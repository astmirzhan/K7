'use client';
import { NinjaBadge, BADGES } from '@/components/scene/NinjaBadge';
import type { Difficulty, Level } from '@/lib/types';

/** One badge per level: earned when every stage of that level is done. */
export function earnedBadges(levels: Level[] | undefined): Set<Difficulty> {
  return new Set((levels ?? []).filter((l) => l.progress.total > 0 && l.progress.done === l.progress.total).map((l) => l.difficulty));
}

export function BadgeShelf({ levels }: { levels: Level[] | undefined }) {
  const earned = earnedBadges(levels);
  const byDifficulty = new Map((levels ?? []).map((l) => [l.difficulty, l]));
  return (
    <ul className="grid grid-cols-3 gap-2" aria-label="Badges">
      {([1, 3, 5] as Difficulty[]).map((d) => {
        const on = earned.has(d);
        const level = byDifficulty.get(d);
        return (
          <li key={d} data-testid={`badge-${d}`} data-earned={on} className="flex flex-col items-center gap-1 text-center">
            <NinjaBadge difficulty={d} earned={on} size={92} />
            <span className="font-display text-[20px] leading-none" style={{ color: on ? BADGES[d].name : '#5b4f8f' }}>
              {on ? BADGES[d].title : 'Locked'}
            </span>
            <span className="k7-label text-[9px] text-ink/70">
              {on ? `N ${d} · ${BADGES[d].label}` : level ? `${level.progress.done}/${level.progress.total} · ${level.interest.name}` : 'finish the level'}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
