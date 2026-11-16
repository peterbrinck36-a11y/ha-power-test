# AGENTS.md — Marina Shore-Power Monitor

Guidance for AI coding agents (and humans) working in this repository.

## What this is

Self-hosted web app (single Docker container) that lets marina boat owners log in and
monitor shore-power usage from Home Assistant. Admins manage user accounts and assign
HA power/energy meters to boat owners. Power is live from HA; consumption totals are
sampled and stored by the app itself so monthly per-user reports are possible.

## Stack (locked — do not swap without discussing)

- **Next.js 16** App Router + TypeScript + Tailwind CSS **v4** (CSS-first: `@import
  "tailwindcss"` + `@theme` in `src/app/globals.css` — there is no `tailwind.config.js`)
- **SQLite** via `better-sqlite3` (WAL mode) + **Drizzle ORM**; DB file at `DATABASE_PATH`
  (default `./data/marina.db`, `/app/data/marina.db` in Docker). Migrations apply
  automatically at startup (`src/lib/db.ts`), SQL lives in `drizzle/`
- **App-owned history**: an in-process sampler (`src/lib/sampler.ts`, started once from
  `src/instrumentation.ts`) reads every meter's power + energy sensors every 2 minutes and
  appends to `readings`; `meter_assignments.consumed_kwh` is the owner-facing total.
  Always-on, independent of user sessions.
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
| `TRUSTED_PROXY_HOPS` | no | default 1; rate-limit IP = Nth entry from the RIGHT of `X-Forwarded-For` (left part is client-forgeable); `0` = ignore header |
| `SAMPLE_INTERVAL_MS` | no | sampler cadence, default `120000` (2 min), clamped to ≥5s |
| `SAMPLER_DISABLED` | no | `1` disables the background loop (E2E uses this; the manual endpoint still works) |
| `APP_URL` | no | public base URL for emailed links; when unset the app falls back to the request origin (`x-forwarded-proto`/`host`) |
| `EMAIL_SECRET` | no | extra key material for encrypting the stored Gmail app password; falls back to `SESSION_SECRET` |
| `EMAIL_CAPTURE_FILE` | tests only | append outgoing emails to this JSONL file instead of sending through Gmail |

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
6. Owner-facing totals come from our DB (`meter_assignments`), never from the HA energy
   counter. Only `src/lib/sampler.ts` writes `readings` / `meter_state`; assignment
   changes go through `syncAssignment` in `src/lib/meters.ts`.
7. Email credentials never leave the server: the Gmail app password is write-only,
   encrypted with AES-256-GCM (key from `EMAIL_SECRET`/`SESSION_SECRET`), and only
   `getPublicEmailSettings()` may be passed to a client component.

## Conventions

- Mutations = server actions (`src/app/**/actions.ts`, `"use server"`); polled/read
  APIs = route handlers under `src/app/api/*`.
- One login field matches email **or** username (both stored, both unique,
  case-insensitive match at login).
- New users are onboarded by email: `createUser` generates a 16-char temporary
  password (`src/lib/passwords.ts`), sets `must_change_password`, and sends the
  invitation. If sending fails the account still exists and the action returns the
  temporary password once so the dialog can show it. `requireUser` redirects
  `must_change_password` users to `/account/password`; changing the password clears
  the flag, clears `temp_password_expires_at` and bumps `session_version` (old JWTs
  carry `sv` and stop matching). An admin typing a password in the user dialog has
  the same effect — it signs that user out everywhere.
- `/account/password` must call `getSessionUser`, **not** `requireUser` — otherwise
  the must-change redirect loops on itself.
- The Gmail app password is a normal admin Settings field but is never rendered back:
  the form shows "stored" and a blank submit keeps the saved value.
- Energy sensors may report Wh, kWh or MWh — `toKwh` in `src/lib/ha/parse.ts`
  normalizes to kWh **before** the delta is taken. Power is normalized to W.
- Consumption is stored in our DB per ownership period: `meter_assignments` holds
  `started_at`, `ended_at` and the accumulated `consumed_kwh`. Assigning a meter to a
  different owner (or unassigning/reassigning) closes the period and opens a new one at
  0 — this is the automatic reset. Editing the same owner's meter must not reset it.
- Changing a meter's energy entity re-baselines the sampler (`resetEnergyBaseline`)
  without discarding the running total.
- In practice each user has exactly one meter, but the data model allows several
  (`meters.owner_id` nullable FK).
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
  password reset (self/last-admin guards), meters CRUD + assignment,
  searchable SensorPicker with manual fallback, dialogs
- [x] Phase 3 — boat owner dashboard (`/dashboard`): mobile-first MeterCard UI,
  10s polling with pause-when-hidden + refresh-on-visible, kW auto-formatting,
  DB-owned totals, live/partial/no-data/unavailable chips, "refreshed Xs
  ago" ticker, degraded-HA + fetch-error banners, empty state, admin "Owner view"
  link; relative-time + number formatters in `src/lib/format.ts`
