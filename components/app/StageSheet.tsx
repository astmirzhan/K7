'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { CameraIcon, CheckIcon, LockIcon } from '@/components/scene/Icons';
import { AvatarTile } from '@/components/scene/Ninja';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Field, Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { api, ApiRequestError } from '@/lib/api';
import { DIFFICULTY_LABEL, PLAN_LABEL, planPrice } from '@/lib/format';
import { invalidate, useConnections } from '@/lib/hooks';
import { openPaywall } from '@/lib/paywall';
import { uploadStagePhoto } from '@/lib/photo';
import { toast } from '@/lib/toast';
import type { CompleteStageResponse, Level, Stage, Visibility } from '@/lib/types';

// 08 Photo report — the stage sheet for every kind × status from FRONTEND.md §5.
export function StageSheet({
  stage,
  level,
  open,
  onClose,
  onCompleted,
}: {
  stage: Stage | null;
  level: Level | null;
  open: boolean;
  onClose: () => void;
  onCompleted: (res: CompleteStageResponse, stage: Stage) => void;
}) {
  if (!stage || !level) return null;
  // the form state lives in <Body/> and is keyed by the stage id, so switching stages resets it
  return <Body key={stage.id} stage={stage} level={level} open={open} onClose={onClose} onCompleted={onCompleted} />;
}

