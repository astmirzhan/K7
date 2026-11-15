'use client';
// Wrap every app screen (app/(app)/layout.tsx). Sends not-onboarded users to /onboarding.
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { signOut } from '@/lib/auth-client';
import { useMe } from '@/lib/hooks';
import type { OnboardedMe } from '@/lib/types';

export function OnboardedGate({
  children,
  fallback = null,
}: {
  children: (me: OnboardedMe) => ReactNode;
  fallback?: ReactNode; // skeleton from the design
}) {
  const { data, error, mutate, isValidating } = useMe();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (data && !data.onboarded) router.replace('/onboarding');
  }, [data, router]);

  // never a dead end: if the profile cannot load, say so and offer a way out
  if (!data && error) {
    return (
      <Panel className="mx-auto flex w-full max-w-[480px] flex-col items-start gap-3 p-6" role="alert" data-testid="me-error">
        <h2 className="font-display text-[30px] leading-none">couldn’t load your quest</h2>
        <p className="text-[14px] text-ink/75">{error.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" pending={isValidating} onClick={() => void mutate()}>retry</Button>
          <Button
            size="sm"
            variant="secondary"
            pending={leaving}
            onClick={async () => {
              setLeaving(true);
              await signOut();
              router.replace('/login');
            }}
          >
            sign out
          </Button>
        </div>
      </Panel>
    );
  }
  if (data && !data.onboarded) {
    return (
      <Panel className="mx-auto flex w-full max-w-[480px] flex-col items-start gap-3 p-6" data-testid="finish-setup">
        <h2 className="font-display text-[30px] leading-none">finish setting up</h2>
        <p className="text-[14px] text-ink/75">Pick your ninja and 3 goals to open your quest map.</p>
        <ButtonLink href="/onboarding" size="sm">continue setup</ButtonLink>
      </Panel>
    );
  }
  if (!data) return <>{fallback}</>;
  return <>{children(data)}</>;
}
