import type { Difficulty, PaidPlan, Plan, PlanLimits } from '../types';

// Keep in sync with plan_max_difficulty / plan_connects_per_month in SQL (a DB test compares them).
export const PLAN_RULES: Record<Plan, Omit<PlanLimits, 'connectsUsedThisMonth'>> = {
  free:    { maxDifficulty: 1, connectsPerMonth: 3,    mapVisible: 10,   aiSteps: false },
  starter: { maxDifficulty: 3, connectsPerMonth: null, mapVisible: null, aiSteps: false },
  pro:     { maxDifficulty: 5, connectsPerMonth: null, mapVisible: null, aiSteps: true },
  crew:    { maxDifficulty: 5, connectsPerMonth: null, mapVisible: null, aiSteps: true },
};

export const PLAN_PRICE_USD: Record<PaidPlan, number> = { starter: 5, pro: 7, crew: 9 };

export const PAID_PLANS: readonly PaidPlan[] = ['starter', 'pro', 'crew'];

export function requiredPlanForDifficulty(d: Difficulty): PaidPlan | null {
  if (d === 1) return null;
  return d === 3 ? 'starter' : 'pro';
}

export function canAccessDifficulty(plan: Plan, d: Difficulty): boolean {
  return d <= PLAN_RULES[plan].maxDifficulty;
}

export function limitsFor(plan: Plan, connectsUsedThisMonth: number): PlanLimits {
  return { ...PLAN_RULES[plan], connectsUsedThisMonth };
}
