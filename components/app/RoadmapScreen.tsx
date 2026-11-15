'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { OnboardedGate } from '@/components/OnboardedGate';
import { LockIcon } from '@/components/scene/Icons';
import { Chip } from '@/components/ui/Chip';
import { CoinBurst } from '@/components/ui/CoinBurst';
import { Panel } from '@/components/ui/Panel';
import { ErrorState, PanelSkeleton, Skeleton } from '@/components/ui/States';
import { DIFFICULTY_LABEL, PLAN_LABEL } from '@/lib/format';
import { useRoadmap } from '@/lib/hooks';
import { KEYS } from '@/lib/api';
import { mutate as revalidateKey } from 'swr';
import { openPaywall } from '@/lib/paywall';
import { toast } from '@/lib/toast';
import type { CompleteStageResponse, Level, OnboardedMe, Stage } from '@/lib/types';
import { LevelComplete } from './LevelComplete';
import { QuestPanel } from './QuestPanel';
import { RoadmapBoard } from './RoadmapBoard';
import { StageSheet } from './StageSheet';

// 05 Roadmap layout shared by /home and /roadmap: level chips, the board, and the quest panel on the right.
export function RoadmapScreen({ mode }: { mode: 'home' | 'roadmap' }) {
  return (
    <OnboardedGate fallback={<RoadmapSkeleton />}>
      {(me) => <Inner me={me} mode={mode} />}
    </OnboardedGate>
  );
}

function RoadmapSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="mb-3 flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Skeleton className="h-[420px] w-full rounded-[16px]" />
      </div>
      <PanelSkeleton lines={5} />
    </div>
  );
}

