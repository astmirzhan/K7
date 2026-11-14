import 'server-only';

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

// Read lazily so `next build` works without secrets.
export const env = {
  get supabaseUrl() { return need('NEXT_PUBLIC_SUPABASE_URL'); },
  get supabasePublishableKey() { return need('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'); },
  get supabaseSecretKey() { return need('SUPABASE_SECRET_KEY'); },
  get appUrl() { return need('NEXT_PUBLIC_APP_URL').replace(/\/+$/, ''); },
  get stripeSecretKey() { return need('STRIPE_SECRET_KEY'); },
  get stripeWebhookSecret() { return need('STRIPE_WEBHOOK_SECRET'); },
  stripePrice(tier: 'starter' | 'pro' | 'crew') { return need(`STRIPE_PRICE_${tier.toUpperCase()}`); },
};
