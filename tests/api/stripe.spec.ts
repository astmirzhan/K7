import { expect, test } from '@playwright/test';
import Stripe from 'stripe';
import type { ApiError, CheckoutResponse, Me } from '../../lib/types';
import { Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

function signed(payload: object): { body: string; signature: string } {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET missing in .env.local');
  const body = JSON.stringify(payload);
  return { body, signature: Stripe.webhooks.generateTestHeaderString({ payload: body, secret }) };
}

function event(type: string, object: object) {
  return {
    id: `evt_${crypto.randomUUID().replaceAll('-', '')}`,
    object: 'event',
    api_version: '2025-01-27.acacia',
    created: Math.floor(Date.now() / 1000),
    type,
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: { object },
  };
}

async function plan(api: Api, token: string): Promise<string> {
  const me = await api.get<Me>('/api/me', token);
  return me.body.onboarded ? me.body.plan : 'none';
}

test('webhook: checkout.session.completed sets the plan, subscription.deleted resets it, bad signature → 400', async ({ request }) => {
  test.skip(!process.env.STRIPE_WEBHOOK_SECRET, 'needs STRIPE_WEBHOOK_SECRET');
  const api = new Api(request);
  const u = await onboardedUser(users, api);
  expect(await plan(api, u.token)).toBe('free');

  const completed = signed(
    event('checkout.session.completed', {
      id: 'cs_test_fake',
      object: 'checkout.session',
      status: 'complete',
      client_reference_id: u.id,
      metadata: { userId: u.id, tier: 'pro' },
    }),
  );
  const ok = await request.post('/api/stripe/webhook', {
    data: completed.body,
    headers: { 'stripe-signature': completed.signature, 'content-type': 'application/json' },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toEqual({ received: true });
  expect(await plan(api, u.token)).toBe('pro');

  const updated = signed(
    event('customer.subscription.updated', {
      id: 'sub_test_fake',
      object: 'subscription',
      status: 'active',
      metadata: { userId: u.id, tier: 'starter' },
    }),
  );
  await request.post('/api/stripe/webhook', {
    data: updated.body,
    headers: { 'stripe-signature': updated.signature, 'content-type': 'application/json' },
  });
  expect(await plan(api, u.token)).toBe('starter');

  const deleted = signed(
    event('customer.subscription.deleted', {
      id: 'sub_test_fake',
      object: 'subscription',
      status: 'canceled',
      metadata: { userId: u.id, tier: 'starter' },
    }),
  );
  await request.post('/api/stripe/webhook', {
    data: deleted.body,
    headers: { 'stripe-signature': deleted.signature, 'content-type': 'application/json' },
  });
  expect(await plan(api, u.token)).toBe('free');

  const bad = await request.post('/api/stripe/webhook', {
    data: completed.body,
    headers: { 'stripe-signature': 't=1,v1=deadbeef', 'content-type': 'application/json' },
  });
  expect(bad.status()).toBe(400);
  const none = await request.post('/api/stripe/webhook', { data: completed.body });
  expect(none.status()).toBe(400);
  expect(await plan(api, u.token)).toBe('free');
});

test('checkout returns a Stripe Checkout URL; bad tier → 400; confirm rejects foreign / unknown sessions', async ({ request }) => {
  test.skip(!process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'), 'needs a Stripe test key');
  const api = new Api(request);
  const u = await onboardedUser(users, api);

  const r = await api.post<CheckoutResponse>('/api/stripe/checkout', { tier: 'starter' }, u.token);
  expect(r.status).toBe(200);
  expect(r.body.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);

  // second checkout reuses the same Stripe customer (no error, still a URL)
  const again = await api.post<CheckoutResponse>('/api/stripe/checkout', { tier: 'pro' }, u.token);
  expect(again.status).toBe(200);

  const bad = await api.post<ApiError>('/api/stripe/checkout', { tier: 'gold' }, u.token);
  expect(bad.status).toBe(400);

  const unknown = await api.post<ApiError>('/api/stripe/confirm', { sessionId: 'cs_test_doesnotexist000' }, u.token);
  expect(unknown.status).toBe(404);

  const badId = await api.post<ApiError>('/api/stripe/confirm', { sessionId: 'nope' }, u.token);
  expect(badId.status).toBe(400);

  // an unpaid session of another user: extract the id from the checkout URL is not possible, so
  // create one directly and confirm it as someone else → 403
  const other = await onboardedUser(users, api);
  const session = new URL(r.body.url).pathname.split('/').pop() ?? '';
  const sessionId = session.startsWith('cs_') ? session.split('#')[0]! : '';
  if (sessionId) {
    const foreign = await api.post<ApiError>('/api/stripe/confirm', { sessionId }, other.token);
    expect(foreign.status).toBe(403);
    const unpaid = await api.post<ApiError>('/api/stripe/confirm', { sessionId }, u.token);
    expect(unpaid.status).toBe(409);
    expect(unpaid.body.error.code).toBe('PAYMENT_NOT_COMPLETE');
  }
});
