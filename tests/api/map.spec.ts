import { expect, test } from '@playwright/test';
import type { MapStateCount, MapUsersResponse } from '../../lib/types';
import { admin, Api, isolatedGoals, onboardedUser, Users } from './helpers';

const users = new Users();
let goals: Awaited<ReturnType<typeof isolatedGoals>>;
test.beforeAll(async () => {
  goals = await isolatedGoals(4); // [shared Easy, Medium a, Medium b, Hard]: no seeded person has them
});
test.afterAll(async () => {
  await users.cleanup();
  await goals.cleanup();
});
const iso = () => goals.slugs;
const isoInterests = () => [
  { slug: iso()[0]!, difficulty: 1 as const },
  { slug: iso()[1]!, difficulty: 3 as const },
  { slug: iso()[3]!, difficulty: 5 as const },
];

// A state nobody in the seed uses, so counts here are fully under the test's control.
const STATE = 'WY';
const CITY = 'Cheyenne';

test('Free sees at most 10 people overall plus hiddenCount; Starter sees everyone', async ({ request }) => {
  test.setTimeout(240_000);
  const api = new Api(request);
  const me = await onboardedUser(users, api, { state: STATE, city: CITY, interests: isoInterests() });
  // open matching lists everyone in the state: count the people already there (seed) first
  const base = (await api.get<MapStateCount[]>('/api/map/states', me.token)).body.find((s) => s.state === STATE)?.count ?? 0;

  // 12 candidates in WY sharing running (and other interests) with me
  const others = [];
  for (let i = 0; i < 12; i++) {
    others.push(
      await onboardedUser(users, api, {
        state: STATE,
        city: i % 2 === 0 ? CITY : 'Laramie',
        interests: [
          { slug: iso()[0]!, difficulty: 1 },
          { slug: i % 3 === 0 ? iso()[1]! : iso()[2]!, difficulty: 3 },
          { slug: iso()[3]!, difficulty: 5 },
        ],
      }),
    );
  }

  const states = await api.get<MapStateCount[]>('/api/map/states', me.token);
  expect(states.status).toBe(200);
  const wy = states.body.find((s) => s.state === STATE);
  expect(wy?.count).toBe(base + 12); // full numbers on every plan
  expect(wy!.total).toBe(base + 12); // everyone in the state
  expect(states.body.map((s) => s.count)).toEqual([...states.body.map((s) => s.count)].sort((a, b) => b - a));

  const free = await api.get<MapUsersResponse>(`/api/map/users?state=${STATE}`, me.token);
  expect(free.status).toBe(200);
  expect(free.body.items.length).toBeLessThanOrEqual(10);
  expect(free.body.items.length + free.body.hiddenCount).toBe(base + 12);
  expect(free.body.hiddenCount).toBeGreaterThan(0);

  const card = free.body.items[0]!;
  expect(card.sharedInterests.some((s) => s.slug === iso()[0] && s.myDifficulty === 1 && s.theirDifficulty === 1)).toBe(true);
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
  expect(starter.body.items).toHaveLength(base + 12);
  // people sharing a goal come before people who do not
  const firstWithout = starter.body.items.findIndex((c) => c.sharedInterests.length === 0);
  if (firstWithout >= 0) expect(starter.body.items.slice(firstWithout).every((c) => c.sharedInterests.length === 0)).toBe(true);
  expect(starter.body.hiddenCount).toBe(0);
});

test('blocked user disappears both ways; declined request hides the pair; report works', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api, { state: 'VT', city: 'Burlington', interests: isoInterests() });
  const b = await onboardedUser(users, api, { state: 'VT', city: 'Burlington', interests: isoInterests() });
  const c = await onboardedUser(users, api, { state: 'VT', city: 'Burlington', interests: isoInterests() });
  const ours = new Set([a.id, b.id, c.id]);
  const seen = async (token: string) =>
    (await api.get<MapUsersResponse>('/api/map/users?state=VT', token)).body.items.filter((i) => ours.has(i.user.userId));
  const vtBase = async (token: string) =>
    ((await api.get<MapStateCount[]>('/api/map/states', token)).body.find((s) => s.state === 'VT')?.count ?? 0);

  expect((await seen(a.token)).map((i) => i.user.userId).sort()).toEqual([b.id, c.id].sort());
  const vtBefore = await vtBase(a.token);

  const report = await api.post('/api/reports', { targetUserId: b.id, reason: 'spam' }, a.token);
  expect(report.status).toBe(200);
  const selfReport = await api.post('/api/reports', { targetUserId: a.id }, a.token);
  expect(selfReport.status).toBe(400);

  expect((await api.post('/api/blocks', { targetUserId: b.id }, a.token)).status).toBe(200);
  expect((await seen(a.token)).map((i) => i.user.userId)).toEqual([c.id]);
  expect((await seen(b.token)).map((i) => i.user.userId)).toEqual([c.id]);
  expect(await vtBase(a.token)).toBe(vtBefore - 1); // b is gone from a's counts

  // a blocked person cannot send a request
  const blockedReq = await api.post<{ error: { code: string } }>('/api/connections', { toUserId: a.id, interestSlug: iso()[0] }, b.token);
  expect(blockedReq.status).toBe(404);

  // declined: c asks a, a declines → c disappears from a's map and vice versa
  const req = await api.post<{ id: string }>('/api/connections', { toUserId: a.id, interestSlug: iso()[0] }, c.token);
  expect(req.status).toBe(200);
  const pendingCard = (await seen(a.token))[0]!;
  expect(pendingCard.connection).toEqual({ id: req.body.id, state: 'incoming_pending' });
  const declined = await api.patch<{ status: string }>(`/api/connections/${req.body.id}`, { status: 'declined' }, a.token);
  expect(declined.status).toBe(200);
  expect(declined.body.status).toBe('declined');
  expect(await seen(a.token)).toHaveLength(0);
  // c no longer sees a, but still sees b (c never blocked or declined b)
  expect((await seen(c.token)).map((i) => i.user.userId)).toEqual([b.id]);
});
