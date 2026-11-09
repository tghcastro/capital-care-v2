# syntax=docker/dockerfile:1

# Node version must match .nvmrc
ARG NODE_VERSION=24.7.0

# Full (non-slim) image: includes python3, make and g++, which better-sqlite3
# needs when it compiles from source. Used for build stages only; the runtime
# stage below is slim.
FROM node:${NODE_VERSION}-bookworm AS base
# Pin pnpm to the version in package.json `packageManager`
RUN npm install -g pnpm@12.11.2 && pnpm --version
WORKDIR /app

# Install dependencies (cached until a manifest or the lockfile changes)
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc .pnpmfile.cjs ./
COPY apps/api/package.json apps/api/
COPY modules/ledger/package.json modules/ledger/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

# Compile TypeScript (includes copying SQL migrations into dist)
FROM deps AS build
COPY tsconfig.json ./
COPY packages ./packages
COPY modules ./modules
COPY apps ./apps
RUN pnpm build

# Production-only node_modules and the API package, laid out for runtime
FROM build AS deploy
RUN pnpm --filter @capital-care/api deploy --prod /out

# Runtime image: no compiler, no pnpm, no dev dependencies
FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/app/data/capital-care.db
WORKDIR /app
COPY --from=deploy /out ./
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Apply pending migrations explicitly, then start the server.
# `exec` makes node PID 1's child replace sh so SIGTERM reaches the server.
CMD ["sh", "-c", "node dist/migrate.js && exec node dist/main.js"]
