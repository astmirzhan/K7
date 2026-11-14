'use client';
import { Coin } from '@/components/scene/Coin';
import { CameraIcon, FlagIcon, LockIcon } from '@/components/scene/Icons';
import { Ninja } from '@/components/scene/Ninja';
import type { Avatar, Level, Stage } from '@/lib/types';

// 05 Roadmap: winding green road, numbered nodes, coins between nodes, hero on the active stage,
// START flag and a camera node with "GOAL · PHOTO REPORT" at the end.

const PER_ROW = 4;
const COL_W = 230;
const ROW_H = 150;
const PAD_X = 120;
const PAD_TOP = 70;

export function layoutNodes(n: number): { x: number; y: number }[] {
  const rows = Math.ceil(n / PER_ROW);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / PER_ROW);
    const col = i % PER_ROW;
    const inRow = Math.min(PER_ROW, n - row * PER_ROW);
    const dir = row % 2 === 0 ? col : inRow - 1 - col; // serpentine
    const spread = inRow === 1 ? 0 : (PER_ROW - 1) / (inRow - 1);
    const x = PAD_X + dir * spread * COL_W;
    const y = PAD_TOP + (rows - 1 - row) * ROW_H + (col % 2) * 26; // small vertical wobble like the design
    pts.push({ x, y });
  }
  return pts;
}

/** Catmull-Rom → cubic Bézier path through the points (plus a start stub to the left). */
function roadPath(pts: { x: number; y: number }[]): string {
  const p = [{ x: pts[0]!.x - 90, y: pts[0]!.y + 10 }, ...pts];
  if (p.length < 2) return '';
  let d = `M${p[0]!.x} ${p[0]!.y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function RoadmapBoard({
  level,
  avatar,
  onStage,
  selectedId,
}: {
  level: Level;
  avatar: Avatar;
  onStage: (stage: Stage) => void;
  selectedId?: string | null;
}) {
  const stages = level.stages;
  const pts = layoutNodes(stages.length);
  const rows = Math.ceil(stages.length / PER_ROW);
  const W = PAD_X * 2 + (PER_ROW - 1) * COL_W;
  const H = PAD_TOP + rows * ROW_H + 20;
  const heroIdx = stages.findIndex((s) => s.status === 'active' || s.status === 'waiting_partner');
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${W} / ${H}` }} data-testid={`level-${level.interest.slug}`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <path d={roadPath(pts)} fill="none" stroke="#2e1b5b" strokeWidth="44" strokeLinecap="round" strokeLinejoin="round" />
        <path d={roadPath(pts)} fill="none" stroke="#a6d86a" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round" />
        <path d={roadPath(pts)} fill="none" stroke="#ffffff" strokeWidth="3" strokeDasharray="14 12" strokeLinecap="round" />
        {/* coins between nodes */}
        {pts.slice(0, -1).map((p, i) => {
          const q = pts[i + 1]!;
          const mx = (p.x + q.x) / 2;
          const my = (p.y + q.y) / 2 - 2;
          const done = stages[i]!.status === 'done' && stages[i + 1]!.status === 'done';
          return (
            <g key={i} transform={`translate(${mx - 11} ${my - 11})`} opacity={done ? 0.35 : 1}>
              <foreignObject width="22" height="22">
                <Coin size={22} />
              </foreignObject>
            </g>
          );
        })}
      </svg>

      {/* START flag */}
      <div
        className="k7-label absolute flex h-8 -translate-x-1/2 -translate-y-[calc(100%+34px)] items-center gap-1.5 rounded-[8px] border-[3px] border-ink bg-white px-2.5 text-[10px]"
        style={{ left: pct(pts[0]!.x - 70, W), top: pct(pts[0]!.y, H) }}
      >
        <FlagIcon size={12} /> start
      </div>

      {stages.map((s, i) => {
        const p = pts[i]!;
        const last = i === stages.length - 1;
        const locked = s.status === 'locked' || level.lockedByPlan;
        const done = s.status === 'done';
        const active = s.status === 'active' || s.status === 'waiting_partner';
        const tone = done ? 'bg-leaf text-white' : active ? 'bg-yellow text-ink' : 'bg-lilac text-ink';
        const selected = selectedId === s.id;
        return (
          <div key={s.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: pct(p.x, W), top: pct(p.y, H) }}>
            {last ? (
              <span className="k7-label absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-[8px] border-[3px] border-ink bg-yellow px-2 py-1 text-[9px]">
                goal · photo report
              </span>
            ) : null}
            <button
              type="button"
              data-testid={`stage-${level.interest.slug}-${s.idx}`}
              aria-label={`Stage ${s.idx}: ${s.title} (${s.status.replace('_', ' ')})`}
              aria-current={active ? 'step' : undefined}
              onClick={() => onStage(s)}
              className={`k7-shadow-sm flex h-[54px] w-[54px] items-center justify-center rounded-[12px] border-4 border-ink font-display text-[30px] leading-none transition-transform hover:-translate-y-0.5 active:translate-y-[2px] active:shadow-none md:h-[60px] md:w-[60px] ${tone} ${
                selected ? 'ring-4 ring-yellow ring-offset-2 ring-offset-white' : ''
              }`}
            >
              {last && !done ? (
                <CameraIcon size={26} color={active ? '#2e1b5b' : '#2e1b5b'} />
              ) : locked && !done ? (
                <LockIcon size={20} />
              ) : (
                s.idx
              )}
            </button>
            {i === heroIdx ? (
              <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[88%]">
                <div className={`k7-outline rounded-[10px] bg-[#e8f6d0] p-1 ${s.status === 'waiting_partner' ? 'k7-pulse' : 'k7-float'}`}>
                  <Ninja avatar={avatar} size={40} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
