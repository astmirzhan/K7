import 'server-only';
import type { Interest } from '../types';
import { AppError } from './errors';
import { normalizeGoalName } from './goal-name';
import { interestCatalog, invalidateCatalog } from './roadmap/read';
import { adminClient } from './supabase';

/**
 * Finds the goal with this name (curated or typed before) or creates a custom one.
 * Matching on the map is by slug, so "Bouldering" and " bouldering " end up as the same goal.
 */
export async function findOrCreateGoal(raw: string): Promise<Interest> {
  const goal = normalizeGoalName(raw);
  if (!goal) throw new AppError('VALIDATION', 'Use letters, numbers and spaces');

  const catalog = await interestCatalog();
  const byName = [...catalog.values()].find((i) => i.name.toLowerCase() === goal.name.toLowerCase());
  const existing = catalog.get(goal.slug) ?? byName;
  if (existing) return existing;

  const row = { slug: goal.slug, name: goal.name, icon: '⭐', category: 'other', custom: true };
  const { error } = await adminClient().from('interests').upsert(row, { onConflict: 'slug', ignoreDuplicates: true });
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  invalidateCatalog();
  const fresh = (await interestCatalog()).get(goal.slug);
  if (!fresh) throw new AppError('INTERNAL', undefined, { details: 'custom goal not found after insert' });
  return fresh;
}
