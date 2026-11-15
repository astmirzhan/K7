import { Coin } from '@/components/scene/Coin';
import { CameraIcon, CheckIcon, FlagIcon, LockIcon, PeopleIcon } from '@/components/scene/Icons';
import { Ninja } from '@/components/scene/Ninja';
import { Scene } from '@/components/scene/Scene';
import { ButtonLink } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { DifficultyBadge } from '@/components/ui/DifficultyBadge';
import { Panel } from '@/components/ui/Panel';
import { LiveCounter, TopStates } from '@/components/landing/LiveCounter';
import { PLAN_LABEL, planPrice } from '@/lib/format';
import { PLAN_FEATURES } from '@/lib/plan-features';
import { PLAN_RULES } from '@/lib/server/plans';
import type { Plan } from '@/lib/types';

const STEPS = [
  {
    n: 1,
    title: 'pick 3 goals',
    text: 'Running, Spanish, guitar… one Hard, one Medium, one Easy. 30 goals to choose from.',
    art: (
      <div className="flex flex-wrap gap-1.5">
        <DifficultyBadge difficulty={5} />
        <DifficultyBadge difficulty={3} />
        <DifficultyBadge difficulty={1} />
      </div>
    ),
  },
  {
    n: 2,
    title: 'get your quest map',
    text: 'AI turns each goal into short stages made for your city. 5–20 minutes each, coins for every step.',
    art: (
      <div className="flex items-center gap-1.5">
        <FlagIcon size={16} />
        {[1, 2, 3].map((i) => (
          <span key={i} className={`flex h-8 w-8 items-center justify-center rounded-[8px] border-[3px] border-ink font-display text-[18px] ${i === 1 ? 'bg-leaf text-white' : i === 2 ? 'bg-yellow' : 'bg-lilac'}`}>
            {i}
          </span>
        ))}
        <CameraIcon size={20} />
      </div>
    ),
  },
  {
    n: 3,
    title: 'quest with a buddy',
    text: 'The map shows people nearby with the same goal. Connect, meet in public, finish a co-op stage with a photo: ×2 coins.',
    art: (
      <div className="flex items-end gap-1">
        <Ninja avatar={{ kind: 'preset', preset: 'ninja-1' }} size={36} />
        <Ninja avatar={{ kind: 'preset', preset: 'ninja-3' }} size={36} />
        <Coin size={18} className="mb-1" />
      </div>
    ),
  },
] as const;

const PLANS: Plan[] = ['free', 'starter', 'pro', 'crew'];

function planLines(plan: Plan): string[] {
  if (plan === 'free') {
    const r = PLAN_RULES.free;
    return [`Map: up to ${r.mapVisible} people`, `${r.connectsPerMonth} connects a month`, 'Easy level'];
  }
  return PLAN_FEATURES[plan];
}

// 01 Start — landing: hero, live counter, how it works, who is on the map, plans.
export default function LandingPage() {
  return (
    <Scene variant="hero">
      <main className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center px-4 pb-40 text-center md:pb-48">
        <section className="relative flex min-h-[calc(100dvh-140px)] w-full flex-col items-center justify-center pt-16">
          {/* decorative coins: desktop only (the svg's own inline-block beat `hidden`, so the wrapper hides them) */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
            <Coin size={34} className="k7-float absolute left-[14%] top-[28%]" />
            <Coin size={30} className="k7-float absolute right-[14%] top-[40%] [animation-delay:400ms]" />
            <Coin size={26} className="k7-float absolute bottom-[30%] left-[30%] [animation-delay:800ms]" />
          </div>

          <h1 className="k7-title text-[128px] md:text-[176px]">K7</h1>
          <p className="k7-title mt-2 text-[44px] md:text-[64px]">network sidequesting</p>
          <p className="mt-5 text-[16px] font-semibold md:text-[18px]">Your goal is a quest. Don’t play it alone.</p>

          <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
            <ButtonLink href="/signup" data-testid="start-cta" className="min-w-[180px]">
              let’s start
            </ButtonLink>
            <ButtonLink href="/login" variant="secondary" className="min-w-[200px]">
              I have an account
            </ButtonLink>
          </div>

          <div className="mt-6">
            <LiveCounter />
          </div>
          <p className="mt-4 max-w-[520px] text-[13px] text-ink/70">
            You’re not alone — people nearby are starting too. 5-minute quests, easier than scrolling.
          </p>
        </section>

        <section className="w-full py-10" aria-labelledby="how">
          <h2 id="how" className="k7-title text-[48px] md:text-[64px]">
            how it works
          </h2>
          <div className="mt-6 grid gap-4 text-left md:grid-cols-3">
            {STEPS.map((s) => (
              <Panel key={s.n} shadow="md" className="flex flex-col gap-3 p-5">
                <div className="flex items-center justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[10px] border-[3px] border-ink bg-yellow font-display text-[28px] leading-none">{s.n}</span>
                  {s.art}
                </div>
                <h3 className="font-display text-[34px] leading-none">{s.title}</h3>
                <p className="text-[14px] text-ink/80">{s.text}</p>
              </Panel>
            ))}
          </div>
        </section>

        <section className="grid w-full items-center gap-6 py-10 text-left md:grid-cols-2" aria-labelledby="map">
          <div className="flex flex-col gap-3">
            <h2 id="map" className="k7-title text-[48px] md:text-[64px]">
              who’s on the map
            </h2>
            <p className="text-[15px] font-semibold">Real people with the same goals, counted live.</p>
            <ul className="flex flex-col gap-2 text-[14px]">
              <li className="flex items-center gap-2">
                <PeopleIcon size={16} /> Matched by shared goals, closest city first
              </li>
              <li className="flex items-center gap-2">
                <LockIcon size={14} /> City only — never your exact location
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon size={12} /> Social link opens only after you both accept
              </li>
            </ul>
          </div>
          <Panel shadow="md" className="p-5">
            <TopStates />
          </Panel>
        </section>

        <section className="w-full py-10" aria-labelledby="plans">
          <h2 id="plans" className="k7-title text-[48px] md:text-[64px]">
            plans
          </h2>
          <p className="mt-2 text-[15px] font-semibold">Free to start. Pay for depth: more people, harder levels.</p>
          <div className="mt-6 grid gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <Panel key={plan} tone={plan === 'starter' ? 'yellow' : 'white'} shadow={plan === 'starter' ? 'md' : 'sm'} className="flex flex-col gap-3 p-5" data-testid={`landing-plan-${plan}`}>
                <div className="flex items-center gap-2">
                  <h3 className="font-display text-[30px] leading-none">{PLAN_LABEL[plan]}</h3>
                  {plan === 'starter' ? <Tag tone="ink">most picked</Tag> : null}
                </div>
                <p className="font-display text-[40px] leading-none">
                  {plan === 'free' ? '$0' : planPrice(plan).replace('/mo', '')}
                  <span className="text-[16px] text-ink/60">/mo</span>
                </p>
                <ul className="flex flex-1 flex-col gap-1.5">
                  {planLines(plan).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[14px]">
                      <CheckIcon size={11} className="mt-1" /> {f}
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-ink/60">Upgrade any time inside the app. Payments by Stripe.</p>
        </section>

        <section className="flex w-full flex-col items-center gap-4 py-10">
          <h2 className="k7-title text-[44px] md:text-[60px]">start your first quest</h2>
          <ButtonLink href="/signup" className="min-w-[200px]">
            let’s start
          </ButtonLink>
        </section>
      </main>
    </Scene>
  );
}
