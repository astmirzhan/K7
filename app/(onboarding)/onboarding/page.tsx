'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AvatarPicker } from '@/components/app/AvatarPicker';
import { GoalStep, goalsTitle, goalsValid, type GoalDraft } from '@/components/app/GoalStep';
import { EMPTY_PROFILE, ProfileForm, profileValid, type ProfileDraft } from '@/components/app/ProfileForm';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Ninja } from '@/components/scene/Ninja';
import { api, ApiRequestError } from '@/lib/api';
import { invalidate, useMe } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import type { Avatar, OnboardingRequest } from '@/lib/types';

type Step = 1 | 2 | 3;
interface State {
  step: Step;
  avatar: Avatar | null;
  goals: GoalDraft[];
  profile: ProfileDraft;
}
type Action =
  | { type: 'step'; step: Step }
  | { type: 'avatar'; avatar: Avatar }
  | { type: 'goals'; goals: GoalDraft[] }
  | { type: 'profile'; profile: ProfileDraft }
  | { type: 'restore'; state: State };

const KEY = 'k7.onboarding';
const EMPTY_GOALS: GoalDraft[] = [
  { name: '', difficulty: null },
  { name: '', difficulty: null },
  { name: '', difficulty: null },
];
const initial: State = { step: 1, avatar: null, goals: EMPTY_GOALS, profile: EMPTY_PROFILE };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'step':
      return { ...s, step: a.step };
    case 'avatar':
      return { ...s, avatar: a.avatar };
    case 'goals':
      return { ...s, goals: a.goals };
    case 'profile':
      return { ...s, profile: a.profile };
    case 'restore':
      return a.state;
  }
}


