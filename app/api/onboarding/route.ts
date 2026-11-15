import { requireUser } from '@/lib/server/auth';
import { AppError, fromDbError } from '@/lib/server/errors';
import { parseJson, route } from '@/lib/server/http';
import { buildMe } from '@/lib/server/me';
import { buildRoadmapRows } from '@/lib/server/roadmap/generate';
import { interestCatalog, invalidateCatalog, loadLevels } from '@/lib/server/roadmap/read';
import { adminClient } from '@/lib/server/supabase';
import { onboardingSchema } from '@/lib/server/validation';
import type { OnboardingResponse } from '@/lib/types';

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await parseJson(req, onboardingSchema);

  const db = adminClient();
  const { data: existing } = await db.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (existing) throw new AppError('ALREADY_ONBOARDED');

  let catalog = await interestCatalog();
  // a goal typed a moment ago may have been created on another server instance: re-read the catalog once
  if (body.interests.some((i) => !catalog.has(i.slug))) {
    invalidateCatalog();
    catalog = await interestCatalog();
  }
  const unknown = body.interests.filter((i) => !catalog.has(i.slug)).map((i) => i.slug);
  if (unknown.length > 0) {
    throw new AppError('VALIDATION', 'Unknown interest', {
      details: unknown.map((slug) => ({ path: 'interests', message: `Unknown interest "${slug}"` })),
    });
  }

  const picks = body.interests.map((i) => ({ interest: catalog.get(i.slug)!, difficulty: i.difficulty }));
  const stages = await buildRoadmapRows(picks, {
    city: body.profile.city,
    state: body.profile.state,
    meetStyle: body.profile.meetStyle,
  });

  const { error } = await db.rpc('create_onboarding', {
    p_user: user.id,
    p_profile: { ...body.profile, avatar: body.avatar },
    p_interests: body.interests,
    p_stages: stages,
  });
  if (error) throw fromDbError(error);

  const me = await buildMe(user);
  if (!me.onboarded) throw new AppError('INTERNAL');
  const res: OnboardingResponse = { me, roadmap: await loadLevels(user.id, me.plan) };
  return res;
});
