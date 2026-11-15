import 'server-only';
import type {
  Avatar, Difficulty, Interest, Level, Plan, Stage, StageKind, StageStatus, UserMini, Visibility,
} from '../../types';
import { AppError } from '../errors';
import { canAccessDifficulty, PLAN_RULES, requiredPlanForDifficulty } from '../plans';
import { signPhotos } from '../storage';
import { adminClient } from '../supabase';

interface StageDb {
  id: string; interest_slug: string; difficulty: Difficulty; idx: number; kind: StageKind;
  title: string; description: string; minutes: number; steps: string[]; requires_photo: boolean;
  status: StageStatus; coins: number; source: 'template' | 'ai'; partner_id: string | null;
}
interface ReportDb {
  stage_id: string; photo_path: string | null; caption: string; visibility: Visibility; created_at: string;
}

const STAGE_COLS =
  'id, interest_slug, difficulty, idx, kind, title, description, minutes, steps, requires_photo, status, coins, source, partner_id';

// All goals, curated and user-typed. Cached briefly: custom goals typed on another instance appear within a minute.
const CATALOG_TTL_MS = 60_000;
let catalog: { at: number; all: Map<string, Interest>; curated: Set<string> } | null = null;

async function loadCatalog() {
  if (catalog && Date.now() - catalog.at < CATALOG_TTL_MS) return catalog;
  const { data, error } = await adminClient().from('interests').select('slug, name, icon, category, custom').order('name');
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = data as Array<Interest & { custom: boolean }>;
  catalog = {
    at: Date.now(),
    all: new Map(rows.map((r) => [r.slug, { slug: r.slug, name: r.name, icon: r.icon, category: r.category }])),
    curated: new Set(rows.filter((r) => !r.custom).map((r) => r.slug)),
  };
  return catalog;
}

export async function interestCatalog(): Promise<Map<string, Interest>> {
  return (await loadCatalog()).all;
}

/** The 30 suggested goals shown in the picker (no user-typed ones). */
export async function curatedInterests(): Promise<Interest[]> {
  const c = await loadCatalog();
  return [...c.all.values()].filter((i) => c.curated.has(i.slug));
}

export function invalidateCatalog(): void {
  catalog = null;
}

export async function getPlan(userId: string): Promise<Plan> {
  const { data, error } = await adminClient().from('profiles').select('plan').eq('id', userId).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  if (!data) throw new AppError('NOT_ONBOARDED');
  return data.plan as Plan;
}

async function toStages(userId: string, rows: StageDb[], plan: Plan): Promise<Stage[]> {
  const db = adminClient();
  const ids = rows.map((r) => r.id);
  const partnerIds = [...new Set(rows.map((r) => r.partner_id).filter((x): x is string => !!x))];
  const [reportsRes, partnersRes] = await Promise.all([
    ids.length
      ? db.from('stage_reports').select('stage_id, photo_path, caption, visibility, created_at').eq('user_id', userId).in('stage_id', ids)
      : Promise.resolve({ data: [], error: null }),
    partnerIds.length
      ? db.from('public_profiles').select('id, display_name, avatar').in('id', partnerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (reportsRes.error || partnersRes.error) {
    throw new AppError('INTERNAL', undefined, { details: (reportsRes.error ?? partnersRes.error)?.message });
  }
  const reports = new Map((reportsRes.data as ReportDb[]).map((r) => [r.stage_id, r]));
  const partners = new Map(
    (partnersRes.data as Array<{ id: string; display_name: string; avatar: Avatar }>).map((p): [string, UserMini] => [
      p.id, { userId: p.id, displayName: p.display_name, avatar: p.avatar },
    ]),
  );
  const urls = await signPhotos([...reports.values()].map((r) => r.photo_path ?? ''));
  const aiSteps = PLAN_RULES[plan].aiSteps;

  return rows.map((r) => {
    const rep = reports.get(r.id);
    return {
      id: r.id,
      interestSlug: r.interest_slug,
      difficulty: r.difficulty,
      idx: r.idx,
      kind: r.kind,
      title: r.title,
      description: r.description,
      minutes: r.minutes,
      requiresPhoto: r.requires_photo,
      status: r.status,
      coins: r.coins,
      steps: aiSteps ? r.steps : null,
      stepsLocked: !aiSteps && r.steps.length > 0,
      source: r.source,
      partner: r.partner_id ? partners.get(r.partner_id) ?? null : null,
      report: rep
        ? {
            photoUrl: rep.photo_path ? urls.get(rep.photo_path) ?? null : null,
            caption: rep.caption,
            visibility: rep.visibility,
            createdAt: rep.created_at,
          }
        : null,
    };
  });
}

/** Levels in Easy -> Medium -> Hard order. */
export async function loadLevels(userId: string, plan: Plan): Promise<Level[]> {
  const { data, error } = await adminClient()
    .from('roadmap_stages').select(STAGE_COLS).eq('user_id', userId)
    .order('difficulty', { ascending: true }).order('idx', { ascending: true });
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = data as StageDb[];
  const [stages, interests] = await Promise.all([toStages(userId, rows, plan), interestCatalog()]);

  const bySlug = new Map<string, Stage[]>();
  for (const s of stages) bySlug.set(s.interestSlug, [...(bySlug.get(s.interestSlug) ?? []), s]);

  return [...bySlug.entries()].map(([slug, list]) => {
    const difficulty = list[0]!.difficulty;
    const locked = !canAccessDifficulty(plan, difficulty);
    return {
      interest: interests.get(slug) ?? { slug, name: slug, icon: '⭐', category: 'social' },
      difficulty,
      lockedByPlan: locked,
      requiredPlan: locked ? requiredPlanForDifficulty(difficulty) : null,
      progress: { done: list.filter((s) => s.status === 'done').length, total: list.length },
      stages: list,
    };
  });
}

export async function loadStage(userId: string, stageId: string, plan: Plan): Promise<Stage> {
  const { data, error } = await adminClient()
    .from('roadmap_stages').select(STAGE_COLS).eq('user_id', userId).eq('id', stageId);
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const rows = data as StageDb[];
  if (rows.length === 0) throw new AppError('NOT_FOUND');
  return (await toStages(userId, rows, plan))[0]!;
}
