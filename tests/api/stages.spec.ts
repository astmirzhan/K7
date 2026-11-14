import { expect, test } from '@playwright/test';
import type { ApiError, CompleteStageResponse, Me } from '../../lib/types';
import { Api, level, onboardedUser, roadmap, uploadPhoto, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('solo stage completes and pays 1 coin; next stage activates', async ({ request }) => {
  const api = new Api(request);
  const u = await onboardedUser(users, api);
  const easy = level(await roadmap(api, u.token), 1);
  const first = easy.stages[0]!;
  expect(first.kind).toBe('solo');

  const r = await api.post<CompleteStageResponse>(`/api/stages/${first.id}/complete`, {}, u.token);
  expect(r.status).toBe(200);
  expect(r.body.stage.status).toBe('done');
  expect(r.body.coinsAwarded).toBe(1);
  expect(r.body.coins).toBe(1);
  expect(r.body.levelCompleted).toBe(false);
  expect(r.body.nextStageId).toBe(easy.stages[1]!.id);

  const after = level(await roadmap(api, u.token), 1);
  expect(after.stages[1]).toMatchObject({ kind: 'connect', status: 'active' });
  expect(after.progress).toEqual({ done: 1, total: 3 });

  const me = await api.get<Me>('/api/me', u.token);
  expect(me.body.onboarded && me.body.coins).toBe(1);

  const again = await api.post<ApiError>(`/api/stages/${first.id}/complete`, {}, u.token);
  expect(again.status).toBe(409);
  expect(again.body.error.code).toBe('STAGE_NOT_ACTIVE');
});

test('locked stage → 409; connect stage by hand → 422 CONNECT_REQUIRED', async ({ request }) => {
  const api = new Api(request);
  const u = await onboardedUser(users, api);
  const easy = level(await roadmap(api, u.token), 1);

  const locked = await api.post<ApiError>(`/api/stages/${easy.stages[2]!.id}/complete`, {}, u.token);
  expect(locked.status).toBe(409);
  expect(locked.body.error.code).toBe('STAGE_NOT_ACTIVE');

  await api.post(`/api/stages/${easy.stages[0]!.id}/complete`, {}, u.token);
  const connect = await api.post<ApiError>(`/api/stages/${easy.stages[1]!.id}/complete`, {}, u.token);
  expect(connect.status).toBe(422);
  expect(connect.body.error.code).toBe('CONNECT_REQUIRED');
});

test('Medium on Free → 402 with requiredPlan starter (complete and upload-url)', async ({ request }) => {
  const api = new Api(request);
  const u = await onboardedUser(users, api);
  const medium = level(await roadmap(api, u.token), 3);
  const first = medium.stages[0]!;
  expect(first.status).toBe('active');

  const complete = await api.post<ApiError>(`/api/stages/${first.id}/complete`, {}, u.token);
  expect(complete.status).toBe(402);
  expect(complete.body.error).toMatchObject({ code: 'PLAN_LIMIT', requiredPlan: 'starter' });

  const upload = await api.post<ApiError>(`/api/stages/${first.id}/upload-url`, {}, u.token);
  expect(upload.status).toBe(402);
  expect(upload.body.error.requiredPlan).toBe('starter');

  const hard = level(await roadmap(api, u.token), 5);
  const hardRes = await api.post<ApiError>(`/api/stages/${hard.stages[0]!.id}/complete`, {}, u.token);
  expect(hardRes.status).toBe(402);
  expect(hardRes.body.error.requiredPlan).toBe('pro');
});

test('upload-url → uploadToSignedUrl → complete with photo: photoUrl present, +2 coins', async ({ request }) => {
  const api = new Api(request);
  const u = await onboardedUser(users, api);
  const first = level(await roadmap(api, u.token), 1).stages[0]!;

  const photoPath = await uploadPhoto(api, u.token, first.id);
  expect(photoPath.startsWith(`${u.id}/${first.id}/`)).toBe(true);

  const r = await api.post<CompleteStageResponse>(
    `/api/stages/${first.id}/complete`,
    { photoPath, caption: 'First run!', visibility: 'public' },
    u.token,
  );
  expect(r.status).toBe(200);
  expect(r.body.coinsAwarded).toBe(3);
  expect(r.body.coins).toBe(3);
  expect(r.body.stage.report?.photoUrl).toMatch(/^https?:\/\//);
  expect(r.body.stage.report?.caption).toBe('First run!');
});

test('foreign or missing photoPath → 400; upload-url on a locked or foreign stage fails', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);
  const aFirst = level(await roadmap(api, a.token), 1).stages[0]!;
  const bFirst = level(await roadmap(api, b.token), 1).stages[0]!;

  const bPhoto = await uploadPhoto(api, b.token, bFirst.id);
  const foreign = await api.post<ApiError>(`/api/stages/${aFirst.id}/complete`, { photoPath: bPhoto }, a.token);
  expect(foreign.status).toBe(400);
  expect(foreign.body.error.code).toBe('VALIDATION');

  const missing = await api.post<ApiError>(
    `/api/stages/${aFirst.id}/complete`,
    { photoPath: `${a.id}/${aFirst.id}/00000000-0000-0000-0000-000000000000.jpg` },
    a.token,
  );
  expect(missing.status).toBe(400);

  const notMine = await api.post<ApiError>(`/api/stages/${bFirst.id}/upload-url`, {}, a.token);
  expect(notMine.status).toBe(404);

  const locked = await api.post<ApiError>(`/api/stages/${level(await roadmap(api, a.token), 1).stages[2]!.id}/upload-url`, {}, a.token);
  expect(locked.status).toBe(409);
});

test('coop stage without a photo → 422; without partner → 422', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);
  const aEasy = level(await roadmap(api, a.token), 1);

  // reach the coop stage: solo done, connect auto-done after accept
  await api.post(`/api/stages/${aEasy.stages[0]!.id}/complete`, {}, a.token);
  const conn = await api.post<{ id: string }>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  expect(conn.status).toBe(200);
  expect((await api.patch(`/api/connections/${conn.body.id}`, { status: 'accepted' }, b.token)).status).toBe(200);

  const coop = level(await roadmap(api, a.token), 1).stages[2]!;
  expect(coop).toMatchObject({ kind: 'coop', status: 'active', requiresPhoto: true });

  const noPartner = await api.post<ApiError>(`/api/stages/${coop.id}/complete`, {}, a.token);
  expect(noPartner.status).toBe(422);
  expect(noPartner.body.error.code).toBe('PARTNER_REQUIRED');

  const noPhoto = await api.post<ApiError>(`/api/stages/${coop.id}/complete`, { partnerId: b.id }, a.token);
  expect(noPhoto.status).toBe(422);
  expect(noPhoto.body.error.code).toBe('PHOTO_REQUIRED');
});
