# K7 — Backend Specification

Single source of truth for data, business rules and the API. Product, design and screens live in `docs/TZ.md`.
If the two disagree on data or API, **this file wins**. The TypeScript contract is `lib/types.ts`.

Verified on Nov 14 2026 against: Next.js 16.4, React 19, `@supabase/supabase-js` 2.119, `@supabase/ssr` 0.12,
Zod 4.6, `stripe` 23, PostgreSQL 16/17.

---

## 0. What already exists and is tested (do not rewrite, extend)

| Path | What | How it is verified |
| --- | --- | --- |
| `supabase/migrations/20261114000001_schema.sql` | Tables, indexes, RLS, `public_profiles` view, `stage-photos` bucket | `pnpm test:db` |
| `supabase/migrations/20261114000002_functions.sql` | All atomic business logic (onboarding, stage completion, co-op, coins, connections, blocks, matching, feed) | `pnpm test:db`: 60+ assertions + race test (12 pairs tagging each other at the same instant: one post wins, no deadlocks, coins once) |
| `supabase/migrations/20261114000003_interests.sql` | Catalog of 30 interests | `pnpm test:db` |
| `tests/db/*` | Plain-Postgres test harness (no Docker, no Supabase) | — |
| `lib/types.ts` | API contract | `tsc` |
| `lib/server/errors.ts, plans.ts, validation.ts, roadmap/*` | Error mapping, plan rules, Zod schemas, social-link check, roadmap skeleton, templates, AI generation with fallback | `pnpm test:unit` (`tests/unit/core.test.ts`, 32 tests) |
| `lib/server/env.ts, supabase.ts, auth.ts, http.ts, storage.ts, stripe.ts, roadmap/read.ts` | Server infrastructure and roadmap read model | `next build` typecheck |
| `app/api/stages/[id]/complete/route.ts` | **Reference route** — every route follows this pattern | `next build` |
| `app/api/stripe/webhook/route.ts`, `app/api/health/route.ts` | Stripe webhook, health check | `next build` |

Differences from `docs/TZ.md` v2 (deliberate):
- Storage bucket is `stage-photos` (not `reports`); the complaints table is `abuse_reports` (not `reports`) — the old names collided.
- `roadmap_stages.kind` (`solo | connect | coop`) and `source` (`template | ai`) were added; `is_coop` is generated from `kind`.
- `GET /api/map/users` returns `{ items, hiddenCount }` (the paywall needs the hidden count).
- Upload returns `{ photoPath, token, signedUrl }`: the browser uploads with `uploadToSignedUrl(photoPath, token, file)`.
- Added: `GET /api/health`, `GET /api/meetups`. Pro unlocks AI **steps** inside every stage (see §7.1).

---

## 1. Architecture rules

```
Browser ──(cookies)──▶ Next.js /api/* ──(secret key)──▶ Supabase Postgres (RLS on, SQL functions)
   │                        │                         └▶ Supabase Storage (private bucket)
   │                        ├──▶ Stripe (Checkout, webhook)
   │                        └──▶ Anthropic Messages API (roadmap, optional)
   └──(signed upload URL)──▶ Supabase Storage   (only photos; Vercel limits request bodies to 4.5 MB)
```

1. **The browser talks to Supabase only for Auth** (sign up / sign in / session) **and photo upload by signed URL.** All data goes through `/api/*`.
2. **The API uses `adminClient()` (secret key, bypasses RLS).** Every query filters by the caller id from `requireUser(req)`. Never trust an id from the body for "who am I".
3. **Any rule that touches more than one row or must not race lives in a SQL function** (`complete_stage`, `request_connection`, …). The API validates input, calls one function, then builds the response from read models.
4. **Other people are read only through `public_profiles` or SQL functions** — never `select *` from `profiles` for someone else. `social_url` is returned only for accepted connections.
5. **Errors:** always `{ error: { code, message, requiredPlan?, details? } }`. Plan limits → HTTP 402 `PLAN_LIMIT` with `requiredPlan`.
6. Files that import `server-only` cannot be imported by unit tests. Keep pure logic (validation, plans, mapping) in modules without it.

