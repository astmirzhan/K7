import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppError, fromDbError, toErrorResponse } from '../../lib/server/errors';
import { canAccessDifficulty, limitsFor, PLAN_RULES, requiredPlanForDifficulty } from '../../lib/server/plans';
import { buildRoadmapPrompt, geminiText, parseAiStages, pickAiProvider } from '../../lib/server/roadmap/ai';
import { buildRoadmapRows } from '../../lib/server/roadmap/generate';
import { STAGE_SKELETON, toStageRows } from '../../lib/server/roadmap/skeleton';
import { templateDrafts } from '../../lib/server/roadmap/templates';
import {
  completeStageSchema, createMeetupSchema, normalizeSocialUrl, onboardingSchema,
} from '../../lib/server/validation';
import type { Interest } from '../../lib/types';

describe('normalizeSocialUrl', () => {
  it.each([
    ['instagram.com/sara.runs', 'https://instagram.com/sara.runs'],
    ['https://www.instagram.com/sara.runs/', 'https://instagram.com/sara.runs'],
    ['http://m.linkedin.com/in/sara?utm=1#x', 'https://linkedin.com/in/sara'],
    ['  https://x.com/sara  ', 'https://x.com/sara'],
    ['https://twitter.com/sara', 'https://twitter.com/sara'],
  ])('accepts %s', (input, out) => expect(normalizeSocialUrl(input)).toBe(out));

  it.each([
    '', 'sara', 'https://instagram.com', 'https://instagram.com/', 'https://instagram.com.evil.com/sara',
    'https://evil.com/instagram.com/sara', 'javascript:alert(1)', 'ftp://instagram.com/sara',
    'https://user:pw@instagram.com/sara', 'https://instagram.com:8080/sara', 'https://facebook.com/sara',
  ])('rejects %s', (input) => expect(normalizeSocialUrl(input)).toBeNull());
});

const validOnboarding = {
  avatar: { kind: 'preset', preset: 'ninja-2' },
  profile: {
    displayName: ' Sarah ', state: 'TX', city: 'Austin', ageRange: '30-34', meetStyle: 'solo',
    socialUrl: 'instagram.com/sarah', bio: 'New in Austin',
  },
  interests: [
    { slug: 'running', difficulty: 1 }, { slug: 'spanish', difficulty: 3 }, { slug: 'guitar', difficulty: 5 },
  ],
};

