# ================================
# Dependencies
# ================================
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

RUN npm ci


# ================================
# Builder
# ================================
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ---------- Build Arguments ----------
ARG DATABASE_URL

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG SUPABASE_SERVICE_ROLE_KEY

ARG PI_API_URL
ARG PI_API_KEY
ARG PI_HORIZON_URL
ARG PI_NETWORK_PASSPHRASE
ARG PI_WALLET_PRIVATE_SEED

ARG NEXT_PUBLIC_APP_URL

# ---------- Build Environment ----------
ENV DATABASE_URL=${DATABASE_URL}

ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}

ENV PI_API_URL=${PI_API_URL}
ENV PI_API_KEY=${PI_API_KEY}
ENV PI_HORIZON_URL=${PI_HORIZON_URL}
ENV PI_NETWORK_PASSPHRASE=${PI_NETWORK_PASSPHRASE}
ENV PI_WALLET_PRIVATE_SEED=${PI_WALLET_PRIVATE_SEED}

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build


# ================================
# Runner
# ================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nodejs
RUN adduser -S nextjs -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

RUN mkdir -p /app/.next/cache && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]