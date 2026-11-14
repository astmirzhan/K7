import { Coin } from '@/components/scene/Coin';
import { DIFFICULTY_LABEL } from '@/lib/format';
import type { Difficulty } from '@/lib/types';

/** "🪙 HARD · 5" — ink pill with a coin, the Difficulty badge of the design. */
export function DifficultyBadge({
  difficulty,
  coins,
  tone = 'ink',
  className = '',
}: {
  difficulty: Difficulty;
  coins?: number;
  tone?: 'ink' | 'white';
  className?: string;
}) {
  const t = tone === 'ink' ? 'bg-ink text-yellow' : 'bg-white text-ink';
  return (
    <span className={`k7-label inline-flex h-7 items-center gap-1.5 rounded-[8px] border-[3px] border-ink px-2 text-[10px] ${t} ${className}`}>
      <Coin size={14} />
      {DIFFICULTY_LABEL[difficulty]} · {coins ?? difficulty}
    </span>
  );
}

export const DIFFICULTY_TONE: Record<Difficulty, { header: string; text: string; node: string }> = {
  5: { header: 'bg-yellow', text: 'text-ink', node: 'bg-yellow' },
  3: { header: 'bg-[#5b6fd6]', text: 'text-white', node: 'bg-[#5b6fd6]' },
  1: { header: 'bg-leaf', text: 'text-white', node: 'bg-leaf' },
};
