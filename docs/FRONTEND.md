# K7 — Frontend Specification (code layer)

The visual design is **done** (Figma "Глава 1 — прототип", Canva; tokens in `docs/TZ.md` §8). Implement it as is — do not
redesign or invent screens. If the design misses a state (loading / empty / error), build it from the design's own
components. If the Figma MCP is connected, pull frames from the file instead of guessing.

This document covers everything else: routes, guards, auth, every endpoint the UI calls, data per screen, flows,
error handling, caching, polling and e2e hooks. API details: `docs/BACKEND.md`. Contract: `lib/types.ts`.

---

## 0. Ready-made code (tested: `pnpm test:unit` 43 tests, `next build` on Next 16.4)

| File | What it gives you |
| --- | --- |
| `lib/types.ts` | All request / response types. Import from here, never redeclare. |
| `lib/api.ts` | `api.*` — one typed function per endpoint; `ApiRequestError` (`status`, `code`, `requiredPlan`, `fieldErrors()`); `onApiError()`; `KEYS` (SWR keys); `fetcher` |
| `lib/hooks.ts` | SWR hooks `useMe`, `useInterests`, `useRoadmap`, `useMapStates`, `useMapUsers`, `useConnections`, `useMeetups`, `useFeed` (polling built in) + `invalidate.*` after each write |
| `lib/auth-client.ts` | `signUp`, `signIn`, `signOut`, `authMessage`, `safeNext` |
| `lib/supabase/browser.ts` | `getBrowserSupabase()` — browser client, **auth and photo upload only** |
| `lib/photo.ts` | `uploadStagePhoto(stageId, file)` → `photoPath` (compress ≤1600 px JPEG, strips EXIF/GPS, signed upload) |
| `lib/paywall.ts` | `openPaywall`, `closePaywall`, `usePaywall`, `reasonFromPath` |
| `lib/format.ts` | Labels (`DIFFICULTY_LABEL`, `PLAN_LABEL`, `MEET_STYLE_LABEL`, `STATUS_LABEL`, `AGE_RANGES`), `planPrice`, `nearbyLine`, `paywallCopy`, `localInputToIso` |
| `lib/us.ts` | `STATE_NAMES` (51), `US_TILES` row/col for a tile-grid map (use if the design does not fix positions) |
| `lib/server/plans.ts`, `lib/server/validation.ts` | Pure, safe on the client: `PLAN_RULES`, `PLAN_PRICE_USD`, `normalizeSocialUrl` (live check of the social link field) |
| `components/AppProviders.tsx` | SWR config + global error reactions: 401 → `/login?next=`, 409 `NOT_ONBOARDED` → `/onboarding`, 402 → paywall |
| `components/OnboardedGate.tsx` | Render-prop gate: `{(me) => <Screen me={me}/>}`; redirects not-onboarded users |
| `proxy.ts` | Session refresh; signed-out → `/login?next=…` for app routes; signed-in → away from `/login`, `/signup` |

---

## 1. Rules

1. **All data through `api.*` / hooks.** Never `fetch('/api/...')` by hand, never query Supabase tables from the browser.
   The browser Supabase client is used only for auth and `uploadToSignedUrl`.
2. **App screens are client components** (`'use client'`) that read data with the hooks. The landing page can be static.
3. **`cacheComponents` is on:** no `export const dynamic / revalidate / runtime` anywhere; a client component that calls
   `useSearchParams()` must be inside `<Suspense>` (e.g. `/login`, `/billing/success`).
4. **After every successful write call the matching `invalidate.*`** (§7). Do not hand-edit cached data except where §7 says so.
5. **Photos of stages/feed are signed URLs (1 h)** on the Supabase host: render with `<img loading="lazy" decoding="async">`
   (not `next/image`). On image `onError`, revalidate that list once.
