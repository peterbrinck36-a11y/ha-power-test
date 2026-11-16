# Marina Shore Power

Self-hosted web application for marinas: boat owners log in and monitor their
shore-power usage from Home Assistant, while an admin manages user accounts and
assigns Home Assistant power meters to them.

## Features

- **Boat owner dashboard** — live power draw (W, auto-formats to kW), total
  consumed energy (offset-adjusted), sensor-age timestamps, and clear fallback
  indicators when a sensor is `unavailable`/`unknown` or Home Assistant is
  unreachable. Auto-refreshes every 10s without page flicker; pauses while the
  tab is hidden.
- **Admin panel** — create/edit/disable/delete boat owners (including direct
  password resets), create/edit/delete meters, assign them to owners, and set a
  `kwh_offset` to zero the total for a new tenant without touching hardware.
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
   (W/kW) and an energy sensor (kWh) → assign an owner.

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
src/app/                routes: login, dashboard, admin/*, api/*
src/lib/ha/             server-only HA client (cache, parsers, mock support)
src/lib/                db, schema, auth, formatters, shared API types
src/components/         dashboard + admin UI components
drizzle/                generated SQL migrations (applied at startup)
e2e/                    Playwright specs
docs/ha-sample.json     offline HA state fixture
```

See `AGENTS.md` for architecture rules and conventions.
