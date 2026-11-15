import type { PaidPlan } from './types';

// Only what the product does today: every line here must be findable after paying.
export const PLAN_FEATURES: Record<PaidPlan, string[]> = {
  starter: ['Everyone on the map', 'Unlimited connects', 'Medium level'],
  pro: ['Hard level', 'AI step-by-step plan for every stage', 'AI icebreakers for your buddies', 'Everyone on the map', 'Unlimited connects'],
  crew: ['Everything in Pro', 'Hard level, AI plans and AI icebreakers', 'Back K7 while we build group quests'],
};
