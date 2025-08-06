# Frontend Service Dockerfile - Next.js/React Application
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies for native modules
RUN apk add --no-cache libc6-compat

# Copy root package files for monorepo
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace packages
COPY apps/frontend/package.json ./apps/frontend/
COPY packages/ ./packages/

# Install dependencies
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Copy source code
COPY apps/frontend/ ./apps/frontend/
COPY tsconfig.json ./

# Build the application
RUN npm run build --filter=@portfolio/frontend

# Production stage
FROM node:18-alpine AS runner

# Create app user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set working directory
WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy built application from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "apps/frontend/server.js"]