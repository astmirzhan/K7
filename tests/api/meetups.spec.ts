import { expect, test } from '@playwright/test';
import type { ApiError, Connection, Meetup } from '../../lib/types';
import { Api, onboardedUser, Users } from './helpers';

const users = new Users();
test.afterAll(() => users.cleanup());

const inAWeek = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

test('create only on accepted; confirm by proposer → 409; other confirms; cancel; done flow', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);

  const req = await api.post<Connection>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  const body = { connectionId: req.body.id, startsAt: inAWeek(), place: 'Zilker Park, main entrance', interestSlug: 'running' };

  const pending = await api.post<ApiError>('/api/meetups', body, a.token);
  expect(pending.status).toBe(409);
  expect(pending.body.error.code).toBe('INVALID_STATE');

  await api.patch(`/api/connections/${req.body.id}`, { status: 'accepted' }, b.token);

  const created = await api.post<Meetup>('/api/meetups', body, a.token);
  expect(created.status).toBe(200);
  expect(created.body).toMatchObject({ status: 'proposed', proposedBy: a.id, connectionId: req.body.id, place: body.place });

  const byProposer = await api.patch<ApiError>(`/api/meetups/${created.body.id}`, { status: 'confirmed' }, a.token);
  expect(byProposer.status).toBe(409);
  expect(byProposer.body.error.code).toBe('INVALID_STATE');

  const doneEarly = await api.patch<ApiError>(`/api/meetups/${created.body.id}`, { status: 'done' }, b.token);
  expect(doneEarly.status).toBe(409);

  const confirmed = await api.patch<Meetup>(`/api/meetups/${created.body.id}`, { status: 'confirmed' }, b.token);
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.status).toBe('confirmed');

  const listA = await api.get<Meetup[]>('/api/meetups', a.token);
  expect(listA.body.map((m) => m.id)).toEqual([created.body.id]);
  const listB = await api.get<Meetup[]>('/api/meetups', b.token);
  expect(listB.body).toHaveLength(1);

  const done = await api.patch<Meetup>(`/api/meetups/${created.body.id}`, { status: 'done' }, a.token);
  expect(done.body.status).toBe('done');
  const cancelAfterDone = await api.patch<ApiError>(`/api/meetups/${created.body.id}`, { status: 'cancelled' }, a.token);
  expect(cancelAfterDone.status).toBe(409);

  const second = await api.post<Meetup>('/api/meetups', { ...body, place: 'Central Library lobby' }, b.token);
  const cancelled = await api.patch<Meetup>(`/api/meetups/${second.body.id}`, { status: 'cancelled' }, a.token);
  expect(cancelled.body.status).toBe('cancelled');
});

test('validation: past time, short place, unknown connection; strangers cannot see or touch it', async ({ request }) => {
  const api = new Api(request);
  const a = await onboardedUser(users, api);
  const b = await onboardedUser(users, api);
  const stranger = await onboardedUser(users, api);
  const req = await api.post<Connection>('/api/connections', { toUserId: b.id, interestSlug: 'running' }, a.token);
  await api.patch(`/api/connections/${req.body.id}`, { status: 'accepted' }, b.token);

  const past = await api.post<ApiError>(
    '/api/meetups',
    { connectionId: req.body.id, startsAt: '2020-01-01T10:00:00Z', place: 'Somewhere public', interestSlug: 'running' },
    a.token,
  );
  expect(past.status).toBe(400);

  const short = await api.post<ApiError>(
    '/api/meetups',
    { connectionId: req.body.id, startsAt: inAWeek(), place: 'x', interestSlug: 'running' },
    a.token,
  );
  expect(short.status).toBe(400);

  const unknown = await api.post<ApiError>(
    '/api/meetups',
    { connectionId: crypto.randomUUID(), startsAt: inAWeek(), place: 'Somewhere public', interestSlug: 'running' },
    a.token,
  );
  expect(unknown.status).toBe(404);

  const notParty = await api.post<ApiError>(
    '/api/meetups',
    { connectionId: req.body.id, startsAt: inAWeek(), place: 'Somewhere public', interestSlug: 'running' },
    stranger.token,
  );
  expect(notParty.status).toBe(404);

  const ok = await api.post<Meetup>(
    '/api/meetups',
    { connectionId: req.body.id, startsAt: inAWeek(), place: 'Somewhere public', interestSlug: 'running' },
    a.token,
  );
  const touch = await api.patch<ApiError>(`/api/meetups/${ok.body.id}`, { status: 'confirmed' }, stranger.token);
  expect(touch.status).toBe(404);
  expect((await api.get<Meetup[]>('/api/meetups', stranger.token)).body).toHaveLength(0);

  // blocking cancels the meetup
  await api.post('/api/blocks', { targetUserId: a.id }, b.token);
  const after = await api.get<Meetup[]>('/api/meetups', a.token);
  expect(after.body.find((m) => m.id === ok.body.id)?.status).toBe('cancelled');
});
