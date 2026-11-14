import type { Difficulty, StageKind } from '../../types';

// Positions of special stages are fixed here, never by the AI: co-op logic depends on them.
export const STAGE_SKELETON: Record<Difficulty, readonly StageKind[]> = {
  1: ['solo', 'connect', 'coop'],
  3: ['solo', 'solo', 'solo', 'connect', 'solo', 'coop'],
  5: ['solo', 'solo', 'solo', 'solo', 'connect', 'solo', 'solo', 'solo', 'solo', 'coop'],
};

export const STAGE_COUNT: Record<Difficulty, number> = { 1: 3, 3: 6, 5: 10 };

export interface StageDraft {
  title: string;
  description: string;
  minutes: number;
  steps: string[];
}

/** Row shape expected by SQL create_onboarding(p_stages). */
export interface StageRow {
  interestSlug: string;
  difficulty: Difficulty;
  idx: number;
  kind: StageKind;
  title: string;
  description: string;
  minutes: number;
  steps: string[];
  requiresPhoto: boolean;
  coins: number;
  source: 'template' | 'ai';
}

export function toStageRows(
  interestSlug: string,
  difficulty: Difficulty,
  drafts: StageDraft[],
  source: 'template' | 'ai',
): StageRow[] {
  const kinds = STAGE_SKELETON[difficulty];
  if (drafts.length !== kinds.length) {
    throw new Error(`expected ${kinds.length} stages for difficulty ${difficulty}, got ${drafts.length}`);
  }
  return kinds.map((kind, i) => {
    const d = drafts[i]!;
    return {
      interestSlug,
      difficulty,
      idx: i + 1,
      kind,
      title: d.title.slice(0, 80),
      description: d.description.slice(0, 300),
      minutes: Math.min(120, Math.max(5, Math.round(d.minutes))),
      steps: d.steps.slice(0, 5).map((s) => s.slice(0, 120)),
      requiresPhoto: kind === 'coop',
      coins: difficulty,
      source,
    };
  });
}
