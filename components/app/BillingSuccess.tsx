'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Coin } from '@/components/scene/Coin';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { api, ApiRequestError } from '@/lib/api';
import { safeNext } from '@/lib/auth-client';
import { PLAN_LABEL } from '@/lib/format';
import { invalidate } from '@/lib/hooks';
import type { Plan } from '@/lib/types';

type Status = { kind: 'checking'; attempt: number } | { kind: 'done'; plan: Plan; returnTo: string } | { kind: 'processing' } | { kind: 'error'; message: string };

const TRIES = 3;
const GAP_MS = 2000;

// 13 Billing success: confirms the Checkout session (webhook may be late), then back to where the paywall opened.
export function BillingSuccess() {
  const router = useRouter();
  const sessionId = useSearchParams().get('session_id');
  const [status, setStatus] = useState<Status>({ kind: 'checking', attempt: 1 });
  const started = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace('/pricing');
      return;
    }
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    (async () => {
      let returnTo = '/roadmap';
      try {
        returnTo = safeNext(sessionStorage.getItem('k7.returnTo')) || '/roadmap';
      } catch {
        /* ignore */
      }
      for (let attempt = 1; attempt <= TRIES; attempt++) {
        if (cancelled) return;
        setStatus({ kind: 'checking', attempt });
        try {
          const { plan } = await api.confirmCheckout({ sessionId });
          await invalidate.afterPlanChange();
          try {
            sessionStorage.removeItem('k7.returnTo');
          } catch {
            /* ignore */
          }
          if (!cancelled) setStatus({ kind: 'done', plan, returnTo });
          return;
        } catch (e) {
          if (e instanceof ApiRequestError && e.code === 'PAYMENT_NOT_COMPLETE' && attempt < TRIES) {
            await new Promise((r) => setTimeout(r, GAP_MS));
            continue;
          }
          if (cancelled) return;
          if (e instanceof ApiRequestError && e.code === 'PAYMENT_NOT_COMPLETE') setStatus({ kind: 'processing' });
          else setStatus({ kind: 'error', message: e instanceof Error ? e.message : 'Something went wrong. Try again.' });
          return;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, router]);

  return (
    <div className="mx-auto w-full max-w-[480px]">
      <Panel className="flex flex-col items-center gap-4 p-7 text-center" data-testid="billing-success" aria-live="polite">
        {status.kind === 'checking' ? (
          <>
            <Coin size={40} className="k7-float" />
            <h1 className="font-display text-[36px] leading-none">confirming your payment…</h1>
            <p className="text-[14px] text-ink/70">Attempt {status.attempt} of {TRIES}. This takes a few seconds.</p>
          </>
        ) : status.kind === 'done' ? (
          <>
            <Coin size={40} className="k7-bounce" />
            <h1 className="font-display text-[40px] leading-none">you&apos;re on {PLAN_LABEL[status.plan]}</h1>
            <p className="text-[14px] text-ink/70">Levels, people and steps unlocked. Back to your quest.</p>
            <ButtonLink href={status.returnTo}>continue</ButtonLink>
          </>
        ) : status.kind === 'processing' ? (
          <>
            <h1 className="font-display text-[36px] leading-none">payment is processing</h1>
            <p className="text-[14px] text-ink/70">Stripe is finishing up. Refresh in a minute — your plan updates automatically.</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>refresh</Button>
              <ButtonLink href="/pricing" variant="secondary">plans</ButtonLink>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-[36px] leading-none">something went wrong</h1>
            <p className="text-[14px] text-danger">{status.message}</p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>try again</Button>
              <ButtonLink href="/pricing" variant="secondary">plans</ButtonLink>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
