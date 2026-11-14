import 'server-only';
import type { Avatar, Connection, ConnectionsResponse, UsState } from '../types';
import { AppError } from './errors';
import { adminClient } from './supabase';

/** Row from SQL `list_connections(p_me)`. */
export interface ConnectionListRow {
  id: string;
  from_id: string;
  to_id: string;
  interest_slug: string;
  status: 'pending' | 'accepted';
  created_at: string;
  other_id: string;
  other_name: string;
  other_avatar: Avatar;
  other_city: string;
  other_state: UsState;
  other_bio: string;
  social_url: string | null;
}

export function toConnection(meId: string, r: ConnectionListRow, sharedInterests: string[] = []): Connection {
  return {
    id: r.id,
    interestSlug: r.interest_slug,
    status: r.status,
    direction: r.from_id === meId ? 'outgoing' : 'incoming',
    createdAt: r.created_at,
    other: {
      userId: r.other_id,
      displayName: r.other_name,
      avatar: r.other_avatar,
      city: r.other_city,
      state: r.other_state,
      bio: r.other_bio,
    },
    sharedInterests,
    socialUrl: r.status === 'accepted' ? r.social_url : null,
  };
}

/** Interest slugs shared between me and each of `otherIds`: one query for everyone. */
export async function sharedInterestsFor(meId: string, otherIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (otherIds.length === 0) return out;
  const ids = Array.from(new Set([meId, ...otherIds]));
  const { data, error } = await adminClient().from('user_interests').select('user_id, interest_slug').in('user_id', ids);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = data as Array<{ user_id: string; interest_slug: string }>;
  const mine = new Set(rows.filter((r) => r.user_id === meId).map((r) => r.interest_slug));
  for (const r of rows) {
    if (r.user_id === meId || !mine.has(r.interest_slug)) continue;
    out.set(r.user_id, [...(out.get(r.user_id) ?? []), r.interest_slug]);
  }
  return out;
}

async function mapAll(meId: string, rows: ConnectionListRow[]): Promise<Connection[]> {
  const shared = await sharedInterestsFor(meId, rows.map((r) => r.other_id));
  return rows.map((r) => toConnection(meId, r, shared.get(r.other_id) ?? []));
}

export async function listConnections(meId: string): Promise<ConnectionListRow[]> {
  const { data, error } = await adminClient().rpc('list_connections', { p_me: meId });
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return data as ConnectionListRow[];
}

export async function groupedConnections(meId: string): Promise<ConnectionsResponse> {
  const all = await mapAll(meId, await listConnections(meId));
  return {
    incoming: all.filter((c) => c.status === 'pending' && c.direction === 'incoming'),
    outgoing: all.filter((c) => c.status === 'pending' && c.direction === 'outgoing'),
    accepted: all.filter((c) => c.status === 'accepted'),
  };
}

/** One connection by id as seen by me (declined / blocked ones are not listed → NOT_FOUND). */
export async function loadConnection(meId: string, connectionId: string): Promise<Connection> {
  const row = (await listConnections(meId)).find((r) => r.id === connectionId);
  if (!row) throw new AppError('NOT_FOUND');
  return (await mapAll(meId, [row]))[0]!;
}
