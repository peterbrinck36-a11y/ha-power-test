# Marina Shore Power

Self-hosted web application for marinas: boat owners log in and monitor their
shore-power usage from Home Assistant, while an admin manages user accounts and
assigns Home Assistant power meters to them. Power is live from HA; consumption
totals are sampled into the app's own database every 2 minutes, so each owner's
total starts at 0 when their meter is assigned and monthly reports are possible.

## Features

- **Boat owner dashboard** — live power draw (W, auto-formats to kW), total
  consumed energy accumulated in our own database since the owner was assigned,
  sensor-age timestamps, and clear fallback indicators when a sensor is
  `unavailable`/`unknown` or a sample is stale. Auto-refreshes every 10s without
  page flicker; pauses while the tab is hidden.
- **Background sampler** — every 2 minutes the server reads all meters and appends
  a reading (power, energy, kWh delta) to SQLite. Runs whether or not anyone is
  signed in; gaps recover from the HA counter on the next good sample.
- **Consumption categories** — admins define kWh tiers (e.g. Bronze 0, Silver 150,
  Gold 300); each owner sees their calendar-month total, current tier and how much
  is left to the next one. Computed from the sampler's stored readings, so it works
  even when Home Assistant is temporarily offline.
- **Admin panel** — create/edit/disable/delete boat owners (including direct
  password resets), create/edit/delete meters and assign them to owners.
  Click a user to open their detail page and see every meter they own; create a
  new meter for them, attach an unassigned one, or unassign one. Users may own
  several meters — the dashboard shows one card per meter and the category total
  combines them. Assigning a meter to a different owner automatically restarts
  that owner's consumption at 0; editing the same owner's meter keeps the
  running total.
- **Emailed invitations** — new users receive a temporary password by email
  (Gmail SMTP), must choose their own password on first sign-in, and an admin
  can still set a password directly for testing or hand-over. Passwords need at
  least 8 characters.
- **Dark mode** — a sun/moon toggle in every header (and on the login screen)
  switches the whole UI, remembers the choice per browser, and otherwise follows
  the operating system's preference.
- **Home Assistant sensor picker** — searchable dropdown fed by a filtered
  `/api/states` query (power/energy device classes, W/kW/Wh/kWh units), with
  manual `entity_id` entry as a fallback.
- **Security boundary** — the browser never sees `HA_URL`/`HA_TOKEN`; all HA
  calls happen server-side through a 5s TTL cache with single-flight, so
  refreshing owners never spam Home Assistant.
- **Self-contained auth** — email-or-username + bcrypt password login, signed
  HTTP-only session cookies (jose HS256), disabled-user cut-off, brute-force
  rate limiting.

## Tech stack

Next.js 16 (App Router, standalone output) · TypeScript · Tailwind CSS v4 ·
SQLite (better-sqlite3, WAL) + Drizzle ORM · bcryptjs + jose · Playwright ·
Docker (node:22-slim) → GHCR → Dockge on TrueNAS SCALE behind an HTTPS proxy.
## Quick start (local development)

```bash
npm install
cp .env.example .env       # then edit — see table below
npm run dev                # http://localhost:3000
```

On first start the app creates and migrates `DATABASE_PATH` and seeds an admin
from `ADMIN_EMAIL` / `ADMIN_PASSWORD` (when no admin exists yet).

> npm ≥ 11.20 may ask about install scripts for `better-sqlite3`/`esbuild` —
> approve them (`npm install-scripts approve better-sqlite3 esbuild`), they are
> already allow-listed in `package.json`.

### Offline mode (no Home Assistant needed)

Set `HA_MOCK_FILE=docs/ha-sample.json` — the app serves sensor states from the
JSON file instead of calling Home Assistant. Ideal for demos and tests.

## Home Assistant setup

1. In HA: **Profile → Security → Create token** (long-lived access token).
2. Put your HA base URL in `HA_URL` (e.g. `http://homeassistant.local:8123`)
   and the token in `HA_TOKEN`.
3. In the app: sign in as admin → **Meters → New meter** → pick a power sensor
   (W/kW) and an energy sensor (Wh/kWh) → assign an owner. The owner's total
   starts at 0 and grows as the sampler records consumption.

## Consumption categories

Each owner is ranked against admin-defined kWh tiers for the current calendar month:

1. Sign in as admin → **Settings → Advanced → New category**, then add tiers in rising order
   (e.g. Bronze `0`, Silver `150`, Gold `300`). Thresholds must be unique; the top
   tier is open-ended. The dialog suggests the next sensible threshold.
2. Owners see a summary card at the top of `/dashboard`: the month label, their
   total across all their meters, their current tier, and how many kWh remain to the
   next one (or "Not ranked yet" below the first tier).

Details:

- The month uses `APP_TIMEZONE` (default `Europe/Copenhagen`), so it flips at local
  midnight, not UTC midnight.
- Totals are summed from the sampler's stored `readings`, counting only rows inside
  the assignment window that was active when each row was recorded. Reassigning a
  meter therefore restarts that owner's monthly progress at 0.
