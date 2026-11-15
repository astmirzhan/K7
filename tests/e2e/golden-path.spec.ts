import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { admin, onboardingBody, PASSWORD, publicClient } from '../api/helpers';

// The golden path from CLAUDE.md §8 on a phone: two fresh users (A onboards through the UI, B through the API),
// then first stage → map → connect → co-op → paywall up to the Stripe Checkout URL → report and block a seed user.
// Runs against `pnpm dev --port 3100` (playwright.config.ts) and the Supabase project from .env.local.

const PHOTO = 'tests/fixtures/photo.jpg';
const EASY = 'guitar'; // clicking running → spanish → guitar fills Hard → Medium → Easy, so Easy is guitar
const CITY_ONLY = 'City only — never your exact location';

interface Actor { id: string; email: string; ctx: BrowserContext; page: Page }
let a: Actor;
let b: Actor;
const created: string[] = [];

async function newUser(): Promise<{ id: string; email: string }> {
  const email = `t-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const { data, error } = await admin().auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  created.push(data.user.id);
  return { id: data.user.id, email };
}

async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByTestId('auth-email').fill(email);
  await page.getByTestId('auth-password').fill(PASSWORD);
  await page.getByTestId('auth-submit').click();
  await page.waitForURL(/\/(home|onboarding)/, { timeout: 60_000, waitUntil: 'commit' });
}

async function coins(page: Page): Promise<number> {
  const text = (await page.getByTestId('coins').textContent()) ?? '';
  return Number(text.replace(/\D/g, ''));
}

async function openStage(page: Page, idx: number) {
  await page.goto('/roadmap');
  await page.getByTestId(`stage-${EASY}-${idx}`).click();
  await expect(page.getByTestId('stage-sheet')).toBeVisible();
}

test.describe.configure({ mode: 'serial', timeout: 240_000 }); // first visits compile pages in `next dev`

test.beforeAll(async ({ browser }, info) => {
  const ctxA = await browser.newContext({ ...info.project.use, baseURL: info.project.use.baseURL });
  const ctxB = await browser.newContext({ ...info.project.use, baseURL: info.project.use.baseURL });
  a = { id: '', email: '', ctx: ctxA, page: await ctxA.newPage() };
  b = { id: '', email: '', ctx: ctxB, page: await ctxB.newPage() };
});

test.afterAll(async () => {
  await a?.ctx.close();
  await b?.ctx.close();
  await Promise.all(created.map((id) => admin().auth.admin.deleteUser(id)));
});

test('GP-1 onboarding: landing → sign in → ninja → 3 goals → profile → home with quest, 0 coins, nearby', async () => {
  const { page } = a;

  // landing → Start opens sign-up (the account itself comes from the admin API, so the run does not
  // depend on Supabase email settings or its sign-up email rate limit)
  await page.goto('/');
  await page.getByTestId('start-cta').click();
  await page.waitForURL(/\/signup/);
  await expect(page.getByTestId('auth-submit')).toBeVisible();

  const u = await newUser();
  a.id = u.id;
  a.email = u.email;
  await signIn(page, a.email);
  await page.waitForURL(/\/onboarding/, { timeout: 60_000 });

  // step 1: avatar
  await page.getByTestId('avatar-ninja-1').click();
  await page.getByTestId('onboarding-next').click();

  // step 2: profile
  await page.getByTestId('profile-displayName').fill('Judge A');
  await page.getByTestId('profile-state').selectOption({ value: 'TX' });
  await page.getByTestId('profile-city').fill('Austin');
  await page.getByTestId('profile-ageRange-30-34').click();
  await page.getByTestId('profile-meetStyle-solo').click();
  await page.getByTestId('profile-socialUrl').fill('https://instagram.com/judge.a');
  await page.getByTestId('profile-bio').fill('Testing the whole path.');
  await page.getByTestId('onboarding-next').click();

  // step 3: three typed goals, each with its N value (typed names land on the suggested goals)
  await page.getByTestId('goal-input-1').fill('Running');
  await page.getByTestId('goal-n-1-5').click();
  await page.getByTestId('goal-input-2').fill('Learn Spanish');
  await page.getByTestId('goal-n-2-3').click();
  await page.getByTestId('goal-input-3').fill('Guitar');
  await page.getByTestId('goal-n-3-1').click();
  await expect(page.getByTestId('goals-total')).toBeVisible();
  await page.getByTestId('onboarding-submit').click();

  await page.waitForURL(/\/home/, { timeout: 60_000 });
  await expect(page.getByTestId('quest-of-day')).toBeVisible();
  await expect.poll(() => coins(page)).toBe(0);
  await expect(page.locator('[data-testid^="nearby-"]').first()).toBeVisible();

  // roadmap: three levels, Medium and Hard locked with the plan name
  await page.goto('/roadmap');
  await expect(page.getByTestId('level-lock-spanish')).toContainText(/medium/i);
  await expect(page.getByTestId('level-lock-running')).toContainText(/hard/i);
  await page.getByTestId('level-lock-spanish').click();
  await expect(page.getByTestId('paywall')).toContainText(/starter/i);
  await page.getByTestId('paywall-close').click();

  // user B: same goals through the API, signs in through the UI
  const ub = await newUser();
  b.id = ub.id;
  b.email = ub.email;
  const session = await publicClient().auth.signInWithPassword({ email: b.email, password: PASSWORD });
  const token = session.data.session?.access_token;
  if (!token) throw new Error('B sign-in failed');
  const base = test.info().project.use.baseURL!;
  const res = await fetch(`${base}/api/onboarding`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(
      onboardingBody({
        interests: [
          { slug: 'running', difficulty: 5 },
          { slug: 'spanish', difficulty: 3 },
          { slug: EASY, difficulty: 1 },
        ],
        socialUrl: 'https://instagram.com/judge.b',
      }),
    ),
  });
  expect(res.status).toBe(200);
  await signIn(b.page, b.email);
});

test('GP-2 first stage with a photo: +3 coins, stage 2 "find a buddy" becomes active', async () => {
  const { page } = a;
  await openStage(page, 1);
  await page.getByTestId('stage-photo-input').setInputFiles(PHOTO);
  await page.getByTestId('stage-caption').fill('First mini-goal done');
  await page.getByTestId('stage-complete').click();
  await expect(page.getByTestId('stage-sheet')).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => coins(page), { timeout: 15_000 }).toBe(3);
  await expect(page.getByTestId(`stage-${EASY}-2`)).toHaveAttribute('aria-current', 'step');

  // B does stage 1 without a photo (+1)
  await openStage(b.page, 1);
  await b.page.getByTestId('stage-complete').click();
  await expect(b.page.getByTestId('stage-sheet')).toBeHidden({ timeout: 30_000 });
  await expect.poll(() => coins(b.page), { timeout: 15_000 }).toBe(1);
});

test('GP-3 map: tiles with counts, TX cards with shared interests, same city, "+N more with Starter"', async () => {
  const { page } = a;
  await page.goto('/map?state=TX');
  await expect(page.getByTestId('map-tile-TX')).toBeVisible();
  await expect(page.getByText(CITY_ONLY).first()).toBeVisible();
  const card = page.getByTestId(`match-card-${b.id}`);
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card).toContainText(/same city/i);
  await expect(card).toContainText(/you easy · them easy/i);
  await expect(page.getByTestId('hidden-more')).toContainText(/more with starter/i);
});

test('GP-4 connect: A requests B, B accepts, both get the social link and "find a buddy" completes itself', async () => {
  const { page } = a;
  await page.goto('/map?state=TX');
  const connect = page.getByTestId(`connect-${b.id}`);
  await connect.click(); // three shared interests → pick one (default is preselected)
  await connect.click();
  await expect(page.getByTestId(`match-card-${b.id}`)).toContainText(/requested/i, { timeout: 15_000 });

  await b.page.goto('/people');
  await b.page.locator('[data-testid^="accept-"]').first().click();
  await expect(b.page.locator('[data-testid^="buddy-"]').first()).toBeVisible({ timeout: 15_000 });
  await expect(b.page.locator('[data-testid^="social-"]').first()).toHaveAttribute('href', 'https://instagram.com/judge.a');
  await expect(b.page.locator('[data-testid^="propose-meetup-"]').first()).toBeVisible();

  await page.goto('/people');
  await page.getByRole('tab', { name: /buddies/i }).click();
  await expect(page.locator('[data-testid^="social-"]').first()).toHaveAttribute('href', 'https://instagram.com/judge.b');

  // "find a buddy" stages completed themselves: A 3 + 1, B 1 + 1
  await page.goto('/roadmap');
  await expect.poll(() => coins(page), { timeout: 15_000 }).toBe(4);
  await expect(page.getByTestId(`stage-${EASY}-3`)).toHaveAttribute('aria-current', 'step');
  await b.page.goto('/roadmap');
  await expect.poll(() => coins(b.page), { timeout: 15_000 }).toBe(2);
});

test('GP-5 co-op: A waits for B, B completes → both done, level complete, feed shows both photos', async () => {
  const { page } = a;
  await openStage(page, 3);
  await page.getByTestId(`partner-option-${b.id}`).click();
  await page.getByTestId('stage-photo-input').setInputFiles(PHOTO);
  await page.getByTestId('stage-caption').fill('Together');
  await page.getByTestId('stage-complete').click();
  await expect(page.getByTestId('waiting-partner')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('waiting-partner')).toContainText('Test Ninja');

  await openStage(b.page, 3);
  await b.page.getByTestId(`partner-option-${a.id}`).click();
  await b.page.getByTestId('stage-photo-input').setInputFiles(PHOTO);
  await b.page.getByTestId('stage-complete').click();
  await expect(b.page.getByTestId('level-complete')).toBeVisible({ timeout: 30_000 });

  // A sees it on the next roadmap poll
  await expect(page.getByTestId('level-complete')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /next goal/i }).click();
  await expect.poll(() => coins(page), { timeout: 15_000 }).toBe(8); // 4 + 2 photo + 1 stage + 1 co-op bonus

  // co-op reveal: one feed card with both partners' photos side by side
  await page.goto('/feed');
  const reveal = page.getByTestId('feed-item').filter({ hasText: 'Judge A & Test Ninja' }).or(
    page.getByTestId('feed-item').filter({ hasText: 'Test Ninja & Judge A' }),
  );
  await expect(reveal.first()).toBeVisible({ timeout: 20_000 });
  await expect(reveal.first().locator('img')).toHaveCount(2);
});

test('GP-6 paywall: Medium stage → "Unlock Medium: Spanish — Starter" → Stripe Checkout', async () => {
  test.skip(!process.env.STRIPE_SECRET_KEY, 'STRIPE_SECRET_KEY is empty in .env.local: Checkout cannot be created');
  const { page } = a;
  await page.goto('/roadmap');
  await page.getByTestId('level-lock-spanish').click();
  const paywall = page.getByTestId('paywall');
  await expect(paywall).toContainText('Unlock Medium: Spanish');
  await expect(paywall).toContainText('$5');
  await page.getByTestId('paywall-cta').click();
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 45_000 });
  await page.goBack();
});

test('GP-7 safety: report and block a seed user from their card → they disappear from the map', async () => {
  const { page } = a;
  await page.goto('/map?state=TX');
  const menu = page.locator(`[data-testid^="card-menu-"]:not([data-testid="card-menu-${b.id}"])`).first();
  await expect(menu).toBeVisible({ timeout: 20_000 });
  const userId = (await menu.getAttribute('data-testid'))!.replace('card-menu-', '');

  await menu.click();
  await page.getByTestId(`report-${userId}`).click();
  await page.getByRole('button', { name: /send report/i }).click();
  await expect(page.getByText(/thanks, we'll review it/i)).toBeVisible();

  await menu.click();
  await page.getByTestId(`block-${userId}`).click();
  await page.getByTestId('confirm-block').click();
  await expect(page.getByTestId(`match-card-${userId}`)).toBeHidden({ timeout: 15_000 });
  await expect(page.getByText(CITY_ONLY).first()).toBeVisible();
});
