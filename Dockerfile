# ---- Stage 1: Build ----
FROM mcr.microsoft.com/playwright:v1.58.2-noble AS builder

WORKDIR /app

# Install all deps (including devDependencies for tsc)
COPY package.json package-lock.json ./
RUN npm ci

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Remove devDependencies
RUN npm prune --omit=dev

# ---- Stage 2: Production ----
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Copy built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

# Create data directories
RUN mkdir -p ./data/images

# Health check
HEALTHCHECK --interval=60s --timeout=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
