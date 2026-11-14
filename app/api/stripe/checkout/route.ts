import { requireUser } from '@/lib/server/auth';
import { env } from '@/lib/server/env';
import { AppError } from '@/lib/server/errors';
import { parseJson, route } from '@/lib/server/http';
import { requireProfile } from '@/lib/server/me';
import { stripe } from '@/lib/server/stripe';
import { adminClient } from '@/lib/server/supabase';
import { checkoutSchema } from '@/lib/server/validation';
import type { CheckoutResponse } from '@/lib/types';

async function customerIdFor(userId: string, email: string | null, name: string): Promise<string> {
  const db = adminClient();
  const { data, error } = await db.from('profiles').select('stripe_customer_id').eq('id', userId).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const existing = (data as { stripe_customer_id: string | null } | null)?.stripe_customer_id;
  if (existing) return existing;

  const customer = await stripe().customers.create({ email: email ?? undefined, name, metadata: { userId } });
  const upd = await db.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', userId);
  if (upd.error) throw new AppError('INTERNAL', undefined, { details: upd.error.message });
  return customer.id;
}

export const POST = route(async (req) => {
  const user = await requireUser(req);
  const { tier } = await parseJson(req, checkoutSchema);
  const profile = await requireProfile(user.id);
  const customer = await customerIdFor(user.id, user.email, profile.display_name);

  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price: env.stripePrice(tier), quantity: 1 }],
    metadata: { userId: user.id, tier },
    subscription_data: { metadata: { userId: user.id, tier } },
    success_url: `${env.appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.appUrl}/pricing?canceled=1`,
    allow_promotion_codes: false,
  });
  if (!session.url) throw new AppError('INTERNAL', undefined, { details: 'Stripe returned no checkout URL' });
  const res: CheckoutResponse = { url: session.url };
  return res;
});
