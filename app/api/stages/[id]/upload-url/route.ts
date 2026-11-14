import { requireUser } from '@/lib/server/auth';
import { AppError } from '@/lib/server/errors';
import { parseWith, route } from '@/lib/server/http';
import { canAccessDifficulty, requiredPlanForDifficulty } from '@/lib/server/plans';
import { getPlan } from '@/lib/server/roadmap/read';
import { createPhotoUpload } from '@/lib/server/storage';
import { adminClient } from '@/lib/server/supabase';
import { idSchema } from '@/lib/server/validation';
import type { Difficulty, StageKind, StageStatus, UploadUrlResponse } from '@/lib/types';

interface StageRow { kind: StageKind; status: StageStatus; difficulty: Difficulty }

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireUser(req);
  const stageId = parseWith(idSchema, (await params).id);
  const plan = await getPlan(user.id);

  const { data, error } = await adminClient()
    .from('roadmap_stages').select('kind, status, difficulty').eq('id', stageId).eq('user_id', user.id).maybeSingle();
  if (error) throw new AppError('INTERNAL', undefined, { details: error.message });
  const stage = data as StageRow | null;
  if (!stage) throw new AppError('NOT_FOUND');

  if (!canAccessDifficulty(plan, stage.difficulty)) {
    throw new AppError('PLAN_LIMIT', undefined, { requiredPlan: requiredPlanForDifficulty(stage.difficulty) ?? 'starter' });
  }
  if (stage.kind === 'connect') throw new AppError('STAGE_NOT_ACTIVE', 'Buddy stages complete on their own.');
  const open = stage.status === 'active' || (stage.kind === 'coop' && stage.status === 'waiting_partner');
  if (!open) throw new AppError('STAGE_NOT_ACTIVE');

  const res: UploadUrlResponse = await createPhotoUpload(user.id, stageId);
  return res;
});
