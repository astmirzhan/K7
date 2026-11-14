// Shared pieces of the seed scripts: admin client, user creation, onboarding through the same
// code the API uses (template roadmaps), stage completion through SQL, placeholder photos.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { toStageRows, type StageRow } from '../../lib/server/roadmap/skeleton';
import { templateDrafts } from '../../lib/server/roadmap/templates';
import type { Avatar, Difficulty, Interest, InterestCategory, MeetStyle, UsState } from '../../lib/types';

export function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

let adminRef: SupabaseClient | null = null;
export function admin(): SupabaseClient {
  adminRef ??= createClient(need('NEXT_PUBLIC_SUPABASE_URL'), need('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminRef;
}

export const PHOTO_BUCKET = 'stage-photos';

export interface SeedProfile {
  displayName: string;
  avatar: Avatar;
  state: UsState;
  city: string;
  ageRange: '25-29' | '30-34' | '35-39' | '40-45';
  meetStyle: MeetStyle;
  socialUrl: string;
  bio: string;
}

export interface SeedPick {
  slug: string;
  difficulty: Difficulty;
}

/** Deterministic pseudo-random generator so every `pnpm seed` builds the same world. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export async function findUserByEmail(email: string): Promise<string | null> {
  let page = 1;
  for (;;) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
    page += 1;
  }
}

/** Deletes the auth user (profiles cascade) and the user's Storage folder. Safe to call when absent. */
export async function deleteUserByEmail(email: string): Promise<void> {
  const id = await findUserByEmail(email);
  if (!id) return;
  await deleteStorageFolder(id);
  const { error } = await admin().auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteUser ${email} failed: ${error.message}`);
}

async function deleteStorageFolder(userId: string): Promise<void> {
  const storage = admin().storage.from(PHOTO_BUCKET);
  const { data: stages } = await storage.list(userId, { limit: 1000 });
  const files: string[] = [];
  for (const s of stages ?? []) {
    const { data: inner } = await storage.list(`${userId}/${s.name}`, { limit: 1000 });
    for (const f of inner ?? []) files.push(`${userId}/${s.name}/${f.name}`);
  }
  if (files.length) await storage.remove(files);
}

export async function createAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser ${email} failed: ${error?.message}`);
  return data.user.id;
}

/** Same path as POST /api/onboarding, with template roadmaps (deterministic and fast). */
export async function onboard(userId: string, profile: SeedProfile, picks: SeedPick[], catalog: Map<string, Interest>) {
  const stages: StageRow[] = picks.flatMap((p) => {
    const interest = catalog.get(p.slug);
    if (!interest) throw new Error(`unknown interest ${p.slug}`);
    return toStageRows(p.slug, p.difficulty, templateDrafts(p.difficulty, interest.name), 'template');
  });
  const { error } = await admin().rpc('create_onboarding', {
    p_user: userId,
    p_profile: profile,
    p_interests: picks,
    p_stages: stages,
  });
  if (error) throw new Error(`create_onboarding ${profile.displayName} failed: ${error.message} ${error.details ?? ''}`);
}

export async function loadCatalog(): Promise<Map<string, Interest>> {
  const { data, error } = await admin().from('interests').select('slug, name, icon, category');
  if (error) throw new Error(`interests failed: ${error.message}`);
  return new Map((data as Interest[]).map((i) => [i.slug, i]));
}

export async function setPlanDirect(userId: string, plan: 'free' | 'starter' | 'pro' | 'crew') {
  const { error } = await admin().from('profiles').update({ plan }).eq('id', userId);
  if (error) throw new Error(`setPlan failed: ${error.message}`);
}

export interface StageLite {
  id: string;
  interest_slug: string;
  difficulty: Difficulty;
  idx: number;
  kind: 'solo' | 'connect' | 'coop';
  status: string;
}

export async function stagesOf(userId: string): Promise<StageLite[]> {
  const { data, error } = await admin()
    .from('roadmap_stages')
    .select('id, interest_slug, difficulty, idx, kind, status')
    .eq('user_id', userId)
    .order('difficulty')
    .order('idx');
  if (error) throw new Error(`stages failed: ${error.message}`);
  return data as StageLite[];
}

/** Goes through complete_stage like the API does (never writes status / coins directly). */
export async function completeStage(
  userId: string,
  stageId: string,
  opts: { photoPath?: string; caption?: string; partnerId?: string } = {},
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const { data, error } = await admin().rpc('complete_stage', {
    p_user: userId,
    p_stage_id: stageId,
    p_photo_path: opts.photoPath ?? null,
    p_caption: opts.caption ?? null,
    p_visibility: 'public',
    p_partner_id: opts.partnerId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: (data as { status: string }).status };
}

// ---------- Photos ----------
const PHOTO_DIR = path.join(process.cwd(), 'supabase', 'seed', 'photos');
const generated = new Map<string, Buffer>();

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** 1080×1350 pixel-art style placeholder: sky, ground, the interest name. */
export async function placeholderJpeg(interestName: string, category: InterestCategory, variant: number): Promise<Buffer> {
  const key = `${category}-${variant}-${interestName}`;
  const cached = generated.get(key);
  if (cached) return cached;
  const hills = Array.from({ length: 6 }, (_, i) => {
    const x = i * 200 - 40 + (variant * 37) % 120;
    const h = 120 + ((variant * 53 + i * 29) % 90);
    return `<rect x="${x}" y="${1000 - h}" width="180" height="${h}" fill="#9ccc65" />`;
  }).join('');
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" shape-rendering="crispEdges">
      <rect width="1080" height="1350" fill="#71c5cf" />
      <rect x="${120 + (variant * 61) % 700}" y="140" width="120" height="120" fill="#ffeb3b" />
      ${hills}
      <rect y="1000" width="1080" height="350" fill="#ddd897" />
      <rect x="60" y="1060" width="960" height="200" fill="#1b5e20" />
      <text x="540" y="1180" font-family="monospace" font-size="72" font-weight="bold" fill="#ffeb3b" text-anchor="middle">${escapeXml(interestName.toUpperCase())}</text>
      <text x="540" y="1235" font-family="monospace" font-size="34" fill="#ffffff" text-anchor="middle">K7 QUEST #${variant}</text>
    </svg>`;
  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
  generated.set(key, buf);
  return buf;
}

/** Photo from supabase/seed/photos/<category>-NN.jpg if present, otherwise a generated placeholder. */
export async function seedPhoto(interestName: string, category: InterestCategory, variant: number): Promise<Buffer> {
  if (existsSync(PHOTO_DIR)) {
    const files = readdirSync(PHOTO_DIR).filter((f) => f.startsWith(`${category}-`) && /\.jpe?g$/i.test(f)).sort();
    if (files.length > 0) return readFileSync(path.join(PHOTO_DIR, files[variant % files.length]!));
  }
  return placeholderJpeg(interestName, category, variant);
}

export async function uploadSeedPhoto(userId: string, stageId: string, jpeg: Buffer): Promise<string> {
  const photoPath = `${userId}/${stageId}/seed.jpg`;
  const { error } = await admin().storage.from(PHOTO_BUCKET).upload(photoPath, jpeg, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`upload ${photoPath} failed: ${error.message}`);
  return photoPath;
}

/** Spreads created_at over the last `days` days (after creation, like the spec asks). */
export async function backdate(table: 'stage_reports' | 'connections', id: string, daysAgo: number) {
  const at = new Date(Date.now() - daysAgo * 86_400_000 - Math.floor(daysAgo * 1234) % 3600_000).toISOString();
  const { error } = await admin().from(table).update({ created_at: at }).eq('id', id);
  if (error) throw new Error(`backdate ${table} failed: ${error.message}`);
}
