# Frontend Dockerfile - Next.js with standalone output

FROM node:20-alpine AS base

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package file
COPY apps/frontend/package.json ./

# Install dependencies with npm (avoids pnpm workspace/symlink issues)
RUN npm install

# Builder stage
FROM base AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY apps/frontend ./

# Build arguments for NEXT_PUBLIC_ variables (these get baked into the build)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_AUTH0_AUDIENCE
ARG NEXT_PUBLIC_CHATWOOT_BASE_URL=https://chatwoot.ventia-latam.com
ARG NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID=3
ARG NEXT_PUBLIC_WHATSAPP_APP_ID
ARG NEXT_PUBLIC_WHATSAPP_CONFIGURATION_ID
ARG NEXT_PUBLIC_WHATSAPP_API_VERSION=v22.0
ARG NEXT_PUBLIC_MESSAGING_WS_URL

# Set environment variables for the build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=$NEXT_PUBLIC_AUTH0_AUDIENCE
ENV NEXT_PUBLIC_CHATWOOT_BASE_URL=$NEXT_PUBLIC_CHATWOOT_BASE_URL
ENV NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID=$NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID
ENV NEXT_PUBLIC_WHATSAPP_APP_ID=$NEXT_PUBLIC_WHATSAPP_APP_ID
ENV NEXT_PUBLIC_WHATSAPP_CONFIGURATION_ID=$NEXT_PUBLIC_WHATSAPP_CONFIGURATION_ID
ENV NEXT_PUBLIC_WHATSAPP_API_VERSION=$NEXT_PUBLIC_WHATSAPP_API_VERSION
ENV NEXT_PUBLIC_MESSAGING_WS_URL=$NEXT_PUBLIC_MESSAGING_WS_URL

# Build Next.js app with standalone output
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Change ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
