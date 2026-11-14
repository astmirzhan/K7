// The demo world: 60 seed users in 12 states, weighted so the map around Austin looks alive.
import type { Avatar, Difficulty, UsState } from '../../lib/types';
import { rng, type SeedPick, type SeedProfile } from './seed-core';

const FIRST = [
  'Ava', 'Liam', 'Mia', 'Noah', 'Zoe', 'Ethan', 'Lily', 'Mason', 'Nora', 'Lucas', 'Ella', 'Owen',
  'Ruby', 'Caleb', 'Maya', 'Jonah', 'Iris', 'Leo', 'Chloe', 'Eli', 'Hazel', 'Miles', 'Luna', 'Jude',
  'Sofia', 'Theo', 'Naomi', 'Felix', 'Stella', 'Hugo', 'Ivy', 'Omar', 'Rosa', 'Diego', 'Priya', 'Ravi',
  'Mei', 'Ken', 'Aisha', 'Tariq', 'Elena', 'Marco', 'Hana', 'Yusuf', 'Clara', 'Ben', 'Nina', 'Sam',
  'Tess', 'Max', 'Jade', 'Cole', 'Wren', 'Reid', 'Faye', 'Kai', 'June', 'Finn', 'Nell', 'Beau',
];
const LAST_INITIALS = 'ABCDEFGHJKLMNPRSTVW';

const PLACES: Array<[UsState, string, number]> = [
  ['TX', 'Austin', 12], ['TX', 'Dallas', 3], ['TX', 'Houston', 3],
  ['CA', 'Los Angeles', 5], ['CA', 'San Francisco', 3],
  ['NY', 'New York', 4], ['NY', 'Brooklyn', 2],
  ['FL', 'Miami', 3], ['FL', 'Orlando', 2],
  ['IL', 'Chicago', 4],
  ['WA', 'Seattle', 4],
  ['CO', 'Denver', 3],
  ['GA', 'Atlanta', 3],
  ['MA', 'Boston', 3],
  ['AZ', 'Phoenix', 2],
  ['NC', 'Raleigh', 2],
  ['OR', 'Portland', 2],
];

const BIOS = [
  'New in town, looking for people to start things with.',
  'Been meaning to start this for years. This is the year.',
  'Weekend mornings are free. Coffee after is mandatory.',
  'Beginner and not ashamed of it.',
  'Trading doomscrolling for real quests.',
  'Here to keep promises I made to myself.',
  'Slow starts are still starts.',
  'Parent of two, free Tuesday evenings.',
  'Remote worker, need a reason to leave the house.',
  'Just moved here. Show me your favorite spots.',
  'Learning out loud. Join me.',
  'Small goals, big consistency.',
];

const ALL_INTERESTS = [
  'running', 'cycling', 'yoga', 'gym', 'swimming', 'climbing', 'pickleball', 'dance', 'hiking', 'camping',
  'gardening', 'birdwatching', 'spanish', 'french', 'japanese', 'guitar', 'piano', 'singing', 'drawing',
  'photography', 'writing', 'pottery', 'cooking', 'baking', 'chess', 'reading', 'meditation', 'coding',
  'volunteering', 'board-games',
];

// Austin: 7 of 12 have running, 5 spanish, 4 cooking, 3 guitar, 3 chess (some overlap is fine).
const AUSTIN_INTERESTS: string[][] = [
  ['running', 'spanish', 'cooking'],
  ['running', 'spanish', 'guitar'],
  ['running', 'cooking', 'chess'],
  ['running', 'spanish', 'hiking'],
  ['running', 'guitar', 'yoga'],
  ['running', 'cooking', 'photography'],
  ['running', 'chess', 'climbing'],
  ['spanish', 'guitar', 'reading'],
  ['spanish', 'cooking', 'meditation'],
  ['chess', 'board-games', 'coding'],
  ['cycling', 'swimming', 'camping'],
  ['dance', 'singing', 'baking'],
];

const AGES = ['25-29', '30-34', '35-39', '40-45'] as const;
const STYLES = ['solo', 'couple', 'family'] as const;
const SUITS = ['#1b5e20', '#0d47a1', '#4a148c', '#b71c1c', '#263238', '#e65100'];
const BANDS = ['#ffeb3b', '#ff9800', '#f44336', '#00bcd4', '#ffffff'];
const ACCESSORIES = ['none', 'katana', 'staff', 'shuriken', 'headphones'] as const;

