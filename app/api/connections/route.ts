import { requireUser } from '@/lib/server/auth';
import { groupedConnections, loadConnection } from '@/lib/server/connections';
import { AppError, fromDbError } from '@/lib/server/errors';
import { parseJson, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { adminClient } from '@/lib/server/supabase';
import { createConnectionSchema } from '@/lib/server/validation';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  await requireProfile(user.id);
  return groupedConnections(user.id);
});

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const body = await parseJson(req, createConnectionSchema);
  const { data, error } = await adminClient().rpc('request_connection', {
    p_from: user.id,
    p_to: body.toUserId,
    p_interest: body.interestSlug,
  });
  if (error) {
    const e = fromDbError(error);
    if (e.code === 'PLAN_LIMIT') {
      throw new AppError('PLAN_LIMIT', 'Free includes 3 connect requests a month. Starter unlocks unlimited.', {
        requiredPlan: 'starter',
      });
    }
    throw e;
  }
  return loadConnection(user.id, (data as { id: string }).id);
});
