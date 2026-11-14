import type { ApiError, ApiErrorCode, PaidPlan } from '../types';

export const HTTP_STATUS: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_ONBOARDED: 409,
  ALREADY_ONBOARDED: 409,
  VALIDATION: 400,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  PLAN_LIMIT: 402,
  STAGE_NOT_ACTIVE: 409,
  PHOTO_REQUIRED: 422,
  PARTNER_REQUIRED: 422,
  PARTNER_INVALID: 422,
  CONNECT_REQUIRED: 422,
  NO_SHARED_INTEREST: 422,
  ALREADY_CONNECTED: 409,
  INVALID_STATE: 409,
  PAYMENT_NOT_COMPLETE: 409,
  INTERNAL: 500,
};

const DEFAULT_MESSAGE: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: 'Please sign in.',
  NOT_ONBOARDED: 'Finish onboarding first.',
  ALREADY_ONBOARDED: 'You are already onboarded.',
  VALIDATION: 'Some fields are invalid.',
  NOT_FOUND: 'Not found.',
  FORBIDDEN: 'You cannot do that.',
  PLAN_LIMIT: 'Upgrade your plan to unlock this.',
  STAGE_NOT_ACTIVE: 'This stage is not open yet.',
  PHOTO_REQUIRED: 'Add a photo to finish this stage.',
  PARTNER_REQUIRED: 'Pick the buddy you did this with.',
  PARTNER_INVALID: 'Pick a buddy you are connected with who shares this interest.',
  CONNECT_REQUIRED: 'Connect with someone on the map to finish this stage.',
  NO_SHARED_INTEREST: 'You need a shared interest to connect.',
  ALREADY_CONNECTED: 'You already have a connection with this person.',
  INVALID_STATE: 'This action is no longer possible.',
  PAYMENT_NOT_COMPLETE: 'Payment is not complete yet.',
  INTERNAL: 'Something went wrong. Try again.',
};

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message?: string,
    public readonly extra: { requiredPlan?: PaidPlan; details?: unknown } = {},
  ) {
    super(message ?? DEFAULT_MESSAGE[code]);
    this.name = 'AppError';
  }
}

// SQL functions raise SQLSTATE P0001 with message = an ApiErrorCode (see migrations/..._functions.sql).
const DB_RAISED = new Set<string>([
  'NOT_FOUND', 'FORBIDDEN', 'VALIDATION', 'PLAN_LIMIT', 'STAGE_NOT_ACTIVE', 'PHOTO_REQUIRED',
  'PARTNER_REQUIRED', 'PARTNER_INVALID', 'CONNECT_REQUIRED', 'NO_SHARED_INTEREST', 'ALREADY_CONNECTED',
  'ALREADY_ONBOARDED', 'NOT_ONBOARDED', 'INVALID_STATE',
]);

/** Maps a supabase-js / PostgREST error ({ code, message, details }) to an AppError. */
export function fromDbError(err: { code?: string; message?: string; details?: string | null }): AppError {
  if (err.code === 'P0001' && err.message && DB_RAISED.has(err.message)) {
    const code = err.message as ApiErrorCode;
    return new AppError(code, DEFAULT_MESSAGE[code], err.details ? { details: err.details } : {});
  }
  return new AppError('INTERNAL', DEFAULT_MESSAGE.INTERNAL, { details: err.message });
}

/** Never leaks internals: INTERNAL details are logged, not returned. */
export function toErrorResponse(e: unknown): { status: number; body: ApiError } {
  const err = e instanceof AppError ? e : new AppError('INTERNAL');
  if (err.code === 'INTERNAL') console.error('[api] internal error', e);
  const body: ApiError = { error: { code: err.code, message: err.message } };
  if (err.extra.requiredPlan) body.error.requiredPlan = err.extra.requiredPlan;
  if (err.code !== 'INTERNAL' && err.extra.details !== undefined) body.error.details = err.extra.details;
  return { status: HTTP_STATUS[err.code], body };
}
