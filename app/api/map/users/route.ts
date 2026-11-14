import { requireUser } from '@/lib/server/auth';
import { parseQuery, route } from '@/lib/server/http';
import { usersInState } from '@/lib/server/map';
import { requireProfile } from '@/lib/server/me';
import { mapUsersQuerySchema } from '@/lib/server/validation';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const { state } = parseQuery(req, mapUsersQuerySchema);
  const me = await requireProfile(user.id);
  return usersInState({ id: me.id, plan: me.plan, state: me.state, city: me.city }, state);
});
