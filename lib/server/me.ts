import 'server-only';
import type { AgeRange, Avatar, Difficulty, Me, MeetStyle, NearbyCount, Plan, Stage, UsState } from '../types';
import type { AuthUser } from './auth';
import { AppError } from './errors';
import { limitsFor, PLAN_RULES } from './plans';
import { interestCatalog, loadStage } from './roadmap/read';
import { adminClient } from './supabase';

interface ProfileDb {
  id: string;
  display_name: string;
  avatar: Avatar;
  state: UsState;
  city: string;
  age_range: AgeRange;
  meet_style: MeetStyle;
  social_url: string;
  bio: string;
  plan: Plan;
  coins: number;
}

const PROFILE_COLS = 'id, display_name, avatar, state, city, age_range, meet_style, social_url, bio, plan, coins';

/** Own profile row (full columns are fine: it is the caller's row). Null = not onboarded. */
export async function loadOwnProfile(userId: string): Promise<ProfileDb | null> {
  const { data, error } = await adminClient().from('profiles').select(PROFILE_COLS).eq('id', userId).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return (data as ProfileDb | null) ?? null;
}

export async function requireProfile(userId: string): Promise<ProfileDb> {
  const p = await loadOwnProfile(userId);
  if (!p) throw new AppError('NOT_ONBOARDED');
  return p;
}

function monthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
}

async function connectsUsedThisMonth(userId: string): Promise<number> {
  const { count, error } = await adminClient()
    .from('connections')
    .select('id', { count: 'exact', head: true })
    .eq('from_id', userId)
    .gte('created_at', monthStart());
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return count ?? 0;
}

async function pendingIncoming(userId: string): Promise<number> {
  const { data, error } = await adminClient().rpc('list_connections', { p_me: userId });
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = data as Array<{ to_id: string; status: string }>;
  return rows.filter((r) => r.status === 'pending' && r.to_id === userId).length;
}

async function nearby(userId: string, state: UsState): Promise<NearbyCount[]> {
  const [{ data, error }, catalog] = await Promise.all([
    adminClient().rpc('nearby_counts', { p_me: userId }),
    interestCatalog(),
  ]);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return (data as Array<{ interest_slug: string; people: number }>).map((r) => ({
    interestSlug: r.interest_slug,
    interestName: catalog.get(r.interest_slug)?.name ?? r.interest_slug,
    state,
    people: r.people,
  }));
}

/** Active stage with the smallest `minutes` among the levels the plan allows; ties: lower difficulty, then idx. */
async function questOfDay(userId: string, plan: Plan): Promise<Stage | null> {
  const { data, error } = await adminClient()
    .from('roadmap_stages')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .lte('difficulty', PLAN_RULES[plan].maxDifficulty)
    .order('minutes', { ascending: true })
    .order('difficulty', { ascending: true })
    .order('idx', { ascending: true })
    .limit(1);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const id = (data as Array<{ id: string }>)[0]?.id;
  return id ? loadStage(userId, id, plan) : null;
}

async function interestsOf(userId: string) {
  const [{ data, error }, catalog] = await Promise.all([
    adminClient().from('user_interests').select('interest_slug, difficulty').eq('user_id', userId).order('difficulty'),
    interestCatalog(),
  ]);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  return (data as Array<{ interest_slug: string; difficulty: Difficulty }>).map((r) => ({
    interest: catalog.get(r.interest_slug) ?? { slug: r.interest_slug, name: r.interest_slug, icon: '⭐', category: 'social' as const },
    difficulty: r.difficulty,
  }));
}

export async function buildMe(user: AuthUser): Promise<Me> {
  const p = await loadOwnProfile(user.id);
  if (!p) return { onboarded: false, id: user.id, email: user.email };

  const [interests, used, near, quest, pending] = await Promise.all([
    interestsOf(user.id),
    connectsUsedThisMonth(user.id),
    nearby(user.id, p.state),
    questOfDay(user.id, p.plan),
    pendingIncoming(user.id),
  ]);

  return {
    onboarded: true,
    id: p.id,
    email: user.email,
    displayName: p.display_name,
    avatar: p.avatar,
    state: p.state,
    city: p.city,
    ageRange: p.age_range,
    meetStyle: p.meet_style,
    socialUrl: p.social_url,
    bio: p.bio,
    plan: p.plan,
    coins: p.coins,
    interests,
    limits: limitsFor(p.plan, used),
    nearby: near,
    questOfDay: quest,
    pendingIncoming: pending,
  };
}
