# Build context is the repository root (see docker-compose.yml) because
# this is a pnpm workspace: apps/dashboard depends on packages/* via
# `workspace:*` and needs the root lockfile to install reproducibly.

FROM node:24-alpine AS base
WORKDIR /repo
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/business-rules/package.json packages/business-rules/package.json
COPY packages/adapters/package.json packages/adapters/package.json
RUN pnpm install --frozen-lockfile || pnpm install

FROM deps AS builder
COPY . .
RUN pnpm --filter=dashboard... run build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
# Docker sets HOSTNAME to the container ID by default, which Next's
# standalone server.js binds to literally (verified live: it listened on
# the container's eth0 IP, not loopback/0.0.0.0, so `wget localhost` and
# the healthcheck both got connection-refused). Override it explicitly.
ENV HOSTNAME="0.0.0.0"
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=builder /repo/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/dashboard/.next/static ./apps/dashboard/.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "apps/dashboard/server.js"]
