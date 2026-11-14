'use client';
import { useEffect, useState } from 'react';
import { Coin } from '@/components/scene/Coin';

/** Full-screen coin burst shown for ~1.2 s after a stage completes. */
export function CoinBurst({ amount, onDone }: { amount: number; onDone?: () => void }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onDone?.();
    }, 1400);
    return () => clearTimeout(t);
  }, [onDone]);
  if (!visible) return null;
  const n = Math.min(14, 6 + amount * 2);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center">
      <div className="relative">
        {Array.from({ length: n }).map((_, i) => {
          const a = (i / n) * Math.PI * 2;
          const r = 110 + (i % 3) * 30;
          const style = {
            '--dx': `${Math.cos(a) * r}px`,
            '--dy': `${Math.sin(a) * r - 40}px`,
            animation: `k7-coin-burst 1.1s ease-out ${i * 25}ms both`,
          } as React.CSSProperties;
          return (
            <span key={i} className="k7-coin absolute left-0 top-0" style={style}>
              <Coin size={22} />
            </span>
          );
        })}
        <div className="k7-pop k7-outline k7-shadow rounded-[12px] bg-yellow px-5 py-2 font-display text-[36px] leading-none text-ink">
          +{amount}
        </div>
      </div>
    </div>
  );
}
