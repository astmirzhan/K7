import { requireUser } from '@/lib/server/auth';
import { loadFeed } from '@/lib/server/feed';
import { parseQuery, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { feedQuerySchema } from '@/lib/server/validation';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const { scope } = parseQuery(req, feedQuerySchema);
  await requireProfile(user.id);
  return loadFeed(user.id, scope, 30);
});
