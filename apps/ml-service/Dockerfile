# ML Service Dockerfile - Machine Learning API Service
# Multi-stage build supporting both Python and Node.js components

# Build stage for Node.js components
FROM node:18-alpine AS node-builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat python3 make g++

# Copy root package files for monorepo
COPY package.json package-lock.json* ./
COPY turbo.json ./

# Copy workspace packages
COPY apps/ml-service/package.json ./apps/ml-service/
COPY packages/ ./packages/

# Install Node.js dependencies
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy source code
COPY apps/ml-service/ ./apps/ml-service/
COPY tsconfig.json ./

# Build the Node.js application
RUN npm run build --filter=@portfolio/ml-service

# Production stage with Python support
FROM python:3.11-alpine AS runner

# Install Node.js for hybrid service
RUN apk add --no-cache nodejs npm curl

# Create app user for security
RUN addgroup --system --gid 1001 mlgroup
RUN adduser --system --uid 1001 mluser

# Set working directory
WORKDIR /app

# Install Python dependencies first (for better layer caching)
COPY apps/ml-service/requirements.txt* ./
RUN if [ -f requirements.txt ]; then \
      pip install --no-cache-dir -r requirements.txt; \
    fi

# Copy built Node.js application from builder stage
COPY --from=node-builder --chown=mluser:mlgroup /app/apps/ml-service/dist ./dist/
COPY --from=node-builder --chown=mluser:mlgroup /app/apps/ml-service/package.json ./
COPY --from=node-builder --chown=mluser:mlgroup /app/node_modules ./node_modules/
COPY --from=node-builder --chown=mluser:mlgroup /app/packages ./packages/

# Copy Python source files if they exist
COPY --chown=mluser:mlgroup apps/ml-service/python/ ./python/ 2>/dev/null || true
COPY --chown=mluser:mlgroup apps/ml-service/models/ ./models/ 2>/dev/null || true

# Switch to non-root user
USER mluser

# Expose port
EXPOSE 3000
ENV PORT=3000

# Set environment variables
ENV NODE_ENV=production
ENV PYTHONPATH=/app/python
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=15s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the ML service (Node.js wrapper with Python ML components)
CMD ["node", "dist/server.js"]