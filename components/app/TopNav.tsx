'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { AvatarTile } from '@/components/scene/Ninja';
import { ChipLink } from '@/components/ui/Chip';
import { PLAN_LABEL } from '@/lib/format';
import { useMe } from '@/lib/hooks';

const TABS = [
  { href: '/roadmap', label: 'Roadmap', id: 'tab-roadmap' },
  { href: '/map', label: 'Map', id: 'tab-map' },
  { href: '/feed', label: 'Feed', id: 'tab-feed' },
  { href: '/people', label: 'People', id: 'tab-people' },
] as const;

function useCoinBump(coins: number | undefined) {
  const prev = useRef<number | undefined>(undefined);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (coins === undefined) return;
    if (prev.current !== undefined && coins > prev.current) {
      setBump(true);
      const t = setTimeout(() => setBump(false), 400);
      return () => clearTimeout(t);
    }
    prev.current = coins;
  }, [coins]);
  useEffect(() => {
    prev.current = coins;
  }, [coins]);
  return bump;
}

/** Top nav from the design: K7 · chips · coins · plan · avatar. On phones the chips move to <TabBar/>. */
export function TopNav() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const onboarded = me?.onboarded ? me : null;
  const bump = useCoinBump(onboarded?.coins);

  return (
    <header className="sticky top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
      <div className="k7-outline k7-shadow mx-auto flex h-14 max-w-[1320px] items-center gap-3 rounded-[14px] bg-white px-3 md:h-16 md:px-4">
        <Link href="/home" aria-label="Home" className="font-display text-[34px] leading-none text-ink md:text-[38px]">
          K7
        </Link>
        <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
          {TABS.map((t) => {
            const active = pathname === t.href || pathname.startsWith(`${t.href}/`) || (t.href === '/roadmap' && pathname === '/home');
            const badge = t.href === '/people' ? onboarded?.pendingIncoming ?? 0 : 0;
            return (
              <ChipLink key={t.href} href={t.href} active={active}>
                {t.label}
                {badge > 0 ? <span className="ml-0.5">· {badge}</span> : null}
              </ChipLink>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <span
            data-testid="coins"
            className={`inline-flex h-9 items-center gap-1.5 rounded-[8px] border-[3px] border-ink bg-ink px-2.5 font-display text-[22px] leading-none text-yellow ${bump ? 'k7-bounce' : ''}`}
            aria-label={`${onboarded?.coins ?? 0} coins`}
          >
            <Coin size={16} />
            {onboarded ? onboarded.coins : '–'}
          </span>
          <Link href="/pricing" className="k7-label hidden h-9 items-center rounded-[8px] border-[3px] border-ink bg-white px-2.5 hover:bg-mist sm:inline-flex">
            {onboarded ? PLAN_LABEL[onboarded.plan] : 'Free'}
          </Link>
          <Link href="/profile" aria-label="Profile" className="rounded-[10px]">
            {onboarded ? (
              <AvatarTile avatar={onboarded.avatar} size={40} tone="grass" />
            ) : (
              <span className="k7-skeleton block h-10 w-10 rounded-[10px] border-[3px] border-ink" />
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

/** Phone tab bar (≥44px targets, safe area). Same destinations as the chips. */
export function TabBar() {
  const pathname = usePathname();
  const { data: me } = useMe();
  const pending = me?.onboarded ? me.pendingIncoming : 0;
  const items = [{ href: '/home', label: 'Home', id: 'tab-home' }, ...TABS];
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(10px+env(safe-area-inset-bottom))] md:hidden"
    >
      <div className="k7-outline k7-shadow-sm mx-auto grid max-w-[480px] grid-cols-5 gap-1 rounded-[14px] bg-white p-1.5">
        {items.map((t) => {
          const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <Link
              key={t.href}
              href={t.href}
              data-testid={t.id}
              aria-current={active ? 'page' : undefined}
              className={`k7-label relative flex h-11 items-center justify-center rounded-[8px] text-[9px] ${active ? 'bg-ink text-yellow' : 'text-ink'}`}
            >
              {t.label}
              {t.href === '/people' && pending > 0 ? (
                <span data-testid="people-badge" className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-yellow px-1 text-[9px] text-ink">
                  {pending}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
