'use client';
import { PeopleIcon } from '@/components/scene/Icons';
import { Skeleton } from '@/components/ui/States';
import { usePublicStats } from '@/lib/hooks';
import { STATE_NAMES } from '@/lib/us';

/** "64 people in 9 states are on the map right now" — live from /api/stats. Hidden on error. */
export function LiveCounter() {
  const { data, error } = usePublicStats();
  if (error) return null;
  if (!data) return <Skeleton className="h-10 w-72" />;
  return (
    <p data-testid="live-counter" className="k7-outline k7-shadow-sm inline-flex items-center gap-2 rounded-[12px] bg-white px-4 py-2 text-[14px] font-semibold">
      <span className="relative flex h-2.5 w-2.5">
        <span className="k7-pulse absolute inline-flex h-full w-full rounded-full bg-leaf" />
      </span>
      <PeopleIcon size={16} />
      {data.people} people in {data.states} states are on the map
    </p>
  );
}

/** Top states with a bar each — the map teaser below the fold. */
export function TopStates() {
  const { data, error } = usePublicStats();
  if (error) return <p className="text-[14px] text-ink/70">The map is warming up. Open it after sign-up.</p>;
  if (!data)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  const max = Math.max(1, ...data.top.map((t) => t.count));
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          [data.people, 'people'],
          [data.cities, 'cities'],
          [data.states, 'states'],
        ].map(([n, label]) => (
          <div key={label} className="k7-outline rounded-[12px] bg-mist px-2 py-3">
            <p className="font-display text-[40px] leading-none">{n}</p>
            <p className="k7-label text-[10px] text-ink/70">{label}</p>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-2" aria-label="Most active states">
        {data.top.map((t) => (
          <li key={t.state} className="flex items-center gap-3 text-[14px]">
            <span className="k7-label w-8 shrink-0">{t.state}</span>
            <span className="relative h-7 flex-1 overflow-hidden rounded-[6px] border-[3px] border-ink bg-white">
              <span className="absolute inset-y-0 left-0 bg-grass" style={{ width: `${Math.max(8, (t.count / max) * 100)}%` }} />
              <span className="relative px-2 text-[12px] font-semibold leading-[22px]">{STATE_NAMES[t.state]}</span>
            </span>
            <span className="font-display w-8 shrink-0 text-right text-[22px] leading-none">{t.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
