'use client';
import Link from 'next/link';
import { Coin } from '@/components/scene/Coin';
import { LockIcon, PeopleIcon } from '@/components/scene/Icons';
import { AvatarTile } from '@/components/scene/Ninja';
import { Button, ButtonLink } from '@/components/ui/Button';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Panel } from '@/components/ui/Panel';
import { DIFFICULTY_LABEL, PLAN_LABEL, nearbyLine, planPrice } from '@/lib/format';
import { openPaywall } from '@/lib/paywall';
import type { Level, OnboardedMe, Stage } from '@/lib/types';

// Right panel of 05: QUEST OF THE DAY · badge · title · minutes · start quest · "N people in Texas…" · find a partner.
export function QuestPanel({
  me,
  levels,
  onStart,
  className = '',
}: {
  me: OnboardedMe;
  levels: Level[] | undefined;
  onStart: (stage: Stage) => void;
  className?: string;
}) {
  const quest = me.questOfDay;
  const waiting = levels?.flatMap((l) => l.stages).find((s) => s.status === 'waiting_partner');
  const lockedLevel = levels?.find((l) => l.lockedByPlan);
  const questLevel = quest ? levels?.find((l) => l.interest.slug === quest.interestSlug) : undefined;
  const nearby = quest ? me.nearby.find((n) => n.interestSlug === quest.interestSlug) : me.nearby[0];

  return (
    <Panel className={`flex flex-col gap-4 p-5 md:p-6 ${className}`} data-testid="quest-of-day">
      <span className="k7-label text-leaf">Quest of the day</span>

      {quest ? (
        <>
          <DifficultyBadge difficulty={quest.difficulty} coins={quest.coins} className="w-fit" />
          <h2 className="font-display text-[40px] leading-[0.95] md:text-[44px]">
            Stage {quest.idx} · {quest.title}
          </h2>
          <p className="text-[15px] text-ink/80">
            {quest.minutes} minutes. Not harder than scrolling your feed.
          </p>
          <Button onClick={() => onStart(quest)} className="w-fit">
            start quest
          </Button>
        </>
      ) : waiting && waiting.partner ? (
        <>
          <div className="flex items-center gap-3">
            <div className="k7-pulse">
              <AvatarTile avatar={waiting.partner.avatar} size={48} />
            </div>
            <h2 className="font-display text-[36px] leading-[0.95]">Waiting for {waiting.partner.displayName}…</h2>
          </div>
          <p className="text-[15px] text-ink/80">Stage {waiting.idx} counts when you both upload a photo.</p>
          <Button variant="secondary" onClick={() => onStart(waiting)} className="w-fit">
            open stage
          </Button>
        </>
      ) : lockedLevel && lockedLevel.requiredPlan ? (
        <>
          <h2 className="font-display text-[40px] leading-[0.95]">
            Unlock {DIFFICULTY_LABEL[lockedLevel.difficulty]}: {lockedLevel.interest.name}
          </h2>
          <p className="text-[15px] text-ink/80">
            {lockedLevel.progress.total} stages. {PLAN_LABEL[lockedLevel.requiredPlan]} · {planPrice(lockedLevel.requiredPlan)}.
          </p>
          <Button onClick={() => openPaywall({ requiredPlan: lockedLevel.requiredPlan!, reason: 'level', context: lockedLevel.interest.name })} className="w-fit">
            <LockIcon size={16} /> unlock
          </Button>
        </>
      ) : (
        <>
          <h2 className="font-display text-[40px] leading-[0.95]">All caught up</h2>
          <p className="text-[15px] text-ink/80">Every open stage is done. Check the map for new people.</p>
          <ButtonLink href="/map" className="w-fit">
            open the map
          </ButtonLink>
        </>
      )}

      {nearby ? (
        <Link
          href={`/map?state=${nearby.state}&interest=${nearby.interestSlug}`}
          data-testid={`nearby-${nearby.interestSlug}`}
          className="flex items-start gap-2 rounded-[8px] text-[14px] font-semibold hover:underline"
        >
          <PeopleIcon size={18} className="mt-0.5" />
          {nearbyLine(nearby)}
        </Link>
      ) : null}
      {me.nearby
        .filter((n) => n !== nearby)
        .map((n) => (
          <Link key={n.interestSlug} href={`/map?state=${n.state}&interest=${n.interestSlug}`} data-testid={`nearby-${n.interestSlug}`} className="-mt-2 flex items-start gap-2 text-[13px] text-ink/70 hover:underline">
            <PeopleIcon size={16} className="mt-0.5" />
            {nearbyLine(n)}
          </Link>
        ))}

      <ButtonLink href={quest ? `/map?interest=${quest.interestSlug}` : '/map'} variant="secondary" className="w-fit">
        find a partner
      </ButtonLink>

      <p className="text-[13px] text-ink/70">No streaks to lose: your progress stays where you left it.</p>
      {me.pendingIncoming > 0 ? (
        <Link href="/people" className="flex items-center gap-2 text-[13px] font-semibold text-ink underline underline-offset-4">
          <Coin size={14} /> {me.pendingIncoming} new connect request{me.pendingIncoming > 1 ? 's' : ''}
        </Link>
      ) : null}
      {questLevel?.lockedByPlan ? null : null}
    </Panel>
  );
}
