// UI labels and copy built from API data. Pure functions: safe in client and server code.
import { PLAN_PRICE_USD } from './server/plans';
import type { AgeRange, Difficulty, MeetStyle, NearbyCount, PaidPlan, Plan, StageStatus } from './types';
import type { PaywallReason } from './paywall';
import { STATE_NAMES } from './us';

export const DIFFICULTY_LABEL: Record<Difficulty, 'Easy' | 'Medium' | 'Hard'> = { 1: 'Easy', 3: 'Medium', 5: 'Hard' };
export const PLAN_LABEL: Record<Plan, string> = { free: 'Free', starter: 'Starter', pro: 'Pro', crew: 'Crew' };
export const MEET_STYLE_LABEL: Record<MeetStyle, string> = { solo: 'Solo', couple: 'Couple', family: 'Family-friendly' };
export const AGE_RANGES: readonly AgeRange[] = ['25-29', '30-34', '35-39', '40-45'];
export const STATUS_LABEL: Record<StageStatus, string> = {
  locked: 'Locked', active: 'Up next', waiting_partner: 'Waiting for partner', done: 'Done',
};

export const planPrice = (plan: PaidPlan): string => `$${PLAN_PRICE_USD[plan]}/mo`;

/** "12 people in Texas also want to start running" / "Be the first in Texas to start running" */
export function nearbyLine(n: NearbyCount): string {
  const state = STATE_NAMES[n.state];
  const interest = n.interestName.toLowerCase();
  if (n.people === 0) return `Be the first in ${state} to start ${interest}`;
  if (n.people === 1) return `1 person in ${state} also wants to start ${interest}`;
  return `${n.people} people in ${state} also want to start ${interest}`;
}

export function paywallCopy(reason: PaywallReason, plan: PaidPlan, context?: string): { title: string; cta: string } {
  const cta = `Get ${PLAN_LABEL[plan]} — ${planPrice(plan)}`;
  switch (reason) {
    case 'level':
      return { title: context ? `Unlock ${plan === 'starter' ? 'Medium' : 'Hard'}: ${context}` : 'Unlock this level', cta };
    case 'map':
      return { title: context ?? 'See everyone near you', cta };
    case 'connects':
      return { title: 'You used your 3 free connects this month', cta };
    case 'steps':
      return { title: 'Step-by-step plan for every stage', cta };
    default:
      return { title: 'Upgrade to continue', cta };
  }
}

/** <input type="datetime-local"> value (local time) -> ISO string accepted by the API. */
export function localInputToIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error('Pick a date and time');
  return d.toISOString();
}
