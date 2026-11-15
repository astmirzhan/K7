import { expect, test } from '@playwright/test';
import type { Interest, MapUsersResponse } from '../../lib/types';
import { admin, Api, onboardingBody, Users } from './helpers';

const users = new Users();
const slug = `zz-test-goal-${Math.random().toString(36).slice(2, 7)}`;
test.afterAll(async () => {
  await users.cleanup();
  await admin().from('interests').delete().eq('slug', slug); // after the users (user_interests reference it)
});

test('custom goals: create once, reuse by name, onboard with it, match on the map, hidden from the picker', async ({ request }) => {
  const api = new Api(request);
  const a = await users.create();
  const b = await users.create();
  const name = slug.replace(/-/g, ' ');

  expect((await api.post('/api/interests/custom', { name })).status).toBe(401);
  expect((await api.post('/api/interests/custom', { name: '<b>' }, a.token)).status).toBe(400);

  const curated = await api.post<Interest>('/api/interests/custom', { name: 'running' }, a.token);
  expect(curated.body).toMatchObject({ slug: 'running', category: 'fitness' }); // typed name lands on the curated goal

  const created = await api.post<Interest>('/api/interests/custom', { name }, a.token);
  expect(created.status).toBe(200);
  expect(created.body).toMatchObject({ slug, category: 'other' });
  const again = await api.post<Interest>('/api/interests/custom', { name: `  ${name.toUpperCase()} ` }, b.token);
  expect(again.body.slug).toBe(slug);

  const picker = await api.get<Interest[]>('/api/interests');
  expect(picker.body.some((i) => i.slug === slug)).toBe(false);
  expect(picker.body).toHaveLength(30);

  for (const [u, other] of [[a, 'spanish'], [b, 'guitar']] as const) {
    const body = onboardingBody({ state: 'WY', city: 'Casper', interests: [{ slug, difficulty: 1 }, { slug: other, difficulty: 3 }, { slug: 'chess', difficulty: 5 }] });
    expect((await api.post('/api/onboarding', body, u.token)).status).toBe(200);
  }
  const map = await api.get<MapUsersResponse>('/api/map/users?state=WY', a.token);
  const card = map.body.items.find((c) => c.user.userId === b.id);
  expect(card?.sharedInterests.map((s) => s.slug)).toContain(slug);
});