function Body({
  stage,
  level,
  open,
  onClose,
  onCompleted,
}: {
  stage: Stage;
  level: Level;
  open: boolean;
  onClose: () => void;
  onCompleted: (res: CompleteStageResponse, stage: Stage) => void;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState(stage.report?.caption ?? '');
  const [visibility, setVisibility] = useState<Visibility>(stage.report?.visibility ?? 'public');
  const [partnerId, setPartnerId] = useState<string | null>(stage.partner?.userId ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<{ photo?: string; partner?: string }>({});
  const isCoop = stage.kind === 'coop';
  const { data: conns } = useConnections();

  const partners = useMemo(
    // any buddy can do a co-op stage with you, whatever their own goals are
    () => conns?.accepted ?? [],
    [conns],
  );

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const lockedByPlan = level.lockedByPlan;
  const title = `stage ${stage.idx} · ${stage.kind === 'coop' ? 'co-op' : stage.kind === 'connect' ? 'find a buddy' : 'solo'}`;

  async function complete() {
    setBusy(true);
    setError(null);
    setFieldErr({});
    try {
      const photoPath = file ? await uploadStagePhoto(stage.id, file) : undefined;
      const res = await api.completeStage(stage.id, {
        photoPath,
        caption: caption.trim() || undefined,
        visibility,
        partnerId: isCoop ? partnerId ?? undefined : undefined,
      });
      await invalidate.afterStageComplete();
      onCompleted(res, stage);
    } catch (e) {
      if (!(e instanceof ApiRequestError)) {
        setError((e as Error).message);
        return;
      }
      switch (e.code) {
        case 'PHOTO_REQUIRED':
          setFieldErr({ photo: e.message });
          return;
        case 'PARTNER_REQUIRED':
        case 'PARTNER_INVALID':
          setFieldErr({ partner: e.message });
          return;
        case 'CONNECT_REQUIRED':
          router.push(`/map?interest=${stage.interestSlug}`);
          return;
        case 'STAGE_NOT_ACTIVE':
          await invalidate.afterStageComplete();
          toast(e.message);
          onClose();
          return;
        case 'PLAN_LIMIT':
          return; // paywall opened globally
        default:
          setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <div className="flex flex-wrap items-center gap-3 pr-8">
      <h2 className="font-display text-[44px] leading-none">{title}</h2>
      <DifficultyBadge difficulty={stage.difficulty} coins={stage.coins} />
    </div>
  );

  // ---- status branches ----
  let body: React.ReactNode;

  if (stage.status === 'done') {
    body = (
      <div className="flex flex-col gap-4">
        <h3 className="text-[18px] font-semibold">{stage.title}</h3>
        <span className="k7-label inline-flex w-fit items-center gap-1.5 rounded-[8px] border-[3px] border-ink bg-grass px-2.5 py-1 text-[10px]">
          <CheckIcon size={11} /> done
        </span>
        {stage.report?.photoUrl ? (
          <img src={stage.report.photoUrl} alt={stage.report.caption || stage.title} loading="lazy" decoding="async" className="k7-outline max-h-[360px] w-full rounded-[12px] object-cover" />
        ) : null}
        {stage.report?.caption ? <p className="text-[15px]">{stage.report.caption}</p> : null}
        {stage.partner ? <p className="text-[14px] text-ink/70">with {stage.partner.displayName}</p> : null}
      </div>
    );
  } else if (lockedByPlan && level.requiredPlan) {
    body = (
      <div className="flex flex-col items-start gap-4">
        <p className="text-[15px]">{stage.title}</p>
        <div className="k7-outline flex items-center gap-3 rounded-[12px] bg-mist px-4 py-3">
          <LockIcon size={20} />
          <div>
            <p className="font-semibold">
              Unlock {DIFFICULTY_LABEL[level.difficulty]}: {level.interest.name}
            </p>
            <p className="text-[13px] text-ink/70">
              {PLAN_LABEL[level.requiredPlan]} · {planPrice(level.requiredPlan)}
            </p>
          </div>
        </div>
        <Button onClick={() => openPaywall({ requiredPlan: level.requiredPlan!, reason: 'level', context: level.interest.name })}>
          <Coin size={18} /> unlock {DIFFICULTY_LABEL[level.difficulty].toLowerCase()}
        </Button>
      </div>
    );
  } else if (stage.status === 'locked') {
    body = (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[15px]">{stage.title}</p>
        <p className="k7-outline rounded-[10px] bg-mist px-4 py-3 text-[14px]">Finish the previous stage first.</p>
      </div>
    );
  } else if (stage.kind === 'connect') {
    body = (
      <div className="flex flex-col items-start gap-4">
        <p className="text-[15px]">{stage.description}</p>
        <p className="k7-outline rounded-[10px] bg-mist px-4 py-3 text-[14px]">
          Find a buddy with {level.interest.name} on the map. This stage completes itself when a connection is accepted.
        </p>
        <ButtonLink href={`/map?interest=${stage.interestSlug}`}>find a buddy</ButtonLink>
      </div>
    );
  } else {
    const waiting = stage.status === 'waiting_partner';
    body = (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void complete();
        }}
      >
        <p className="text-[15px] text-ink/85">{stage.description}</p>

        {waiting && stage.partner ? (
          <div data-testid="waiting-partner" className="k7-outline flex items-center gap-3 rounded-[12px] bg-mist px-4 py-3">
            <div className="k7-pulse">
              <AvatarTile avatar={stage.partner.avatar} size={44} />
            </div>
            <p className="text-[14px]">
              <span className="font-semibold">Waiting for {stage.partner.displayName}</span> — they need to upload their photo too. You can change your photo or partner below.
            </p>
          </div>
        ) : null}

        {stage.steps && stage.steps.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {stage.steps.map((s, i) => (
              <li key={i} className="flex gap-2 text-[14px]">
                <span className="font-display text-[20px] leading-none text-ink/60">{i + 1}</span>
                {s}
              </li>
            ))}
          </ul>
        ) : stage.steps === null && stage.stepsLocked ? (
          <button
            type="button"
            onClick={() => openPaywall({ requiredPlan: 'pro', reason: 'steps' })}
            className="k7-outline flex items-center gap-2 rounded-[10px] bg-mist px-4 py-3 text-left text-[14px] hover:bg-white"
          >
            <LockIcon size={16} /> Step-by-step plan — Pro
          </button>
        ) : null}

        {isCoop ? (
          <Field label="Partner" error={fieldErr.partner}>
            {partners.length === 0 ? (
              <div className="flex flex-col items-start gap-2">
                <p className="text-[14px] text-ink/70">Connect with a buddy on the map first — any buddy can do this stage with you.</p>
                <ButtonLink href={`/map?interest=${stage.interestSlug}`} size="sm" variant="secondary">
                  open the map
                </ButtonLink>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {partners.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    data-testid={`partner-option-${c.other.userId}`}
                    aria-pressed={partnerId === c.other.userId}
                    onClick={() => setPartnerId(c.other.userId)}
                    className={`k7-label flex h-10 items-center gap-2 rounded-[8px] border-[3px] border-ink pl-1 pr-3 ${partnerId === c.other.userId ? 'bg-ink text-yellow' : 'bg-white'}`}
                  >
                    <AvatarTile avatar={c.other.avatar} size={28} />
                    {c.other.displayName}
                  </button>
                ))}
              </div>
            )}
          </Field>
        ) : null}

        <Field label={stage.requiresPhoto ? 'Photo (required)' : 'Photo (optional, +2 coins)'} error={fieldErr.photo}>
          <label
            className={`k7-outline relative flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[12px] border-dashed bg-mist px-4 py-5 text-center hover:bg-white ${
              fieldErr.photo ? 'border-danger' : ''
            }`}
          >
            <input
              type="file"
              accept="image/*"
              capture="environment"
              data-testid="stage-photo-input"
              className="sr-only"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            {preview ? (
              <img src={preview} alt="Your photo" className="max-h-[220px] rounded-[8px] object-contain" />
            ) : (
              <>
                <CameraIcon size={28} />
                <span className="font-display text-[22px] leading-none">take or upload a photo</span>
                <span className="text-[12px] text-ink/60">Compressed to 1600px before upload</span>
              </>
            )}
          </label>
        </Field>

        <Field label="Caption" htmlFor="caption">
          <Input id="caption" data-testid="stage-caption" maxLength={140} placeholder={`${stage.title}…`} value={caption} onChange={(e) => setCaption(e.target.value)} />
        </Field>

        <div className="flex flex-wrap items-center gap-2" data-testid="stage-visibility">
          <span className="k7-label mr-1">Show in</span>
          <Chip size="sm" active={visibility === 'public'} onClick={() => setVisibility('public')}>
            public feed
          </Chip>
          <Chip size="sm" active={visibility === 'private'} onClick={() => setVisibility('private')}>
            only me
          </Chip>
        </div>

        {error ? (
          <p role="alert" className="text-[13px] font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" pending={busy} data-testid="stage-complete">
            {waiting ? 'update report' : 'complete stage'}
          </Button>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold">
            <Coin size={16} /> +{stage.coins}
            {isCoop ? ' ×2 co-op bonus' : ''}
            {!stage.requiresPhoto ? ' · +2 photo' : ' · +2 photo'}
          </span>
        </div>
      </form>
    );
  }

  return (
    <Modal open={open} onClose={onClose} label={title} testId="stage-sheet" width="max-w-[640px]">
      <div className="flex flex-col gap-4">
        {header}
        <p className="-mt-2 text-[16px] font-semibold">{stage.title}</p>
        {body}
      </div>
    </Modal>
  );
}
