import { connection } from 'next/server';
import { route } from '@/lib/server/http';
import { interestCatalog } from '@/lib/server/roadmap/read';
import type { Interest } from '@/lib/types';

/** Public catalog, sorted by category then name. */
export const GET = route(async () => {
  await connection();
  const list: Interest[] = [...(await interestCatalog()).values()];
  return list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
});
