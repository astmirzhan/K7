# K7 — Your goal is a quest

Turn any personal goal into a quest with real people nearby: a 3-level roadmap per interest, a US map of
people who want the same thing, buddy connects, co-op stages with photo proof, coins, and plans via Stripe.

Stack: Next.js 16 (App Router, API routes) · Supabase (Postgres, Auth, Storage) · Stripe Checkout · Zod · Playwright · Vitest.

**Live:** https://k7-indol.vercel.app

## Try it

1. Open the link on a phone (390 px wide is the target; desktop works too).
2. Sign in as `judge1@example.com` or `judge2@example.com` (password on the slide), or sign up as a new user.
3. Golden path: pick a ninja and 3 goals → finish Easy stage 1 with a photo → open the map, tap Texas →
   connect judge1 and judge2 → both finish the co-op stage with a photo → "Level complete!" → tap a Medium
   stage → paywall → Stripe Checkout (test card `4242 4242 4242 4242`, any future date, any CVC).

## Screens

| Route | What |
| --- | --- |
| `/` | Landing |
| `/signup`, `/login` | Email + password |
| `/onboarding` | Ninja avatar → 3 goals with Hard / Medium / Easy → profile |
| `/home`, `/roadmap` | Quest of the day, winding roadmap per goal, stage sheet with photo report, co-op partner picker |
| `/map` | Tile map of the US with counts, match cards with shared interests, connect, report and block |
| `/people` | Requests, sent, buddies, social link after accept, meetups |
| `/feed` | Reels-style photo reports, everyone / mine |
| `/pricing`, `/billing/success` | Plans and Stripe Checkout confirmation |
| `/profile` | Read-only profile, plan, sign out |

Frontend: `app/(public)`, `app/(onboarding)`, `app/(app)`, `components/app` (screens), `components/ui` and
`components/scene` (design system), `lib/api.ts` + `lib/hooks.ts` (typed API client and SWR hooks).

## Backend layout

```
app/api/*                 JSON API (see docs/BACKEND.md §8 for every route)
lib/types.ts              API contract shared by API and UI
lib/server/*              auth, validation, plan rules, read models, Stripe, storage
lib/supabase/browser.ts   browser client (Auth + signed photo upload only)
proxy.ts                  Supabase session refresh (Next 16)
supabase/migrations/*     schema, RLS, all business rules as SQL functions
scripts/seed.ts           demo world (60 users, judges, persona)
scripts/smoke.ts          production smoke test
tests/db, tests/unit, tests/api, tests/e2e
```

Architecture rules, data model, business rules and error codes: [`docs/BACKEND.md`](docs/BACKEND.md).
Product spec and screens: [`docs/TZ.md`](docs/TZ.md).

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase, Stripe and passwords (see `docs/BACKEND.md` §3, §14).
3. Supabase: Auth → Email provider on, **Confirm email off**. Then `supabase link --project-ref <ref>` and `supabase db push`.
4. `pnpm dev` → `http://localhost:3000/api/health` should return `{ "ok": true, "interests": 30 }`.
5. `pnpm seed` creates the demo world; `pnpm seed:judges` resets only the judge and demo accounts.

## Commands

| Command | What |
| --- | --- |
| `pnpm verify` | typecheck + lint + unit tests + DB tests + build |
| `pnpm test:db` | Postgres scenario and race tests (needs local Postgres, `DATABASE_URL`) |
| `pnpm test:api` | Playwright request tests against `next dev` on port 3100 (needs `.env.local`) |
| `pnpm test:e2e` | Golden path in the browser on iPhone 14 and Pixel 7 (needs `.env.local`; the Checkout step needs Stripe keys) |
| `pnpm seed` / `pnpm seed:judges` | demo data |
| `SMOKE_URL=https://<prod> pnpm smoke` | production smoke test with the judge accounts |

## API in one minute

All routes return JSON. Errors are always `{ "error": { "code", "message", "requiredPlan?", "details?" } }`.
Auth: the Supabase session cookie, or `Authorization: Bearer <access_token>`.

```
GET  /api/health                      GET  /api/interests
GET  /api/me                          POST /api/onboarding
GET  /api/roadmap                     POST /api/stages/:id/upload-url     POST /api/stages/:id/complete
GET  /api/map/states                  GET  /api/map/users?state=TX
GET  /api/connections                 POST /api/connections               PATCH /api/connections/:id
GET  /api/meetups                     POST /api/meetups                   PATCH /api/meetups/:id
GET  /api/feed?scope=public|mine      POST /api/reports                   POST /api/blocks
POST /api/stripe/checkout             POST /api/stripe/confirm            POST /api/stripe/webhook
```

Plan limits come back as HTTP 402 with `requiredPlan`, so the UI can open the paywall with the right offer.
