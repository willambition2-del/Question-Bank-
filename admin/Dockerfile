# 1. Base stage
FROM node:22.17.1-alpine AS base
WORKDIR /app
# Install tini and curl
RUN apk add --no-cache tini curl libc6-compat

# 2. Dependencies stage
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# 3. Build stage
FROM base AS builder
# Allow build-time variables
ARG NEXT_PUBLIC_API_URL
ARG BACKEND_INTERNAL_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 4. Production stage (Standalone)
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Set Next.js runtime environment variables (for server components)
ARG NEXT_PUBLIC_API_URL
ARG BACKEND_INTERNAL_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV BACKEND_INTERNAL_URL=${BACKEND_INTERNAL_URL}

# Create necessary directories
RUN mkdir -p .next

# Copy standalone output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

# Healthcheck targeting login page
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/login || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]