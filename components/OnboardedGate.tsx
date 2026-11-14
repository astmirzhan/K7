'use client';
// Wrap every app screen (app/(app)/layout.tsx). Sends not-onboarded users to /onboarding.
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useMe } from '@/lib/hooks';
import type { OnboardedMe } from '@/lib/types';

export function OnboardedGate({
  children,
  fallback = null,
}: {
  children: (me: OnboardedMe) => ReactNode;
  fallback?: ReactNode; // skeleton from the design
}) {
  const { data } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (data && !data.onboarded) router.replace('/onboarding');
  }, [data, router]);

  if (!data || !data.onboarded) return <>{fallback}</>;
  return <>{children(data)}</>;
}
