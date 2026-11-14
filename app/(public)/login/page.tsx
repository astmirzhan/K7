import { Suspense } from 'react';
import { AuthForm } from '@/components/app/AuthForm';
import { Scene } from '@/components/scene/Scene';
import { PanelSkeleton } from '@/components/ui/States';

export default function LoginPage() {
  return (
    <Scene variant="form">
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-4 pb-36 pt-10">
        <Suspense fallback={<PanelSkeleton lines={4} className="w-full max-w-[520px]" />}>
          <AuthForm mode="login" />
        </Suspense>
      </main>
    </Scene>
  );
}
