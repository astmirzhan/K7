import type { ReactNode } from 'react';
import { AppProviders } from '@/components/AppProviders';
import { PaywallSheet } from '@/components/app/PaywallSheet';
import { TabBar, TopNav } from '@/components/app/TopNav';
import { Scene } from '@/components/scene/Scene';
import { Toaster } from '@/components/ui/Toaster';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <Scene variant="app">
        <TopNav />
        <main className="mx-auto w-full max-w-[1320px] flex-1 px-3 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-28 md:pt-5">
          {children}
        </main>
        <TabBar />
        <PaywallSheet />
        <Toaster />
      </Scene>
    </AppProviders>
  );
}
