'use client';
import { useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { CrossIcon } from '@/components/scene/Icons';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Field';
import { DIFFICULTY_TONE } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/States';
import type { Difficulty, Interest } from '@/lib/types';

// 03 Pick 3 goals: chips of the catalog + three Goal cards (Hard / Medium / Easy).
export type GoalPick = { slug: string; difficulty: Difficulty };
const SLOTS: Array<{ difficulty: Difficulty; label: string; stages: number }> = [
  { difficulty: 5, label: 'Hard', stages: 10 },
  { difficulty: 3, label: 'Medium', stages: 6 },
  { difficulty: 1, label: 'Easy', stages: 3 },
];
const VISIBLE = 8;

export function GoalPicker({
  interests,
  value,
  onChange,
  error,
}: {
  interests: Interest[] | undefined;
  value: GoalPick[];
  onChange: (v: GoalPick[]) => void;
  error?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [query, setQuery] = useState('');
  const bySlug = new Map((interests ?? []).map((i) => [i.slug, i]));
  const taken = new Set(value.map((v) => v.slug));

  function toggle(slug: string) {
    if (taken.has(slug)) return onChange(value.filter((v) => v.slug !== slug));
    const free = SLOTS.find((s) => !value.some((v) => v.difficulty === s.difficulty));
    if (!free) return;
    onChange([...value, { slug, difficulty: free.difficulty }]);
  }

  /** Move the interest in this slot one slot down (Hard → Medium → Easy → Hard), swapping with what is there. */
  function rotate(difficulty: Difficulty) {
    const order = SLOTS.map((s) => s.difficulty);
    const i = order.indexOf(difficulty);
    const next = order[(i + 1) % order.length]!;
    onChange(
      value.map((v) => (v.difficulty === difficulty ? { ...v, difficulty: next } : v.difficulty === next ? { ...v, difficulty } : v)),
    );
  }

  const list = interests ?? [];
  const q = query.trim().toLowerCase();
  // picked goals stay visible so they can be un-picked; a query searches the whole catalog by name or category
  const matches = q ? list.filter((i) => i.name.toLowerCase().includes(q) || i.category.includes(q) || taken.has(i.slug)) : list;
  const shown = q || showAll ? matches : matches.slice(0, VISIBLE);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-[420px]">
        <Input
          type="search"
          aria-label="Search goals"
          data-testid="goal-search"
          placeholder="Search 30 goals: yoga, chess, piano…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-white text-center"
        />
      </div>
      <div className="flex max-w-[960px] flex-wrap justify-center gap-2">
        {!interests
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-24" />)
          : shown.map((i) => (
              <Chip key={i.slug} data-testid={`interest-${i.slug}`} active={taken.has(i.slug)} onClick={() => toggle(i.slug)} disabled={!taken.has(i.slug) && value.length >= 3}>
                {taken.has(i.slug) ? '✓ ' : ''}
                {i.name}
              </Chip>
            ))}
        {interests && q && matches.length === 0 ? (
          <p className="text-[14px] text-ink/70">No goal called “{query.trim()}” yet. Try a close one, like running or drawing.</p>
        ) : null}
        {interests && !q && list.length > VISIBLE ? (
          <Chip onClick={() => setShowAll((s) => !s)}>{showAll ? 'fewer' : `+ ${list.length - VISIBLE} more`}</Chip>
        ) : null}
      </div>

      <div className="grid w-full max-w-[960px] grid-cols-1 gap-4 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const pick = value.find((v) => v.difficulty === slot.difficulty);
          const interest = pick ? bySlug.get(pick.slug) : undefined;
          const tone = DIFFICULTY_TONE[slot.difficulty];
          return (
            <div
              key={slot.difficulty}
              data-testid={pick ? `difficulty-${pick.slug}-${slot.difficulty}` : `goal-slot-${slot.difficulty}`}
              className={`k7-outline k7-shadow-sm flex min-h-[150px] flex-col overflow-hidden rounded-[14px] ${pick ? 'bg-white' : 'bg-mist border-dashed'}`}
            >
              <div className={`k7-label flex h-10 items-center gap-2 px-4 ${tone.header} ${tone.text}`}>
                <Coin size={16} />
                {slot.label} · {slot.stages} stages
              </div>
              <div className="flex flex-1 flex-col gap-1 px-4 py-3">
                {interest ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-[34px] leading-[0.95]">{interest.name}</h3>
                      <button type="button" aria-label={`Remove ${interest.name}`} onClick={() => toggle(interest.slug)} className="mt-1 opacity-60 hover:opacity-100">
                        <CrossIcon size={12} />
                      </button>
                    </div>
                    <p className="text-[13px] text-ink/70">
                      {slot.difficulty} coin{slot.difficulty > 1 ? 's' : ''} per stage
                    </p>
                    {value.length > 1 ? (
                      <button type="button" onClick={() => rotate(slot.difficulty)} className="k7-label mt-auto self-start text-ink/70 underline underline-offset-4 hover:text-ink">
                        swap ↓
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="my-auto text-[14px] text-ink/60">Pick a goal above for the {slot.label.toLowerCase()} slot.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="text-[13px] font-semibold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
