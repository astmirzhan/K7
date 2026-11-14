import 'server-only';
import type { Meetup } from '../types';
import { AppError } from './errors';
import { adminClient } from './supabase';

interface MeetupDb {
  id: string;
  connection_id: string;
  proposed_by: string;
  interest_slug: string;
  starts_at: string;
  place: string;
  status: Meetup['status'];
}

interface ConnDb {
  id: string;
  from_id: string;
  to_id: string;
  status: 'pending' | 'accepted' | 'declined';
}

const MEETUP_COLS = 'id, connection_id, proposed_by, interest_slug, starts_at, place, status';

export function toMeetup(m: MeetupDb): Meetup {
  return {
    id: m.id,
    connectionId: m.connection_id,
    proposedBy: m.proposed_by,
    interestSlug: m.interest_slug,
    startsAt: m.starts_at,
    place: m.place,
    status: m.status,
  };
}

/** Ids of every connection (any status) I am a party to. */
async function myConnectionIds(meId: string): Promise<string[]> {
  const { data, error } = await adminClient()
    .from('connections')
    .select('id')
    .or(`from_id.eq.${meId},to_id.eq.${meId}`);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return (data as Array<{ id: string }>).map((r) => r.id);
}

/** Upcoming first, then past ones (most recent first). */
export async function listMeetups(meId: string): Promise<Meetup[]> {
  const ids = await myConnectionIds(meId);
  if (ids.length === 0) return [];
  const { data, error } = await adminClient().from('meetups').select(MEETUP_COLS).in('connection_id', ids);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const now = Date.now();
  const rows = (data as MeetupDb[]).map(toMeetup);
  const upcoming = rows.filter((m) => Date.parse(m.startsAt) >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = rows.filter((m) => Date.parse(m.startsAt) < now).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return [...upcoming, ...past];
}

/** The connection must be accepted, include me and not be blocked. Returns the other party's id. */
async function requireAcceptedConnection(meId: string, connectionId: string): Promise<{ otherId: string }> {
  const db = adminClient();
  const { data, error } = await db.from('connections').select('id, from_id, to_id, status').eq('id', connectionId).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const c = data as ConnDb | null;
  if (!c || (c.from_id !== meId && c.to_id !== meId)) throw new AppError('NOT_FOUND');
  if (c.status !== 'accepted') throw new AppError('INVALID_STATE', 'Meetups need an accepted connection.');
  const otherId = c.from_id === meId ? c.to_id : c.from_id;
  const blocked = await db.rpc('is_blocked', { a: meId, b: otherId });
  if (blocked.error) throw new AppError('INTERNAL', undefined, { details: blocked.error.message });
  if (blocked.data === true) throw new AppError('NOT_FOUND');
  return { otherId };
}

export async function createMeetup(
  meId: string,
  input: { connectionId: string; startsAt: string; place: string; interestSlug: string },
): Promise<Meetup> {
  await requireAcceptedConnection(meId, input.connectionId);
  const { data, error } = await adminClient()
    .from('meetups')
    .insert({
      connection_id: input.connectionId,
      proposed_by: meId,
      interest_slug: input.interestSlug,
      starts_at: input.startsAt,
      place: input.place,
    })
    .select(MEETUP_COLS)
    .single();
  if (error) {
    if (error.code === '23503') throw new AppError('VALIDATION', 'Unknown interest');
    if (error.code === '23514') throw new AppError('VALIDATION', error.message);
    throw new AppError('INTERNAL', undefined, { details: error.message });
  }
  return toMeetup(data as MeetupDb);
}

/**
 * confirmed: only the other party, from proposed.
 * cancelled: either party, from proposed / confirmed.
 * done: either party, from confirmed.
 */
export async function updateMeetup(
  meId: string,
  meetupId: string,
  status: 'confirmed' | 'cancelled' | 'done',
): Promise<Meetup> {
  const db = adminClient();
  const { data, error } = await db.from('meetups').select(MEETUP_COLS).eq('id', meetupId).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const m = data as MeetupDb | null;
  if (!m) throw new AppError('NOT_FOUND');
  await requireAcceptedConnection(meId, m.connection_id);

  const allowed =
    (status === 'confirmed' && m.status === 'proposed' && m.proposed_by !== meId) ||
    (status === 'cancelled' && (m.status === 'proposed' || m.status === 'confirmed')) ||
    (status === 'done' && m.status === 'confirmed');
  if (!allowed) throw new AppError('INVALID_STATE');

  const upd = await db
    .from('meetups')
    .update({ status })
    .eq('id', meetupId)
    .eq('status', m.status)
    .select(MEETUP_COLS)
    .maybeSingle();
  if (upd.error) throw new AppError('INTERNAL', undefined, { details: upd.error.message });
  if (!upd.data) throw new AppError('INVALID_STATE');
  return toMeetup(upd.data as MeetupDb);
}
