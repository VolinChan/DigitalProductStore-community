# Dependencies stage
FROM node:22-alpine AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./

# Install dependencies
RUN \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then \
    for attempt in 1 2 3; do \
      npm ci --no-audit --no-fund && break; \
      if [ "$attempt" -eq 3 ]; then exit 1; fi; \
      rm -rf node_modules; \
      sleep $((attempt * 5)); \
    done; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm install --frozen-lockfile; \
  else npm install; \
  fi

# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set Next.js to output standalone
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* env vars must be present at build time so they are inlined
# into the client bundle. Callers pass the correct API URL via build args
# (see docker-compose.yml).
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_CATALOG_EDITOR_ENABLED=true
ARG NEXT_PUBLIC_CATALOG_STOREFRONT_ENABLED=true
ARG NEXT_PUBLIC_GRAFANA_URL=https://grafana.plexoria.cl
ARG NEXT_PUBLIC_SYSTEM_MONITORING_LINK_ENABLED=false
ARG NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED=false
ENV NEXT_PUBLIC_CATALOG_EDITOR_ENABLED=$NEXT_PUBLIC_CATALOG_EDITOR_ENABLED
ENV NEXT_PUBLIC_CATALOG_STOREFRONT_ENABLED=$NEXT_PUBLIC_CATALOG_STOREFRONT_ENABLED
ENV NEXT_PUBLIC_GRAFANA_URL=$NEXT_PUBLIC_GRAFANA_URL
ENV NEXT_PUBLIC_SYSTEM_MONITORING_LINK_ENABLED=$NEXT_PUBLIC_SYSTEM_MONITORING_LINK_ENABLED
ENV NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED=$NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED
ARG NEXT_PUBLIC_TRANSFER_BANK_NAME=
ARG NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME=
ARG NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER=
ARG NEXT_PUBLIC_MEDIA_MAX_PER_PRODUCT=100
ARG NEXT_PUBLIC_MEDIA_UPLOAD_CONCURRENCY=3
ENV NEXT_PUBLIC_TRANSFER_BANK_NAME=$NEXT_PUBLIC_TRANSFER_BANK_NAME
ENV NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME=$NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME
ENV NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER=$NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER
ENV NEXT_PUBLIC_MEDIA_MAX_PER_PRODUCT=$NEXT_PUBLIC_MEDIA_MAX_PER_PRODUCT
ENV NEXT_PUBLIC_MEDIA_UPLOAD_CONCURRENCY=$NEXT_PUBLIC_MEDIA_UPLOAD_CONCURRENCY

# Build the application
RUN npm run build

# Runtime stage
FROM node:22-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check. Use 127.0.0.1 (not localhost) because Next.js binds to
# 0.0.0.0 on IPv4 only — inside the container `localhost` may resolve to
# ::1 and fail with "Connection refused" even while the app is healthy.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

# Run the application
CMD ["node", "server.js"]
