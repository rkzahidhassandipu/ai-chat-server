# =========================
# 1. Dependencies stage
# =========================
FROM node:22-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./

RUN npm ci


# =========================
# 2. Builder stage
# =========================
FROM node:22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate

RUN npm run build


# =========================
# 3. Production stage
# =========================
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

RUN npx prisma generate

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]