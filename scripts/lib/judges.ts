// Judge + demo accounts: deleted and recreated by both `pnpm seed` and `pnpm seed:judges`.
import type { Interest } from '../../lib/types';
import { DEMO_EMAIL, JUDGES, SARAH } from './seed-data';
import {
  admin, createAuthUser, deleteUserByEmail, findUserByEmail, need, onboard, setPlanDirect,
} from './seed-core';

export interface JudgeSummary {
  judge1: string;
  judge2: string;
  demo: string;
  sarahRequestId: string;
}

/** Makes sure Sarah exists (the persona) and returns her id. Used when seed-judges runs alone. */
export async function ensureSarah(catalog: Map<string, Interest>): Promise<string> {
  const existing = await findUserByEmail(SARAH.email);
  if (existing) return existing;
  const id = await createAuthUser(SARAH.email, need('SEED_PASSWORD'));
  await onboard(id, SARAH.profile, SARAH.picks, catalog);
  await setPlanDirect(id, SARAH.plan);
  return id;
}

export async function resetJudges(catalog: Map<string, Interest>, sarahId: string): Promise<JudgeSummary> {
  const password = need('JUDGE_PASSWORD');
  for (const email of [...JUDGES.map((j) => j.email), DEMO_EMAIL]) await deleteUserByEmail(email);

  const ids: string[] = [];
  for (const j of JUDGES) {
    const id = await createAuthUser(j.email, password);
    await onboard(id, j.profile, j.picks, catalog);
    ids.push(id);
  }
  // presenter: auth user only, onboarding happens live in the pitch
  const demo = await createAuthUser(DEMO_EMAIL, password);

  // Sarah → judge1: the "someone wants to meet you" moment
  const { data, error } = await admin().rpc('request_connection', { p_from: sarahId, p_to: ids[0], p_interest: 'running' });
  if (error) throw new Error(`Sarah's request failed: ${error.message}`);

  return { judge1: ids[0]!, judge2: ids[1]!, demo, sarahRequestId: (data as { id: string }).id };
}
