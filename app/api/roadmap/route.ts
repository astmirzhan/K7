import { requireUser } from '@/lib/server/auth';
import { route } from '@/lib/server/http';
import { getPlan, loadLevels } from '@/lib/server/roadmap/read';
import type { Level } from '@/lib/types';

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const levels: Level[] = await loadLevels(user.id, await getPlan(user.id));
  return levels;
});
