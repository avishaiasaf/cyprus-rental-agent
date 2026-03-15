# ---- Stage 1: Build ----
FROM node:20-bookworm AS builder

WORKDIR /app

# System deps required by Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libwayland-client0 \
    fonts-liberation fonts-noto-color-emoji curl \
    && rm -rf /var/lib/apt/lists/*

# Install all deps (including devDependencies for tsc)
COPY package.json package-lock.json ./
RUN npm ci

# Install patchright's patched Chromium (anti-bot stealth browser)
RUN npx patchright install chromium

# Build TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# Remove devDependencies
RUN npm prune --omit=dev

# ---- Stage 2: Production ----
FROM node:20-bookworm-slim

WORKDIR /app

# Runtime system deps for Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libatspi2.0-0 libxcomposite1 \
    libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libwayland-client0 \
    fonts-liberation fonts-noto-color-emoji curl \
    && rm -rf /var/lib/apt/lists/*

# Copy patchright's browser from builder (uses same cache path as playwright)
COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

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
