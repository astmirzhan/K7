import type Stripe from 'stripe';
import { env } from '@/lib/server/env';
import { setPlan, stripe, tierFromMetadata } from '@/lib/server/stripe';

// Node.js is the default runtime. Do not export `runtime`/`dynamic`/`revalidate`:
// they are build errors with `cacheComponents: true` (on by default in new Next 16 apps).

const bad = (message: string) =>
  Response.json({ error: { code: 'VALIDATION', message } }, { status: 400 });

export async function POST(req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return bad('Missing Stripe signature');

  const payload = await req.text(); // raw body is required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, env.stripeWebhookSecret);
  } catch {
    return bad('Invalid Stripe signature');
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const tier = tierFromMetadata(session.metadata);
      if (session.client_reference_id && tier && session.status === 'complete') {
        await setPlan(session.client_reference_id, tier);
      }
      break;
    }
    case 'customer.subscription.updated': {
      // events can arrive out of order: only act on clear states
      const sub = event.data.object;
      const userId = sub.metadata?.userId;
      const tier = tierFromMetadata(sub.metadata);
      if (!userId) break;
      if ((sub.status === 'active' || sub.status === 'trialing') && tier) await setPlan(userId, tier);
      if (sub.status === 'canceled' || sub.status === 'unpaid' || sub.status === 'incomplete_expired') {
        await setPlan(userId, 'free');
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const userId = event.data.object.metadata?.userId;
      if (userId) await setPlan(userId, 'free');
      break;
    }
    default:
      break;
  }
  return Response.json({ received: true });
}
