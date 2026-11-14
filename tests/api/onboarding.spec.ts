import { expect, test } from '@playwright/test';
import type { ApiError, Level, Me, OnboardingResponse } from '../../lib/types';
import { Api, onboardingBody, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

test('happy path: 19 stages, 3 active, me.onboarded, template source when AI is off', async ({ request }) => {
  const api = new Api(request);
  const u = await users.create();

  const r = await api.post<OnboardingResponse>('/api/onboarding', onboardingBody(), u.token);
  expect(r.status).toBe(200);
  expect(r.body.me.onboarded).toBe(true);
  expect(r.body.me.plan).toBe('free');
  expect(r.body.me.coins).toBe(0);
  expect(r.body.me.socialUrl).toBe('https://instagram.com/test.ninja');
  expect(r.body.me.interests.map((i) => i.difficulty)).toEqual([1, 3, 5]);
  expect(r.body.me.limits).toMatchObject({ maxDifficulty: 1, connectsPerMonth: 3, connectsUsedThisMonth: 0, mapVisible: 10 });
  expect(r.body.me.nearby).toHaveLength(3);
  expect(r.body.me.questOfDay?.status).toBe('active');
  expect(r.body.me.questOfDay?.difficulty).toBe(1);

  const levels = r.body.roadmap;
  expect(levels.map((l) => l.difficulty)).toEqual([1, 3, 5]);
  const stages = levels.flatMap((l) => l.stages);
  expect(stages).toHaveLength(19);
  expect(stages.filter((s) => s.status === 'active')).toHaveLength(3);
  expect(stages.every((s) => s.source === 'template')).toBe(true);
  expect(stages.every((s) => s.steps === null && s.stepsLocked)).toBe(true);
  expect(levels.find((l) => l.difficulty === 3)).toMatchObject({ lockedByPlan: true, requiredPlan: 'starter' });
  expect(levels.find((l) => l.difficulty === 5)).toMatchObject({ lockedByPlan: true, requiredPlan: 'pro' });
  expect(levels.find((l) => l.difficulty === 1)).toMatchObject({ lockedByPlan: false, requiredPlan: null });

  const me = await api.get<Me>('/api/me', u.token);
  expect(me.status).toBe(200);
  expect(me.body.onboarded).toBe(true);

  const roadmap = await api.get<Level[]>('/api/roadmap', u.token);
  expect(roadmap.status).toBe(200);
  expect(roadmap.body.flatMap((l) => l.stages)).toHaveLength(19);
});

test('duplicate onboarding → 409 ALREADY_ONBOARDED', async ({ request }) => {
  const api = new Api(request);
  const u = await users.create();
  expect((await api.post('/api/onboarding', onboardingBody(), u.token)).status).toBe(200);
  const again = await api.post<ApiError>('/api/onboarding', onboardingBody(), u.token);
  expect(again.status).toBe(409);
  expect(again.body.error.code).toBe('ALREADY_ONBOARDED');
});

test('bad social link, duplicate difficulty and unknown slug → 400 with details', async ({ request }) => {
  const api = new Api(request);
  const u = await users.create();

  const social = await api.post<ApiError>('/api/onboarding', onboardingBody({ socialUrl: 'https://facebook.com/me' }), u.token);
  expect(social.status).toBe(400);
  expect(social.body.error.code).toBe('VALIDATION');
  expect(JSON.stringify(social.body.error.details)).toContain('socialUrl');

  const dup = await api.post<ApiError>(
    '/api/onboarding',
    onboardingBody({ interests: [{ slug: 'running', difficulty: 1 }, { slug: 'spanish', difficulty: 1 }, { slug: 'guitar', difficulty: 5 }] }),
    u.token,
  );
  expect(dup.status).toBe(400);
  expect(dup.body.error.details).toBeTruthy();

  const unknown = await api.post<ApiError>(
    '/api/onboarding',
    onboardingBody({ interests: [{ slug: 'running', difficulty: 1 }, { slug: 'nope', difficulty: 3 }, { slug: 'guitar', difficulty: 5 }] }),
    u.token,
  );
  expect(unknown.status).toBe(400);
  expect(JSON.stringify(unknown.body.error.details)).toContain('nope');

  const me = await api.get<Me>('/api/me', u.token);
  expect(me.body.onboarded).toBe(false);
});

test('invalid JSON body → 400', async ({ request }) => {
  const u = await users.create();
  const res = await request.post('/api/onboarding', {
    headers: { Authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
    data: '{not json',
  });
  expect(res.status()).toBe(400);
});
