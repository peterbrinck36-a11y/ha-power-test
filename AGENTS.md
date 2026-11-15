# AGENTS.md — Marina Shore-Power Monitor

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Self-hosted web app (single Docker container) that lets marina boat owners log in and
monitor shore-power usage from Home Assistant. Admins manage user accounts and assign
HA power/energy meters (with `kwh_offset` support) to boat owners.

## Stack (locked — do not swap without discussing)

- **Next.js 16** App Router + TypeScript + Tailwind CSS **v4** (CSS-first: `@import
  "tailwindcss"` + `@theme` in `src/app/globals.css` — there is no `tailwind.config.js`)
- **SQLite** via `better-sqlite3` (WAL mode) + **Drizzle ORM**; DB file at `DATABASE_PATH`
  (default `./data/marina.db`, `/app/data/marina.db` in Docker). Migrations apply
  automatically at startup (`src/lib/db.ts`), SQL lives in `drizzle/`
- **Auth**: `bcryptjs` password hashing, `jose` HS256 JWT in an HTTP-only cookie
  (`marina_session`), routes guarded by `src/proxy.ts` (Next 16's replacement for
  `middleware.ts`) **plus** per-page/route/action `requireUser`/`requireAdmin`
- Deployment target: Docker (`node:22-slim`, `output: "standalone"`) behind an HTTPS
  reverse proxy, built by GitHub Actions → GHCR (Phase 4)

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server at http://localhost:3000 |
| `npm run build` | Production build (standalone) + TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migration after editing `src/lib/schema.ts` |
| `npx playwright test` | E2E tests (Phase 4) |

Running the production build locally: `node .next/standalone/server.js` from
`.next/standalone/` (after copying `.next/static` → `.next/standalone/.next/static`).
`next start` does **not** support `output: "standalone"`.

## Environment

