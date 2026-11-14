// Full demo seed. Idempotent: deletes and recreates only seed / judge / demo users and their photos.
// Run: pnpm seed   (needs .env.local with the Supabase secret key, SEED_PASSWORD, JUDGE_PASSWORD)
import type { Interest } from '../lib/types';
import { resetJudges } from './lib/judges';
import {
  admin, backdate, completeStage, createAuthUser, deleteUserByEmail, loadCatalog, need, onboard, rng,
  seedPhoto, setPlanDirect, stagesOf, uploadSeedPhoto, type StageLite,
} from './lib/seed-core';
import { SARAH, seedUsers, type SeedUserSpec } from './lib/seed-data';

interface SeededUser extends SeedUserSpec {
  id: string;
}

const log = (msg: string) => process.stdout.write(`${msg}\n`);

async function recreate(spec: SeedUserSpec, password: string, catalog: Map<string, Interest>): Promise<SeededUser> {
  await deleteUserByEmail(spec.email);
  const id = await createAuthUser(spec.email, password);
  await onboard(id, spec.profile, spec.picks, catalog);
  if (spec.plan !== 'free') await setPlanDirect(id, spec.plan);
  return { ...spec, id };
}

const maxDifficulty = (plan: string) => (plan === 'free' ? 1 : plan === 'starter' ? 3 : 5);

/** Completes solo stages in roadmap order (within the plan) until `count` stages are done. */
async function progress(u: SeededUser, count: number, withPhotos: boolean, catalog: Map<string, Interest>, rand: () => number) {
  let done = 0;
  let photos = 0;
  const stages = await stagesOf(u.id);
  const allowed = stages.filter((s) => s.difficulty <= maxDifficulty(u.plan));
  for (const s of allowed) {
    if (done >= count) break;
    if (s.kind !== 'solo') continue;
    const fresh = (await stagesOf(u.id)).find((x) => x.id === s.id);
    if (!fresh || fresh.status !== 'active') continue;
    let photoPath: string | undefined;
    if (withPhotos && rand() < 0.5) {
      const interest = catalog.get(s.interest_slug)!;
      photoPath = await uploadSeedPhoto(u.id, s.id, await seedPhoto(interest.name, interest.category, photos + 1));
      photos += 1;
    }
    const r = await completeStage(u.id, s.id, { photoPath, caption: photoPath ? captionFor(s, catalog) : undefined });
    if (!r.ok) throw new Error(`complete_stage ${u.profile.displayName}: ${r.error}`);
    done += 1;
  }
  return { done, photos };
}

const CAPTIONS = ['Day one. Done.', 'Small win today.', 'Showed up. That is the whole trick.', 'Not perfect, still progress.', 'First try!', 'Good morning quest.'];
function captionFor(s: StageLite, catalog: Map<string, Interest>): string {
  const name = catalog.get(s.interest_slug)?.name ?? s.interest_slug;
  return `${CAPTIONS[s.idx % CAPTIONS.length]} #${name.toLowerCase().replace(/\s+/g, '')}`;
}

function sharedInterest(a: SeededUser, b: SeededUser): string | null {
  const bs = new Set(b.picks.map((p) => p.slug));
  return a.picks.find((p) => bs.has(p.slug))?.slug ?? null;
}

async function connect(a: SeededUser, b: SeededUser, slug: string, accept: boolean): Promise<string | null> {
  const req = await admin().rpc('request_connection', { p_from: a.id, p_to: b.id, p_interest: slug });
  if (req.error) return null; // ALREADY_CONNECTED / PLAN_LIMIT on Free users: skip quietly
  const id = (req.data as { id: string }).id;
  if (accept) {
    const res = await admin().rpc('respond_connection', { p_user: b.id, p_connection_id: id, p_status: 'accepted' });
    if (res.error) throw new Error(`respond_connection failed: ${res.error.message}`);
  }
  return id;
}

