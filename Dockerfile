# syntax=docker/dockerfile:1
# Single-container image for the marina shore-power monitor.
# Base is node:22-slim (Debian glibc — NOT Alpine musl) so better-sqlite3's
# prebuilt binaries work; python3/make/g++ are installed only in the build
# stage as a fallback when no prebuilt binary matches the platform.

########## 1. Dependencies ##########
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# allowScripts in package.json permits better-sqlite3's install script
# (prebuild-install downloads the native binding; node-gyp is the fallback).
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

########## 2. Builder ##########
FROM node:22-slim AS builder
WORKDIR /app
# Build toolchain — only present in this stage, never shipped in the image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Throwaway DB for build-time page-data collection (module init runs migrations).
ENV DATABASE_PATH=/tmp/marina-build.db
RUN npm run build

########## 3. Runner ##########
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# The SQLite file always lives on the mounted volume inside the container.
ENV DATABASE_PATH=/app/data/marina.db

RUN mkdir -p /app/data && chown node:node /app/data

# output: "standalone" ships the traced server + node_modules + drizzle migrations.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
# Mock fixture (tiny) — lets a fresh container run with HA_MOCK_FILE=/app/docs/ha-sample.json
COPY --from=builder --chown=node:node /app/docs ./docs

USER node
EXPOSE 3000

# Unauthenticated probe used by Docker/Dockge (node 22 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "server.js"]
