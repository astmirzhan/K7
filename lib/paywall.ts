// Global paywall sheet state. Opened automatically on any 402 (see components/ApiErrorRouter),
// or manually (locked level tap, "+N more people", locked AI steps).
import { useSyncExternalStore } from 'react';
import type { PaidPlan } from './types';

export type PaywallReason = 'level' | 'map' | 'connects' | 'steps' | 'icebreaker' | 'generic';

export interface PaywallState {
  open: boolean;
  requiredPlan: PaidPlan;
  reason: PaywallReason;
  context?: string; // e.g. "Spanish" or "13 more people in Texas"
}

let state: PaywallState = { open: false, requiredPlan: 'starter', reason: 'generic' };
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((fn) => fn());

export function openPaywall(p: Omit<PaywallState, 'open'>): void {
  state = { ...p, open: true };
  emit();
}

export function closePaywall(): void {
  state = { ...state, open: false };
  emit();
}

export function usePaywall(): PaywallState {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    () => state,
    () => state,
  );
}

/** Which benefit to pitch when a 402 comes from this API path. */
export function reasonFromPath(path: string): PaywallReason {
  if (path.startsWith('/api/stages/')) return 'level';
  if (path.includes('/icebreaker')) return 'icebreaker';
  if (path.startsWith('/api/connections')) return 'connects';
  if (path.startsWith('/api/map')) return 'map';
  return 'generic';
}
