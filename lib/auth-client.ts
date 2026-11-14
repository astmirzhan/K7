// Sign up / sign in / sign out for the browser. Email + password, "Confirm email" is OFF in Supabase,
// so signUp returns a session immediately.
import type { AuthError } from '@supabase/supabase-js';
import { invalidate } from './hooks';
import { getBrowserSupabase } from './supabase/browser';

export type AuthResult = { ok: true } | { ok: false; message: string };

export function authMessage(err: Pick<AuthError, 'code' | 'message'>): string {
  switch (err.code) {
    case 'invalid_credentials': return 'Wrong email or password.';
    case 'user_already_exists': return 'An account with this email already exists. Sign in instead.';
    case 'weak_password': return 'Use at least 8 characters.';
    case 'email_address_invalid': return 'Enter a valid email address.';
    case 'over_request_rate_limit': return 'Too many attempts. Wait a minute and try again.';
    default: return err.message || 'Could not sign you in. Try again.';
  }
}

export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (password.length < 8) return { ok: false, message: 'Use at least 8 characters.' };
  const { data, error } = await getBrowserSupabase().auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, message: authMessage(error) };
  if (!data.session) return { ok: false, message: 'Sign-up needs email confirmation. Turn it off in Supabase.' };
  return { ok: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await getBrowserSupabase().auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, message: authMessage(error) };
  await invalidate.clearAll(); // never show the previous account's cached data
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await getBrowserSupabase().auth.signOut();
  await invalidate.clearAll();
}

/** Only same-site relative paths; anything else -> /home (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/home';
  return next;
}
