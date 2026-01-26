# ============================================
# Base stage - shared between dev and prod
# ============================================
FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/poller/package.json ./packages/poller/

# ============================================
# Development stage
# ============================================
FROM base AS dev
RUN npm install -g tsx
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/poller ./packages/poller

WORKDIR /app/packages/poller
CMD ["tsx", "watch", "src/index.ts"]

# ============================================
# Build stage - compile TypeScript
# ============================================
FROM base AS builder
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY packages/poller ./packages/poller

RUN pnpm --filter @dexter/shared build && \
    pnpm --filter @dexter/poller build

# ============================================
# Production stage
# ============================================
FROM base AS prod
RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/poller/dist ./packages/poller/dist

WORKDIR /app/packages/poller
CMD ["node", "dist/index.js"]
