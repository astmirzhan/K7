'use client';
import { Button, ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Scene } from '@/components/scene/Scene';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Scene variant="form">
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-4 pb-36 pt-10">
        <Panel className="w-full max-w-[480px] p-8 text-center" role="alert">
          <h1 className="font-display text-[40px] leading-none">something went wrong</h1>
          <p className="mt-3 text-[14px] text-ink/70">Try again. Your progress is saved.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={reset}>try again</Button>
            <ButtonLink href="/home" variant="secondary">
              home
            </ButtonLink>
          </div>
        </Panel>
      </main>
    </Scene>
  );
}