### Next.js 16 specifics
- Session refresh lives in **`proxy.ts`** (Next 16 renamed `middleware.ts` → `proxy.ts`, export `proxy`). Use the current Supabase SSR pattern; do not ship both files.
- Route `params` is a **Promise**: `const { id } = await params` (handled by `route<{ id: string }>()` in `lib/server/http.ts`).
- `cookies()` is async (handled in `lib/server/supabase.ts`).
- New Next 16 apps have `cacheComponents: true`: **never export route segment config** (`runtime`, `dynamic`, `revalidate`, `fetchCache`) — it is a build error. Node.js is the default runtime. GET handlers that do not read the request call `await connection()` (see `/api/health`).
- Stripe webhook reads the raw body with `await req.text()` (exists).
- The installed Next docs are in `node_modules/next/dist/docs/` — check them before using any Next API you are not sure about.

---

## 2. Repository layout (backend part)

```
app/api/
  health/route.ts                     GET
  interests/route.ts                  GET
  me/route.ts                         GET
  onboarding/route.ts                 POST
  roadmap/route.ts                    GET
  stages/[id]/upload-url/route.ts     POST
  stages/[id]/complete/route.ts       POST   (reference, exists)
  map/states/route.ts                 GET
  map/users/route.ts                  GET ?state=TX
  connections/route.ts                GET, POST
  connections/[id]/route.ts           PATCH
  meetups/route.ts                    GET, POST
  meetups/[id]/route.ts               PATCH
  feed/route.ts                       GET ?scope=public|mine
  reports/route.ts                    POST
  blocks/route.ts                     POST
  stripe/checkout/route.ts            POST
  stripe/confirm/route.ts             POST
  stripe/webhook/route.ts             POST   (exists)
lib/types.ts                          contract (exists)
lib/server/
  env.ts supabase.ts auth.ts http.ts errors.ts plans.ts validation.ts storage.ts stripe.ts   (exist)
  roadmap/skeleton.ts templates.ts ai.ts generate.ts read.ts                                (exist)
  me.ts            buildMe(user) — used by /api/me and /api/onboarding
  map.ts           matches(me) + card mapping
  connections.ts   list/group + mapping
  feed.ts          feed mapping + signed URLs
  icebreakers.ts   (P1)
proxy.ts                              session refresh (Next 16)
supabase/migrations/*.sql             (exist)
supabase/seed/photos/*.jpg            seed photos (see §11)
scripts/seed.ts                       full demo seed (idempotent)
scripts/seed-judges.ts                reset judge + demo accounts only
scripts/smoke.ts                      prod smoke test
tests/unit/*.test.ts                  Vitest
tests/db/*                            Postgres scenario + race tests (exist)
tests/api/*.spec.ts                   Playwright request tests against `next dev`
tests/e2e/*.spec.ts                   Playwright mobile golden path
```

---

## 3. Environment

