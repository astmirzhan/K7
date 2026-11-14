// Reference route: shows the pattern every API route follows
// (auth -> validate -> one SQL function for the business rule -> read model -> typed response).
import { requireUser } from '@/lib/server/auth';
import { AppError, fromDbError } from '@/lib/server/errors';
import { parseJson, parseWith, route } from '@/lib/server/http';
import { requiredPlanForDifficulty } from '@/lib/server/plans';
import { getPlan, loadStage } from '@/lib/server/roadmap/read';
import { photoExists } from '@/lib/server/storage';
import { adminClient } from '@/lib/server/supabase';
import { completeStageSchema, idSchema } from '@/lib/server/validation';
import type { CompleteStageResponse, Difficulty } from '@/lib/types';

interface CompleteStageRpc {
  stageId: string;
  status: string;
  coinsAwarded: number;
  coins: number;
  waitingForPartner: boolean;
  levelCompleted: boolean;
  nextStageId: string | null;
}

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const stageId = parseWith(idSchema, (await params).id);
  const body = await parseJson(req, completeStageSchema);

  if (body.photoPath && !(await photoExists(body.photoPath))) {
    throw new AppError('VALIDATION', 'Upload the photo before completing the stage');
  }

  const db = adminClient();
  const { data, error } = await db.rpc('complete_stage', {
    p_user: user.id,
    p_stage_id: stageId,
    p_photo_path: body.photoPath ?? null,
    p_caption: body.caption ?? null,
    p_visibility: body.visibility,
    p_partner_id: body.partnerId ?? null,
  });

  if (error) {
    const e = fromDbError(error);
    if (e.code === 'PLAN_LIMIT') {
      const { data: s } = await db
        .from('roadmap_stages').select('difficulty').eq('id', stageId).eq('user_id', user.id).maybeSingle();
      throw new AppError('PLAN_LIMIT', undefined, {
        requiredPlan: requiredPlanForDifficulty((s?.difficulty ?? 3) as Difficulty) ?? 'starter',
      });
    }
    throw e;
  }

  const r = data as CompleteStageRpc;
  const stage = await loadStage(user.id, stageId, await getPlan(user.id));
  const res: CompleteStageResponse = {
    stage,
    coinsAwarded: r.coinsAwarded,
    coins: r.coins,
    waitingForPartner: r.waitingForPartner,
    levelCompleted: r.levelCompleted,
    nextStageId: r.nextStageId,
  };
  return res;
});