const TITLES: Record<1 | 2, { title: string; sub: string }> = {
  1: { title: 'choose your ninja', sub: 'or create your own avatar' },
  2: { title: 'your profile', sub: 'Only your city is shown on the map. Your social link opens after you both accept.' },
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [state, dispatch] = useReducer(reducer, initial);
  const restored = useRef(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me?.onboarded) router.replace('/home');
  }, [me, router]);

  // keep answers across a refresh
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<State>;
        // answers saved by the old goal picker have no goals: start the goals fresh
        const goals = Array.isArray(saved.goals) && saved.goals.length === 3 ? saved.goals : EMPTY_GOALS;
        dispatch({ type: 'restore', state: { ...initial, ...saved, goals } });
      }
    } catch {
      /* ignore */
    }
    restored.current = true;
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try {
      sessionStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const canNext = state.step === 1 ? state.avatar !== null : state.step === 2 ? profileValid(state.profile) : goalsValid(state.goals);

  async function submit() {
    if (!state.avatar || !profileValid(state.profile) || !goalsValid(state.goals)) return;
    setBusy(true);
    setErrors({});
    const p = state.profile;
    // typed goals → goals in the catalog: a suggested one when it means the same ("Learn Spanish"), else a new one
    let picks: Array<{ slug: string; difficulty: 1 | 3 | 5; name: string }>;
    try {
      picks = await Promise.all(
        state.goals.map(async (g) => {
          const goal = await api.customInterest({ name: g.name.trim() });
          return { slug: goal.slug, difficulty: g.difficulty!, name: goal.name };
        }),
      );
    } catch (e) {
      setBusy(false);
      if (e instanceof ApiRequestError && e.code === 'VALIDATION') setErrors({ interests: e.message });
      else toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
      return;
    }
    const twins = picks.filter((x, i) => picks.findIndex((y) => y.slug === x.slug) !== i);
    if (twins.length > 0) {
      setBusy(false);
      setErrors({ interests: `Two of your goals are the same: ${twins[0]!.name}. Make each goal different.` });
      return;
    }
    const body: OnboardingRequest = {
      avatar: state.avatar,
      profile: {
        displayName: p.displayName.trim(),
        state: p.state as OnboardingRequest['profile']['state'],
        city: p.city.trim(),
        ageRange: p.ageRange!,
        meetStyle: p.meetStyle!,
        socialUrl: p.socialUrl.trim(),
        bio: p.bio.trim(),
      },
      interests: picks.map(({ slug, difficulty }) => ({ slug, difficulty })),
    };
    try {
      const res = await api.onboarding(body);
      await invalidate.afterOnboarding(res.me, res.roadmap);
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignore */
      }
      router.replace('/home');
    } catch (e) {
      setBusy(false);
      if (!(e instanceof ApiRequestError)) return toast((e as Error).message, { tone: 'error' });
      if (e.code === 'ALREADY_ONBOARDED') return router.replace('/home');
      if (e.code === 'VALIDATION') {
        const fe = e.fieldErrors();
        setErrors(fe);
        const first = Object.keys(fe)[0] ?? '';
        const step: Step = first.startsWith('avatar') ? 1 : first.startsWith('profile') ? 2 : 3;
        dispatch({ type: 'step', step });
        if (Object.keys(fe).length === 0) toast(e.message, { tone: 'error' });
        return;
      }
      toast(e.message, { tone: 'error' });
    }
  }

  const t = state.step === 3 ? goalsTitle(state.goals) : TITLES[state.step];

  if (busy) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center" aria-live="polite">
        <div className="k7-pulse">{state.avatar ? <Ninja avatar={state.avatar} size={120} /> : null}</div>
        <h1 className="k7-title text-[48px] md:text-[64px]">building your quest map…</h1>
        <p className="text-[15px] text-ink/80">Personalised stages for your 3 goals. This can take up to 10 seconds.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <ol className="mb-4 flex gap-2" aria-label="Steps">
        {[1, 2, 3].map((n) => (
          <li key={n} className={`h-2.5 w-10 rounded-[3px] border-[3px] border-ink ${n <= state.step ? 'bg-yellow' : 'bg-white'}`} aria-current={n === state.step ? 'step' : undefined} />
        ))}
      </ol>

      {state.step === 2 ? (
        <Panel className="w-full max-w-[920px] px-6 py-7 md:px-10 md:py-8">
          <h1 className="font-display text-center text-[52px] leading-none md:text-[60px]">{t.title}</h1>
          <div className="mt-6">
            <ProfileForm value={state.profile} onChange={(profile) => dispatch({ type: 'profile', profile })} errors={errors} />
          </div>
          <p className="mt-4 text-center text-[13px] text-ink/70">{t.sub}</p>
          <div className="mt-5 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => dispatch({ type: 'step', step: 1 })}>
              back
            </Button>
            <Button onClick={() => dispatch({ type: 'step', step: 3 })} disabled={!canNext} data-testid="onboarding-next" className="min-w-[200px]">
              next
            </Button>
          </div>
        </Panel>
      ) : (
        <>
          <h1 className="k7-title text-center text-[56px] md:text-[72px]">{t.title}</h1>
          <p className="mb-7 mt-2 text-center text-[15px] font-semibold md:text-[17px]">{t.sub}</p>
          {state.step === 1 ? (
            <AvatarPicker value={state.avatar} onChange={(avatar) => dispatch({ type: 'avatar', avatar })} />
          ) : (
            <GoalStep value={state.goals} onChange={(goals) => dispatch({ type: 'goals', goals })} error={errors['interests']} />
          )}
          <div className="mt-6 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              {state.step === 3 ? (
                <Button variant="secondary" onClick={() => dispatch({ type: 'step', step: 2 })}>
                  back
                </Button>
              ) : null}
              {state.step === 1 ? (
                <Button onClick={() => dispatch({ type: 'step', step: 2 })} disabled={!canNext} data-testid="onboarding-next" className="min-w-[140px]">
                  next
                </Button>
              ) : (
                <Button onClick={submit} disabled={!canNext} data-testid="onboarding-submit" className="min-w-[220px]">
                  build my roadmap
                </Button>
              )}
            </div>
            {state.step === 3 ? <p className="text-[12px] text-ink/70">The N value is fixed once the path starts.</p> : null}
          </div>
        </>
      )}
    </div>
  );
}
