'use client';
import { useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { CrossIcon } from '@/components/scene/Icons';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Field';
import { api } from '@/lib/api';
import { suggestedSlugFor } from '@/lib/goal-synonyms';
import { toast } from '@/lib/toast';
import { DIFFICULTY_TONE } from '@/components/ui/DifficultyBadge';
import { Skeleton } from '@/components/ui/States';
import type { Difficulty, Interest } from '@/lib/types';

// 03 Pick 3 goals: chips of the catalog + three Goal cards (Hard / Medium / Easy).
export type GoalPick = { slug: string; difficulty: Difficulty; name?: string }; // name kept for typed goals
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
  const [adding, setAdding] = useState(false);
  const nameOf = (p: GoalPick) => bySlug.get(p.slug)?.name ?? p.name ?? p.slug;
  const taken = new Set(value.map((v) => v.slug));

  function toggle(slug: string, name?: string) {
    if (taken.has(slug)) return onChange(value.filter((v) => v.slug !== slug));
    const free = SLOTS.find((s) => !value.some((v) => v.difficulty === s.difficulty));
    if (!free) return;
    onChange([...value, { slug, difficulty: free.difficulty, ...(name ? { name } : {}) }]);
  }

  /** The person picks the difficulty; if another goal already has it, the two swap. */
  function setDifficulty(slug: string, difficulty: Difficulty) {
    const mine = value.find((v) => v.slug === slug);
    if (!mine || mine.difficulty === difficulty) return;
    onChange(
      value.map((v) => (v.slug === slug ? { ...v, difficulty } : v.difficulty === difficulty ? { ...v, difficulty: mine.difficulty } : v)),
    );
  }

  /** A goal that is not in the suggestions: the server returns the matching goal or creates it. */
  async function addTyped() {
    const name = query.trim();
    if (name.length < 2 || value.length >= 3) return;
    setAdding(true);
    try {
      const goal = await api.customInterest({ name });
      if (!taken.has(goal.slug)) toggle(goal.slug, goal.name);
      setQuery('');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    } finally {
      setAdding(false);
    }
  }

  const list = interests ?? [];
  const q = query.trim().toLowerCase();
  // picked goals stay visible so they can be un-picked; a query searches the whole catalog by name or category
  const synonym = q ? suggestedSlugFor(q) : null; // "read books" also shows Reading
  const matches = q
    ? list.filter((i) => i.name.toLowerCase().includes(q) || i.category.includes(q) || i.slug === synonym || taken.has(i.slug))
    : list;
  const shown = q || showAll ? matches : matches.slice(0, VISIBLE);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-[420px]">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const exact = list.find((i) => i.name.toLowerCase() === q);
            if (exact) toggle(exact.slug);
            else void addTyped();
          }}
        >
          <Input
            type="search"
            aria-label="Search goals or type your own"
            data-testid="goal-search"
            maxLength={30}
            placeholder="Search or type your own goal"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-white text-center"
          />
        </form>
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
        {interests && q.length >= 2 && !list.some((i) => i.name.toLowerCase() === q) ? (
          <Button
            size="sm"
            variant="ink"
            pending={adding}
            disabled={value.length >= 3}
            onClick={() => void addTyped()}
            data-testid="goal-add-custom"
          >
            + add “{query.trim()}” as my goal
          </Button>
        ) : null}
        {interests && !q && list.length > VISIBLE ? (
          <Chip onClick={() => setShowAll((s) => !s)}>{showAll ? 'fewer' : `+ ${list.length - VISIBLE} more`}</Chip>
        ) : null}
      </div>

      <div className="grid w-full max-w-[960px] grid-cols-1 gap-4 md:grid-cols-3">
        {SLOTS.map((slot) => {
          const pick = value.find((v) => v.difficulty === slot.difficulty);
          const interest = pick ? { slug: pick.slug, name: nameOf(pick) } : undefined;
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
                    <div role="radiogroup" aria-label={`Difficulty for ${interest.name}`} className="mt-auto flex gap-1.5 pt-1">
                      {SLOTS.map((d) => (
                        <button
                          key={d.difficulty}
                          type="button"
                          role="radio"
                          aria-checked={d.difficulty === slot.difficulty}
                          data-testid={`set-difficulty-${interest.slug}-${d.difficulty}`}
                          onClick={() => setDifficulty(interest.slug, d.difficulty)}
                          className={`k7-label h-8 rounded-[6px] border-[3px] border-ink px-2 text-[9px] ${
                            d.difficulty === slot.difficulty ? 'bg-ink text-yellow' : 'bg-white text-ink hover:bg-mist'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
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
