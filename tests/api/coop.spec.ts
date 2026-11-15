import { expect, test } from '@playwright/test';
import type { ApiError, CompleteStageResponse, Connection, FeedItem, Me } from '../../lib/types';
import { Api, level, onboardedUser, roadmap, uploadPhoto, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('co-op as tagging: one photo tagging a buddy closes the stage for both, coins for both, feed shows it', async ({ request }) => {
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
  // tagging: A posts one photo and tags B, the co-op stage closes for both right away
  const post = await api.post<CompleteStageResponse>(
    `/api/stages/${aCoop.id}/complete`,
    { photoPath: aPhoto, partnerId: b.id, caption: 'Together' },
    a.token,
  );
  expect(post.status).toBe(200);
  expect(post.body.waitingForPartner).toBe(false);
  expect(post.body.levelCompleted).toBe(true);
  expect(post.body.stage.status).toBe('done');
  expect(post.body.stage.partner?.userId).toBe(b.id);
  expect(post.body.coinsAwarded).toBe(4); // 2 photo + 1 stage + 1 coop bonus

  // B's co-op stage is already done; posting again is refused
  const again = await api.post<ApiError>(`/api/stages/${bCoop.id}/complete`, { partnerId: a.id }, b.token);
  expect(again.status).toBe(409);
  expect(again.body.error.code).toBe('STAGE_NOT_ACTIVE');

  // A: 1 + 1 + 2 photo + 1 + 1 = 6, B (tagged, no own photo): 1 + 1 + 1 + 1 = 4
  for (const [u, coins] of [[a, 6], [b, 4]] as const) {
    const me = await api.get<Me>('/api/me', u.token);
    expect(me.body.onboarded && me.body.coins).toBe(coins);
    const easy = level(await roadmap(api, u.token), 1);
    expect(easy.progress).toEqual({ done: 3, total: 3 });
    expect(easy.stages[2]!.status).toBe('done');
  }

  // the feed shows the photo "with <partner>"
  const feed = await api.get<FeedItem[]>('/api/feed?scope=public', b.token);
  expect(feed.status).toBe(200);
  const aItem = feed.body.find((i) => i.author.userId === a.id && i.kind === 'coop');
  expect(aItem?.partner?.userId).toBe(b.id);
  expect(aItem?.photoUrl).toMatch(/^https?:\/\//);
  expect(aItem?.caption).toBe('Together');

  const mine = await api.get<FeedItem[]>('/api/feed?scope=mine', a.token);
  expect(mine.body.every((i) => i.author.userId === a.id)).toBe(true);
  expect(mine.body).toHaveLength(1);
});

test('co-op partner must be an accepted buddy', async ({ request }) => {
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
