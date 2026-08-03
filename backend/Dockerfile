# 1. Base stage
FROM node:22.17.1-alpine AS base
WORKDIR /app
# Install OpenSSL for Prisma and tini for process management
RUN apk add --no-cache openssl tini libc6-compat

# 2. Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
# Clean install dependencies
RUN npm ci

# 3. Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma Client
RUN npx prisma generate
# Build NestJS App
RUN npm run build

# 4. Production stage
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Use non-root user
USER node

EXPOSE 3000

# Healthcheck targeting actual endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health/live || exit 1

# Entrypoint using tini to handle PID 1 signals
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/src/main.js"]