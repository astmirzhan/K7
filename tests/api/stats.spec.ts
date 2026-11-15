import { expect, test } from '@playwright/test';
import type { PublicStats } from '../../lib/types';
import { Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('public stats: no auth, aggregates only, counts a new person', async ({ request }) => {
  const api = new Api(request);
  const before = await api.get<PublicStats>('/api/stats');
  expect(before.status).toBe(200);
  expect(Object.keys(before.body).sort()).toEqual(['cities', 'people', 'states', 'top']);
  expect(before.body.top.length).toBeLessThanOrEqual(5);
  for (const t of before.body.top) expect(Object.keys(t).sort()).toEqual(['count', 'state']);

  await onboardedUser(users, api, { state: 'WY', city: 'Cheyenne' });
  const after = await api.get<PublicStats>('/api/stats');
  expect(after.body.people).toBe(before.body.people + 1);
});