function Inner({ me, mode }: { me: OnboardedMe; mode: 'home' | 'roadmap' }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: levels, error, mutate, isLoading } = useRoadmap();
  const stageParam = params.get('stage');
  const [slug, setSlug] = useState<string | null>(null);
  // ?stage=<id> opens the sheet once; afterwards the sheet always shows the fresh stage from the roadmap
  const [sheetId, setSheetId] = useState<string | null>(stageParam);
  const [burst, setBurst] = useState<number | null>(null);
  const [complete, setComplete] = useState<{ level: Level; coins: number } | null>(null);
  const [seenDone, setSeenDone] = useState<string>('');
  const sheet = useMemo(() => (sheetId && levels ? levels.flatMap((l) => l.stages).find((s) => s.id === sheetId) ?? null : null), [levels, sheetId]);

  // default level: the one with the active stage (quest of the day), else the first
  const current = useMemo(() => {
    if (!levels) return null;
    const bySlug = slug ? levels.find((l) => l.interest.slug === slug) : undefined;
    if (bySlug) return bySlug;
    const bySheet = sheet ? levels.find((l) => l.interest.slug === sheet.interestSlug) : undefined;
    if (bySheet) return bySheet;
    const active = levels.find((l) => l.stages.some((s) => s.status === 'active' || s.status === 'waiting_partner'));
    return active ?? levels[0] ?? null;
  }, [levels, slug, sheet]);

  const openStage = useCallback(
    (stage: Stage) => {
      const lvl = levels?.find((l) => l.interest.slug === stage.interestSlug);
      if (!lvl) return;
      setSlug(lvl.interest.slug);
      if (lvl.lockedByPlan && lvl.requiredPlan && stage.status !== 'done') {
        openPaywall({ requiredPlan: lvl.requiredPlan, reason: 'level', context: lvl.interest.name });
        return;
      }
      if (stage.status === 'locked') {
        toast('Finish the previous stage first');
        return;
      }
      setSheetId(stage.id);
    },
    [levels],
  );

  // a partner finishing a co-op changes my coins too: refresh them as soon as the roadmap poll sees it
  const doneKey = levels ? levels.flatMap((l) => l.stages).filter((st) => st.status === 'done').length : 0;
  useEffect(() => {
    if (doneKey > 0) void revalidateKey(KEYS.me);
  }, [doneKey]);

  // strip ?stage from the URL once it has been consumed
  useEffect(() => {
    if (stageParam) router.replace(mode === 'home' ? '/home' : '/roadmap');
  }, [stageParam, router, mode]);

  // partner-side "level complete" detection via polling (FRONTEND F15): adjust state while rendering
  const doneSlugs = levels ? levels.filter((l) => l.progress.total > 0 && l.progress.done === l.progress.total).map((l) => l.interest.slug).join(',') : '';
  if (levels && doneSlugs !== seenDone) {
    setSeenDone(doneSlugs);
    for (const l of levels) {
      if (!doneSlugs.split(',').includes(l.interest.slug)) continue;
      const key = `k7.levelDone.${me.id}.${l.interest.slug}`;
      try {
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1');
          if (!complete) setComplete({ level: l, coins: l.stages.reduce((a, s) => a + s.coins, 0) });
        }
      } catch {
        /* ignore */
      }
    }
  }

  function onCompleted(res: CompleteStageResponse, stage: Stage) {
    setBurst(res.coinsAwarded);
    const lvl = levels?.find((l) => l.interest.slug === stage.interestSlug);
    if (res.levelCompleted && lvl) {
      try {
        localStorage.setItem(`k7.levelDone.${me.id}.${lvl.interest.slug}`, '1');
      } catch {
        /* ignore */
      }
      setSheetId(null);
      setComplete({ level: lvl, coins: res.coinsAwarded });
    } else if (!res.waitingForPartner) {
      setSheetId(null); // waiting_partner keeps the sheet open: it re-renders from the fresh roadmap
    }
  }

  if (error && !levels) return <ErrorState message={error.message} onRetry={() => void mutate()} />;
  if (isLoading || !levels || !current) return <RoadmapSkeleton />;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px] lg:gap-6">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Levels">
          {levels.map((l) => {
            const active = l.interest.slug === current.interest.slug;
            return (
              <Chip
                key={l.interest.slug}
                role="tab"
                aria-selected={active}
                active={active}
                onClick={() => {
                  setSlug(l.interest.slug);
                  if (l.lockedByPlan && l.requiredPlan) openPaywall({ requiredPlan: l.requiredPlan, reason: 'level', context: l.interest.name });
                }}
                data-testid={l.lockedByPlan ? `level-lock-${l.interest.slug}` : undefined}
              >
                {l.lockedByPlan ? <LockIcon size={11} color="currentColor" /> : null}
                {DIFFICULTY_LABEL[l.difficulty]} · {l.interest.name}
                <span className="opacity-60">
                  {l.progress.done}/{l.progress.total}
                </span>
              </Chip>
            );
          })}
        </div>

        <div className="relative">
          <Panel tone="mist" shadow="md" className="overflow-hidden px-3 py-6 md:px-6 md:py-8">
            <RoadmapBoard level={current} avatar={me.avatar} onStage={openStage} selectedId={sheet?.id} />
          </Panel>
          {current.lockedByPlan && current.requiredPlan ? (
            <button
              type="button"
              onClick={() => openPaywall({ requiredPlan: current.requiredPlan!, reason: 'level', context: current.interest.name })}
              className="absolute inset-0 flex items-center justify-center rounded-[16px] bg-ink/25"
              aria-label={`Unlock ${current.interest.name}`}
            >
              <span className="k7-outline k7-shadow flex items-center gap-2 rounded-[12px] bg-white px-5 py-3 font-display text-[26px] leading-none">
                <LockIcon size={20} /> {PLAN_LABEL[current.requiredPlan]} · unlock {DIFFICULTY_LABEL[current.difficulty].toLowerCase()}
              </span>
            </button>
          ) : null}
        </div>
      </section>

      <QuestPanel me={me} levels={levels} onStart={openStage} className="lg:sticky lg:top-24 lg:self-start" />

      <StageSheet stage={sheet} level={sheet ? levels.find((l) => l.interest.slug === sheet.interestSlug) ?? null : null} open={sheet !== null} onClose={() => setSheetId(null)} onCompleted={onCompleted} />
      {burst !== null ? <CoinBurst amount={burst} onDone={() => setBurst(null)} /> : null}
      {complete ? (
        <LevelComplete
          level={complete.level}
          avatar={me.avatar}
          coins={complete.coins}
          userId={me.id}
          levels={levels}
          onNext={() => {
            setComplete(null);
            const next = levels.find((l) => l.progress.done < l.progress.total);
            if (next) setSlug(next.interest.slug);
          }}
        />
      ) : null}
    </div>
  );
}
