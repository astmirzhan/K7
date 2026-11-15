'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, Input } from '@/components/ui/Field';
import { Panel } from '@/components/ui/Panel';
import { safeNext, signIn, signOut, signUp } from '@/lib/auth-client';
import { getBrowserSupabase } from '@/lib/supabase/browser';

// F3: the 04 panel with two inputs, as the handoff says.
export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // already signed in (the proxy keeps /login open): say who, offer to continue or switch account
  const [current, setCurrent] = useState<string | null>(null);
  useEffect(() => {
    if (mode !== 'login') return;
    let alive = true;
    void getBrowserSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (alive && data.user) setCurrent(data.user.email ?? 'your account');
      });
    return () => {
      alive = false;
    };
  }, [mode]);

  async function switchAccount() {
    setPending(true);
    await signOut();
    setCurrent(null);
    setPending(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const r = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    if (r.ok) {
      router.replace(mode === 'signup' ? '/onboarding' : safeNext(params.get('next')));
      return;
    }
    setError(r.message);
    setPending(false);
  }

  return (
    <Panel className="w-full max-w-[520px] px-6 py-7 md:px-10 md:py-9">
      <h1 className="font-display text-center text-[48px] leading-none">{mode === 'signup' ? 'create your ninja' : 'welcome back'}</h1>
      <p className="mt-2 text-center text-[14px] text-ink/70">
        {mode === 'signup' ? 'Email and a password of 8+ characters. No confirmation email.' : 'Sign in with your email and password.'}
      </p>
      {current ? (
        <div data-testid="signed-in-as" className="mt-6 flex flex-col gap-3 rounded-[12px] border-[3px] border-ink bg-mist p-4">
          <p className="text-[14px]">
            You’re signed in as <span className="font-semibold">{current}</span>.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => router.replace(safeNext(params.get('next')))}>
              continue
            </Button>
            <Button size="sm" variant="secondary" pending={pending} onClick={() => void switchAccount()} data-testid="switch-account">
              use another account
            </Button>
          </div>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className={`mt-6 flex flex-col gap-4 ${current ? 'hidden' : ''}`} noValidate>
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="auth-email"
            placeholder="you@example.com"
          />
        </Field>
        <Field label="Password" htmlFor="password" hint={mode === 'signup' ? 'At least 8 characters' : undefined}>
          <Input
            id="password"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            data-testid="auth-password"
            placeholder="••••••••"
          />
        </Field>
        {error ? (
          <p role="alert" data-testid="auth-error" className="rounded-[8px] border-[3px] border-danger bg-white px-3 py-2 text-[13px] font-semibold text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" pending={pending} data-testid="auth-submit" className="mt-1 w-full">
          {mode === 'signup' ? 'start the quest' : 'enter the map'}
        </Button>
      </form>
      <p className="mt-5 text-center text-[14px]">
        {mode === 'signup' ? (
          <>
            Already have a ninja?{' '}
            <Link href="/login" className="font-semibold underline underline-offset-4">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New here?{' '}
            <Link href="/signup" className="font-semibold underline underline-offset-4">
              Create an account
            </Link>
          </>
        )}
      </p>
    </Panel>
  );
}
