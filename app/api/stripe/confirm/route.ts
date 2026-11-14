import { requireUser } from '@/lib/server/auth';
import { AppError } from '@/lib/server/errors';
import { parseJson, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { setPlan, stripe, tierFromMetadata } from '@/lib/server/stripe';
import { confirmCheckoutSchema } from '@/lib/server/validation';
import type { ConfirmCheckoutResponse } from '@/lib/types';

/** Called by /billing/success so the demo does not depend on webhook latency. */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { sessionId } = await parseJson(req, confirmCheckoutSchema);
  await requireProfile(user.id);

  const session = await stripe().checkout.sessions.retrieve(sessionId).catch(() => null);
  if (!session) throw new AppError('NOT_FOUND', 'Checkout session not found');
  if (session.client_reference_id !== user.id) throw new AppError('FORBIDDEN');
  if (session.status !== 'complete') throw new AppError('PAYMENT_NOT_COMPLETE');
  const tier = tierFromMetadata(session.metadata);
  if (!tier) throw new AppError('INTERNAL', undefined, { details: 'checkout session has no tier' });

  await setPlan(user.id, tier);
  const res: ConfirmCheckoutResponse = { plan: tier };
  return res;
});
