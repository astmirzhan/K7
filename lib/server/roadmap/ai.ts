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

/** One call to the Anthropic Messages API. Returns null on missing key, timeout, HTTP error or bad JSON. */
export async function generateAiStages(ctx: RoadmapContext, timeoutMs = 8000): Promise<StageDraft[] | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'claude-haiku-5-5',
        max_tokens: 2000,
        messages: [{ role: 'user', content: buildRoadmapPrompt(ctx) }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn('[ai] roadmap http', res.status);
      return null;
    }
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (body.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
    return parseAiStages(text, ctx.difficulty);
  } catch (e) {
    console.warn('[ai] roadmap failed, using template', (e as Error).name);
    return null;
  }
}
