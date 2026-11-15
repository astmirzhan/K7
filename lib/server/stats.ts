import 'server-only';
import type { PublicStats, UsState } from '../types';
import { AppError } from './errors';
import { adminClient } from './supabase';

/** Aggregates for the landing page: counts only, never names, ids or cities by person. */
export async function publicStats(): Promise<PublicStats> {
  const { data, error } = await adminClient().from('profiles').select('state, city');
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = (data ?? []) as Array<{ state: UsState; city: string }>;
  const byState = new Map<UsState, number>();
  const cities = new Set<string>();
  for (const r of rows) {
    byState.set(r.state, (byState.get(r.state) ?? 0) + 1);
    cities.add(`${r.state}:${r.city.trim().toLowerCase()}`);
  }
  const top = [...byState.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count || a.state.localeCompare(b.state))
    .slice(0, 5);
  return { people: rows.length, states: byState.size, cities: cities.size, top };
}