describe('onboardingSchema', () => {
  it('accepts and normalizes a valid payload', () => {
    const r = onboardingSchema.parse(validOnboarding);
    expect(r.profile.displayName).toBe('Sarah');
    expect(r.profile.socialUrl).toBe('https://instagram.com/sarah');
  });
  it('defaults bio', () => {
    const profile: Partial<typeof validOnboarding.profile> = { ...validOnboarding.profile };
    delete profile.bio;
    expect(onboardingSchema.parse({ ...validOnboarding, profile }).profile.bio).toBe('');
  });
  it('rejects duplicate difficulties', () => {
    const bad = { ...validOnboarding, interests: [{ slug: 'running', difficulty: 1 }, { slug: 'spanish', difficulty: 1 }, { slug: 'guitar', difficulty: 5 }] };
    expect(onboardingSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects duplicate interests', () => {
    const bad = { ...validOnboarding, interests: [{ slug: 'running', difficulty: 1 }, { slug: 'running', difficulty: 3 }, { slug: 'guitar', difficulty: 5 }] };
    expect(onboardingSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects wrong state, bad link, custom avatar with bad color', () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, profile: { ...validOnboarding.profile, state: 'XX' } }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validOnboarding, profile: { ...validOnboarding.profile, socialUrl: 'facebook.com/x' } }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...validOnboarding, avatar: { kind: 'custom', suit: 'red', band: '#ffffff', accessory: 'katana' } }).success).toBe(false);
  });
  it('accepts a custom avatar', () => {
    expect(onboardingSchema.safeParse({ ...validOnboarding, avatar: { kind: 'custom', suit: '#e05a1d', band: '#1f4d17', accessory: 'katana' } }).success).toBe(true);
  });
});

describe('other schemas', () => {
  it('completeStage defaults visibility and validates partner id', () => {
    expect(completeStageSchema.parse({}).visibility).toBe('public');
    expect(completeStageSchema.safeParse({ partnerId: 'nope' }).success).toBe(false);
    expect(completeStageSchema.safeParse({ partnerId: '00000000-0000-0000-0000-00000000000a' }).success).toBe(true);
  });
  it('meetup must be in the future', () => {
    const base = { connectionId: '00000000-0000-0000-0000-00000000000a', place: 'Zilker Park', interestSlug: 'running' };
    expect(createMeetupSchema.safeParse({ ...base, startsAt: '2020-01-01T10:00:00Z' }).success).toBe(false);
    expect(createMeetupSchema.safeParse({ ...base, startsAt: new Date(Date.now() + 86_400_000).toISOString() }).success).toBe(true);
  });
});

describe('plans', () => {
  it('matches the pricing table', () => {
    expect(PLAN_RULES.free).toEqual({ maxDifficulty: 1, connectsPerMonth: 3, mapVisible: 10, aiSteps: false });
    expect(canAccessDifficulty('free', 3)).toBe(false);
    expect(canAccessDifficulty('starter', 3)).toBe(true);
    expect(canAccessDifficulty('starter', 5)).toBe(false);
    expect(canAccessDifficulty('pro', 5)).toBe(true);
    expect(requiredPlanForDifficulty(1)).toBeNull();
    expect(requiredPlanForDifficulty(3)).toBe('starter');
    expect(requiredPlanForDifficulty(5)).toBe('pro');
    expect(limitsFor('free', 2).connectsUsedThisMonth).toBe(2);
  });
});

describe('errors', () => {
  it('maps SQL-raised codes and hides internals', () => {
    expect(fromDbError({ code: 'P0001', message: 'PLAN_LIMIT' }).code).toBe('PLAN_LIMIT');
    expect(fromDbError({ code: '23505', message: 'duplicate key' }).code).toBe('INTERNAL');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const r = toErrorResponse(new Error('db password is hunter2'));
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('hunter2');
    const p = toErrorResponse(new AppError('PLAN_LIMIT', undefined, { requiredPlan: 'pro' }));
    expect(p).toEqual({ status: 402, body: { error: { code: 'PLAN_LIMIT', message: 'Upgrade your plan to unlock this.', requiredPlan: 'pro' } } });
  });
});

describe('roadmap', () => {
  it('templates fit the skeleton for every difficulty', () => {
    for (const d of [1, 3, 5] as const) {
      const rows = toStageRows('running', d, templateDrafts(d, 'Running'), 'template');
      expect(rows).toHaveLength(STAGE_SKELETON[d].length);
      expect(rows.at(-1)).toMatchObject({ kind: 'coop', requiresPhoto: true, coins: d });
      expect(rows.filter((r) => r.kind === 'connect')).toHaveLength(1);
      expect(rows.every((r) => !r.title.includes('{interest}') && r.title.length <= 80)).toBe(true);
    }
  });
  it('parses good AI output and rejects junk', () => {
    const stage = { title: 'Jog 10 minutes', description: 'Easy pace around your block.', minutes: 10, steps: ['a1', 'b2', 'c3'] };
    expect(parseAiStages('Sure! {"stages":' + JSON.stringify([stage, stage, stage]) + '}', 1)).toHaveLength(3);
    expect(parseAiStages(JSON.stringify({ stages: [stage, stage] }), 1)).toBeNull();
    expect(parseAiStages('not json', 1)).toBeNull();
    expect(parseAiStages(JSON.stringify({ stages: [{ ...stage, minutes: 500 }, stage, stage] }), 1)).toBeNull();
  });
  it('prompt pins the stage order', () => {
    const p = buildRoadmapPrompt({ interestName: 'Running', category: 'fitness', difficulty: 3, city: 'Austin', state: 'TX', meetStyle: 'solo' });
    expect(p).toContain('Exactly 6 stages');
    expect(p).toContain('4. connect');
    expect(p).toContain('6. coop');
  });
});

describe('AI fallback', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
  const picks: Array<{ interest: Interest; difficulty: 1 | 3 | 5 }> = [
    { interest: { slug: 'running', name: 'Running', icon: '🏃', category: 'fitness' }, difficulty: 1 },
    { interest: { slug: 'spanish', name: 'Spanish', icon: '💬', category: 'languages' }, difficulty: 3 },
    { interest: { slug: 'guitar', name: 'Guitar', icon: '🎸', category: 'music' }, difficulty: 5 },
  ];
  const who = { city: 'Austin', state: 'TX' as const, meetStyle: 'solo' as const };

  it('uses templates when there is no API key', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const rows = await buildRoadmapRows(picks, who);
    expect(rows).toHaveLength(19);
    expect(rows.every((r) => r.source === 'template')).toBe(true);
  });
  it('falls back per interest when the API errors', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn(async () => new Response('overloaded', { status: 529 })));
    const rows = await buildRoadmapRows(picks, who);
    expect(rows).toHaveLength(19);
    expect(rows.every((r) => r.source === 'template')).toBe(true);
  });
  it('uses AI stages when the model answers well', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test');
    const s = { title: 'Jog 10 minutes', description: 'Easy pace around Lady Bird Lake.', minutes: 10, steps: ['a1', 'b2', 'c3'] };
    vi.stubGlobal('fetch', vi.fn(async (_u: string, init: RequestInit) => {
      const n = (JSON.parse(String(init.body)).messages[0].content as string).match(/Exactly (\d+) stages/)![1];
      return Response.json({ content: [{ type: 'text', text: JSON.stringify({ stages: Array(Number(n)).fill(s) }) }] });
    }));
    const rows = await buildRoadmapRows(picks, who);
    expect(rows).toHaveLength(19);
    expect(rows.every((r) => r.source === 'ai')).toBe(true);
    expect(rows.filter((r) => r.kind === 'coop')).toHaveLength(3);
  });
});

describe('AI provider', () => {
  it('prefers Gemini, then Anthropic, else templates', () => {
    expect(pickAiProvider({ GEMINI_API_KEY: 'g', ANTHROPIC_API_KEY: 'a' })).toBe('gemini');
    expect(pickAiProvider({ ANTHROPIC_API_KEY: 'a' })).toBe('anthropic');
    expect(pickAiProvider({ GEMINI_API_KEY: '', ANTHROPIC_API_KEY: '' })).toBeNull();
  });
  it('reads the text of a Gemini response', () => {
    expect(geminiText({ candidates: [{ content: { parts: [{ text: '{"stages":' }, { text: '[]}' }] } }] })).toBe('{"stages":[]}');
    expect(geminiText({ promptFeedback: { blockReason: 'SAFETY' } })).toBe('');
    expect(geminiText(null)).toBe('');
  });
});
