import { expect, test } from '@playwright/test';
import type { Connection, Me } from '../../lib/types';
import { admin, Api, level, onboardingBody, publicClient, PASSWORD, roadmap, Users } from './helpers';

const users = new Users();
let demoId: string | null = null;
test.afterAll(async () => {
  await users.cleanup();
  if (demoId) await admin().auth.admin.deleteUser(demoId);
});

test('a request to a demo person is accepted at once and completes "Find a buddy"; a real person still has to accept', async ({ request }) => {
  const api = new Api(request);
  const me = await users.create();
  expect((await api.post('/api/onboarding', onboardingBody(), me.token)).status).toBe(200);
  const first = level(await roadmap(api, me.token), 1).stages[0]!;
  expect((await api.post(`/api/stages/${first.id}/complete`, {}, me.token)).status).toBe(200);

  // a demo person, named like the seed
  const email = `k7.seed.e2e-${crypto.randomUUID().slice(0, 6)}@example.com`;
  const created = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  demoId = created.data.user!.id;
  const demoToken = (await publicClient().auth.signInWithPassword({ email, password: PASSWORD })).data.session!.access_token;
  expect((await api.post('/api/onboarding', onboardingBody(), demoToken)).status).toBe(200);

  const res = await api.post<Connection>('/api/connections', { toUserId: demoId, interestSlug: 'running' }, me.token);
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('accepted');
  expect(res.body.socialUrl).not.toBeNull();
  expect(level(await roadmap(api, me.token), 1).stages[1]).toMatchObject({ kind: 'connect', status: 'done' });
  const after = await api.get<Me>('/api/me', me.token);
  expect(after.body.onboarded && after.body.coins).toBe(2);

  // a real person: stays pending
  const other = await users.create();
  expect((await api.post('/api/onboarding', onboardingBody(), other.token)).status).toBe(200);
  const pending = await api.post<Connection>('/api/connections', { toUserId: other.id, interestSlug: 'running' }, me.token);
  expect(pending.body.status).toBe('pending');
});
