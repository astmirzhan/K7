import { requireUser } from '@/lib/server/auth';
import { findOrCreateGoal } from '@/lib/server/custom-goals';
import { parseJson, route } from '@/lib/server/http';
import { customInterestSchema } from '@/lib/server/validation';
import type { Interest } from '@/lib/types';

/** A goal typed in onboarding: returns the matching goal or creates a custom one. Signed-in users only. */
export const POST = route(async (req) => {
  await requireUser(req);
  const { name } = await parseJson(req, customInterestSchema);
  const goal: Interest = await findOrCreateGoal(name);
  return goal;
});
