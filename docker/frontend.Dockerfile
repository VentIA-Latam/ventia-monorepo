# Frontend Dockerfile - Next.js 16 with standalone output

FROM node:20-alpine AS base

# Install pnpm
RUN npm install -g pnpm

# Dependencies stage
FROM base AS deps
WORKDIR /app

# Copy package files
COPY apps/frontend/package.json ./
COPY pnpm-workspace.yaml ../

# Install dependencies
RUN pnpm install --frozen-lockfile

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

# Set environment variables for the build
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN
ENV NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID
ENV NEXT_PUBLIC_AUTH0_AUDIENCE=$NEXT_PUBLIC_AUTH0_AUDIENCE
ENV NEXT_PUBLIC_CHATWOOT_BASE_URL=$NEXT_PUBLIC_CHATWOOT_BASE_URL
ENV NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID=$NEXT_PUBLIC_CHATWOOT_ACCOUNT_ID

# Build Next.js app with standalone output
RUN pnpm build

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