| Var | Required | Notes |
|---|---|---|
| `DATABASE_PATH` | no | default `./data/marina.db`; directory created automatically |
| `HA_URL` / `HA_TOKEN` | live HA only | Server-side only — NEVER expose to the browser |
| `HA_MOCK_FILE` | no | JSON array of HA state objects for offline dev/tests (`docs/ha-sample.json`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first boot | Seeds the initial admin when no admin exists (atomic insert, race-safe) |
| `SESSION_SECRET` | **yes in prod** | HS256 key; dev falls back to per-boot random (sessions reset on restart) |
| `COOKIE_SECURE` | no | `auto` (default: secure only when `x-forwarded-proto` is https) / `true` / `false` |

Copy `.env.example` → `.env` for local development; never commit `.env` or `data/`.

## Hard rules

1. `HA_TOKEN` / `HA_URL` never leave the server. Client components must never import
   `src/lib/ha/*` (protected by the `server-only` package once Phase 2 lands).
2. All HA reads go through the shared HA client (Phase 2: 5s TTL cache + single-flight).
   Never call Home Assistant ad hoc from a route or component.
3. `src/proxy.ts` does optimistic JWT-only redirects — no DB access there. Real
   authorization happens via `requireUser` / `requireAdmin` in pages, layouts, actions,
   and route handlers (this is also what cuts off disabled users immediately, since the
   session JWT is stateless).
4. Schema changes: edit `src/lib/schema.ts` → `npm run db:generate` → commit the new
   `drizzle/` migration. Do not hand-edit generated SQL.
5. Never commit `.env`, `data/`, or real tokens. `docs/ha-sample.json` is mock data only.

## Conventions

- Mutations = server actions (`src/app/**/actions.ts`, `"use server"`); polled/read
  APIs = route handlers under `src/app/api/*`.
- One login field matches email **or** username (both stored, both unique,
  case-insensitive match at login).
- `kwh_offset` is subtracted from the meter total and **clamped at 0** — never show
  negative consumption. In practice each user has exactly one meter, but the data
  model allows several (`meters.owner_id` nullable FK).
- UI: mobile-first Tailwind utilities; small hand-rolled components in `src/components`.
- When `npm install` warns about blocked install scripts (npm ≥ 11.20), approve the
  native/native-adjacent packages: `npm install-scripts approve better-sqlite3 esbuild`
  then `npm rebuild better-sqlite3 esbuild`.

## Status / roadmap

- [x] Phase 1 — scaffold, DB schema (`users`, `meters`), auth (login/logout, proxy
  guards, role redirects, admin seeding), `/api/health`, stub pages
- [x] Phase 2 — HA proxy client (`src/lib/ha/*`: 5s TTL cache + single-flight +
  `HA_MOCK_FILE` + BOM-tolerant parsing), `/api/ha/readings` (owner-scoped, admins
  see all), `/api/admin/ha-sensors` (admin-only picker feed), admin users CRUD +
  password reset (self/last-admin guards), meters CRUD + assignment + `kwh_offset`,
  searchable SensorPicker with manual fallback, dialogs
- [x] Phase 3 — boat owner dashboard (`/dashboard`): mobile-first MeterCard UI,
  10s polling with pause-when-hidden + refresh-on-visible, kW auto-formatting,
  offset-adjusted totals, live/partial/no-data/unavailable chips, "refreshed Xs
  ago" ticker, degraded-HA + fetch-error banners, empty state, admin "Owner view"
  link; relative-time + number formatters in `src/lib/format.ts`
- [x] Phase 4 — Dockerfile (node:22-slim multi-stage, standalone runner, non-root,
  HEALTHCHECK via node fetch), .dockerignore, compose.yaml (./data volume),
  GHCR workflow (E2E job gates the amd64+arm64 build-push), README, Playwright
  suite (17 specs: auth, dashboard scenarios, admin UI flows incl. sensor
  picker + password reset + disable, API auth boundaries) — all passing

## Gotchas learned the hard way

- **jose**: `setExpirationTime(<number>)` is an absolute Unix timestamp in seconds,
  NOT "seconds from now" — compute `Math.floor(Date.now() / 1000) + TTL`.
- **Next build workers** run page-data collection in parallel: any DB seeding at
  module init must be atomic/race-safe (see `seedAdminIfMissing` in `src/lib/db.ts`).
- **Turbopack tracing**: dynamic `fs` paths in server modules need
  `/* turbopackIgnore: true */` or the whole project gets traced into the bundle.
- **Server actions must return `{ error: null, ok: true }` on success** — dialogs
  close via `useEffect` watching `state.ok`. React 19 auto-resets uncontrolled
  form fields after a successful action.
- **Locale-dependent `type="number"` inputs silently block form submission** on
  comma-decimal locales ("5.239" fails `step="0.01"` with "5,23/5,24" as nearest
  valid values, no visible error). Use `type="text"` + `inputMode="decimal"` and
  validate server-side (see the kWh offset field).
- **HA exports often start with a UTF-8 BOM** — strip it before `JSON.parse`
  (see `readMockFile` in `src/lib/ha/client.ts`).
- **`next build` wipes `.next/standalone/data`** — that throwaway DB is rebuilt
  with a fresh seed on every rebuild locally. In Docker the DB lives on the
  mounted volume (`/app/data`), so this only affects local standalone testing.
- **After rebuilding, hard-reload browser tabs** — the old Next.js client runtime
  keeps running across soft navigations, and React handlers from it stop
  responding (clicks silently do nothing) until a full reload.
- **Playwright webServer teardown hangs on Windows** with the Next.js standalone
  server (its worker child inherits the stdio pipes). This repo instead spawns
  the server in `e2e/global-setup.ts` and kills the process tree with
  `taskkill /T /F` in `e2e/global-teardown.ts`.
- **E2E gotchas** (see `e2e/helpers/*`): the SQLite DB path is unique per run
  (never unlink on Windows); seeds are idempotent (beforeAll re-runs when
  Playwright restarts a worker after a failed test); `MAX_LOGIN_ATTEMPTS=1000`
  is set for the server (all E2E logins share one IP); React 19 resets login
  forms after a failed attempt, so re-login tests must refill both fields and
  wait for the redirect URL before navigating further; `role="alert"` is also
  used by Next's route announcer — scope alerts to `p[role=alert]`.