6. UI copy in English. Numbers in copy (`+3 coins`, `12 people in Texas`) come from API data, never hardcoded.
7. Env used by the browser: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`.

---

## 2. Routes and layouts

```
app/
  layout.tsx                      fonts (Press Start 2P + Inter), globals.css, metadata — no providers here
  (public)/page.tsx               /            landing (delete the scaffold's app/page.tsx — same path)
  (public)/login/page.tsx         /login       <Suspense> → reads ?next
  (public)/signup/page.tsx        /signup
  (onboarding)/layout.tsx         <AppProviders>
  (onboarding)/onboarding/page.tsx  /onboarding  wizard (no tab bar)
  (app)/layout.tsx                <AppProviders> + tab bar + header (coins) + <PaywallSheet/>
  (app)/home/page.tsx             /home
  (app)/roadmap/page.tsx          /roadmap     (?stage=<id> opens the stage sheet)
  (app)/map/page.tsx              /map         (?state=TX, ?interest=running)
  (app)/people/page.tsx           /people      connections + meetups
  (app)/feed/page.tsx             /feed        (?scope=mine)
  (app)/pricing/page.tsx          /pricing
  (app)/billing/success/page.tsx  /billing/success?session_id=…   <Suspense>
  (app)/profile/page.tsx          /profile
  not-found.tsx, error.tsx        from the design
```

Guards (already implemented): `proxy.ts` handles signed-in vs signed-out; `OnboardedGate` handles onboarded;
the onboarding page itself redirects to `/home` when `me.onboarded` is true.

Tab bar: Home · Roadmap · Map · People (badge = `me.pendingIncoming`) · Feed. Header: coins = `me.coins` (animate on increase).

---

## 3. Auth (code)

```tsx
// signup page
const r = await signUp(email, password);
if (r.ok) router.replace('/onboarding'); else setError(r.message);

// login page (inside <Suspense>)
const next = useSearchParams().get('next');
const r = await signIn(email, password);
if (r.ok) router.replace(safeNext(next)); else setError(r.message);

// profile → sign out
await signOut(); router.replace('/');
```

Email + password, min 8 characters. No email confirmation step exists.

---

## 4. Endpoints the UI uses

`api` function → HTTP → types → where → errors to handle locally (everything else is global, §6) → invalidate after.

| `api.*` | HTTP | Request → Response | Used on | Local errors | After success |
| --- | --- | --- | --- | --- | --- |
| `interests()` | `GET /api/interests` (public) | — → `Interest[]` | Onboarding step 2 | — | — |
| `stats()` / `usePublicStats` | `GET /api/stats` (public) | — → `PublicStats` | Landing counter | — | — |
| `me()` / `useMe` | `GET /api/me` | — → `Me` | everywhere (gate, header, home, profile) | — | — |
| `onboarding(body)` | `POST /api/onboarding` | `OnboardingRequest` → `OnboardingResponse` | Onboarding submit | `VALIDATION` (field errors), `ALREADY_ONBOARDED` → `/home` | `invalidate.afterOnboarding(res.me, res.roadmap)` |
| `roadmap()` / `useRoadmap` | `GET /api/roadmap` | — → `Level[]` | Roadmap, Home | — | — |
| `stageUploadUrl(id)` | `POST /api/stages/:id/upload-url` | — → `UploadUrlResponse` | inside `uploadStagePhoto` | `STAGE_NOT_ACTIVE`, `VALIDATION` | — |
| `completeStage(id, body)` | `POST /api/stages/:id/complete` | `CompleteStageRequest` → `CompleteStageResponse` | Stage sheet | `PHOTO_REQUIRED`, `PARTNER_REQUIRED`, `PARTNER_INVALID`, `CONNECT_REQUIRED`, `STAGE_NOT_ACTIVE`, `VALIDATION` | `invalidate.afterStageComplete()` |
| `mapStates()` / `useMapStates` | `GET /api/map/states` | — → `MapStateCount[]` | Map tiles | — | — |
| `mapUsers(state)` / `useMapUsers` | `GET /api/map/users?state=` | — → `MapUsersResponse` | Map state sheet | — | — |
| `connect(body)` | `POST /api/connections` | `CreateConnectionRequest` → `Connection` | Match card | `ALREADY_CONNECTED` (revalidate), `NO_SHARED_INTEREST`, `NOT_FOUND` | `invalidate.afterConnect()` |
| `connections()` / `useConnections` | `GET /api/connections` | — → `ConnectionsResponse` | People, co-op partner picker | — | — |
| `respondConnection(id, body)` | `PATCH /api/connections/:id` | `RespondConnectionRequest` → `Connection` | People incoming, match card | `INVALID_STATE`, `FORBIDDEN` | `invalidate.afterRespond()` |
| `meetups()` / `useMeetups` | `GET /api/meetups` | — → `Meetup[]` | People | — | — |
| `proposeMeetup(body)` | `POST /api/meetups` | `CreateMeetupRequest` → `Meetup` | People → buddy | `VALIDATION` (time in past, place), `NOT_FOUND` | `invalidate.afterMeetup()` |
| `updateMeetup(id, body)` | `PATCH /api/meetups/:id` | `UpdateMeetupRequest` → `Meetup` | People → meetup | `INVALID_STATE` | `invalidate.afterMeetup()` |
| `feed(scope)` / `useFeed` | `GET /api/feed?scope=` | — → `FeedItem[]` | Feed | — | — |
| `report(body)` | `POST /api/reports` | `ReportRequest` → `OkResponse` | Card menu | `VALIDATION` | — (toast "Thanks, we'll review it") |
| `block(body)` | `POST /api/blocks` | `BlockRequest` → `OkResponse` | Card menu, People | — | `invalidate.afterBlock()` |
| `checkout(body)` | `POST /api/stripe/checkout` | `CheckoutRequest` → `CheckoutResponse` | Pricing, paywall CTA | — | `window.location.assign(res.url)` |
| `confirmCheckout(body)` | `POST /api/stripe/confirm` | `ConfirmCheckoutRequest` → `ConfirmCheckoutResponse` | `/billing/success` | `PAYMENT_NOT_COMPLETE` (retry), `FORBIDDEN` | `invalidate.afterPlanChange()` |

There is **no profile-edit endpoint** in the MVP: Profile is read-only + sign out + plan.

---

## 5. Screens → data → logic

### F2 Landing `/`
Static. "Start" → `/signup`; "I have an account" → `/login`. No API calls.

### F3 Sign up / Sign in
§3. Show `message` from `AuthResult` under the form. Disable the button while pending.

### F4–F6 Onboarding `/onboarding` (one page, 3 steps, one POST)
- State in `useReducer`; mirror to `sessionStorage['k7.onboarding']` (wrap in try/catch) so a refresh keeps answers.
- If `useMe().data?.onboarded` → `router.replace('/home')`.
- **Step 1 Avatar** → `Avatar`: `{ kind:'preset', preset:'ninja-1'|'ninja-2'|'ninja-3'|'ninja-4' }` or
  `{ kind:'custom', suit:'#rrggbb', band:'#rrggbb', accessory:'none'|'katana'|'staff'|'shuriken'|'headphones' }`
  (constants `AVATAR_PRESETS`, `AVATAR_ACCESSORIES` in `lib/types.ts`; colors from the design palette, as `#rrggbb`).
- **Step 2 Interests**: `useInterests()` grouped by `category`. Exactly 3; each gets a different difficulty: Hard 5 / Medium 3 / Easy 1.
  "Next" disabled until valid (3 distinct slugs, difficulties exactly {1,3,5}).
- **Step 3 Profile**: `displayName` 2–30 · `state` (select from `STATE_NAMES`) · `city` 2–50 · `ageRange` (`AGE_RANGES`) ·
  `meetStyle` (`MEET_STYLE_LABEL`) · `socialUrl` (live check `normalizeSocialUrl(v) !== null`; hint "LinkedIn, Instagram or X profile link") ·
  `bio` ≤ 160 (optional).
- **Submit** `api.onboarding({ avatar, profile, interests })`. Show a "Building your quest map…" state (AI can take up to ~10 s).
  Success → `invalidate.afterOnboarding(res.me, res.roadmap)` → clear sessionStorage → `router.replace('/home')`.
  `VALIDATION` → `err.fieldErrors()`; path prefix → step (`avatar` → 1, `interests` → 2, `profile.*` → 3), jump there, show inline.

### F7 Home `/home`
- `me = OnboardedGate`, `roadmap = useRoadmap()`.
- **Quest of the day** = `me.questOfDay` (a `Stage`): title, minutes, coins, CTA → `/roadmap?stage=<id>`.
  If `null`: a stage with `status:'waiting_partner'` exists → "Waiting for {partner.displayName}…"; else a level with
  `lockedByPlan` → upgrade card (`openPaywall({ requiredPlan, reason:'level', context: level.interest.name })`); else "All caught up".
- **Nearby**: `me.nearby.map(nearbyLine)` — "12 people in Texas also want to start running" → tap → `/map?state=<me.state>&interest=<slug>`.
- Coins `me.coins`; incoming requests `me.pendingIncoming` → `/people`.

### F8 Roadmap `/roadmap`
- `useRoadmap()` → `Level[]` in order Easy → Medium → Hard. Level header: `interest.name`, `DIFFICULTY_LABEL[difficulty]`, `progress.done/total`.
- `level.lockedByPlan` → lock overlay with `PLAN_LABEL[level.requiredPlan]` and `planPrice`; tap → `openPaywall({ requiredPlan: level.requiredPlan!, reason:'level', context: level.interest.name })`.
- Hero sits on the first stage with `status` `active` or `waiting_partner`.
- `?stage=<id>` opens the stage sheet for that stage.

**Stage sheet — what to show** (`stage.kind` × `stage.status`):

| kind | status | Show |
| --- | --- | --- |
| any | `locked` | Disabled. Tap → toast "Finish the previous stage first". |
| any | `active`, level `lockedByPlan` | Lock → paywall (as above). |
| `solo` | `active` | Title, description, `minutes`, `coins`; steps (or Pro teaser); optional photo; caption (≤140); public/private; **Complete**. |
| `connect` | `active` | "Find a buddy with {interest} on the map" → `/map?interest=<slug>`. **No complete button** — it completes itself when a connection is accepted. |
| `coop` | `active` | Partner picker + **required** photo + caption + visibility; **Complete**. |
| `coop` | `waiting_partner` | "Waiting for {stage.partner.displayName} — they need to upload their photo too." + "Change photo or partner" (same form, re-submit is allowed). |
| any | `done` | Done badge; if `stage.report` → photo (`report.photoUrl`), caption. |

- **Steps**: `stage.steps` (array) → checklist. If `steps === null && stage.stepsLocked` → teaser "Step-by-step plan — Pro" → `openPaywall({ requiredPlan:'pro', reason:'steps' })`.
- **Partner picker (coop)**: `useConnections().data.accepted.filter(c => c.sharedInterests.includes(stage.interestSlug))`.
  Empty → "Connect with someone who does {interest} first" → `/map?interest=<slug>`.

### F9 Complete a stage (code)

```tsx
async function complete(stage: Stage, input: { file?: File; caption: string; visibility: Visibility; partnerId?: string }) {
  setBusy(true);
  try {
    const photoPath = input.file ? await uploadStagePhoto(stage.id, input.file) : undefined;
    const res = await api.completeStage(stage.id, {
      photoPath, caption: input.caption || undefined, visibility: input.visibility, partnerId: input.partnerId,
    });
    await invalidate.afterStageComplete();
    playCoins(res.coinsAwarded);                    // design animation
    if (res.levelCompleted) showLevelComplete(stage.interestSlug);
    else if (res.waitingForPartner) showWaiting(res.stage.partner);
    else closeSheet();
  } catch (e) {
    if (!(e instanceof ApiRequestError)) return setError((e as Error).message);   // upload/compress errors
    switch (e.code) {
      case 'PHOTO_REQUIRED':   return setFieldError('photo', e.message);
      case 'PARTNER_REQUIRED':
      case 'PARTNER_INVALID':  return setFieldError('partner', e.message);
      case 'CONNECT_REQUIRED': return router.push(`/map?interest=${stage.interestSlug}`);
      case 'STAGE_NOT_ACTIVE': await invalidate.afterStageComplete(); return toast(e.message);
      case 'PLAN_LIMIT':       return;               // paywall already opened globally
      default:                 return setError(e.message);
    }
  } finally {
    setBusy(false);
  }
}
```

Photo input: `<input type="file" accept="image/*" capture="environment">` (camera on phones; gallery also works). Show a preview
(`URL.createObjectURL`) before upload.

### F15 Level complete
- Show when `completeStage` returns `levelCompleted: true`.
- The partner who was waiting sees it on the next roadmap poll: when a level changes to `progress.done === progress.total`
  and `localStorage['k7.levelDone.<slug>']` is not set → show, then set it (try/catch).

### F10 Map `/map`
- `useMapStates()` → tile per state (`US_TILES` positions if the design has none), count on the tile, 0 → dimmed.
- Selected state = `?state` or `me.state`; `useMapUsers(selected)` → bottom sheet with cards.
- `?interest=<slug>` → client-side filter: `items.filter(c => c.sharedInterests.some(s => s.slug === slug))`.
- `hiddenCount > 0` → locked rows "+N more with Starter" → `openPaywall({ requiredPlan:'starter', reason:'map', context: `${hiddenCount} more people in ${STATE_NAMES[state]}` })`.
- Safety line always visible: "City only — never your exact location".

### F11 Match card
Fields: `user.avatar`, `user.displayName`, `user.city`, `user.state`, `user.bio`, `sharedInterests[]` (name, icon,
`DIFFICULTY_LABEL[myDifficulty]` / `DIFFICULTY_LABEL[theirDifficulty]`), `sameCity` badge, `user.coins`.

| `connection.state` | Button |
| --- | --- |
| `none` | **Connect** — one shared interest → send; several → pick one (default: highest `myDifficulty + theirDifficulty`). `api.connect({ toUserId, interestSlug })` → `invalidate.afterConnect()`. |
| `outgoing_pending` | "Requested" (disabled) |
| `incoming_pending` | **Accept** / **Decline** → `api.respondConnection(connection.id!, { status })` → `invalidate.afterRespond()` |
| `accepted` | "Buddies" → `/people` |

Menu: **Report** (optional reason ≤ 300) → `api.report({ targetUserId, reason })` → toast. **Block** (confirm dialog) →
`api.block({ targetUserId })` → `invalidate.afterBlock()` → close the card.

### F12 People `/people`
- `useConnections({ poll: true })` → tabs **Requests** (`incoming`) · **Sent** (`outgoing`) · **Buddies** (`accepted`).
- Incoming row: `other`, `interestSlug` → Accept / Decline (`respondConnection` → `invalidate.afterRespond()`).
- Buddy row: `other`, **Open profile** → `socialUrl` (`<a target="_blank" rel="noopener noreferrer">`), **Propose a meetup**, Block.
- **Propose a meetup** form: date-time (`<input type="datetime-local">` → `localInputToIso`), place (3–120 chars, hint "a public place,
  e.g. Zilker Park"), checkbox "This is a public place" (required in UI), interest = one of `sharedInterests`.
  `api.proposeMeetup({ connectionId, startsAt, place, interestSlug })` → `invalidate.afterMeetup()`.
- `useMeetups()` → list under each buddy (`meetup.connectionId === connection.id`), upcoming first:

| `meetup.status` | I proposed (`proposedBy === me.id`) | They proposed |
| --- | --- | --- |
| `proposed` | "Waiting for confirmation" · Cancel | **Confirm** · Decline (= `cancelled`) |
| `confirmed` | **Mark as done** · Cancel | **Mark as done** · Cancel |
| `cancelled` / `done` | read-only | read-only |

`api.updateMeetup(id, { status })` → `invalidate.afterMeetup()`.

### F13 Feed `/feed`
- `useFeed(scope)`; toggle **Everyone** (`public`) / **Mine** (`mine`).
- Vertical full-height cards with CSS scroll-snap (Reels-style). Item: `photoUrl`, `author` (avatar, name, city, state),
  `interest.name`, `stageTitle`, `caption`, `partner` → "with {partner.displayName}", `createdAt` relative ("2h ago"),
  private badge when `visibility === 'private'` (only in Mine).
- Empty Mine → "Finish a stage with a photo" → `/roadmap`.

### F14 Pricing `/pricing` + paywall sheet + checkout
- Plans from `PLAN_RULES` + `PLAN_PRICE_USD` (+ feature copy from TZ §4). Current plan `me.plan` → "Your plan".
- **Paywall sheet** (in `(app)/layout.tsx`): `const p = usePaywall()`; copy = `paywallCopy(p.reason, p.requiredPlan, p.context)`;
  CTA → checkout. Close → `closePaywall()`.
- **Checkout**:
  ```ts
  sessionStorage.setItem('k7.returnTo', location.pathname + location.search); // try/catch
  const { url } = await api.checkout({ tier });
  window.location.assign(url);   // Stripe Checkout; test card 4242 4242 4242 4242
  ```
- **`/billing/success`** (inside `<Suspense>`):
  ```ts
  const sessionId = useSearchParams().get('session_id');
  // up to 3 tries, 2 s apart, while the code is PAYMENT_NOT_COMPLETE
  const { plan } = await api.confirmCheckout({ sessionId });
  await invalidate.afterPlanChange();
  // "You're on {PLAN_LABEL[plan]}" → button back to safeNext(sessionStorage 'k7.returnTo') or /roadmap
  ```
  Missing `session_id` → `/pricing`. Still not complete after 3 tries → "Payment is processing — refresh in a minute".

### F16 Profile `/profile` (read-only)
`me`: avatar, name, city/state, age range, meet style, bio, social link, interests with difficulties, plan + coins,
"Change plan" → `/pricing`, **Sign out**.

---

## 6. Error handling

Global (in `AppProviders`, nothing to do in screens): **401** → `/login?next=`, **409 `NOT_ONBOARDED`** → `/onboarding`,
**402 `PLAN_LIMIT`** → paywall with `requiredPlan` and a reason from the path. Screens may additionally open the paywall
with a better `context` (e.g. the interest name).

Local (in the screen that made the call):

| Code | UI |
| --- | --- |
| `VALIDATION` | inline field errors from `err.fieldErrors()`; otherwise toast `err.message` |
| `PHOTO_REQUIRED` / `PARTNER_REQUIRED` / `PARTNER_INVALID` | error on that field in the stage sheet |
| `CONNECT_REQUIRED` | go to `/map?interest=<slug>` |
| `STAGE_NOT_ACTIVE`, `INVALID_STATE`, `NOT_FOUND`, `ALREADY_CONNECTED` | toast `err.message` + revalidate the list it came from |
| `NO_SHARED_INTEREST`, `FORBIDDEN` | toast `err.message` |
| `PAYMENT_NOT_COMPLETE` | retry logic on `/billing/success` |
| `INTERNAL` or `status === 0` | toast "Something went wrong. Try again." + a retry button; SWR retries reads automatically |

`err.message` from the API is already user-facing English.

---

## 7. Cache, invalidation, polling

| After | Call | Why |
| --- | --- | --- |
| onboarding | `invalidate.afterOnboarding(res.me, res.roadmap)` | seed the cache from the response |
| complete stage | `invalidate.afterStageComplete()` | coins, next stage, feed |
| connect | `invalidate.afterConnect()` | card state, monthly limit |
| accept / decline | `invalidate.afterRespond()` | "Find a buddy" stages complete themselves, coins |
| meetup create / update | `invalidate.afterMeetup()` | |
| block | `invalidate.afterBlock()` | map, people, feed, waiting co-op released |
| plan change | `invalidate.afterPlanChange()` | levels unlock, AI steps, full map |
| sign in / out | inside `signIn` / `signOut` | no data from the previous account |

Polling (built into the hooks): `useMe` every 20 s (badge, coins); `useRoadmap` every 5 s **only while** a stage is
`waiting_partner`; `useConnections({ poll: true })` every 15 s on `/people`. SWR also revalidates on focus.

---

## 8. Test hooks (Playwright)

Put these `data-testid`s on the real elements (the golden-path e2e uses them):

| Area | test ids |
| --- | --- |
| Auth | `start-cta`, `auth-email`, `auth-password`, `auth-submit`, `auth-error` |
| Onboarding | `avatar-<preset>` (e.g. `avatar-ninja-1`), `interest-<slug>`, `difficulty-<slug>-<1\|3\|5>`, `onboarding-next`, `profile-<field>` (`displayName`, `state`, `city`, `ageRange`, `meetStyle`, `socialUrl`, `bio`), `onboarding-submit` |
| Shell | `tab-home`, `tab-roadmap`, `tab-map`, `tab-people`, `tab-feed`, `coins`, `people-badge` |
| Home | `quest-of-day`, `nearby-<slug>` |
| Roadmap | `level-<slug>`, `level-lock-<slug>`, `stage-<slug>-<idx>`, `stage-sheet`, `stage-photo-input`, `stage-caption`, `stage-visibility`, `partner-option-<userId>`, `stage-complete`, `waiting-partner`, `level-complete` |
| Map | `map-tile-<STATE>`, `match-card-<userId>`, `connect-<userId>`, `accept-<connectionId>`, `decline-<connectionId>`, `hidden-more`, `card-menu-<userId>`, `report-<userId>`, `block-<userId>`, `confirm-block` |
| People | `request-<connectionId>`, `buddy-<connectionId>`, `social-<connectionId>`, `propose-meetup-<connectionId>`, `meetup-<meetupId>`, `meetup-action-<status>` |
| Feed | `feed-item`, `feed-scope-public`, `feed-scope-mine` |
| Paywall | `paywall`, `paywall-cta`, `paywall-close`, `plan-<tier>`, `billing-success` |

Fixtures: `tests/fixtures/photo.jpg` (any ~1 MB JPEG) for `setInputFiles('[data-testid=stage-photo-input]', …)`.
Users for e2e: create with the admin API in a Playwright fixture (`t-<random>@example.com`), sign in through the UI, delete in teardown.

---

## 9. Done per screen

- Implements the design frame pixel-faithfully at 390×844 and works at desktop width.
- Loading (skeleton), empty and error states exist and come from the design components.
- Every action shows a pending state and cannot be double-submitted.
- All data from hooks / `api.*`; correct `invalidate.*` after writes.
- `data-testid`s from §8 present; the related e2e step passes on iPhone 14 and Pixel 7 projects.
- No console errors; `pnpm verify` green.
