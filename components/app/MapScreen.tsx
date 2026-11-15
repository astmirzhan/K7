'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { OnboardedGate } from '@/components/OnboardedGate';
import { Cloud } from '@/components/scene/Cloud';
import { LockIcon } from '@/components/scene/Icons';
import { Chip } from '@/components/ui/Chip';
import { Panel } from '@/components/ui/Panel';
import { EmptyState, ErrorState, PanelSkeleton, Skeleton } from '@/components/ui/States';
import { useMapStates, useMapUsers } from '@/lib/hooks';
import { openPaywall } from '@/lib/paywall';
import { US_STATES, type OnboardedMe, type UsState } from '@/lib/types';
import { STATE_NAMES } from '@/lib/us';
import { cityCoords } from '@/lib/us-cities';
import { UsMap, type MapPin } from './UsMap';
import { MatchCard } from './MatchCard';

const isState = (v: string | null): v is UsState => !!v && (US_STATES as readonly string[]).includes(v);

// 07 Map: tile-grid USA with counts, selected state → cards with shared interests. Safety line always visible.
export function MapScreen() {
  return (
    <OnboardedGate fallback={<MapSkeleton />}>
      {(me) => <Inner me={me} />}
    </OnboardedGate>
  );
}

function MapSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
      <Skeleton className="aspect-[11/8] w-full rounded-[16px]" />
      <PanelSkeleton lines={6} />
    </div>
  );
}

