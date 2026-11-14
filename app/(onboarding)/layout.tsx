import type { ReactNode } from 'react';
import { AppProviders } from '@/components/AppProviders';
import { Scene } from '@/components/scene/Scene';
import { Toaster } from '@/components/ui/Toaster';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <Scene variant="form">
        <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-4 pb-32 pt-8 md:pt-10">{children}</main>
        <Toaster />
      </Scene>
    </AppProviders>
  );
}