/** Both reach the co-op stage of `slug` (plan permitting), then complete it with photos naming each other. */
async function coop(a: SeededUser, b: SeededUser, slug: string, catalog: Map<string, Interest>, variant: number): Promise<boolean> {
  for (const u of [a, b]) {
    const level = (await stagesOf(u.id)).filter((s) => s.interest_slug === slug);
    if (level[0]!.difficulty > maxDifficulty(u.plan)) return false;
    for (const s of level) {
      if (s.kind === 'coop') break;
      const fresh = (await stagesOf(u.id)).find((x) => x.id === s.id)!;
      if (fresh.status === 'done') continue;
      if (s.kind === 'connect') return false; // buddy stage did not auto-complete → not connected
      const r = await completeStage(u.id, s.id);
      if (!r.ok) return false;
    }
  }
  // both co-op stages must be open now, otherwise skip the pair (e.g. the buddy stage did not unlock yet)
  for (const u of [a, b]) {
    const stage = (await stagesOf(u.id)).find((s) => s.interest_slug === slug && s.kind === 'coop')!;
    if (stage.status !== 'active') return false;
  }
  const interest = catalog.get(slug)!;
  for (const [u, partner] of [[a, b], [b, a]] as const) {
    const stage = (await stagesOf(u.id)).find((s) => s.interest_slug === slug && s.kind === 'coop')!;
    const photoPath = await uploadSeedPhoto(u.id, stage.id, await seedPhoto(interest.name, interest.category, variant));
    const r = await completeStage(u.id, stage.id, { photoPath, partnerId: partner.id, caption: `Did it together: ${interest.name.toLowerCase()}!` });
    if (!r.ok) throw new Error(`coop ${u.profile.displayName} ↔ ${partner.profile.displayName}: ${r.error}`);
  }
  return true;
}

async function spreadDates(rand: () => number) {
  const { data: reports } = await admin().from('stage_reports').select('id').order('created_at', { ascending: false }).limit(500);
  for (const r of reports ?? []) await backdate('stage_reports', r.id, Math.floor(rand() * 14));
  const { data: conns } = await admin().from('connections').select('id').limit(500);
  for (const c of conns ?? []) await backdate('connections', c.id, Math.floor(rand() * 14));
}

async function main() {
  const seedPassword = need('SEED_PASSWORD');
  need('JUDGE_PASSWORD');
  const catalog = await loadCatalog();
  if (catalog.size !== 30) throw new Error(`expected 30 interests, found ${catalog.size} — run supabase db push`);
  const rand = rng(42);

  log('→ users');
  const users: SeededUser[] = [];
  for (const spec of seedUsers()) users.push(await recreate(spec, seedPassword, catalog));
  await deleteUserByEmail(SARAH.email);
  const sarah = await recreate(SARAH, seedPassword, catalog);
  log(`  ${users.length} seed users + Sarah`);

  log('→ progress');
  let photos = 0;
  for (const u of users) {
    const r = await progress(u, 1 + Math.floor(rand() * 6), true, catalog, rand);
    photos += r.photos;
  }
  await progress(sarah, 3, true, catalog, rand);
  log(`  ${photos} photos`);

  log('→ connections');
  let connections = 0;
  let accepted = 0;
  const pairs: Array<[SeededUser, SeededUser, string]> = [];
  const pool = [...users, sarah];
  for (let i = 0; i < pool.length && connections < 40; i++) {
    const a = pool[i]!;
    for (let j = i + 1; j < pool.length && connections < 40; j++) {
      const b = pool[j]!;
      if (a.profile.state !== b.profile.state && rand() < 0.7) continue; // mostly local
      const slug = sharedInterest(a, b);
      if (!slug || rand() < 0.5) continue;
      const accept = rand() < 0.8;
      const id = await connect(a, b, slug, accept);
      if (!id) continue;
      connections += 1;
      if (accept) {
        accepted += 1;
        pairs.push([a, b, slug]);
      }
    }
  }
  log(`  ${connections} connections, ${accepted} accepted`);

  log('→ co-op');
  let coops = 0;
  for (const [a, b, slug] of pairs) {
    if (coops >= 10) break;
    if (await coop(a, b, slug, catalog, coops + 1)) coops += 1;
  }
  log(`  ${coops} completed co-op pairs`);

  log('→ judges');
  const judges = await resetJudges(catalog, sarah.id);

  log('→ dates');
  await spreadDates(rand);

  // ----- summary -----
  const { data: byState } = await admin().from('profiles').select('state');
  const counts = new Map<string, number>();
  for (const r of (byState ?? []) as Array<{ state: string }>) counts.set(r.state, (counts.get(r.state) ?? 0) + 1);
  const { count: feedCount } = await admin().from('stage_reports').select('id', { count: 'exact', head: true }).not('photo_path', 'is', null);
  const { count: connCount } = await admin().from('connections').select('id', { count: 'exact', head: true });

  log('');
  log('Seed complete');
  log(`  users per state: ${[...counts.entries()].sort((x, y) => y[1] - x[1]).map(([s, n]) => `${s} ${n}`).join(', ')}`);
  log(`  connections: ${connCount ?? 0} · co-op pairs: ${coops} · feed items: ${feedCount ?? 0}`);
  log(`  judge1@example.com / judge2@example.com · password: JUDGE_PASSWORD · demo@example.com (no profile)`);
  log(`  judge1 has a pending request from Sarah K. (${judges.sarahRequestId})`);
  log(`  seed users: k7.seed.01..60@example.com · password: SEED_PASSWORD`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
