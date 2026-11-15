'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Coin } from '@/components/scene/Coin';
import { CheckIcon } from '@/components/scene/Icons';
import { api } from '@/lib/api';
import { PLAN_LABEL, paywallCopy, planPrice } from '@/lib/format';
import { closePaywall, usePaywall } from '@/lib/paywall';
import { toast } from '@/lib/toast';
import type { PaidPlan } from '@/lib/types';

// Only what the product does today: every line here must be findable after paying.
export const PLAN_FEATURES: Record<PaidPlan, string[]> = {
  starter: ['Everyone on the map', 'Unlimited connects', 'Medium level'],
  pro: ['Hard level', 'AI step-by-step plan for every stage', 'Everyone on the map', 'Unlimited connects'],
  crew: ['Everything in Pro', 'Hard level and AI plans for your whole path', 'Back K7 while we build group quests'],
};

export async function startCheckout(tier: PaidPlan): Promise<void> {
  try {
    sessionStorage.setItem('k7.returnTo', window.location.pathname + window.location.search);
  } catch {
    /* private mode */
  }
  const { url } = await api.checkout({ tier });
  window.location.assign(url);
}

export function PaywallSheet() {
  const p = usePaywall();
  const [busy, setBusy] = useState(false);
  const copy = paywallCopy(p.reason, p.requiredPlan, p.context);

  async function go() {
    setBusy(true);
    try {
      await startCheckout(p.requiredPlan);
    } catch (e) {
      setBusy(false);
      toast((e as Error).message, { tone: 'error' });
    }
  }

  return (
    <Modal open={p.open} onClose={closePaywall} label="Upgrade" testId="paywall" width="max-w-[480px]">
      <div className="flex flex-col gap-4 pr-8">
        <span className="k7-label text-ink/70">{PLAN_LABEL[p.requiredPlan]} plan</span>
        <h2 className="font-display text-[36px] leading-[0.95] text-ink">{copy.title}</h2>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-[44px] leading-none">${planPrice(p.requiredPlan).replace(/\D/g, '')}</span>
          <span className="text-[14px] text-ink/70">/month</span>
        </div>
        <ul className="flex flex-col gap-2">
          {PLAN_FEATURES[p.requiredPlan].map((f) => (
            <li key={f} className="flex items-center gap-2 text-[15px]">
              <CheckIcon size={12} />
              {f}
            </li>
          ))}
        </ul>
        <Button onClick={go} pending={busy} data-testid="paywall-cta" className="w-full">
          <Coin size={18} /> {copy.cta}
        </Button>
        <button type="button" data-testid="paywall-close" onClick={closePaywall} className="k7-label self-center text-ink/70 hover:text-ink">
          not now
        </button>
        <p className="text-center text-[12px] text-ink/60">Stripe test mode · card 4242 4242 4242 4242</p>
      </div>
    </Modal>
  );
}
