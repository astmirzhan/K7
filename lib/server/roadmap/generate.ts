import type { Difficulty, Interest, MeetStyle, UsState } from '../../types';
import { generateAiStages } from './ai';
import { toStageRows, type StageRow } from './skeleton';
import { templateDrafts } from './templates';

/** 19 rows for create_onboarding: AI per interest in parallel, template fallback per interest. */
export async function buildRoadmapRows(
  picks: Array<{ interest: Interest; difficulty: Difficulty }>,
  who: { city: string; state: UsState; meetStyle: MeetStyle },
): Promise<StageRow[]> {
  const perInterest = await Promise.all(
    picks.map(async ({ interest, difficulty }) => {
      const ai = await generateAiStages({
        interestName: interest.name,
        category: interest.category,
        difficulty,
        ...who,
      });
      return ai
        ? toStageRows(interest.slug, difficulty, ai, 'ai')
        : toStageRows(interest.slug, difficulty, templateDrafts(difficulty, interest.name), 'template');
    }),
  );
  return perInterest.flat();
}
