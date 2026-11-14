'use client';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Coin } from '@/components/scene/Coin';
import { Ninja } from '@/components/scene/Ninja';
import { Button } from '@/components/ui/Button';
import { Sign } from '@/components/ui/Sign';
import { DIFFICULTY_LABEL } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Avatar, Level } from '@/lib/types';

// 11 Level complete — full-screen moment with confetti coins.
export function LevelComplete({ level, avatar, coins, onNext }: { level: Level; avatar: Avatar; coins: number; onNext: () => void }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  if (typeof document === 'undefined') return null;

  async function share() {
    const text = `Level complete! ${level.interest.name} · ${DIFFICULTY_LABEL[level.difficulty]} · ${level.progress.total}/${level.progress.total} stages on K7`;
    try {
      if (navigator.share) await navigator.share({ text, url: window.location.origin });
      else {
        await navigator.clipboard.writeText(`${text} — ${window.location.origin}`);
        toast('Copied to clipboard', { tone: 'success' });
      }
    } catch {
      /* cancelled */
    }
  }

  return createPortal(
    <div data-testid="level-complete" role="dialog" aria-modal="true" aria-label="Level complete" className="fixed inset-0 z-[65] overflow-y-auto bg-[linear-gradient(180deg,var(--color-sky)_0%,#9fb4e4_45%,#c9e3c9_72%,var(--color-sky-low)_100%)]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="k7-confetti absolute top-0"
            style={{ left: `${(i * 53) % 100}%`, animation: `k7-confetti ${2.6 + (i % 5) * 0.4}s linear ${(i % 7) * 0.25}s both` }}
          >
            <Coin size={14 + (i % 3) * 6} />
          </span>
        ))}
      </div>
      <div className="relative mx-auto flex min-h-dvh max-w-[720px] flex-col items-center justify-center gap-5 px-4 py-10 text-center">
        <h1 className="k7-title text-[64px] md:text-[88px]">level complete!</h1>
        <p className="k7-label text-[12px]">
          {level.interest.name} · {DIFFICULTY_LABEL[level.difficulty]} · {level.progress.total} / {level.progress.total} stages
        </p>
        <div className="k7-outline k7-shadow rounded-[16px] bg-[#e8f6d0] p-4">
          <Ninja avatar={avatar} size={88} />
        </div>
        <Sign className="-mt-2">
          <p className="font-display text-[40px] leading-none text-yellow">+{coins}</p>
          <p className="k7-label text-[10px] text-white">coins earned</p>
        </Sign>
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="secondary" onClick={share}>
            share card
          </Button>
          <Button onClick={onNext}>next goal</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
