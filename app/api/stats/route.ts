import { connection } from 'next/server';
import { route } from '@/lib/server/http';
import { publicStats } from '@/lib/server/stats';

/** Public: how many people are on the map (landing page counter). Aggregates only. */
export const GET = route(async () => {
  await connection();
  return publicStats();
});
