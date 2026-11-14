'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useReducer, useRef, useState } from 'react';
import { AvatarPicker } from '@/components/app/AvatarPicker';
import { GoalPicker, type GoalPick } from '@/components/app/GoalPicker';
import { EMPTY_PROFILE, ProfileForm, profileValid, type ProfileDraft } from '@/components/app/ProfileForm';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Ninja } from '@/components/scene/Ninja';
import { api, ApiRequestError } from '@/lib/api';
import { invalidate, useInterests, useMe } from '@/lib/hooks';
import { toast } from '@/lib/toast';
import type { Avatar, OnboardingRequest } from '@/lib/types';

type Step = 1 | 2 | 3;
interface State {
  step: Step;
  avatar: Avatar | null;
  interests: GoalPick[];
  profile: ProfileDraft;
}
type Action =
  | { type: 'step'; step: Step }
  | { type: 'avatar'; avatar: Avatar }
  | { type: 'interests'; interests: GoalPick[] }
  | { type: 'profile'; profile: ProfileDraft }
  | { type: 'restore'; state: State };

const KEY = 'k7.onboarding';
const initial: State = { step: 1, avatar: null, interests: [], profile: EMPTY_PROFILE };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'step':
      return { ...s, step: a.step };
    case 'avatar':
      return { ...s, avatar: a.avatar };
    case 'interests':
      return { ...s, interests: a.interests };
    case 'profile':
      return { ...s, profile: a.profile };
    case 'restore':
      return a.state;
  }
}

function interestsValid(v: GoalPick[]): boolean {
  const d = v.map((x) => x.difficulty).sort().join();
  return v.length === 3 && new Set(v.map((x) => x.slug)).size === 3 && d === '1,3,5';
}

const TITLES: Record<Step, { title: string; sub: string }> = {
  1: { title: 'choose your ninja', sub: 'or create your own avatar' },
  2: { title: 'pick 3 goals', sub: 'one hard · one medium · one easy' },
  3: { title: 'your profile', sub: 'Only your city is shown on the map. Your social link opens after you both accept.' },
};

export default function OnboardingPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const { data: interests } = useInterests();
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
      if (raw) dispatch({ type: 'restore', state: { ...initial, ...(JSON.parse(raw) as Partial<State>) } });
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

  const canNext = state.step === 1 ? state.avatar !== null : state.step === 2 ? interestsValid(state.interests) : profileValid(state.profile);

  async function submit() {
    if (!state.avatar || !profileValid(state.profile)) return;
    setBusy(true);
    setErrors({});
    const p = state.profile;
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
      interests: state.interests,
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
        const step: Step = first.startsWith('avatar') ? 1 : first.startsWith('interests') ? 2 : 3;
        dispatch({ type: 'step', step });
        if (Object.keys(fe).length === 0) toast(e.message, { tone: 'error' });
        return;
      }
      toast(e.message, { tone: 'error' });
    }
  }

  const t = TITLES[state.step];

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

      {state.step === 3 ? (
        <Panel className="w-full max-w-[920px] px-6 py-7 md:px-10 md:py-8">
          <h1 className="font-display text-center text-[52px] leading-none md:text-[60px]">{t.title}</h1>
          <div className="mt-6">
            <ProfileForm value={state.profile} onChange={(profile) => dispatch({ type: 'profile', profile })} errors={errors} />
          </div>
          <p className="mt-4 text-center text-[13px] text-ink/70">{t.sub}</p>
          <div className="mt-5 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => dispatch({ type: 'step', step: 2 })}>
              back
            </Button>
            <Button onClick={submit} disabled={!canNext} data-testid="onboarding-submit" className="min-w-[200px]">
              enter the map
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
            <GoalPicker interests={interests} value={state.interests} onChange={(v) => dispatch({ type: 'interests', interests: v })} error={errors['interests']} />
          )}
          <div className="mt-8 flex items-center gap-3">
            {state.step === 2 ? (
              <Button variant="secondary" onClick={() => dispatch({ type: 'step', step: 1 })}>
                back
              </Button>
            ) : null}
            <Button onClick={() => dispatch({ type: 'step', step: (state.step + 1) as Step })} disabled={!canNext} data-testid="onboarding-next" className="min-w-[140px]">
              next
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
