'use client';
import { useState } from 'react';
import { OnboardedGate } from '@/components/OnboardedGate';
import { Coin } from '@/components/scene/Coin';
import { Ninja } from '@/components/scene/Ninja';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Divider, Panel } from '@/components/ui/Panel';
import { PanelSkeleton } from '@/components/ui/States';
import { hardNavigate, signOut } from '@/lib/auth-client';
import { MEET_STYLE_LABEL, PLAN_LABEL } from '@/lib/format';
import type { OnboardedMe } from '@/lib/types';
import { useRoadmap } from '@/lib/hooks';
import { BadgeShelf } from './BadgeShelf';
import { STATE_NAMES } from '@/lib/us';

// 14 Profile: read-only in the MVP + plan + sign out.
export function ProfileScreen() {
  return (
    <OnboardedGate fallback={<PanelSkeleton lines={6} className="mx-auto max-w-[560px]" />}>
      {(me) => <Inner me={me} />}
    </OnboardedGate>
  );
}

function Inner({ me }: { me: OnboardedMe }) {
  const { data: levels } = useRoadmap();
  const [busy, setBusy] = useState(false);

  async function out() {
    setBusy(true);
    await signOut();
    hardNavigate('/');
  }

  const rows: Array<[string, string]> = [
    ['City', `${me.city}, ${STATE_NAMES[me.state]}`],
    ['Age', me.ageRange],
    ['Meet style', MEET_STYLE_LABEL[me.meetStyle]],
  ];

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <Panel className="flex flex-col gap-4 p-5 md:p-6">
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="k7-outline rounded-[14px] bg-[#e8f6d0] p-2">
              <Ninja avatar={me.avatar} size={72} />
            </div>
            {me.avatar.name ? <span className="k7-label max-w-[96px] truncate text-[9px] text-ink/70" data-testid="ninja-name">{me.avatar.name}</span> : null}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[36px] leading-none">{me.displayName}</h1>
            <p className="mt-1 text-[13px] text-ink/70">{me.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Tag tone="ink">
                <Coin size={12} /> {me.coins}
              </Tag>
              <Tag tone="yellow">{PLAN_LABEL[me.plan]}</Tag>
            </div>
          </div>
        </div>
        {me.bio ? <p className="text-[15px]">{me.bio}</p> : null}
        <Divider />
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px]">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="k7-label pt-0.5 text-ink/60">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
          <dt className="k7-label pt-0.5 text-ink/60">Social</dt>
          <dd className="truncate">
            <a href={me.socialUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-4">
              {me.socialUrl.replace(/^https?:\/\/(www\.)?/, '')}
            </a>
          </dd>
        </dl>
        <Divider />
        <div>
          <p className="k7-label mb-2 text-ink/60">Goals</p>
          <ul className="flex flex-col gap-2">
            {[...me.interests]
              .sort((a, b) => a.difficulty - b.difficulty)
              .map((i) => (
                <li key={i.interest.slug} className="flex items-center justify-between gap-2 rounded-[10px] border-[3px] border-ink bg-mist px-3 py-2 text-[14px] font-semibold">
                  <span>
                    <span aria-hidden="true">{i.interest.icon}</span> {i.interest.name}
                  </span>
                  <DifficultyBadge difficulty={i.difficulty} />
                </li>
              ))}
          </ul>
        </div>
      </Panel>

      <Panel shadow="sm" className="flex flex-col gap-3 p-5" data-testid="badges">
        <p className="k7-label text-ink/60">Badges</p>
        <BadgeShelf levels={levels} />
        <p className="text-[12px] text-ink/60">Finish a level to earn its badge: bronze for easy, silver for medium, gold for hard.</p>
      </Panel>

      <Panel shadow="sm" className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex-1">
          <p className="font-display text-[24px] leading-none">{PLAN_LABEL[me.plan]} plan</p>
          <p className="text-[13px] text-ink/70">
            {me.limits.connectsPerMonth === null ? 'Unlimited connects' : `${me.limits.connectsUsedThisMonth}/${me.limits.connectsPerMonth} connects used this month`}
            {me.limits.mapVisible === null ? ' · full map' : ` · map shows ${me.limits.mapVisible}`}
          </p>
        </div>
        <ButtonLink href="/pricing" size="sm" variant="ink">
          change plan
        </ButtonLink>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] text-ink/60">City only on the map — never your exact location.</p>
        <Button variant="secondary" size="sm" pending={busy} onClick={out}>
          sign out
        </Button>
      </div>
    </div>
  );
}
