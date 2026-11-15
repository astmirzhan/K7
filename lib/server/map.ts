import 'server-only';
import type {
  AgeRange, Avatar, ConnectionState, Difficulty, MapStateCount, MapUsersResponse, MatchCard, MeetStyle, Plan,
  SharedInterest, UsState,
} from '../types';
import { AppError } from './errors';
import { PLAN_RULES } from './plans';
import { interestCatalog } from './roadmap/read';
import { adminClient } from './supabase';

interface MatchRow {
  user_id: string;
  display_name: string;
  avatar: Avatar;
  state: UsState;
  city: string;
  age_range: AgeRange;
  meet_style: MeetStyle;
  bio: string;
  coins: number;
  score: number;
  shared: Array<{ slug: string; myDifficulty: Difficulty; theirDifficulty: Difficulty }>;
}

interface ConnRow {
  id: string;
  from_id: string;
  to_id: string;
  status: 'pending' | 'accepted';
}

const cityKey = (c: string) => c.trim().toLowerCase();

/** Everyone sharing an interest with me, best first (SQL `match_users`). */
export async function matchUsers(meId: string): Promise<MatchRow[]> {
  const { data, error } = await adminClient().rpc('match_users', { p_me: meId });
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return data as MatchRow[];
}

export async function stateCounts(meId: string): Promise<MapStateCount[]> {
  const [rows, everyone] = await Promise.all([
    matchUsers(meId),
    adminClient().from('profiles').select('id, state').neq('id', meId),
  ]);
  if (everyone.error) throw new AppError('INTERNAL', undefined, { details: everyone.error.message });
  const counts = new Map<UsState, number>();
  for (const r of rows) counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
  const totals = new Map<UsState, number>();
  for (const p of everyone.data as Array<{ state: UsState }>) totals.set(p.state, (totals.get(p.state) ?? 0) + 1);
  return [...totals.keys()]
    .map((state) => ({ state, count: counts.get(state) ?? 0, total: totals.get(state) ?? 0 }))
    .sort((a, b) => b.count - a.count || b.total - a.total || a.state.localeCompare(b.state));
}

async function myConnections(meId: string): Promise<Map<string, { id: string; state: ConnectionState }>> {
  const { data, error } = await adminClient().rpc('list_connections', { p_me: meId });
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const out = new Map<string, { id: string; state: ConnectionState }>();
  for (const c of data as ConnRow[]) {
    const other = c.from_id === meId ? c.to_id : c.from_id;
    const state: ConnectionState =
      c.status === 'accepted' ? 'accepted' : c.from_id === meId ? 'outgoing_pending' : 'incoming_pending';
    out.set(other, { id: c.id, state });
  }
  return out;
}

export async function usersInState(
  me: { id: string; plan: Plan; state: UsState; city: string },
  state: UsState,
): Promise<MapUsersResponse> {
  const [rows, conns, catalog] = await Promise.all([matchUsers(me.id), myConnections(me.id), interestCatalog()]);
  const limit = PLAN_RULES[me.plan].mapVisible;
  const visible = limit === null ? null : new Set(rows.slice(0, limit).map((r) => r.user_id));
  const inState = rows.filter((r) => r.state === state);
  const shown = visible ? inState.filter((r) => visible.has(r.user_id)) : inState;
  const myCity = cityKey(me.city);

  const items: MatchCard[] = shown.map((r) => {
    const shared: SharedInterest[] = r.shared.map((s) => {
      const i = catalog.get(s.slug);
      return {
        slug: s.slug,
        name: i?.name ?? s.slug,
        icon: i?.icon ?? '⭐',
        myDifficulty: s.myDifficulty,
        theirDifficulty: s.theirDifficulty,
      };
    });
    const conn = conns.get(r.user_id);
    return {
      user: {
        userId: r.user_id,
        displayName: r.display_name,
        avatar: r.avatar,
        state: r.state,
        city: r.city,
        ageRange: r.age_range,
        meetStyle: r.meet_style,
        bio: r.bio,
        coins: r.coins,
      },
      sharedInterests: shared,
      score: r.score,
      sameCity: r.state === me.state && cityKey(r.city) === myCity,
      connection: conn ?? { id: null, state: 'none' },
    };
  });

  return { items, hiddenCount: inState.length - shown.length };
}