export interface SeedUserSpec {
  email: string;
  profile: SeedProfile;
  picks: SeedPick[];
  plan: 'free' | 'starter' | 'pro';
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function avatarFor(i: number, rand: () => number): Avatar {
  if (i % 3 !== 0) return { kind: 'preset', preset: `ninja-${(i % 4) + 1}` as 'ninja-1' };
  return {
    kind: 'custom',
    suit: SUITS[Math.floor(rand() * SUITS.length)]!,
    band: BANDS[Math.floor(rand() * BANDS.length)]!,
    accessory: ACCESSORIES[Math.floor(rand() * ACCESSORIES.length)]!,
  };
}

export function seedUsers(): SeedUserSpec[] {
  const rand = rng(7);
  const out: SeedUserSpec[] = [];
  let n = 0;
  let austin = 0;
  for (const [state, city, count] of PLACES) {
    for (let k = 0; k < count; k++) {
      const i = n++;
      const first = FIRST[i % FIRST.length]!;
      const last = LAST_INITIALS[Math.floor(rand() * LAST_INITIALS.length)]!;
      const handle = `${first.toLowerCase()}.${last.toLowerCase()}${(i % 9) + 1}`;
      const slugs = city === 'Austin' ? AUSTIN_INTERESTS[austin++]! : shuffle(ALL_INTERESTS, rand).slice(0, 3);
      const diffs = shuffle<Difficulty>([1, 3, 5], rand);
      // people near the judges share their Easy interest at the same level more often
      if (city === 'Austin' && slugs.includes('running') && rand() < 0.6) {
        const ri = slugs.indexOf('running');
        const ei = diffs.indexOf(1);
        [diffs[ri], diffs[ei]] = [diffs[ei]!, diffs[ri]!];
      }
      const r = rand();
      out.push({
        email: `k7.seed.${String(i + 1).padStart(2, '0')}@example.com`,
        profile: {
          displayName: `${first} ${last}.`,
          avatar: avatarFor(i, rand),
          state,
          city,
          ageRange: AGES[Math.floor(rand() * AGES.length)]!,
          meetStyle: STYLES[Math.floor(rand() * STYLES.length)]!,
          socialUrl: `https://instagram.com/${handle}`,
          bio: BIOS[i % BIOS.length]!,
        },
        picks: slugs.map((slug, j) => ({ slug, difficulty: diffs[j]! })),
        plan: r < 0.6 ? 'free' : r < 0.85 ? 'starter' : 'pro',
      });
    }
  }
  return out;
}

export const SARAH: SeedUserSpec = {
  email: 'k7.sarah@example.com',
  profile: {
    displayName: 'Sarah K.',
    avatar: { kind: 'custom', suit: '#4a148c', band: '#ffeb3b', accessory: 'headphones' },
    state: 'TX',
    city: 'Austin',
    ageRange: '30-34',
    meetStyle: 'solo',
    socialUrl: 'https://instagram.com/sarah.k.runs',
    bio: 'Marketing by day. Trying to become a morning runner and finally speak Spanish.',
  },
  picks: [
    { slug: 'running', difficulty: 1 },
    { slug: 'spanish', difficulty: 3 },
    { slug: 'photography', difficulty: 5 },
  ],
  plan: 'starter',
};

export const JUDGES: SeedUserSpec[] = [
  {
    email: 'judge1@example.com',
    profile: {
      displayName: 'Judge One',
      avatar: { kind: 'preset', preset: 'ninja-1' },
      state: 'TX',
      city: 'Austin',
      ageRange: '35-39',
      meetStyle: 'solo',
      socialUrl: 'https://linkedin.com/in/judge-one',
      bio: 'Here to see if this thing really works.',
    },
    picks: [
      { slug: 'running', difficulty: 1 },
      { slug: 'spanish', difficulty: 3 },
      { slug: 'guitar', difficulty: 5 },
    ],
    plan: 'free',
  },
  {
    email: 'judge2@example.com',
    profile: {
      displayName: 'Judge Two',
      avatar: { kind: 'preset', preset: 'ninja-3' },
      state: 'TX',
      city: 'Austin',
      ageRange: '30-34',
      meetStyle: 'couple',
      socialUrl: 'https://linkedin.com/in/judge-two',
      bio: 'Second opinion, same city.',
    },
    picks: [
      { slug: 'running', difficulty: 1 },
      { slug: 'cooking', difficulty: 3 },
      { slug: 'chess', difficulty: 5 },
    ],
    plan: 'free',
  },
];

export const DEMO_EMAIL = 'demo@example.com';
