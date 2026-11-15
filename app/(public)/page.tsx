import { ButtonLink } from '@/components/ui/Button';
import { Coin } from '@/components/scene/Coin';
import { Scene } from '@/components/scene/Scene';

// 01 Start — static landing.
export default function LandingPage() {
  return (
    <Scene variant="hero">
      <main className="relative mx-auto flex w-full max-w-[1200px] flex-1 flex-col items-center justify-center px-4 pb-40 pt-16 text-center md:pb-48">
        {/* decorative coins: desktop only (the svg's own inline-block beat `hidden`, so the wrapper hides them) */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden md:block">
          <Coin size={34} className="k7-float absolute left-[14%] top-[28%]" />
          <Coin size={30} className="k7-float absolute right-[14%] top-[40%] [animation-delay:400ms]" />
          <Coin size={26} className="k7-float absolute bottom-[30%] left-[30%] [animation-delay:800ms]" />
        </div>

        <h1 className="k7-title text-[128px] md:text-[176px]">K7</h1>
        <p className="k7-title mt-2 text-[44px] md:text-[64px]">network sidequesting</p>
        <p className="mt-5 text-[16px] font-semibold md:text-[18px]">Your goal is a quest. Don’t play it alone.</p>

        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
          <ButtonLink href="/signup" data-testid="start-cta" className="min-w-[180px]">
            let’s start
          </ButtonLink>
          <ButtonLink href="/login" variant="secondary" className="min-w-[200px]">
            I have an account
          </ButtonLink>
        </div>

        <p className="mt-8 max-w-[520px] text-[13px] text-ink/70">
          You’re not alone — people nearby are starting too. 5-minute quest, easier than scrolling. Missing a day doesn’t reset your path.
        </p>
      </main>
    </Scene>
  );
}
