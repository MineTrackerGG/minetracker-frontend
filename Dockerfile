FROM oven/bun:1 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps-dev
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM base AS deps-prod
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS builder
ENV NODE_ENV=development
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .
RUN bun run build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bun.lock ./bun.lock
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["bun", "run", "start"]
