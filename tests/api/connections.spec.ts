import { expect, test } from '@playwright/test';
import type { ApiError, Connection, ConnectionsResponse, Me } from '../../lib/types';
import { Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('4th request on Free → 402 starter; lists group correctly; used count on /me', async ({ request }) => {
  const api = new Api(request);
  const me = await onboardedUser(users, api, { state: 'ND' });
  const targets = [];
  for (let i = 0; i < 4; i++) targets.push(await onboardedUser(users, api, { state: 'ND' }));

  for (let i = 0; i < 3; i++) {
    const r = await api.post<Connection>('/api/connections', { toUserId: targets[i]!.id, interestSlug: 'running' }, me.token);
    expect(r.status, `request ${i + 1}`).toBe(200);
  }
  const fourth = await api.post<ApiError>('/api/connections', { toUserId: targets[3]!.id, interestSlug: 'running' }, me.token);
  expect(fourth.status).toBe(402);
  expect(fourth.body.error).toMatchObject({ code: 'PLAN_LIMIT', requiredPlan: 'starter' });

  const meRes = await api.get<Me>('/api/me', me.token);
  expect(meRes.body.onboarded && meRes.body.limits.connectsUsedThisMonth).toBe(3);

  const mine = await api.get<ConnectionsResponse>('/api/connections', me.token);
  expect(mine.body.outgoing).toHaveLength(3);
  expect(mine.body.incoming).toHaveLength(0);
  expect(mine.body.accepted).toHaveLength(0);

  const theirs = await api.get<ConnectionsResponse>('/api/connections', targets[0]!.token);
  expect(theirs.body.incoming).toHaveLength(1);
  expect(theirs.body.incoming[0]!.other.userId).toBe(me.id);
  const theirMe = await api.get<Me>('/api/me', targets[0]!.token);
  expect(theirMe.body.onboarded && theirMe.body.pendingIncoming).toBe(1);
});

test('accept by sender → 403; socialUrl only after accept; duplicates → 409', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api, { socialUrl: 'https://x.com/ninja_a' });
  const b = await onboardedUser(users, api, { socialUrl: 'https://linkedin.com/in/ninja-b' });

  const req = await api.post<Connection>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  expect(req.status).toBe(200);
  expect(req.body.socialUrl).toBeNull();

  const bySender = await api.patch<ApiError>(`/api/connections/${req.body.id}`, { status: 'accepted' }, a.token);
  expect(bySender.status).toBe(403);

  const dup = await api.post<ApiError>('/api/connections', { toUserId: a.id, interestSlug: 'running' }, b.token);
  expect(dup.status).toBe(409);
  expect(dup.body.error.code).toBe('ALREADY_CONNECTED');

  const pendingList = await api.get<ConnectionsResponse>('/api/connections', b.token);
  expect(pendingList.body.incoming[0]!.socialUrl).toBeNull();

  const acc = await api.patch<Connection>(`/api/connections/${req.body.id}`, { status: 'accepted' }, b.token);
  expect(acc.status).toBe(200);
  expect(acc.body.socialUrl).toBe('https://x.com/ninja_a');

  const aList = await api.get<ConnectionsResponse>('/api/connections', a.token);
  expect(aList.body.accepted[0]!.socialUrl).toBe('https://linkedin.com/in/ninja-b');
  expect([...aList.body.accepted[0]!.sharedInterests].sort()).toEqual(['guitar', 'running', 'spanish']);

  const twice = await api.patch<ApiError>(`/api/connections/${req.body.id}`, { status: 'declined' }, b.token);
  expect(twice.status).toBe(409);
  expect(twice.body.error.code).toBe('INVALID_STATE');
});

test('request about a goal the sender does not have → 422; unknown user → 404; self → 400', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api, {
    interests: [{ slug: 'yoga', difficulty: 1 }, { slug: 'french', difficulty: 3 }, { slug: 'piano', difficulty: 5 }],
  });

  const none = await api.post<ApiError>('/api/connections', { toUserId: b.id, interestSlug: 'yoga' }, a.token); // yoga is not a's goal
  expect(none.status).toBe(422);
  expect(none.body.error.code).toBe('NO_SHARED_INTEREST');

  const ghost = await api.post<ApiError>('/api/connections', { toUserId: crypto.randomUUID(), interestSlug: 'running' }, a.token);
  expect(ghost.status).toBe(404);

  const self = await api.post<ApiError>('/api/connections', { toUserId: a.id, interestSlug: 'running' }, a.token);
  expect(self.status).toBe(400);

  const stranger = await api.patch<ApiError>(`/api/connections/${crypto.randomUUID()}`, { status: 'accepted' }, a.token);
  expect(stranger.status).toBe(404);
});
