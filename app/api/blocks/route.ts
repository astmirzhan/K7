import { requireUser } from '@/lib/server/auth';
import { fromDbError } from '@/lib/server/errors';
import { parseJson, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { adminClient } from '@/lib/server/supabase';
import { blockSchema } from '@/lib/server/validation';
import type { OkResponse } from '@/lib/types';

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await parseJson(req, blockSchema);
  await requireProfile(user.id);
  const { error } = await adminClient().rpc('block_user', { p_user: user.id, p_target: body.targetUserId });
  if (error) throw fromDbError(error);
  const res: OkResponse = { ok: true };
  return res;
});
