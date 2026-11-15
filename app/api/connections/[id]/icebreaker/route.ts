import { requireUser } from '@/lib/server/auth';
import { loadConnection } from '@/lib/server/connections';
import { AppError } from '@/lib/server/errors';
import { generateIcebreakers } from '@/lib/server/icebreaker';
import { parseWith, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { PLAN_RULES } from '@/lib/server/plans';
import { interestCatalog } from '@/lib/server/roadmap/read';
import { idSchema } from '@/lib/server/validation';
import type { IcebreakerResponse } from '@/lib/types';

/** Pro / Crew: three AI-written first messages for an accepted buddy. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const connectionId = parseWith(idSchema, (await params).id);
  const me = await requireProfile(user.id);
  if (!PLAN_RULES[me.plan].aiSteps) {
    throw new AppError('PLAN_LIMIT', 'AI icebreakers come with Pro.', { requiredPlan: 'pro' });
  }
  const conn = await loadConnection(user.id, connectionId); // NOT_FOUND unless I am a party
  if (conn.status !== 'accepted') throw new AppError('INVALID_STATE', 'Icebreakers open once you are buddies.');

  const catalog = await interestCatalog();
  const slugs = [conn.interestSlug, ...conn.sharedInterests.filter((s) => s !== conn.interestSlug)];
  const interests = slugs.map((s) => catalog.get(s)?.name ?? s);
  const { lines, source } = await generateIcebreakers({
    me: { name: me.display_name, city: me.city },
    other: { name: conn.other.displayName, city: conn.other.city, bio: conn.other.bio },
    interests,
  });
  const res: IcebreakerResponse = { lines, source };
  return res;
});