`.env.example` (commit this; real values only in `.env.local` and Vercel):

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # or the legacy anon key
SUPABASE_SECRET_KEY=sb_secret_...                         # or the legacy service_role key. NEVER NEXT_PUBLIC_
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_CREW=price_...
ANTHROPIC_API_KEY=                                        # optional; empty = template roadmaps
LLM_MODEL=claude-haiku-5-5
SEED_PASSWORD=                                            # password for all seed users
JUDGE_PASSWORD=                                           # password printed on the slide
```

Supabase legacy `anon` / `service_role` keys are being deprecated by the end of 2026 — use publishable / secret keys.
After `pnpm build`, `grep -r "sb_secret" .next/static` must find nothing.

---

## 4. Auth

- Supabase Auth, **email + password**, "Confirm email" **OFF** (Authentication → Sign In / Providers → Email). No emails are sent, so the default SMTP limits do not matter.
- Browser: `@supabase/ssr` `createBrowserClient` → `signUp({ email, password })` / `signInWithPassword(...)`. Session in cookies.
- `proxy.ts` refreshes the session on page requests (matcher excludes `_next/static`, images, `api/stripe/webhook`).
- API: `requireUser(req)` — cookie session, or `Authorization: Bearer <access_token>` (tests, scripts, curl). Both verified with `auth.getUser()`.
- A user exists in `auth.users` from sign-up; the `profiles` row is created only by onboarding. `GET /api/me` returns `{ onboarded: false }` until then; every other data route returns 409 `NOT_ONBOARDED`.
- Password rule in UI: min 8 chars. Show Supabase errors in plain English ("Wrong email or password").

---

## 5. Data model (summary — the SQL is authoritative)

| Table | Purpose | Key rules |
| --- | --- | --- |
| `interests` | Catalog (30) | readable by everyone |
| `profiles` | One per onboarded user | `plan` and `coins` change only on the server; `social_url` never leaves the server except to accepted connections |
| `user_interests` | 3 per user | unique (user, interest), unique (user, difficulty); difficulties exactly {1,3,5} |
| `roadmap_stages` | 19 per user (3 + 6 + 10) | `kind` positions fixed by skeleton; `status` locked → active → (waiting_partner) → done; `steps` = AI micro-actions |
| `stage_reports` | Photo report, max 1 per stage | `photo_path` = `<userId>/<stageId>/<uuid>.jpg` |
| `connections` | One per pair (either direction) | pending → accepted / declined |
| `meetups` | Proposed meeting for an accepted connection | public place text, time in the future |
| `coin_ledger` | Every coin movement | unique (user, reason, ref_id) ⇒ no double pay; `profiles.coins` = sum(ledger) |
| `abuse_reports`, `blocks` | Safety | blocks are two-way in effect |

RLS: every table has RLS on. Clients may only `select` their own rows; there are **no** client write policies. `public_profiles` and all functions are revoked from `anon` / `authenticated`.

Optional but recommended: `supabase gen types typescript --linked > lib/server/database.types.ts` and pass the type to `createClient<Database>()`.

---

## 6. SQL functions (call with `adminClient().rpc(name, args)`)

All raise `P0001` with `message = <ApiErrorCode>`; map with `fromDbError()`. Argument names must match exactly.

| Function | Args | Returns | Raises |
| --- | --- | --- | --- |
| `create_onboarding` | `p_user, p_profile jsonb, p_interests jsonb, p_stages jsonb` | void | `ALREADY_ONBOARDED`, `VALIDATION` |
| `complete_stage` | `p_user, p_stage_id, p_photo_path, p_caption, p_visibility, p_partner_id` | jsonb `{stageId,status,coinsAwarded,coins,waitingForPartner,levelCompleted,nextStageId}` | `NOT_FOUND`, `PLAN_LIMIT`, `STAGE_NOT_ACTIVE`, `CONNECT_REQUIRED`, `PHOTO_REQUIRED`, `PARTNER_REQUIRED`, `PARTNER_INVALID`, `VALIDATION` |
| `request_connection` | `p_from, p_to, p_interest` | connections row (jsonb, snake_case) | `VALIDATION`, `NOT_ONBOARDED`, `NOT_FOUND`, `NO_SHARED_INTEREST`, `ALREADY_CONNECTED`, `PLAN_LIMIT` |
| `respond_connection` | `p_user, p_connection_id, p_status` | connections row | `VALIDATION`, `NOT_FOUND`, `FORBIDDEN`, `INVALID_STATE` |
| `block_user` | `p_user, p_target` | void | `VALIDATION`, `NOT_FOUND` |
| `match_users` | `p_me` | rows `{user_id, display_name, avatar, state, city, age_range, meet_style, bio, coins, score, shared}` sorted by score; excludes me, blocked and declined pairs | — |
| `nearby_counts` | `p_me` | rows `{interest_slug, people}` | — |
| `feed_items` | `p_me, p_scope, p_limit` | rows (see migration) | — |
| `list_connections` | `p_me` | rows incl. `social_url` only when accepted | — |
| `plan_max_difficulty`, `plan_connects_per_month` | `p_plan` | rule values | — |

`p_stages` row shape = `StageRow` from `lib/server/roadmap/skeleton.ts` (produced by `buildRoadmapRows`).
`p_profile` = `{ ...parsed.profile, avatar: parsed.avatar }` (camelCase keys, as in `OnboardingRequest`).

---

## 7. Business rules

### 7.1 Plans

| | Free | Starter $5 | Pro $7 | Crew $9 |
| --- | --- | --- | --- | --- |
| Levels you can complete | Easy | Easy, Medium | all | all |
| People visible on the map | top 10 overall | all | all | all |
| Connect requests / month | 3 | ∞ | ∞ | ∞ |
| AI step-by-step plan inside stages (`steps`) | locked | locked | ✓ | ✓ |
| AI icebreakers (P1) | — | — | ✓ | ✓ |
| Group quests, private crew feed, verified badge | — | — | — | slide only |

Source: `PLAN_RULES` (TS) and `plan_max_difficulty / plan_connects_per_month` (SQL) — a DB test keeps them equal.
Levels above the plan are visible with a lock (`Level.lockedByPlan`, `requiredPlan`); completing → 402 with `requiredPlan`.

### 7.2 Coins

| Event | Coins | Ledger reason, ref |
| --- | --- | --- |
| Stage done | = difficulty (1 / 3 / 5) | `stage`, stage id |
| Photo on a stage | +2 (once per stage) | `photo`, stage id |
| Co-op stage done | +difficulty again (×2 total) | `coop_bonus`, stage id |
| 3-day streak (P1) | +5 | `streak`, deterministic uuid of (user, date) |
| Spend (P1) | negative | `spend`, item id |

### 7.3 Roadmap

- Skeleton (fixed, see `STAGE_SKELETON`): Easy `solo, connect, coop`; Medium `solo×3, connect, solo, coop`; Hard `solo×4, connect, solo×4, coop`.
- Stage 1 of every level starts `active`, the rest `locked`; finishing stage *n* activates *n+1*.
- `connect`: cannot be completed by hand; it is done automatically when the user has an accepted, non-blocked connection with someone who has this interest — at accept time, or the moment the stage activates.
- `coop` (tagging, migration `20261115000003`): needs `partnerId` (any accepted, non-blocked buddy) and a photo. The poster's stage is `done` at once with ×2 coins, and the tagged buddy's open co-op stage (same goal first, else their first open one) is `done` too with ×2 coins. If the buddy has no open co-op stage yet, only the poster's stage completes. `waiting_partner` is no longer entered (kept for old rows).
- Co-op photos appear in the feed only when both are done (the "reveal").
- Content: AI (`generateAiStages`, 8 s timeout, Zod-validated) per interest in parallel; template fallback per interest. The AI never decides `kind`, order or coins.

### 7.4 Matching and map

- Candidates: everyone sharing ≥ 1 interest; excluding me, blocked (either direction) and people with a **declined** connection with me.
- Score = Σ over shared interests (my difficulty + their difficulty) + 3 same city (case/space-insensitive, same state) + 1 same `meet_style`.
- `GET /api/map/states`: counts per state from all candidates (full numbers on every plan).
- `GET /api/map/users?state=XX`: candidates in that state. Free: only candidates that are in the global top 10; `hiddenCount` = the rest in that state.
- Card shows: avatar, name, city, shared interests with both difficulties, "same city" badge, connection state. Never `social_url`, age or exact location.

### 7.5 Home

- `nearby`: for each of my interests, people in my state with it (`nearby_counts`).
- `questOfDay`: my `active` stage with the smallest `minutes` among levels my plan allows (ties: lower difficulty, then idx). `null` if none — UI then shows "Waiting for <partner>" or "Upgrade to continue".
- `pendingIncoming`: pending requests to me (excluding blocked).

### 7.6 Safety

- Map shows city only. Meetups require a public place (free text, UI hint + checkbox "This is a public place").
- Report = insert into `abuse_reports`. Block = `block_user` (two-way hide, connection declined, meetups cancelled, waiting co-op released).
- Social link must be a LinkedIn / Instagram / X profile URL (`normalizeSocialUrl`), revealed only after accept.

---

## 8. API (all JSON; all routes except health/interests/stats/webhook require auth)

Every route: `route()` wrapper → `requireUser` → Zod (`parseJson` / `parseQuery` / `parseWith`) → SQL function or queries → typed response. Use the reference route as the template.

| # | Route | Input | Output | Notes / errors |
| --- | --- | --- | --- | --- |
| 1 | `GET /api/health` | — | `{ ok, interests }` | 503 if DB down. Used by smoke test |
| 2 | `GET /api/interests` | — | `Interest[]` | public, sorted by category then name |
| 2a | `GET /api/stats` | — | `PublicStats` | public landing counter: people, states, cities, top 5 states. Aggregates only, no names or ids |
| 3 | `GET /api/me` | — | `Me` | `onboarded:false` if no profile |
| 4 | `POST /api/onboarding` | `onboardingSchema` | `OnboardingResponse` | slugs must exist (VALIDATION); `buildRoadmapRows` (one AI call for all 3 levels, Gemini or Anthropic, 12 s timeout, template fallback per level) → `create_onboarding`; 409 `ALREADY_ONBOARDED` |
| 5 | `GET /api/roadmap` | — | `Level[]` | `loadLevels(user, plan)` |
| 6 | `POST /api/stages/[id]/upload-url` | — | `UploadUrlResponse` | stage mine; kind `solo`/`coop`; status `active` (or `waiting_partner` for coop); plan allows (402 + requiredPlan) |
| 7 | `POST /api/stages/[id]/complete` | `completeStageSchema` | `CompleteStageResponse` | **exists**. Photo must exist in Storage |
| 8 | `GET /api/map/states` | — | `MapStateCount[]` | open matching: `count` = everyone I can see in the state (shared goals first in the list), `total` = everyone; sorted by count desc |
| 9 | `GET /api/map/users` | `?state=` (`mapUsersQuerySchema`) | `MapUsersResponse` | §7.4 |
| 10 | `GET /api/connections` | — | `ConnectionsResponse` | from `list_connections`; incoming = pending & to me; outgoing = pending & from me. `sharedInterests` per connection = one `user_interests` query for all other ids, intersected with mine (`lib/server/connections.ts`); the same mapper is used by #11 and #12 |
| 11 | `POST /api/connections` | `createConnectionSchema` | `Connection` | `request_connection`: `interestSlug` must be one of the sender's goals (the receiver need not have it); 402 → `requiredPlan:'starter'` |
| 12 | `PATCH /api/connections/[id]` | `respondConnectionSchema` | `Connection` | `respond_connection`; on accept `socialUrl` filled |
| 12a | `POST /api/connections/[id]/icebreaker` | — | `IcebreakerResponse` | Pro/Crew only (402 `requiredPlan:'pro'`); I am a party (404); connection accepted (409 `INVALID_STATE`); one model call, template fallback |
| 13 | `GET /api/meetups` | — | `Meetup[]` | my connections' meetups, upcoming first |
| 14 | `POST /api/meetups` | `createMeetupSchema` | `Meetup` | connection accepted, I am a party, not blocked; `proposed_by` = me |
| 15 | `PATCH /api/meetups/[id]` | `updateMeetupSchema` | `Meetup` | `confirmed`: only the other party, from `proposed`; `cancelled`: either, from proposed/confirmed; `done`: either, from confirmed; else 409 `INVALID_STATE` |
| 16 | `GET /api/feed` | `?scope=` (`feedQuerySchema`) | `FeedItem[]` | `feed_items` + `signPhotos` in one call; 30 items |
| 17 | `POST /api/reports` | `reportSchema` | `OkResponse` | target exists, not me |
| 18 | `POST /api/blocks` | `blockSchema` | `OkResponse` | `block_user` |
| 19 | `POST /api/stripe/checkout` | `checkoutSchema` | `CheckoutResponse` | §10 |
| 20 | `POST /api/stripe/confirm` | `confirmCheckoutSchema` | `ConfirmCheckoutResponse` | §10 |
| 21 | `POST /api/stripe/webhook` | Stripe event | `{ received: true }` | **exists** |
| P1 | `POST /api/connections/[id]/icebreakers` | — | `{ messages: string[] }` | Pro+, accepted only; 3 short openers from shared interest; template fallback |

### Error codes

| Code | HTTP | Code | HTTP |
| --- | --- | --- | --- |
| `UNAUTHORIZED` | 401 | `PHOTO_REQUIRED` | 422 |
| `NOT_ONBOARDED` | 409 | `PARTNER_REQUIRED` | 422 |
| `ALREADY_ONBOARDED` | 409 | `PARTNER_INVALID` | 422 |
| `VALIDATION` | 400 | `CONNECT_REQUIRED` | 422 |
| `NOT_FOUND` | 404 | `NO_SHARED_INTEREST` | 422 |
| `FORBIDDEN` | 403 | `ALREADY_CONNECTED` | 409 |
| `PLAN_LIMIT` | 402 | `INVALID_STATE` | 409 |
| `STAGE_NOT_ACTIVE` | 409 | `PAYMENT_NOT_COMPLETE` | 409 |
| `INTERNAL` | 500 (details logged, never returned) | | |

---

## 9. Photos

1. UI compresses: longest side ≤ 1600 px, JPEG quality 0.8 (canvas), so files are ~200–600 KB.
2. `POST /api/stages/:id/upload-url` → `{ photoPath, token }`.
3. Browser: `supabase.storage.from('stage-photos').uploadToSignedUrl(photoPath, token, blob, { contentType: 'image/jpeg' })`.
4. `POST /api/stages/:id/complete` with `{ photoPath, caption, visibility, partnerId? }`.
5. Reading: always signed URLs (1 h) via `signPhotos([...])` in one request per response. Bucket is private, 5 MB limit, jpeg/png/webp only.

---

## 10. Stripe (test mode)

- Products: Starter $5/mo, Pro $7/mo, Crew $9/mo (recurring). Price ids in env.
- `POST /api/stripe/checkout { tier }`: create the Stripe customer once (store `stripe_customer_id`), then
  `checkout.sessions.create({ mode:'subscription', customer, client_reference_id:userId, line_items:[{price, quantity:1}], metadata:{userId,tier}, subscription_data:{metadata:{userId,tier}}, success_url:`${APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url:`${APP_URL}/pricing?canceled=1` })` → `{ url }`.
- Webhook (exists): `checkout.session.completed` (status `complete`) → plan = tier; `customer.subscription.updated` active/trialing → tier, canceled/unpaid/incomplete_expired → free; `customer.subscription.deleted` → free. Out-of-order safe.
- `POST /api/stripe/confirm { sessionId }` (called by `/billing/success`): retrieve the session; `client_reference_id` must equal the caller (else 403); `status !== 'complete'` → 409 `PAYMENT_NOT_COMPLETE`; else set plan = `metadata.tier` → `{ plan }`. Makes the demo independent of webhook latency.
- Upgrading Starter → Pro creates a second subscription in MVP. Acceptable for the demo; Billing Portal is post-MVP.
- Local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`. Test card `4242 4242 4242 4242`, any future date, any CVC.

---

## 11. Seed and demo accounts

`pnpm seed` (`scripts/seed.ts`, run with `tsx`, uses the secret key; idempotent — deletes and recreates only seed/judge/demo users and their Storage folders):

- **60 seed users** `k7.seed.01@example.com … k7.seed.60@example.com` (password `SEED_PASSWORD`) in **12 states**: TX 18 (Austin 12, Dallas 3, Houston 3), CA 8, NY 6, FL 5, IL 4, WA 4, CO 3, GA 3, MA 3, AZ 2, NC 2, OR 2.
- Interests weighted so the judges see a lively map: in Austin, 7 of 12 have running, 5 spanish, 4 cooking, 3 guitar, 3 chess. Each user: 3 distinct interests with difficulties 1/3/5, realistic first name + last initial, short bio, valid social URL (`https://instagram.com/<handle>`), avatar preset or custom.
- Progress: onboard each user with **template** roadmaps (deterministic, fast). Set ~40% of users to `starter`/`pro` directly in DB so Medium/Hard progress exists. Complete 1–6 stages per user through `complete_stage` (never write `status`/`coins` directly), ~half with photos. Create ~40 connections among seed users (most accepted) and ~10 completed co-op pairs so the feed shows "with <name>". Spread `created_at` of reports/connections over the last 14 days with an `update` after creation.
- Photos: `supabase/seed/photos/<category>-NN.jpg` (fitness, outdoors, languages, music, creative, food, mind, social; ≥ 3 each). The team drops in its own photos or free-license ones. If a category has none, generate a 1080×1350 pixel-art placeholder JPEG with `sharp` (sky `#71c5cf`, ground `#ddd897`, the interest emoji/name). Upload to `<userId>/<stageId>/seed.jpg`.
- **Persona user "Sarah K."** (Austin, TX, 30–34, running Easy + spanish Medium + photography Hard) — appears on the map and in the feed.
- **Judges** `judge1@example.com`, `judge2@example.com` (password `JUDGE_PASSWORD`): Austin, TX, both **running Easy**, judge1: spanish Medium + guitar Hard, judge2: cooking Medium + chess Hard. Free plan, no progress, not connected to each other. judge1 has **one pending incoming request from Sarah** (shows the "someone wants to meet you" moment).
- **Presenter** `demo@example.com`: auth user only (no profile) — for the live onboarding in the pitch.
- `pnpm seed:judges` (`scripts/seed-judges.ts`): resets only judge1, judge2, demo (delete + recreate + Sarah's request). Run before every rehearsal and the final pitch.
- Prints a summary: users per state, connections, co-ops, feed items, judge credentials.

---

## 12. Tests (all must pass before a task is "done")

| Command | What | Needs |
| --- | --- | --- |
| `pnpm test:unit` | Vitest, `tests/unit/**` | nothing |
| `pnpm test:db` | `tests/db/run.sh`: fresh DB → stub → migrations → scenarios → race test | local Postgres 15+ (`brew install postgresql@17`), `DATABASE_URL` to its admin db |
| `pnpm test:api` | Playwright `request` tests against `next dev -p 3100` | Supabase project + `.env.local`; creates `t-<random>@example.com` users and deletes them after |
| `pnpm test:e2e` | Playwright, iPhone 14 + Pixel 7 projects, golden path | same as API tests + seed |
| `pnpm smoke` | `scripts/smoke.ts` against `SMOKE_URL` (prod) | judge credentials |

Rules: a DB change ships with a scenario in `tests/db/scenarios.sql`; a route ships with an API spec; a bug fix ships with the test that reproduced it.

### Required API test cases (`tests/api/`)

- `auth.spec`: every protected route → 401 without token; 409 `NOT_ONBOARDED` before onboarding (except `/me`).
- `onboarding.spec`: happy path → 19 stages, 3 active, `me.onboarded`; duplicate → 409; bad social link / duplicate difficulty / unknown slug → 400 with `details`; AI disabled → `source:'template'`.
- `stages.spec`: solo complete pays 1; locked stage → 409; Medium on Free → 402 + `requiredPlan:'starter'`; upload-url → upload with `uploadToSignedUrl` → complete with photo → `report.photoUrl` present, +2; foreign `photoPath` → 400; coop without photo → 422.
- `coop.spec`: two users, connect, accept (connect stages auto-done), both upload, first gets `waitingForPartner:true`, second gets `levelCompleted:true`; both have ×2 coins; feed shows both with partner names.
- `map.spec`: Free sees ≤ 10 overall + `hiddenCount`; starter sees all; blocked user disappears both ways; declined disappears.
- `connections.spec`: 4th request on Free → 402; accept by sender → 403; `socialUrl` only after accept; `sharedInterests` lists exactly the slugs both people have.
- `meetups.spec`: create only on accepted; confirm by proposer → 409; cancel → status.
- `stripe.spec`: webhook with a body signed by `stripe.webhooks.generateTestHeaderString({ payload, secret: STRIPE_WEBHOOK_SECRET })` sets the plan; `customer.subscription.deleted` → free; bad signature → 400; checkout returns a `https://checkout.stripe.com/` URL. `confirm` needs a paid session, so it is covered by the manual prod check in B9.
- `security.spec`: with the publishable key + user JWT, `select social_url from profiles` returns only own row; `rpc('complete_stage')` → permission denied; `public_profiles` → denied.

---

## 13. Backend task order (each = branch `feat/<name>`, merged after its gate)

| # | Task | Done when (commands + observable result) |
| --- | --- | --- |
| B1 | Scaffold merge, deps, scripts, `.env.example`, Supabase link, Vercel deploy | `pnpm verify` green; prod URL serves `/api/health` → `{ok:true, interests:30}` |
| B2 | `proxy.ts` session refresh + browser client helper | sign up / sign in work locally; `/api/me` → `onboarded:false` |
| B3 | `supabase db push` migrations to the project | `/api/health` ok on prod; `pnpm test:db` green |
| B4 | `/api/interests`, `/api/me` (`lib/server/me.ts`), `/api/onboarding` | `onboarding.spec`, `auth.spec` green |
| B5 | `/api/roadmap`, `/api/stages/[id]/upload-url` (+ reference complete) | `stages.spec` green |
| B6 | Map: `lib/server/map.ts`, `/api/map/states`, `/api/map/users` | `map.spec` green |
| B7 | Connections + meetups routes | `connections.spec`, `meetups.spec`, `coop.spec` green |
| B8 | Feed, reports, blocks | feed part of `coop.spec`, `map.spec` block cases green |
| B9 | Stripe checkout + confirm (+ webhook exists) | `stripe.spec` green; manual 4242 payment on prod changes plan |
| B10 | Seed + seed-judges + smoke | `pnpm seed` summary OK; `SMOKE_URL=<prod> pnpm smoke` green |
| B11 (P1) | Icebreakers, streak, coin spending | their specs green |

---

## 14. Manual setup (human, ~20 min, before B1)

1. **Supabase**: new project (region `us-east-1`). Auth → Email: enabled, **Confirm email OFF**. Settings → API Keys: copy URL, publishable, secret. `supabase login && supabase link --project-ref <ref>`.
2. **Stripe** (test mode): 3 products with monthly prices $5 / $7 / $9 → price ids. Developers → API keys → secret key. Webhooks → endpoint `https://<prod-domain>/api/stripe/webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → signing secret.
3. **Vercel**: import the GitHub repo, add all env vars (Production + Preview), set `NEXT_PUBLIC_APP_URL` to the prod domain.
4. **Anthropic** (optional): API key → `ANTHROPIC_API_KEY`.
5. **Local Postgres for `test:db`** (macOS): `brew install postgresql@17 && brew services start postgresql@17`, add `/opt/homebrew/opt/postgresql@17/bin` to `PATH`, then `DATABASE_URL=postgres://$(whoami)@localhost:5432/postgres`.

---

## 15. Known MVP limitations (say them honestly if asked)

- No realtime chat (social link after accept), no push/email notifications.
- Upgrade creates a new subscription; no proration / billing portal.
- Social link is format-checked, not ownership-verified (post-MVP: LinkedIn OAuth).
- City-level matching only, no geolocation by design (safety).
