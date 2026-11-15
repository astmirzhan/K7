import { z } from 'zod';
import type { Difficulty, InterestCategory, MeetStyle, UsState } from '../../types';
import { STAGE_SKELETON, type StageDraft } from './skeleton';

export interface RoadmapContext {
  interestName: string;
  category: InterestCategory;
  difficulty: Difficulty;
  city: string;
  state: UsState;
  meetStyle: MeetStyle;
}

const LEVEL: Record<Difficulty, string> = { 1: 'Easy', 3: 'Medium', 5: 'Hard' };
const KIND_RULE = {
  solo: 'done alone, 5-30 minutes, concrete and doable today',
  connect: 'the user finds a buddy with the same interest on the K7 map and sends a connect request',
  coop: 'done TOGETHER with the buddy in a public place, ends with a photo of both',
} as const;

export function buildRoadmapPrompt(ctx: RoadmapContext): string {
  const kinds = STAGE_SKELETON[ctx.difficulty];
  const plan = kinds.map((k, i) => `${i + 1}. ${k}: ${KIND_RULE[k]}`).join('\n');
  return [
    `You design a short quest roadmap for an adult (25-45) in ${ctx.city}, ${ctx.state} who wants to start "${ctx.interestName}" (${ctx.category}).`,
    `Level: ${LEVEL[ctx.difficulty]}. Exactly ${kinds.length} stages, in this order:`,
    plan,
    ``,
    `Rules:`,
    `- Beginner-friendly, safe, legal, cheap. Public places only for meetups. No medical or financial claims.`,
    `- Each stage builds on the previous one. Make it specific to ${ctx.interestName}, not generic.`,
    `- title: imperative, max 50 characters. description: max 160 characters, motivating, second person.`,
    `- minutes: integer 5-60. steps: 3 to 5 concrete micro-actions, max 80 characters each.`,
    `- Meeting style of the user: ${ctx.meetStyle}.`,
    ``,
    `Reply with JSON only, no prose, no markdown fences:`,
    `{"stages":[{"title":"...","description":"...","minutes":15,"steps":["...","...","..."]}]}`,
  ].join('\n');
}

const aiSchema = z.object({
  stages: z.array(
    z.object({
      title: z.string().trim().min(3).max(60),
      description: z.string().trim().min(10).max(220),
      minutes: z.number().int().min(5).max(60),
      steps: z.array(z.string().trim().min(2).max(100)).min(3).max(5),
    }),
  ),
});

/** Parses model output; returns null on anything unexpected (caller falls back to templates). */
export function parseAiStages(text: string, difficulty: Difficulty): StageDraft[] | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = aiSchema.safeParse(json);
  if (!parsed.success) return null;
  if (parsed.data.stages.length !== STAGE_SKELETON[difficulty].length) return null;
  return parsed.data.stages;
}

/** One prompt for all of a user's levels (one model call per onboarding instead of three). */
export function buildCombinedPrompt(ctxs: RoadmapContext[]): string {
  const sections = ctxs.map((ctx, n) => {
    const kinds = STAGE_SKELETON[ctx.difficulty];
    const plan = kinds.map((k, i) => `   ${i + 1}. ${k}: ${KIND_RULE[k]}`).join('\n');
    return [`Level ${n + 1}: "${ctx.interestName}" (${ctx.category}), ${LEVEL[ctx.difficulty]}, exactly ${kinds.length} stages in this order:`, plan].join('\n');
  });
  const first = ctxs[0]!;
  return [
    `You design short quest roadmaps for an adult (25-45) in ${first.city}, ${first.state} who is starting ${ctxs.length} goals.`,
    ...sections,
    ``,
    `Rules for every level:`,
    `- Beginner-friendly, safe, legal, cheap. Public places only for meetups. No medical or financial claims.`,
    `- Each stage builds on the previous one. Make it specific to that goal and to ${first.city} where it fits, not generic.`,
    `- title: imperative, max 50 characters. description: max 160 characters, motivating, second person.`,
    `- minutes: integer 5-60. steps: 3 to 5 concrete micro-actions, max 80 characters each.`,
    `- Meeting style of the user: ${first.meetStyle}.`,
    ``,
    `Reply with JSON only, no prose, no markdown fences, levels in the same order as above:`,
    `{"levels":[{"stages":[{"title":"...","description":"...","minutes":15,"steps":["...","...","..."]}]}]}`,
  ].join('\n');
}

