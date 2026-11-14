'use client';
import { useState } from 'react';
import { OnboardedGate } from '@/components/OnboardedGate';
import { Coin } from '@/components/scene/Coin';
import { CheckIcon } from '@/components/scene/Icons';
import { Button } from '@/components/ui/Button';
import { Tag } from '@/components/ui/Chip';
import { Panel } from '@/components/ui/Panel';
import { PanelSkeleton } from '@/components/ui/States';
import { PLAN_LABEL, planPrice } from '@/lib/format';
import { PAID_PLANS, PLAN_RULES } from '@/lib/server/plans';
import { toast } from '@/lib/toast';
import type { OnboardedMe, PaidPlan, Plan } from '@/lib/types';
import { PLAN_FEATURES, startCheckout } from './PaywallSheet';

const ORDER: Plan[] = ['free', 'starter', 'pro', 'crew'];
const TAGLINE: Record<Plan, string> = {
  free: 'Try it and appear on the map',
  starter: 'Find your people',
  pro: 'Reach the hard goal',
  crew: 'Quest with your crew',
};

function features(plan: Plan): string[] {
  const r = PLAN_RULES[plan];
  if (plan === 'free') return [`Map: up to ${r.mapVisible} people`, `${r.connectsPerMonth} connects a month`, 'Easy level'];
  return PLAN_FEATURES[plan as PaidPlan];
}

// 12 Pricing: four plan cards, current one marked, checkout through Stripe.
export function PricingScreen() {
  return (
    <OnboardedGate fallback={<PanelSkeleton lines={6} />}>
      {(me) => <Inner me={me} />}
    </OnboardedGate>
  );
}

function Inner({ me }: { me: OnboardedMe }) {
  const [busy, setBusy] = useState<PaidPlan | null>(null);
  const rank = (p: Plan) => ORDER.indexOf(p);

  async function buy(tier: PaidPlan) {
    setBusy(tier);
    try {
      await startCheckout(tier);
    } catch (e) {
      setBusy(null);
      toast(e instanceof Error ? e.message : 'Something went wrong. Try again.', { tone: 'error' });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-4">
      <div>
        <h1 className="font-display text-[34px] leading-none">plans</h1>
        <p className="mt-1 text-[14px] text-ink/70">Free to start. Pay for depth: more people, harder levels, your crew.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ORDER.map((plan) => {
          const current = me.plan === plan;
          const paid = plan !== 'free';
          const lower = rank(plan) < rank(me.plan);
          return (
            <Panel key={plan} tone={current ? 'yellow' : 'white'} shadow={current ? 'md' : 'sm'} className="flex flex-col gap-3 p-5" data-testid={`plan-${plan}`}>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-[30px] leading-none">{PLAN_LABEL[plan]}</h2>
                {current ? <Tag tone="ink">your plan</Tag> : null}
              </div>
              <p className="text-[13px] text-ink/70">{TAGLINE[plan]}</p>
              <p className="font-display text-[40px] leading-none">
                {paid ? planPrice(plan as PaidPlan).replace('/mo', '') : '$0'}
                <span className="text-[16px] text-ink/60">/mo</span>
              </p>
              <ul className="flex flex-1 flex-col gap-1.5">
                {features(plan).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[14px]">
                    <CheckIcon size={11} /> {f}
                  </li>
                ))}
                {plan !== 'free' && plan !== 'starter' ? <li className="text-[12px] text-ink/60">+ everything in {PLAN_LABEL[ORDER[rank(plan) - 1]!]}</li> : null}
              </ul>
              {paid && !current && !lower ? (
                <Button pending={busy === plan} onClick={() => buy(plan as PaidPlan)} className="w-full">
                  <Coin size={16} /> get {PLAN_LABEL[plan].toLowerCase()}
                </Button>
              ) : (
                <Button variant="secondary" disabled className="w-full">
                  {current ? 'current' : lower ? 'included' : 'free'}
                </Button>
              )}
            </Panel>
          );
        })}
      </div>
      <p className="text-center text-[12px] text-ink/60">Stripe test mode · card 4242 4242 4242 4242 · any future date · any CVC</p>
      {PAID_PLANS.length === 0 ? null : null}
    </div>
  );
}
