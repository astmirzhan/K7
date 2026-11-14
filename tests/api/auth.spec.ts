import { expect, test } from '@playwright/test';
import { Api, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

const PROTECTED: Array<['get' | 'post' | 'patch', string]> = [
  ['get', '/api/me'],
  ['post', '/api/onboarding'],
  ['get', '/api/roadmap'],
  ['post', '/api/stages/00000000-0000-0000-0000-000000000001/upload-url'],
  ['post', '/api/stages/00000000-0000-0000-0000-000000000001/complete'],
  ['get', '/api/map/states'],
  ['get', '/api/map/users?state=TX'],
  ['get', '/api/connections'],
  ['post', '/api/connections'],
  ['patch', '/api/connections/00000000-0000-0000-0000-000000000001'],
  ['get', '/api/meetups'],
  ['post', '/api/meetups'],
  ['patch', '/api/meetups/00000000-0000-0000-0000-000000000001'],
  ['get', '/api/feed'],
  ['post', '/api/reports'],
  ['post', '/api/blocks'],
  ['post', '/api/stripe/checkout'],
  ['post', '/api/stripe/confirm'],
];

test('every protected route returns 401 without a token', async ({ request }) => {
  const api = new Api(request);
  for (const [method, path] of PROTECTED) {
    const r = method === 'get' ? await api.get(path) : method === 'post' ? await api.post(path, {}) : await api.patch(path, {});
    expect(r.status, `${method.toUpperCase()} ${path}`).toBe(401);
    expect((r.body as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
  }
});

test('a garbage bearer token is rejected', async ({ request }) => {
  const r = await new Api(request).get('/api/me', 'not-a-jwt');
  expect(r.status).toBe(401);
});

test('before onboarding: /me says onboarded:false, data routes say NOT_ONBOARDED', async ({ request }) => {
  const api = new Api(request);
  const u = await users.create();

  const me = await api.get<{ onboarded: boolean; id: string; email: string }>('/api/me', u.token);
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({ onboarded: false, id: u.id, email: u.email });

  const DATA: Array<['get' | 'post' | 'patch', string, unknown]> = [
    ['get', '/api/roadmap', null],
    ['get', '/api/map/states', null],
    ['get', '/api/map/users?state=TX', null],
    ['get', '/api/connections', null],
    ['post', '/api/connections', { toUserId: u.id, interestSlug: 'running' }],
    ['get', '/api/meetups', null],
    ['get', '/api/feed', null],
    ['post', '/api/reports', { targetUserId: u.id }],
    ['post', '/api/blocks', { targetUserId: u.id }],
    ['post', '/api/stripe/checkout', { tier: 'starter' }],
  ];
  for (const [method, path, body] of DATA) {
    const r = method === 'get' ? await api.get(path, u.token) : method === 'post' ? await api.post(path, body, u.token) : await api.patch(path, body, u.token);
    expect(r.status, `${method.toUpperCase()} ${path}`).toBe(409);
    expect((r.body as { error: { code: string } }).error.code).toBe('NOT_ONBOARDED');
  }
});

test('public routes work without auth', async ({ request }) => {
  const api = new Api(request);
  const health = await api.get<{ ok: boolean; interests: number }>('/api/health');
  expect(health.status).toBe(200);
  expect(health.body).toEqual({ ok: true, interests: 30 });

  const interests = await api.get<Array<{ slug: string; category: string; name: string }>>('/api/interests');
  expect(interests.status).toBe(200);
  expect(interests.body).toHaveLength(30);
  const keys = interests.body.map((i) => `${i.category}|${i.name}`);
  expect(keys).toEqual([...keys].sort());
});
