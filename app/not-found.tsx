import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Scene } from '@/components/scene/Scene';

export default function NotFound() {
  return (
    <Scene variant="form">
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 items-center justify-center px-4 pb-36 pt-10">
        <Panel className="w-full max-w-[480px] p-8 text-center">
          <p className="k7-title text-[96px]">404</p>
          <h1 className="font-display mt-2 text-[36px] leading-none">this path isn’t on the map</h1>
          <p className="mt-3 text-[14px] text-ink/70">A wrong turn doesn’t cost you anything. Your progress is saved.</p>
          <ButtonLink href="/home" className="mt-6">
            back to the map
          </ButtonLink>
        </Panel>
      </main>
    </Scene>
  );
}
