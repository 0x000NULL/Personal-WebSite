# Backend API Service Dockerfile - Node.js API Server
# Multi-stage build for optimized production image

# Build stage
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy root package files for monorepo
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace packages
COPY apps/backend-api/package.json ./apps/backend-api/
COPY packages/ ./packages/

# Install all dependencies (including devDependencies for build)
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy source code
COPY apps/backend-api/ ./apps/backend-api/
COPY tsconfig.json ./

# Build the application
RUN npm run build --filter=@portfolio/backend-api

# Production stage
FROM node:18-alpine AS runner

# Create app user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 apiuser

# Set working directory
WORKDIR /app

# Install curl for health checks
RUN apk add --no-cache curl

# Set environment variables
ENV NODE_ENV=production

# Copy built application from builder stage
COPY --from=builder --chown=apiuser:nodejs /app/apps/backend-api/dist ./dist/
COPY --from=builder --chown=apiuser:nodejs /app/apps/backend-api/package.json ./
COPY --from=builder --chown=apiuser:nodejs /app/node_modules ./node_modules/
COPY --from=builder --chown=apiuser:nodejs /app/packages ./packages/

# Switch to non-root user
USER apiuser

# Expose port
EXPOSE 3000
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]