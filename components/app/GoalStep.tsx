'use client';
import { Coin } from '@/components/scene/Coin';
import type { Difficulty } from '@/lib/types';

// "name your 3 goals" → "how hard is it?" → "your 3 paths" (Figma: Write your own goals / Give each goal its N value).
export type GoalDraft = { name: string; difficulty: Difficulty | null };

export const DIFF = {
  5: { word: 'hard', color: '#d8433b', soft: '#fde3e1', stages: 10 },
  3: { word: 'medium', color: '#ee8a2c', soft: '#fdebd8', stages: 6 },
  1: { word: 'easy', color: '#4fa63f', soft: '#e3f3dc', stages: 3 },
} as const satisfies Record<Difficulty, { word: string; color: string; soft: string; stages: number }>;

export function goalsValid(goals: GoalDraft[]): boolean {
  const names = goals.map((g) => g.name.trim().toLowerCase());
  const diffs = goals.map((g) => g.difficulty).sort().join();
  return goals.length === 3 && names.every((n) => n.length >= 2) && new Set(names).size === 3 && diffs === '1,3,5';
}

export function goalsTitle(goals: GoalDraft[]): { title: string; sub: string } {
  if (goalsValid(goals)) return { title: 'your 3 paths', sub: 'Each goal becomes a quest map made for your city.' };
  if (goals.some((g) => g.name.trim().length > 0)) return { title: 'how hard is it?', sub: 'Each N value once: 5 hard, 3 medium, 1 easy.' };
  return { title: 'name your 3 goals', sub: 'Type anything you want to start. No lists to pick from.' };
}

/** The pixel "N" token from the K7 logo. Filled = part of this goal's N value. */
function NToken({ on, color }: { on: boolean; color: string }) {
  return (
    <svg viewBox="0 0 16 16" width={28} height={28} aria-hidden="true" className="pixelated block">
      <circle cx="8" cy="8" r="7" fill={on ? '#2e1b5b' : '#eef1fd'} stroke={on ? '#2e1b5b' : '#b8c3ee'} strokeWidth="1.2" />
      {/* N */}
      <g fill={on ? color : '#b8c3ee'}>
        <rect x="4.5" y="4" width="1.6" height="8" />
        <rect x="9.9" y="4" width="1.6" height="8" />
        <rect x="6.1" y="5.2" width="1.3" height="2" />
        <rect x="7.3" y="7" width="1.3" height="2" />
        <rect x="8.5" y="8.8" width="1.3" height="2" />
      </g>
    </svg>
  );
}

export function GoalStep({ value, onChange, error }: { value: GoalDraft[]; onChange: (v: GoalDraft[]) => void; error?: string | null }) {
  const used = new Set(value.map((g) => g.difficulty).filter(Boolean));
  const free = ([5, 3, 1] as Difficulty[]).filter((d) => !used.has(d));

  function setName(i: number, name: string) {
    onChange(value.map((g, j) => (j === i ? { ...g, name: name.slice(0, 30) } : g)));
  }

  /** Tap the k-th N: 1, 3 or 5 set it directly; 2 and 4 round up. Taking a value another goal has swaps them. */
  function setN(i: number, k: number) {
    const d = (k <= 1 ? 1 : k <= 3 ? 3 : 5) as Difficulty;
    const mine = value[i]!.difficulty;
    onChange(value.map((g, j) => (j === i ? { ...g, difficulty: d } : g.difficulty === d ? { ...g, difficulty: mine } : g)));
  }

  const allSet = goalsValid(value);
  const coins = value.reduce((sum, g) => sum + (g.difficulty ? g.difficulty * DIFF[g.difficulty].stages : 0), 0);

  return (
    <div className="flex w-full max-w-[560px] flex-col gap-4">
      {value.map((g, i) => {
        const d = g.difficulty ? DIFF[g.difficulty] : null;
        const n = g.difficulty ?? 0;
        const onlyOneLeft = !g.difficulty && free.length === 1;
        return (
          <section
            key={i}
            data-testid={`goal-card-${i + 1}`}
            className="k7-shadow-sm rounded-[14px] border-4 bg-white px-4 py-3 transition-colors"
            style={{ borderColor: d ? d.color : 'var(--color-ink)' }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="k7-label text-[10px] text-ink/70">Goal {i + 1}</span>
              {d ? (
                <span className="k7-label rounded-[6px] px-2 py-0.5 text-[10px] text-white" style={{ background: d.color }}>
                  N {g.difficulty} · {d.word}
                </span>
              ) : null}
            </div>
            <label className="sr-only" htmlFor={`goal-${i + 1}`}>
              Goal {i + 1}
            </label>
            <input
              id={`goal-${i + 1}`}
              data-testid={`goal-input-${i + 1}`}
              value={g.name}
              onChange={(e) => setName(i, e.target.value)}
              maxLength={30}
              placeholder="Type your own goal…"
              className="h-11 w-full rounded-[10px] border-[3px] border-[#b8c3ee] bg-mist px-3 text-[15px] focus:border-ink focus:bg-white"
            />
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div role="radiogroup" aria-label={`How hard is goal ${i + 1}`} className="flex gap-1">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={g.difficulty === k}
                    aria-label={`${k} N`}
                    data-testid={`goal-n-${i + 1}-${k}`}
                    onClick={() => setN(i, k)}
                    className="rounded-full transition-transform hover:-translate-y-0.5 active:translate-y-[1px]"
                  >
                    <NToken on={k <= n} color={d?.color ?? '#b8c3ee'} />
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink/80">
                {d ? (
                  <>
                    <Coin size={14} /> {d.stages} stages · +{g.difficulty} a stage
                  </>
                ) : onlyOneLeft ? (
                  `Only ${free[0]} left — tap ${free[0] === 1 ? 'one N' : `${free[0]} N`}`
                ) : i === 0 ? (
                  'Tap 1, 3 or 5 N'
                ) : null}
              </span>
            </div>
          </section>
        );
      })}

      <div className="flex justify-center">
        {allSet ? (
          <p data-testid="goals-total" className="k7-label flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[10px] border-[3px] border-ink bg-ink px-4 py-2 text-[10px] text-white">
            <span>N 9 total</span>
            <span className="text-yellow">19 stages</span>
            <span className="flex items-center gap-1">
              <Coin size={12} /> up to {coins} coins
            </span>
          </p>
        ) : (
          <p className="k7-label flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-[10px] border-[3px] border-ink bg-white px-4 py-2 text-[10px]">
            {([1, 3, 5] as Difficulty[]).map((x) => (
              <span key={x} style={{ color: DIFF[x].color }}>
                {x} N · {DIFF[x].word} · {DIFF[x].stages} stages
              </span>
            ))}
          </p>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-center text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
