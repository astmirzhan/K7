import { z } from 'zod';
import { callModel } from './roadmap/ai';

export interface IcebreakerContext {
  me: { name: string; city: string };
  other: { name: string; city: string; bio: string };
  interests: string[]; // names both people share, best first
}

export function buildIcebreakerPrompt(ctx: IcebreakerContext): string {
  const where = ctx.me.city.toLowerCase() === ctx.other.city.toLowerCase() ? `both in ${ctx.me.city}` : `${ctx.me.city} and ${ctx.other.city}`;
  return [
    `Write 3 short first messages from ${ctx.me.name} to ${ctx.other.name}, two adults who just connected on K7, an app for starting goals with people nearby.`,
    `They share: ${ctx.interests.join(', ')}. Cities: ${where}.`,
    ctx.other.bio ? `${ctx.other.name}'s bio: "${ctx.other.bio.slice(0, 160)}"` : '',
    `Rules: friendly, casual, no flirting, no pressure. Each message max 140 characters. At least one suggests a concrete low-key first step in a public place.`,
    `Reply with JSON only: {"lines":["...","...","..."]}`,
  ].filter(Boolean).join('\n');
}

const schema = z.object({ lines: z.array(z.string().trim().min(5).max(200)).min(3) });

export function parseIcebreakers(text: string): string[] | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
    return parsed.success ? parsed.data.lines.slice(0, 3) : null;
  } catch {
    return null;
  }
}

/** Used when no model key is set or the model fails, so the feature always answers. */
export function templateIcebreakers(ctx: IcebreakerContext): string[] {
  const goal = (ctx.interests[0] ?? 'this').toLowerCase();
  return [
    `Hey ${ctx.other.name}! Saw we're both starting ${goal}. How far in are you?`,
    `I'm doing my first ${goal} stage this week. Want to do the co-op one together?`,
    `Free this weekend for a quick ${goal} session somewhere public in ${ctx.other.city}?`,
  ];
}

export async function generateIcebreakers(ctx: IcebreakerContext, timeoutMs = 8000): Promise<{ lines: string[]; source: 'ai' | 'template' }> {
  try {
    const text = await callModel(buildIcebreakerPrompt(ctx), timeoutMs, 600);
    const lines = text ? parseIcebreakers(text) : null;
    if (lines) return { lines, source: 'ai' };
  } catch (e) {
    console.warn('[ai] icebreaker failed, using template', (e as Error).name);
  }
  return { lines: templateIcebreakers(ctx), source: 'template' };
}
