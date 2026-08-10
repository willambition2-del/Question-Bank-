FROM node:22.17.1-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /home/node/.cache/tesseract \
  && chown -R node:node /home/node/.cache

FROM base AS dependencies
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM dependencies AS build
COPY . .
RUN npm run build

FROM dependencies AS migration
COPY prisma ./prisma
COPY prisma.config.ts ./prisma.config.ts
CMD ["node", "node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM base AS production-dependencies
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
USER node
EXPOSE 3000
CMD ["node", "dist/src/main.js"]