/** Parses a combined reply. Each level is validated on its own: a bad level is null (template fallback). */
export function parseAiLevels(text: string, difficulties: Difficulty[]): Array<StageDraft[] | null> {
  const none = difficulties.map(() => null);
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return none;
  let json: unknown;
  try {
    json = JSON.parse(text.slice(start, end + 1));
  } catch {
    return none;
  }
  const levels = (json as { levels?: unknown })?.levels;
  if (!Array.isArray(levels)) return none;
  return difficulties.map((d, i) => {
    const parsed = aiSchema.safeParse(levels[i]);
    if (!parsed.success || parsed.data.stages.length !== STAGE_SKELETON[d].length) return null;
    return parsed.data.stages;
  });
}

export type AiProvider = 'gemini' | 'anthropic';

/** Gemini when GEMINI_API_KEY is set, else Anthropic when ANTHROPIC_API_KEY is set, else none (templates). */
export function pickAiProvider(env: Record<string, string | undefined>): AiProvider | null {
  if (env.GEMINI_API_KEY) return 'gemini';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  return null;
}

/** Text of the first Gemini candidate, or '' when the shape is unexpected. */
export function geminiText(body: unknown): string {
  const parts = (body as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts;
  return Array.isArray(parts) ? parts.map((p) => p.text ?? '').join('') : '';
}

async function callGemini(prompt: string, apiKey: string, timeoutMs: number, maxTokens: number): Promise<string | null> {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: maxTokens, temperature: 0.7 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    console.warn('[ai] gemini http', res.status);
    return null;
  }
  return geminiText(await res.json());
}

async function callAnthropic(prompt: string, apiKey: string, timeoutMs: number, maxTokens: number): Promise<string | null> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || 'claude-haiku-5-5',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    console.warn('[ai] anthropic http', res.status);
    return null;
  }
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  return (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
}

/** Raw text from the configured model (Gemini first, then Anthropic); null when no key is set. */
export async function callModel(prompt: string, timeoutMs: number, maxTokens: number): Promise<string | null> {
  const provider = pickAiProvider(process.env);
  if (!provider) return null;
  return provider === 'gemini'
    ? callGemini(prompt, process.env.GEMINI_API_KEY!, timeoutMs, maxTokens)
    : callAnthropic(prompt, process.env.ANTHROPIC_API_KEY!, timeoutMs, maxTokens);
}

/** One model call (Gemini or Anthropic) for one level. Returns null on missing key, timeout, HTTP error or bad JSON. */
export async function generateAiStages(ctx: RoadmapContext, timeoutMs = 8000): Promise<StageDraft[] | null> {
  if (!pickAiProvider(process.env)) return null;
  try {
    const text = await callModel(buildRoadmapPrompt(ctx), timeoutMs, 2000);
    return text ? parseAiStages(text, ctx.difficulty) : null;
  } catch (e) {
    console.warn('[ai] roadmap failed, using template', (e as Error).name);
    return null;
  }
}

/** One model call for all levels. Per level: drafts, or null to fall back to the template. */
export async function generateAiRoadmap(ctxs: RoadmapContext[], timeoutMs = 12000): Promise<Array<StageDraft[] | null>> {
  const none = ctxs.map(() => null);
  if (ctxs.length === 0 || !pickAiProvider(process.env)) return none;
  try {
    const text = await callModel(buildCombinedPrompt(ctxs), timeoutMs, 6000);
    return text ? parseAiLevels(text, ctxs.map((c) => c.difficulty)) : none;
  } catch (e) {
    console.warn('[ai] roadmap failed, using templates', (e as Error).name);
    return none;
  }
}
