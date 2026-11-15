'use client';
// Mount once in app/(app)/layout.tsx and app/(onboarding)/layout.tsx.
// Global reactions to API errors + SWR defaults. Visuals of the paywall live in <PaywallSheet/> (from the design).
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { ApiRequestError, fetcher, onApiError } from '@/lib/api';
import { hardNavigate } from '@/lib/auth-client';
import { openPaywall, reasonFromPath } from '@/lib/paywall';

export function AppProviders({ children }: { children: ReactNode }) {
  const router = useRouter();

  useEffect(
    () =>
      onApiError((err) => {
        if (err.status === 401) {
          // full load: drop router cache entries from the expired session
          hardNavigate(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        } else if (err.code === 'NOT_ONBOARDED') {
          router.replace('/onboarding');
        } else if (err.status === 402) {
          openPaywall({ requiredPlan: err.requiredPlan ?? 'starter', reason: reasonFromPath(err.path) });
        }
      }),
    [router],
  );

  return (
    <SWRConfig
      value={{
        fetcher,
        errorRetryCount: 3,
        // retry only network errors and 5xx; 4xx are answers, not glitches
        shouldRetryOnError: (e) => !(e instanceof ApiRequestError) || e.status === 0 || e.status >= 500,
      }}
    >
      {children}
    </SWRConfig>
  );
}
