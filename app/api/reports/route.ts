import { requireUser } from '@/lib/server/auth';
import { AppError } from '@/lib/server/errors';
import { parseJson, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { adminClient } from '@/lib/server/supabase';
import { reportSchema } from '@/lib/server/validation';
import type { OkResponse } from '@/lib/types';

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await parseJson(req, reportSchema);
  await requireProfile(user.id);
  if (body.targetUserId === user.id) throw new AppError('VALIDATION', 'You cannot report yourself');

  const db = adminClient();
  const { data: target, error } = await db.from('public_profiles').select('id').eq('id', body.targetUserId).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  if (!target) throw new AppError('NOT_FOUND');

  const ins = await db.from('abuse_reports').insert({
    reporter_id: user.id,
    target_id: body.targetUserId,
    reason: body.reason ?? '',
  });
  if (ins.error) throw new AppError('INTERNAL', undefined, { details: ins.error.message });
  const res: OkResponse = { ok: true };
  return res;
});
