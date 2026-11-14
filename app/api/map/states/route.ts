import { requireUser } from '@/lib/server/auth';
import { route } from '@/lib/server/http';
import { stateCounts } from '@/lib/server/map';
import { requireProfile } from '@/lib/server/me';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  await requireProfile(user.id);
  return stateCounts(user.id);
});
