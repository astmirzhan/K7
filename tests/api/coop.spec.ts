import { expect, test } from '@playwright/test';
import type { CompleteStageResponse, Connection, FeedItem, Me } from '../../lib/types';
import { Api, level, onboardedUser, roadmap, uploadPhoto, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('two users connect, both complete co-op with photos: waiting → done, ×2 coins, feed reveal', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);

  // GP-2: stage 1 for both
  for (const u of [a, b]) {
    const first = level(await roadmap(api, u.token), 1).stages[0]!;
    expect((await api.post(`/api/stages/${first.id}/complete`, {}, u.token)).status).toBe(200);
  }

  // GP-4: connect and accept → both "Find a buddy" stages complete themselves (+1)
  const req = await api.post<Connection>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  expect(req.status).toBe(200);
  expect(req.body).toMatchObject({ status: 'pending', direction: 'outgoing', socialUrl: null });
  const acc = await api.patch<Connection>(`/api/connections/${req.body.id}`, { status: 'accepted' }, b.token);
  expect(acc.status).toBe(200);
  expect(acc.body).toMatchObject({ status: 'accepted', direction: 'incoming', socialUrl: 'https://instagram.com/test.ninja' });

  for (const u of [a, b]) {
    const easy = level(await roadmap(api, u.token), 1);
    expect(easy.stages[1]).toMatchObject({ kind: 'connect', status: 'done' });
    expect(easy.stages[2]).toMatchObject({ kind: 'coop', status: 'active' });
    const me = await api.get<Me>('/api/me', u.token);
    expect(me.body.onboarded && me.body.coins).toBe(2);
  }

  // GP-5: co-op
  const aCoop = level(await roadmap(api, a.token), 1).stages[2]!;
  const bCoop = level(await roadmap(api, b.token), 1).stages[2]!;
  const aPhoto = await uploadPhoto(api, a.token, aCoop.id);
  const first = await api.post<CompleteStageResponse>(
    `/api/stages/${aCoop.id}/complete`,
    { photoPath: aPhoto, partnerId: b.id, caption: 'Together' },
    a.token,
  );
  expect(first.status).toBe(200);
  expect(first.body.waitingForPartner).toBe(true);
  expect(first.body.stage.status).toBe('waiting_partner');
  expect(first.body.stage.partner?.userId).toBe(b.id);
  expect(first.body.coinsAwarded).toBe(2); // photo bonus only, stage coins wait for the partner

  // the co-op photo is hidden from the feed until both are done
  const feedBefore = await api.get<FeedItem[]>('/api/feed', b.token);
  expect(feedBefore.body.some((i) => i.author.userId === a.id)).toBe(false);

  const bPhoto = await uploadPhoto(api, b.token, bCoop.id);
  const second = await api.post<CompleteStageResponse>(
    `/api/stages/${bCoop.id}/complete`,
    { photoPath: bPhoto, partnerId: a.id },
    b.token,
  );
  expect(second.status).toBe(200);
  expect(second.body.waitingForPartner).toBe(false);
  expect(second.body.levelCompleted).toBe(true);
  expect(second.body.stage.status).toBe('done');
  expect(second.body.coinsAwarded).toBe(4); // 2 photo + 1 stage + 1 coop bonus

  // both: 1 (solo) + 1 (connect) + 2 (photo) + 1 (stage) + 1 (coop bonus) = 6
  for (const u of [a, b]) {
    const me = await api.get<Me>('/api/me', u.token);
    expect(me.body.onboarded && me.body.coins).toBe(6);
    const easy = level(await roadmap(api, u.token), 1);
    expect(easy.progress).toEqual({ done: 3, total: 3 });
    expect(easy.stages[2]!.status).toBe('done');
  }

  // feed shows both photos "with <partner>"
  const feed = await api.get<FeedItem[]>('/api/feed?scope=public', a.token);
  expect(feed.status).toBe(200);
  const aItem = feed.body.find((i) => i.author.userId === a.id && i.kind === 'coop');
  const bItem = feed.body.find((i) => i.author.userId === b.id && i.kind === 'coop');
  expect(aItem?.partner?.userId).toBe(b.id);
  expect(bItem?.partner?.userId).toBe(a.id);
  expect(aItem?.photoUrl).toMatch(/^https?:\/\//);
  expect(aItem?.caption).toBe('Together');

  const mine = await api.get<FeedItem[]>('/api/feed?scope=mine', a.token);
  expect(mine.body.every((i) => i.author.userId === a.id)).toBe(true);
  expect(mine.body).toHaveLength(1);
});

test('co-op partner must be an accepted connection sharing the interest', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);
  const stranger = await onboardedUser(users, api);

  await api.post(`/api/stages/${level(await roadmap(api, a.token), 1).stages[0]!.id}/complete`, {}, a.token);
  const req = await api.post<Connection>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  await api.patch(`/api/connections/${req.body.id}`, { status: 'accepted' }, b.token);

  const coop = level(await roadmap(api, a.token), 1).stages[2]!;
  const photo = await uploadPhoto(api, a.token, coop.id);
  const r = await api.post<{ error: { code: string } }>(
    `/api/stages/${coop.id}/complete`,
    { photoPath: photo, partnerId: stranger.id },
    a.token,
  );
  expect(r.status).toBe(422);
  expect(r.body.error.code).toBe('PARTNER_INVALID');
});
