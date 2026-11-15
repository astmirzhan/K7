// Scene/Flappy: sky gradient, pixel cloud band, grass hills, stripe band and dotted ground (1440 × 810 in Figma).
// Rendered behind every screen; children scroll above it.
import type { ReactNode } from 'react';
import { Cloud } from './Cloud';
import { Pipe } from './Pipe';

export type SceneVariant = 'hero' | 'form' | 'app';

// Heights (in 8px steps) of the stepped silhouettes, sampled from the design.
const CLOUD_BAND = [6, 7, 7, 8, 9, 8, 7, 6, 5, 5, 6, 8, 9, 10, 9, 8, 7, 6, 6, 7, 8, 8, 7, 6, 5, 6, 7, 9, 10, 9, 8, 7, 6, 6, 7, 8];
const HILLS = [4, 5, 6, 6, 5, 4, 3, 3, 4, 5, 6, 7, 6, 5, 4, 4, 5, 6, 6, 5, 4, 3, 4, 5, 6, 7, 7, 6, 5, 4, 4, 5, 6, 6, 5, 4];

function stepPath(heights: number[], unit: number, baseline: number): string {
  const w = 1440 / heights.length;
  let d = `M0 ${baseline}`;
  heights.forEach((h, i) => {
    const y = baseline - h * unit;
    d += ` L${i * w} ${y} L${(i + 1) * w} ${y}`;
  });
  d += ` L1440 ${baseline} Z`;
  return d;
}

export function Scene({
  variant = 'app',
  children,
  className = '',
}: {
  variant?: SceneVariant;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative min-h-dvh w-full overflow-x-clip bg-[linear-gradient(180deg,var(--color-sky)_0%,#9fb4e4_45%,#c9e3c9_72%,var(--color-sky-low)_100%)] ${className}`}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden select-none">
        {/* ground block pinned to the bottom: stripes + dotted forest */}
        <div className="absolute inset-x-0 bottom-0 h-[72px] md:h-[96px]">
          <div className="h-[6px] bg-ink" />
          <div className="k7-stripes h-[18px] md:h-[22px]" />
          <div className="h-[4px] bg-ink" />
          <div className="k7-ground h-full" />
        </div>
        {/* cloud band + hills sit just above the ground */}
        <svg
          viewBox="0 0 1440 200"
          preserveAspectRatio="none"
          className="pixelated absolute inset-x-0 bottom-[72px] md:bottom-[96px] h-[160px] md:h-[220px] w-full"
        >
          <path d={stepPath(CLOUD_BAND, 12, 200)} fill="#dfe9ec" />
          <path d={stepPath(CLOUD_BAND.map((h) => h - 1), 12, 200)} fill="#ffffff" />
          <path d={stepPath(HILLS, 10, 200)} fill="#4c8c4a" />
          <path d={stepPath(HILLS.map((h) => h - 0.5), 10, 200)} fill="#a6d86a" />
        </svg>

        {/* clouds */}
        <Cloud width={120} className="absolute left-[6%] top-[52px] md:left-[5.5%] md:top-[48px]" />
        <Cloud width={150} className="absolute right-[5%] top-[70px] md:right-[6%] md:top-[64px]" />

        {/* pipes by variant */}
        {variant === 'hero' && (
          <>
            <Pipe hanging height={240} width={72} className="absolute left-[8%] top-0 hidden sm:block" />
            <Pipe hanging height={150} width={72} className="absolute right-[9%] top-0" />
            <Pipe height={200} width={72} className="absolute left-[8%] bottom-[72px] md:bottom-[96px] hidden sm:block" />
            <Pipe height={260} width={72} className="absolute right-[9%] bottom-[72px] md:bottom-[96px] hidden sm:block" />
          </>
        )}
        {variant === 'form' && (
          <>
            <Pipe hanging height={110} width={64} className="absolute left-[3%] top-0" />
            <Pipe hanging height={110} width={64} className="absolute right-[3%] top-0" />
            <Pipe height={170} width={64} className="absolute right-[5%] bottom-[72px] md:bottom-[96px] hidden lg:block" />
          </>
        )}
        {variant === 'app' && (
          <>
            <Pipe height={190} width={64} className="absolute left-[4%] bottom-[72px] md:bottom-[96px] hidden lg:block" />
            <Pipe height={120} width={64} className="absolute right-[2%] bottom-[72px] md:bottom-[96px] hidden lg:block" />
          </>
        )}
      </div>
      <div className="relative z-10 flex min-h-dvh flex-col">{children}</div>
    </div>
  );
}
