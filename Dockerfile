FROM node:20-alpine AS base
WORKDIR /app

FROM base AS dev
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm install
COPY . .
RUN npx prisma generate
EXPOSE 3000

FROM base AS builder
RUN apk add --no-cache libc6-compat
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build && npm run worker:build

FROM base AS production
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Prisma engine binaries and CLI are not bundled into .next/standalone automatically
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
# Run migrations before starting — prisma migrate deploy is idempotent
CMD ["sh", "-c", "node node_modules/prisma/build/index.js migrate deploy && node server.js"]

FROM base AS worker-production
RUN apk add --no-cache libc6-compat
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/worker/dist ./worker/dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma
CMD ["node", "worker/dist/worker/index.js"]
