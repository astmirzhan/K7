import type { Difficulty, Interest, MeetStyle, UsState } from '../../types';
import { generateAiRoadmap } from './ai';
import { toStageRows, type StageRow } from './skeleton';
import { templateDrafts } from './templates';

/** 19 rows for create_onboarding: one AI call for all interests, template fallback per interest. */
export async function buildRoadmapRows(
  picks: Array<{ interest: Interest; difficulty: Difficulty }>,
  who: { city: string; state: UsState; meetStyle: MeetStyle },
): Promise<StageRow[]> {
  const ai = await generateAiRoadmap(
    picks.map(({ interest, difficulty }) => ({ interestName: interest.name, category: interest.category, difficulty, ...who })),
  );
  return picks.flatMap(({ interest, difficulty }, i) => {
    const drafts = ai[i];
    return drafts
      ? toStageRows(interest.slug, difficulty, drafts, 'ai')
      : toStageRows(interest.slug, difficulty, templateDrafts(difficulty, interest.name), 'template');
  });
}
