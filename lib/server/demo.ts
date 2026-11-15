// Seeded demo people (no human behind them) and the auto-accept switch. Pure: safe in unit tests.

const DEMO_EMAIL = /^k7\.(seed\.[a-z0-9-]+|sarah)@example\.com$/i;

/** Seeded map people: they never open the app, so requests to them are accepted at once. */
export function isDemoAccount(email: string | null | undefined): boolean {
  return !!email && DEMO_EMAIL.test(email);
}

/**
 * AUTO_ACCEPT_CONNECTS: unset/"demo" = only demo people accept by themselves (default);
 * "all" = every request is accepted at once (for testing with friends); "off" = nobody.
 */
export function shouldAutoAccept(targetEmail: string | null | undefined, setting: string | undefined): boolean {
  const mode = (setting ?? 'demo').trim().toLowerCase();
  if (mode === 'off') return false;
  if (mode === 'all') return true;
  return isDemoAccount(targetEmail);
}