function Inner({ me }: { me: OnboardedMe }) {
  const router = useRouter();
  const params = useSearchParams();
  const stateParam = params.get('state');
  const interest = params.get('interest');
  const selected: UsState = isState(stateParam) ? stateParam : me.state;

  const [zoomed, setZoomed] = useState(true);
  const states = useMapStates();
  const users = useMapUsers(selected);
  const counts = useMemo(() => new Map((states.data ?? []).map((s) => [s.state, s.count])), [states.data]);

  const items = useMemo(() => {
    const all = users.data?.items ?? [];
    return interest ? all.filter((c) => c.sharedInterests.some((s) => s.slug === interest)) : all;
  }, [users.data, interest]);
  const interestName = interest ? me.interests.find((i) => i.interest.slug === interest)?.interest.name ?? interest : null;

  function go(next: { state?: UsState; interest?: string | null }) {
    const q = new URLSearchParams();
    const st = next.state ?? selected;
    if (st) q.set('state', st);
    const it = next.interest === undefined ? interest : next.interest;
    if (it) q.set('interest', it);
    router.replace(`/map?${q.toString()}`);
  }

  const hidden = users.data?.hiddenCount ?? 0;
  const pins: MapPin[] = items.map((c) => ({
    id: c.user.userId,
    name: `${c.user.displayName} · ${c.user.city}`,
    avatar: c.user.avatar,
    state: c.user.state,
    coords: cityCoords(c.user.state, c.user.city),
  }));

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_420px] lg:gap-6">
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="font-display text-[34px] leading-none">people on the map</h1>
          <span className="k7-label ml-auto rounded-[8px] border-[3px] border-ink bg-white px-2.5 py-1 text-[10px]">City only — never your exact location</span>
        </div>

        {states.error && !states.data ? (
          <ErrorState message={states.error.message} onRetry={() => void states.mutate()} />
        ) : (
          <Panel tone="mist" shadow="md" className="relative overflow-hidden p-0">
            <UsMap
              counts={counts}
              selected={selected}
              myState={me.state}
              zoomed={zoomed}
              pins={pins}
              onSelect={(st) => {
                setZoomed(true);
                go({ state: st });
              }}
              onPin={(id) => {
                const el = document.querySelector(`[data-testid="match-card-${id}"]`);
                el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el?.classList.add('k7-bounce');
                window.setTimeout(() => el?.classList.remove('k7-bounce'), 400);
              }}
            />
            {/* clouds drifting across, behind the controls */}
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="k7-drift absolute top-[8%] w-full"><Cloud width={90} /></div>
              <div className="k7-drift absolute top-[62%] w-full [animation-delay:-28s] [animation-duration:80s]"><Cloud width={64} /></div>
            </div>
            <div className="absolute left-3 top-3 flex flex-wrap gap-2 md:left-5 md:top-5">
              <Chip size="sm" active={!zoomed} onClick={() => setZoomed((z) => !z)} data-testid="map-zoom">
                {zoomed ? 'US view' : `zoom to ${selected}`}
              </Chip>
              <label className="sr-only" htmlFor="map-state">State</label>
              <select
                id="map-state"
                data-testid="map-state-select"
                value={selected}
                onChange={(e) => {
                  setZoomed(true);
                  go({ state: e.target.value as UsState });
                }}
                className="k7-label h-7 rounded-[8px] border-[3px] border-ink bg-white pl-2 pr-7 text-[10px]"
              >
                {US_STATES.map((st) => (
                  <option key={st} value={st}>
                    {STATE_NAMES[st]} · {counts.get(st) ?? 0}
                  </option>
                ))}
              </select>
            </div>
            {states.isLoading && !states.data ? <p className="k7-label mt-2 text-center text-ink/60">Counting people…</p> : null}
          </Panel>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="k7-label text-ink/70">Filter</span>
          <Chip size="sm" active={!interest} onClick={() => go({ interest: null })}>
            all
          </Chip>
          {me.interests.map((i) => (
            <Chip key={i.interest.slug} size="sm" active={interest === i.interest.slug} onClick={() => go({ interest: i.interest.slug })}>
              <span aria-hidden="true">{i.interest.icon}</span> {i.interest.name}
            </Chip>
          ))}
        </div>
      </section>

      <section aria-live="polite" className="flex min-w-0 flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-[30px] leading-none">
            {STATE_NAMES[selected]}
            {interestName ? <span className="text-ink/60"> · {interestName}</span> : null}
          </h2>
          <span className="k7-label text-ink/70">
            {counts.get(selected) ?? 0} total
          </span>
        </div>

        {users.error && !users.data ? (
          <ErrorState message={users.error.message} onRetry={() => void users.mutate()} />
        ) : users.isLoading && !users.data ? (
          <>
            <PanelSkeleton lines={3} />
            <PanelSkeleton lines={3} />
          </>
        ) : items.length === 0 ? (
          <EmptyState
            title={hidden > 0 ? 'More people with Starter' : `Nobody here yet`}
            text={
              hidden > 0
                ? `${hidden} more ${hidden === 1 ? 'person' : 'people'} in ${STATE_NAMES[selected]} share your interests.`
                : interestName
                  ? `Be the first in ${STATE_NAMES[selected]} with ${interestName}. Try another state or interest.`
                  : `Pick another state or come back later — new people join every day.`
            }
            action={hidden > 0 ? { label: 'see everyone', onClick: () => openPaywall({ requiredPlan: 'starter', reason: 'map', context: `${hidden} more people in ${STATE_NAMES[selected]}` }) } : interest ? { label: 'show everyone', onClick: () => go({ interest: null }) } : undefined}
          />
        ) : (
          <>
            {items.map((c) => (
              <MatchCard key={c.user.userId} card={c} onGone={() => void users.mutate()} />
            ))}
            {hidden > 0 ? (
              <button
                type="button"
                data-testid="hidden-more"
                onClick={() => openPaywall({ requiredPlan: 'starter', reason: 'map', context: `${hidden} more people in ${STATE_NAMES[selected]}` })}
                className="k7-outline k7-shadow-sm flex items-center gap-3 rounded-[16px] bg-white p-4 text-left hover:bg-mist"
              >
                <LockIcon size={20} />
                <span className="flex-1">
                  <span className="block font-display text-[24px] leading-none">+{hidden} more with Starter</span>
                  <span className="text-[13px] text-ink/70">Free shows up to {me.limits.mapVisible ?? '∞'} people. Starter shows everyone.</span>
                </span>
              </button>
            ) : null}
          </>
        )}
        <p className="text-[12px] text-ink/60">City only — never your exact location. Meet in public places.</p>
      </section>
    </div>
  );
}
