// SWR data hooks + cache invalidation after writes. Import only from client components.
import useSWR, { mutate } from 'swr';
import { fetcher, KEYS } from './api';
import type {
  ConnectionsResponse, FeedItem, Interest, Level, MapStateCount, MapUsersResponse, Me, Meetup, PublicStats, UsState,
} from './types';

const POLL_ME_MS = 20_000;        // pendingIncoming badge, coins
const POLL_WAITING_MS = 5_000;    // while a co-op stage waits for the partner
const POLL_PEOPLE_MS = 15_000;    // on the People screen

export const useMe = () => useSWR<Me>(KEYS.me, fetcher, { refreshInterval: POLL_ME_MS });
export const useInterests = () => useSWR<Interest[]>(KEYS.interests, fetcher, { revalidateOnFocus: false });
/** Public landing counter. */
export const usePublicStats = () => useSWR<PublicStats>(KEYS.stats, fetcher, { revalidateOnFocus: false });

/** Polls fast while any stage is waiting for a partner, so the "both done" reveal appears by itself. */
export function useRoadmap() {
  return useSWR<Level[]>(KEYS.roadmap, fetcher, {
    refreshInterval: (levels) =>
      levels?.some((l) => l.stages.some((s) => s.status === 'waiting_partner')) ? POLL_WAITING_MS : 0,
  });
}

export const useMapStates = () => useSWR<MapStateCount[]>(KEYS.mapStates, fetcher);
export const useMapUsers = (state: UsState | null) =>
  useSWR<MapUsersResponse>(state ? KEYS.mapUsers(state) : null, fetcher);

export const useConnections = (opts: { poll?: boolean } = {}) =>
  useSWR<ConnectionsResponse>(KEYS.connections, fetcher, { refreshInterval: opts.poll ? POLL_PEOPLE_MS : 0 });
export const useMeetups = () => useSWR<Meetup[]>(KEYS.meetups, fetcher);
export const useFeed = (scope: 'public' | 'mine') => useSWR<FeedItem[]>(KEYS.feed(scope), fetcher);

// ---------- Invalidation: call after the matching write succeeds ----------
const startsWith = (prefix: string) => (key: unknown) => typeof key === 'string' && key.startsWith(prefix);
const allMapUsers = startsWith('/api/map/users');
const allFeeds = startsWith('/api/feed');

export const invalidate = {
  /** onboarding returns me + roadmap: seed the cache, no refetch */
  afterOnboarding: (me: Me, roadmap: Level[]) =>
    Promise.all([mutate(KEYS.me, me, { revalidate: false }), mutate(KEYS.roadmap, roadmap, { revalidate: false })]),
  afterStageComplete: () => Promise.all([mutate(KEYS.me), mutate(KEYS.roadmap), mutate(allFeeds)]),
  afterConnect: () => Promise.all([mutate(KEYS.me), mutate(KEYS.connections), mutate(allMapUsers)]),
  // accepting auto-completes "Find a buddy" stages -> roadmap and coins change too
  afterRespond: () =>
    Promise.all([mutate(KEYS.me), mutate(KEYS.connections), mutate(KEYS.roadmap), mutate(allMapUsers)]),
  afterMeetup: () => mutate(KEYS.meetups),
  afterBlock: () =>
    Promise.all([
      mutate(KEYS.me), mutate(KEYS.mapStates), mutate(allMapUsers), mutate(KEYS.connections),
      mutate(KEYS.roadmap), mutate(KEYS.meetups), mutate(allFeeds),
    ]),
  // plan change unlocks levels, AI steps and the full map
  afterPlanChange: () => Promise.all([mutate(KEYS.me), mutate(KEYS.roadmap), mutate(allMapUsers)]),
  /** sign-out: drop every cached response without refetching */
  clearAll: () => mutate(() => true, undefined, { revalidate: false }),
};
