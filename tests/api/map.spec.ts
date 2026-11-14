import { expect, test } from '@playwright/test';
import type { MapStateCount, MapUsersResponse } from '../../lib/types';
import { admin, Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

// A state nobody in the seed uses, so counts here are fully under the test's control.
const STATE = 'WY';
const CITY = 'Cheyenne';

test('Free sees at most 10 people overall plus hiddenCount; Starter sees everyone', async ({ request }) => {
  test.setTimeout(240_000);
  const api = new Api(request);
  const me = await onboardedUser(users, api, { state: STATE, city: CITY });

  // 12 candidates in WY sharing running (and other interests) with me
  const others = [];
  for (let i = 0; i < 12; i++) {
    others.push(
      await onboardedUser(users, api, {
        state: STATE,
        city: i % 2 === 0 ? CITY : 'Laramie',
        interests: [
          { slug: 'running', difficulty: 1 },
          { slug: i % 3 === 0 ? 'spanish' : 'yoga', difficulty: 3 },
          { slug: 'chess', difficulty: 5 },
        ],
      }),
    );
  }

  const states = await api.get<MapStateCount[]>('/api/map/states', me.token);
  expect(states.status).toBe(200);
  const wy = states.body.find((s) => s.state === STATE);
  expect(wy?.count).toBe(12); // full numbers on every plan
  expect(states.body.map((s) => s.count)).toEqual([...states.body.map((s) => s.count)].sort((a, b) => b - a));

  const free = await api.get<MapUsersResponse>(`/api/map/users?state=${STATE}`, me.token);
  expect(free.status).toBe(200);
  expect(free.body.items.length).toBeLessThanOrEqual(10);
  expect(free.body.items.length + free.body.hiddenCount).toBe(12);
  expect(free.body.hiddenCount).toBeGreaterThan(0);

  const card = free.body.items[0]!;
  expect(card.sharedInterests.some((s) => s.slug === 'running' && s.myDifficulty === 1 && s.theirDifficulty === 1)).toBe(true);
  expect(card.connection).toEqual({ id: null, state: 'none' });
  expect(card.user.city).toBeTruthy();
  expect(JSON.stringify(card)).not.toContain('instagram.com');
  // same-city people score higher, so they come first
  expect(card.sameCity).toBe(true);
  const scores = free.body.items.map((c) => c.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));

  const bad = await api.get<{ error: { code: string } }>('/api/map/users?state=ZZ', me.token);
  expect(bad.status).toBe(400);
  expect(bad.body.error.code).toBe('VALIDATION');

  // upgrade directly in the DB (what the Stripe webhook does) → everyone is visible
  await admin().from('profiles').update({ plan: 'starter' }).eq('id', me.id);
  const starter = await api.get<MapUsersResponse>(`/api/map/users?state=${STATE}`, me.token);
  expect(starter.body.items).toHaveLength(12);
  expect(starter.body.hiddenCount).toBe(0);
});

test('blocked user disappears both ways; declined request hides the pair; report works', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api, { state: 'VT', city: 'Burlington' });
  const b = await onboardedUser(users, api, { state: 'VT', city: 'Burlington' });
  const c = await onboardedUser(users, api, { state: 'VT', city: 'Burlington' });

  const before = await api.get<MapUsersResponse>('/api/map/users?state=VT', a.token);
  expect(before.body.items.map((i) => i.user.userId).sort()).toEqual([b.id, c.id].sort());

  const report = await api.post('/api/reports', { targetUserId: b.id, reason: 'spam' }, a.token);
  expect(report.status).toBe(200);
  const selfReport = await api.post('/api/reports', { targetUserId: a.id }, a.token);
  expect(selfReport.status).toBe(400);

  expect((await api.post('/api/blocks', { targetUserId: b.id }, a.token)).status).toBe(200);
  const afterA = await api.get<MapUsersResponse>('/api/map/users?state=VT', a.token);
  expect(afterA.body.items.map((i) => i.user.userId)).toEqual([c.id]);
  const afterB = await api.get<MapUsersResponse>('/api/map/users?state=VT', b.token);
  expect(afterB.body.items.map((i) => i.user.userId)).toEqual([c.id]);
  const counts = await api.get<MapStateCount[]>('/api/map/states', a.token);
  expect(counts.body.find((s) => s.state === 'VT')?.count).toBe(1);

  // a blocked person cannot send a request
  const blockedReq = await api.post<{ error: { code: string } }>('/api/connections', { toUserId: a.id, interestSlug: 'running' }, b.token);
  expect(blockedReq.status).toBe(404);

  // declined: c asks a, a declines → c disappears from a's map and vice versa
  const req = await api.post<{ id: string }>('/api/connections', { toUserId: a.id, interestSlug: 'running' }, c.token);
  expect(req.status).toBe(200);
  const pendingCard = (await api.get<MapUsersResponse>('/api/map/users?state=VT', a.token)).body.items[0]!;
  expect(pendingCard.connection).toEqual({ id: req.body.id, state: 'incoming_pending' });
  const declined = await api.patch<{ status: string }>(`/api/connections/${req.body.id}`, { status: 'declined' }, a.token);
  expect(declined.status).toBe(200);
  expect(declined.body.status).toBe('declined');
  expect((await api.get<MapUsersResponse>('/api/map/users?state=VT', a.token)).body.items).toHaveLength(0);
  expect((await api.get<MapUsersResponse>('/api/map/users?state=VT', c.token)).body.items).toHaveLength(0);
});
