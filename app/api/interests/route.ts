import { connection } from 'next/server';
import { route } from '@/lib/server/http';
import { curatedInterests } from '@/lib/server/roadmap/read';
import type { Interest } from '@/lib/types';

/** Public catalog of suggested goals (user-typed goals are not listed), sorted by category then name. */
export const GET = route(async () => {
  await connection();
  const list: Interest[] = await curatedInterests();
  return list.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
});