- [x] Phase 4 — Dockerfile (node:22-slim multi-stage, standalone runner, non-root,
  HEALTHCHECK via node fetch), .dockerignore, compose.yaml (./data volume),
  GHCR workflow (E2E job gates the amd64+arm64 build-push), README, Playwright
  suite (auth, dashboard scenarios, admin UI flows incl. sensor picker + password
  reset + disable, API auth boundaries, sampler) — all passing
- [x] Phase 5 — app-owned consumption history: `readings` + `meter_assignments` +
  `meter_state`, 2-minute always-on sampler (`src/instrumentation.ts`), owner totals
  from `consumed_kwh` since assignment (HA `kwh_offset` retired), automatic reset on
  reassignment, `POST /api/admin/sample` manual pass
- [ ] Phase 6 — email onboarding: Gmail SMTP settings in `/admin/settings` (app
  password encrypted at rest), test email, emailed temporary passwords, forced
  first-login password change, admin direct password set
- [ ] Phase 7 — monthly consumption reports per user (query model already supports it:
  `SUM(readings.delta_kwh)` grouped by month and assignment window)

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
  validate server-side (the kWh offset field is gone, but keep the pattern for any
  future decimal input).
- **HA exports often start with a UTF-8 BOM** — strip it before `JSON.parse`
  (see `readMockFile` in `src/lib/ha/client.ts`).
- **`next build` wipes `.next/standalone/data`** — that throwaway DB is rebuilt
  with a fresh seed on every rebuild locally. In Docker the DB lives on the
  mounted volume (`/app/data`), so this only affects local standalone testing.
- **Sampler lifecycle**: it starts from `src/instrumentation.ts` (bundled into the
  standalone output), never from `db.ts` — otherwise `next build`'s parallel workers
  would spawn timers. A `globalThis` singleton prevents double loops on dev reloads.
- **One replica only**: the sampler is an in-process timer. Two containers against one
  DB would double-sample (totals stay assignment-scoped, but rows/deltas duplicate).
- **Sampling gaps recover**: deltas are measured against the last stored counter, so
  container downtime is credited on the next good sample. Negative deltas (counter
  reset) are ignored, never counted.
- **E2E sampling**: the suite sets `SAMPLER_DISABLED=1` and triggers passes explicitly
  via `POST /api/admin/sample`; seed assignments / `meter_state` directly through
  `e2e/helpers/db.ts` so totals are deterministic.
- **After rebuilding, hard-reload browser tabs** — the old Next.js client runtime
  keeps running across soft navigations, and React handlers from it stop
  responding (clicks silently do nothing) until a full reload.
- **CI has no `.env`** (gitignored) — `scripts/prepare-standalone.mjs` must not
  require it; the E2E global-setup passes `HA_MOCK_FILE` via the server's
  process environment, which always wins over any `.env` file.
- **Docker build context excludes `e2e/`** — so `next build`'s project-wide
  type check must never reference test files: `tsconfig.json` excludes
  `e2e`, `playwright.config.ts`, and `scripts`. Keep app/test type worlds apart.
- **Bind-mount volume ownership**: the container runs as non-root `node`
  (uid 1000). The Dockerfile's `chown node:node /app/data` only affects the
  image's own mountpoint — a host bind mount **replaces** it with the host
  directory's ownership, so the host data dir must be `chown 1000:1000`'d
  (SQLITE_CANTOPEN otherwise). `src/lib/db.ts` wraps open errors with the fix
  in the message.
- **Playwright webServer teardown hangs on Windows** with the Next.js standalone
  server (its worker child inherits the stdio pipes). This repo instead spawns
  the server in `e2e/global-setup.ts` and kills the process tree with
  `taskkill /T /F` in `e2e/global-teardown.ts`.
- **Gmail needs an app password**: `smtp.gmail.com:465`, and the Google account must
  have 2-Step Verification enabled — a normal password fails with `EAUTH`. The app
  password is 16 letters (spaces allowed, stripped before saving).
- **Email capture in E2E**: `EMAIL_CAPTURE_FILE` only writes JSONL *after* settings
  exist — `sendEmail` checks config before the capture branch, so tests that expect
  "not configured" must clear `app_settings`. Capture paths must be unique per run so
  parallel/restarted workers don't read each other's mail.
- **Password policy lives in a client-safe module**: import
  `MIN_PASSWORD_LENGTH` from `src/lib/password-policy.ts`; importing
  `src/lib/passwords.ts` (node:crypto) into a client component breaks the bundle.
- **E2E gotchas** (see `e2e/helpers/*`): the SQLite DB path is unique per run
  (never unlink on Windows); seeds are idempotent (beforeAll re-runs when
  Playwright restarts a worker after a failed test); `MAX_LOGIN_ATTEMPTS=1000`
  is set for the server (all E2E logins share one IP); React 19 resets login
  forms after a failed attempt, so re-login tests must refill both fields and
  wait for the redirect URL before navigating further; `role="alert"` is also
  used by Next's route announcer — scope alerts to `p[role=alert]`.
