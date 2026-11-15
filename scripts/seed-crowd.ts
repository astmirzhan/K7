// Demo crowd: one extra person in every state the base seed does not cover, so the map shows people everywhere
// and the demo world stays around 100 people (60 base + Sarah + this crowd).
// They are seed people (k7.seed.c###@example.com): connect requests to them are accepted at once.
// Idempotent: deletes and recreates only k7.seed.c### users.  Run: pnpm seed:crowd
import type { Avatar, Difficulty, UsState } from '../lib/types';
import { US_STATES } from '../lib/types';
import { US_CITIES } from '../lib/us-cities';
import { admin, completeStage, createAuthUser, loadCatalog, need, onboard, rng, setPlanDirect, stagesOf } from './lib/seed-core';
import { seedUsers } from './lib/seed-data';

const log = (m: string) => process.stdout.write(`${m}\n`);
const PREFIX = 'k7.seed.c';

const FIRST = ['Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Lily', 'Mason', 'Nora', 'Lucas', 'Ella', 'Owen', 'Ruby', 'Caleb', 'Maya',
  'Jonah', 'Iris', 'Leo', 'Chloe', 'Eli', 'Hazel', 'Miles', 'Luna', 'Jude', 'Sofia', 'Theo', 'Naomi', 'Felix', 'Stella', 'Hugo', 'Ivy',
  'Omar', 'Rosa', 'Diego', 'Priya', 'Ravi', 'Mei', 'Ken', 'Aisha', 'Tariq', 'Elena', 'Marco', 'Hana', 'Yusuf', 'Clara', 'Ben', 'Nina',
  'Sam', 'Tess', 'Max', 'Jade', 'Cole', 'Wren', 'Reid', 'Faye', 'Kai', 'June', 'Finn', 'Nell', 'Beau', 'Ada', 'Rafael', 'Lena', 'Gabe'];
const NINJA = ['Shadow Fox', 'Night Owl', 'Swift Crane', 'Iron Lotus', 'Quiet Storm', 'Red Comet', 'Blue Moth', 'Silver Pine', 'Ember', 'Kite', 'Pixel', 'Nova'];
const BIOS = [
  'New in town, looking for people to start things with.', 'Weekend mornings are free. Coffee after is mandatory.',
  'Beginner and not ashamed of it.', 'Trading doomscrolling for real quests.', 'Slow starts are still starts.',
  'Remote worker, need a reason to leave the house.', 'Learning out loud. Join me.', 'Small goals, big consistency.',
  'Looking for an accountability buddy.', 'I show up if you show up.', 'Lunch breaks are for side quests.', 'Back at it after a long break.',
];
const COMMON = ['running', 'spanish', 'guitar']; // the judge accounts' goals: most people share one
const ALL = ['running', 'cycling', 'yoga', 'gym', 'swimming', 'climbing', 'pickleball', 'dance', 'hiking', 'camping', 'gardening',
  'birdwatching', 'spanish', 'french', 'japanese', 'guitar', 'piano', 'singing', 'drawing', 'photography', 'writing', 'pottery',
  'cooking', 'baking', 'chess', 'reading', 'meditation', 'coding', 'volunteering', 'board-games'];
const SUITS = ['#3f8f4a', '#2e1b5b', '#3b6fd6', '#8b5ad6', '#d84b6a', '#2f6b45'];
const BANDS = ['#ffc803', '#ff7fb0', '#ffffff', '#9ae04c', '#c9d2f7', '#ff6fa8'];
const ACC = ['none', 'katana', 'staff', 'shuriken', 'headphones'] as const;
// states the base seed (pnpm seed) already fills
const COVERED = new Set<UsState>(seedUsers().map((u) => u.profile.state));

async function deleteCrowd(): Promise<number> {
  let page = 1;
  let deleted = 0;
  for (;;) {
    const { data, error } = await admin().auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    for (const u of data.users) {
      if (u.email?.startsWith(PREFIX)) {
        const r = await admin().auth.admin.deleteUser(u.id);
        if (r.error) throw new Error(`delete ${u.email} failed: ${r.error.message}`);
        deleted++;
      }
    }
    if (data.users.length < 1000) return deleted;
    page++;
  }
}

async function main() {
  const password = need('SEED_PASSWORD');
  const rand = rng(2026);
  const pick = <T>(a: readonly T[]) => a[Math.floor(rand() * a.length)]!;
  const catalog = await loadCatalog();
  log(`removed ${await deleteCrowd()} old crowd users`);

  let n = 0;
  for (const state of US_STATES) {
    const cities = Object.keys(US_CITIES[state] ?? {});
    if (cities.length === 0) continue;
    const count = COVERED.has(state) ? 0 : 1;
    for (let k = 0; k < count; k++) {
      n++;
      const first = FIRST[(n * 7) % FIRST.length]!;
      const last = 'ABCDEFGHJKLMNPRSTVW'[Math.floor(rand() * 19)]!;
      const city = pick(cities);
      const slugs = new Set<string>();
      if (rand() < 0.75) slugs.add(pick(COMMON));
      while (slugs.size < 3) slugs.add(pick(ALL));
      const diffs = ([1, 3, 5] as Difficulty[]).sort(() => rand() - 0.5);
      const avatar: Avatar =
        n % 3 === 0
          ? { kind: 'custom', suit: pick(SUITS), band: pick(BANDS), accessory: pick(ACC) }
          : { kind: 'preset', preset: `ninja-${(n % 4) + 1}` as 'ninja-1' };
      if (rand() < 0.4) avatar.name = pick(NINJA);
      const email = `${PREFIX}${String(n).padStart(3, '0')}@example.com`;
      const id = await createAuthUser(email, password);
      await onboard(
        id,
        {
          displayName: `${first} ${last}.`,
          avatar,
          state,
          city,
          ageRange: pick(['25-29', '30-34', '35-39', '40-45'] as const),
          meetStyle: pick(['solo', 'couple', 'family'] as const),
          socialUrl: `https://instagram.com/${first.toLowerCase()}.${last.toLowerCase()}${n}`,
          bio: pick(BIOS),
        },
        [...slugs].map((slug, j) => ({ slug, difficulty: diffs[j]! })),
        catalog,
      );
      const r = rand();
      if (r > 0.7) await setPlanDirect(id, r > 0.92 ? 'pro' : 'starter');
      // some have already started: complete 1-2 solo stages so coins differ
      const done = Math.floor(rand() * 3);
      for (const s of (await stagesOf(id)).filter((x) => x.kind === 'solo' && x.difficulty === 1).slice(0, done)) {
        await completeStage(id, s.id);
      }
      if (n % 25 === 0) log(`  ${n} people…`);
    }
  }
  log(`crowd ready: ${n} people, one per state not covered by the base seed`);
}

main().catch((e) => {
  process.stderr.write(`${(e as Error).message}\n`);
  process.exit(1);
});
