import 'server-only';
import Stripe from 'stripe';
import type { PaidPlan, Plan } from '../types';
import { env } from './env';
import { adminClient } from './supabase';

let client: Stripe | null = null;
export function stripe(): Stripe {
  client ??= new Stripe(env.stripeSecretKey);
  return client;
}

const PAID: readonly string[] = ['starter', 'pro', 'crew'];
export function tierFromMetadata(meta: Stripe.Metadata | null | undefined): PaidPlan | null {
  const t = meta?.tier;
  return t && PAID.includes(t) ? (t as PaidPlan) : null;
}

export async function setPlan(userId: string, plan: Plan): Promise<void> {
  const { error } = await adminClient().from('profiles').update({ plan }).eq('id', userId);
  if (error) throw new Error(`setPlan failed: ${error.message}`);
}