- With no tiers configured the card is hidden; deleting tiers hides it again.
- Admins previewing `/dashboard` do not get a category card (the total is
  account-level, so it has no meaning for the admin account).

## Email setup (Gmail)

New accounts are invited by email. The app sends through Gmail SMTP with a
Google **app password** — a normal account password will not work:

1. Sign in to the Google account that should send the mail.
2. Turn on **2-Step Verification** (`myaccount.google.com/security`); app
   passwords are unavailable without it.
3. Open `myaccount.google.com/apppasswords`, create one named e.g. "Marina
   Shore Power", and copy the 16-letter password.
4. In the app: admin → **Settings** → enter the Gmail address and the app
   password → **Save settings** → **Send test email**.

Notes:

- The app password is stored encrypted (AES-256-GCM, key derived from
  `EMAIL_SECRET` or `SESSION_SECRET`) and is never returned to the browser.
  Rotating that secret means re-entering the app password.
- Free Gmail accounts can send to roughly 500 recipients per day.
- If email is not configured (or Gmail rejects the credentials), creating a
  user still succeeds: the temporary password appears once in the dialog so the
  admin can hand it over.
- Emailed links use `APP_URL`; when unset the app falls back to the request
  origin (`X-Forwarded-Proto` / `Host`).

## Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_PATH` | no | SQLite file, created automatically. Default `./data/marina.db`; `/app/data/marina.db` in Docker |
| `HA_URL` | live HA only | Base URL of your Home Assistant instance |
| `HA_TOKEN` | live HA only | Long-lived access token — server-side only, never sent to the browser |
| `HA_MOCK_FILE` | no | JSON array of HA state objects for offline dev/tests (`docs/ha-sample.json`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | first boot | Seeds the initial admin when none exists |
| `SESSION_SECRET` | **yes in prod** | HS256 signing secret — generate with `openssl rand -base64 48` |
| `COOKIE_SECURE` | no | `auto` (default): secure when `x-forwarded-proto` is https · `true` · `false` |
| `MAX_LOGIN_ATTEMPTS` | no | Failed logins allowed per client IP per 15 min (default 10) |
| `TRUSTED_PROXY_HOPS` | no | Reverse proxies appending to `X-Forwarded-For` (default 1). Client IP for rate limiting = that many entries from the right; `0` = no proxy, ignore the header |
| `SAMPLE_INTERVAL_MS` | no | sampler cadence in ms (default `120000` = 2 min, clamped to ≥5s) |
| `SAMPLER_DISABLED` | no | `1` turns the background loop off (tests use this; `POST /api/admin/sample` still works) |
| `APP_TIMEZONE` | no | IANA zone for monthly category windows/labels (default `Europe/Copenhagen`) |
| `APP_URL` | no | public base URL used in emailed links (`https://marina.example.com`); defaults to the request origin |
| `EMAIL_SECRET` | no | key material for encrypting the stored Gmail app password; falls back to `SESSION_SECRET` |
| `EMAIL_CAPTURE_FILE` | tests only | write outgoing emails to this JSONL file instead of sending via Gmail |

## Production deployment (GHCR + Dockge)

1. Push to `main` — GitHub Actions runs the Playwright E2E suite, then builds
   `linux/amd64` + `linux/arm64` images and pushes them to
   `ghcr.io/<owner>/<repo>:latest` (and a SHA tag).
2. In Dockge, create a stack from `compose.yaml`:
   - set `image:` to your GHCR path
   - keep the `./data:/app/data` volume (the SQLite database lives there)
   - fill in the environment (or an `env_file`)
3. Behind a reverse proxy, **forward `X-Forwarded-Proto`** — with the default
   `COOKIE_SECURE=auto` the session cookie is marked `Secure` exactly when the
   request arrived over HTTPS. Update the container image with
   `docker compose pull && docker compose up -d`.

Local container test:

```bash
docker compose up -d --build
# http://localhost:3000  (data persists in ./data)
```

## Tests

```bash
npm run build        # E2E runs against the standalone build
npm run test:e2e     # Playwright (offline via HA_MOCK_FILE, throwaway DB)
```

## Project structure

```
src/proxy.ts            Next 16 middleware (session redirects, JWT-only checks)
src/instrumentation.ts  boots the background sampler once per server process
src/app/                routes: login, dashboard, admin/*, api/*
src/lib/sampler.ts      always-on 2-minute sampling pass (readings + deltas)
src/lib/meters.ts       ownership periods / automatic consumption reset
src/lib/email/          Gmail SMTP sender, encrypted settings, email templates
src/app/account/password forced first-login password change
src/lib/ha/             server-only HA client (cache, parsers, mock support)
src/lib/                db, schema, auth, formatters, shared API types
src/components/         dashboard + admin UI components
drizzle/                generated SQL migrations (applied at startup)
e2e/                    Playwright specs
docs/ha-sample.json     offline HA state fixture
```

See `AGENTS.md` for architecture rules and conventions.
