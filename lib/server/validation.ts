import { z } from 'zod';
import { AVATAR_ACCESSORIES, AVATAR_PRESETS, US_STATES } from '../types';

// ---------- Social link ----------
const SOCIAL_HOSTS = new Set(['linkedin.com', 'instagram.com', 'x.com', 'twitter.com']);

/** Returns a canonical https URL of a LinkedIn / Instagram / X profile, or null. */
export function normalizeSocialUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.|mobile\.)/, '');
  if (!SOCIAL_HOSTS.has(host)) return null;
  const path = url.pathname.replace(/\/+$/, '');
  if (path.length < 2) return null; // must be a profile, not the homepage
  return `https://${host}${path}`;
}

// ---------- Shared pieces ----------
export const idSchema = z.guid();
export const difficultySchema = z.union([z.literal(1), z.literal(3), z.literal(5)]);
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #rrggbb color');

const ninjaName = z.string().trim().min(1).max(20).optional();
export const avatarSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('preset'), preset: z.enum(AVATAR_PRESETS), name: ninjaName }),
  z.object({ kind: z.literal('custom'), suit: hexColor, band: hexColor, accessory: z.enum(AVATAR_ACCESSORIES), name: ninjaName }),
]);

/** A typed goal: letters (any language), digits, spaces and & ' - . + only. */
export const customInterestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Use at least 2 characters')
    .max(30, 'Keep it under 30 characters')
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} &'.+-]*$/u, 'Use letters, numbers and spaces'),
});

// ---------- Requests ----------
export const onboardingSchema = z.object({
  avatar: avatarSchema,
  profile: z.object({
    displayName: z.string().trim().min(2).max(30),
    state: z.enum(US_STATES),
    city: z.string().trim().min(2).max(50),
    ageRange: z.enum(['25-29', '30-34', '35-39', '40-45']),
    meetStyle: z.enum(['solo', 'couple', 'family']),
    socialUrl: z
      .string()
      .max(200)
      .transform((v, ctx) => {
        const normalized = normalizeSocialUrl(v);
        if (!normalized) {
          ctx.addIssue({ code: 'custom', message: 'Use a linkedin.com, instagram.com or x.com profile link' });
          return z.NEVER;
        }
        return normalized;
      }),
    bio: z.string().trim().max(160).default(''),
  }),
  interests: z
    .array(z.object({ slug: z.string().regex(/^[a-z0-9-]+$/), difficulty: difficultySchema }))
    .length(3)
    .refine((a) => new Set(a.map((i) => i.slug)).size === 3, { message: 'Pick 3 different interests' })
    .refine((a) => a.map((i) => i.difficulty).sort((x, y) => x - y).join(',') === '1,3,5', {
      message: 'Use each difficulty once: Hard (5), Medium (3), Easy (1)',
    }),
});

export const completeStageSchema = z.object({
  photoPath: z.string().min(1).max(300).optional(),
  caption: z.string().trim().max(140).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  partnerId: idSchema.optional(),
});

export const createConnectionSchema = z.object({
  toUserId: idSchema,
  interestSlug: z.string().regex(/^[a-z0-9-]+$/),
});

export const respondConnectionSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

export const createMeetupSchema = z.object({
  connectionId: idSchema,
  startsAt: z.iso
    .datetime({ offset: true })
    .refine((v) => new Date(v).getTime() > Date.now() - 60_000, { message: 'Pick a time in the future' }),
  place: z.string().trim().min(3).max(120),
  interestSlug: z.string().regex(/^[a-z0-9-]+$/),
});

export const updateMeetupSchema = z.object({
  status: z.enum(['confirmed', 'cancelled', 'done']),
});

export const reportSchema = z.object({
  targetUserId: idSchema,
  reason: z.string().trim().max(300).optional(),
});

export const blockSchema = z.object({ targetUserId: idSchema });

export const checkoutSchema = z.object({ tier: z.enum(['starter', 'pro', 'crew']) });

export const confirmCheckoutSchema = z.object({ sessionId: z.string().regex(/^cs_(test|live)_[A-Za-z0-9]+$/) });

export const mapUsersQuerySchema = z.object({ state: z.enum(US_STATES) });

export const feedQuerySchema = z.object({ scope: z.enum(['public', 'mine']).default('public') });
