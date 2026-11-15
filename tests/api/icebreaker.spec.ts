import { expect, test } from '@playwright/test';
import type { ApiError, Connection, IcebreakerResponse } from '../../lib/types';
import { admin, Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('icebreaker: Free → 402 pro, Pro buddy → 3 lines, stranger → 404, pending → 409', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);
  const c = await onboardedUser(users, api);

  const req = await api.post<Connection>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  expect(req.status).toBe(200);
  const path = `/api/connections/${req.body.id}/icebreaker`;

  // Free plan
  const free = await api.post<ApiError>(path, {}, a.token);
  expect(free.status).toBe(402);
  expect(free.body.error.requiredPlan).toBe('pro');

  await admin().from('profiles').update({ plan: 'pro' }).in('id', [a.id, c.id]);

  // still pending
  expect((await api.post<ApiError>(path, {}, a.token)).status).toBe(409);

  expect((await api.patch(`/api/connections/${req.body.id}`, { status: 'accepted' }, b.token)).status).toBe(200);
  const ok = await api.post<IcebreakerResponse>(path, {}, a.token);
  expect(ok.status).toBe(200);
  expect(ok.body.lines).toHaveLength(3);
  expect(ok.body.source).toBe('template'); // API tests run without model keys

  // not a party
  expect((await api.post<ApiError>(path, {}, c.token)).status).toBe(404);
});
