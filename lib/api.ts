// Typed client for every K7 endpoint. Browser only (same-origin cookies).
// All screens call the API through `api.*` — never `fetch('/api/...')` directly.
import type {
  ApiError, ApiErrorCode, BlockRequest, CheckoutRequest, CheckoutResponse, CompleteStageRequest,
  CompleteStageResponse, ConfirmCheckoutRequest, ConfirmCheckoutResponse, Connection, ConnectionsResponse,
  CreateConnectionRequest, CreateMeetupRequest, FeedItem, Interest, Level, MapStateCount, MapUsersResponse,
  Me, Meetup, OkResponse, OnboardingRequest, OnboardingResponse, PaidPlan, PublicStats, ReportRequest,
  RespondConnectionRequest, UpdateMeetupRequest, UploadUrlResponse, UsState,
} from './types';

export class ApiRequestError extends Error {
  readonly status: number;       // 0 = network error
  readonly code: ApiErrorCode;
  readonly path: string;
  readonly requiredPlan?: PaidPlan;
  readonly details?: unknown;    // VALIDATION: Array<{ path: string; message: string }>

  constructor(init: {
    status: number; code: ApiErrorCode; message: string; path: string; requiredPlan?: PaidPlan; details?: unknown;
  }) {
    super(init.message);
    this.name = 'ApiRequestError';
    this.status = init.status;
    this.code = init.code;
    this.path = init.path;
    this.requiredPlan = init.requiredPlan;
    this.details = init.details;
  }

  /** VALIDATION details as { 'profile.socialUrl': 'message' } for inline form errors. */
  fieldErrors(): Record<string, string> {
    if (this.code !== 'VALIDATION' || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as Array<{ path?: unknown; message?: unknown }>) {
      if (typeof d?.path === 'string' && typeof d?.message === 'string' && !(d.path in out)) out[d.path] = d.message;
    }
    return out;
  }
}

type Listener = (err: ApiRequestError) => void;
const listeners = new Set<Listener>();

/** Global reactions (401 -> login, 402 -> paywall, 409 NOT_ONBOARDED -> onboarding). Returns unsubscribe. */
export function onApiError(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function isApiError(v: unknown): v is ApiError {
  return typeof v === 'object' && v !== null && 'error' in v
    && typeof (v as { error?: { code?: unknown } }).error?.code === 'string';
}

export async function request<T>(method: 'GET' | 'POST' | 'PATCH', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const err = new ApiRequestError({
      status: 0, code: 'INTERNAL', path, message: 'No connection. Check your internet and try again.',
    });
    listeners.forEach((l) => l(err));
    throw err;
  }

  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    const err = isApiError(json)
      ? new ApiRequestError({
          status: res.status, path, code: json.error.code, message: json.error.message,
          requiredPlan: json.error.requiredPlan, details: json.error.details,
        })
      : new ApiRequestError({ status: res.status, path, code: 'INTERNAL', message: 'Something went wrong. Try again.' });
    listeners.forEach((l) => l(err));
    throw err;
  }
  return json as T;
}

/** SWR fetcher: the SWR key is the GET path. */
export const fetcher = <T>(path: string) => request<T>('GET', path);

/** SWR keys = GET paths. Use these everywhere so revalidation hits the right cache entries. */
export const KEYS = {
  me: '/api/me',
  interests: '/api/interests',
  stats: '/api/stats',
  roadmap: '/api/roadmap',
  mapStates: '/api/map/states',
  mapUsers: (state: UsState) => `/api/map/users?state=${state}`,
  connections: '/api/connections',
  meetups: '/api/meetups',
  feed: (scope: 'public' | 'mine') => `/api/feed?scope=${scope}`,
} as const;

const id = (v: string) => encodeURIComponent(v);

export const api = {
  health: () => request<{ ok: boolean; interests: number }>('GET', '/api/health'),
  interests: () => request<Interest[]>('GET', KEYS.interests),
  stats: () => request<PublicStats>('GET', KEYS.stats),
  me: () => request<Me>('GET', KEYS.me),
  onboarding: (body: OnboardingRequest) => request<OnboardingResponse>('POST', '/api/onboarding', body),

  roadmap: () => request<Level[]>('GET', KEYS.roadmap),
  stageUploadUrl: (stageId: string) => request<UploadUrlResponse>('POST', `/api/stages/${id(stageId)}/upload-url`, {}),
  completeStage: (stageId: string, body: CompleteStageRequest) =>
    request<CompleteStageResponse>('POST', `/api/stages/${id(stageId)}/complete`, body),

  mapStates: () => request<MapStateCount[]>('GET', KEYS.mapStates),
  mapUsers: (state: UsState) => request<MapUsersResponse>('GET', KEYS.mapUsers(state)),

  connections: () => request<ConnectionsResponse>('GET', KEYS.connections),
  connect: (body: CreateConnectionRequest) => request<Connection>('POST', '/api/connections', body),
  respondConnection: (connectionId: string, body: RespondConnectionRequest) =>
    request<Connection>('PATCH', `/api/connections/${id(connectionId)}`, body),

  meetups: () => request<Meetup[]>('GET', KEYS.meetups),
  proposeMeetup: (body: CreateMeetupRequest) => request<Meetup>('POST', '/api/meetups', body),
  updateMeetup: (meetupId: string, body: UpdateMeetupRequest) =>
    request<Meetup>('PATCH', `/api/meetups/${id(meetupId)}`, body),

  feed: (scope: 'public' | 'mine') => request<FeedItem[]>('GET', KEYS.feed(scope)),

  report: (body: ReportRequest) => request<OkResponse>('POST', '/api/reports', body),
  block: (body: BlockRequest) => request<OkResponse>('POST', '/api/blocks', body),

  checkout: (body: CheckoutRequest) => request<CheckoutResponse>('POST', '/api/stripe/checkout', body),
  confirmCheckout: (body: ConfirmCheckoutRequest) =>
    request<ConfirmCheckoutResponse>('POST', '/api/stripe/confirm', body),
};
