# Near Me Backend - Production Dockerfile

# 1) Dependencies stage (installs all deps for build)
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 2) Build stage (compiles TypeScript and copies static assets via postbuild)
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
# Build (tsc) and copy dashboard assets via postbuild defined in package.json
RUN npm run build

# 3) Production dependencies only
FROM node:18-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# 4) Runtime image
FROM node:18-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Install minimal tools for healthcheck + pid1 handling
RUN apk add --no-cache dumb-init curl

# Copy production node_modules and built app
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Provide an example env for reference in the container
COPY .env.production.example ./.env.example

# Use non-root user for security
USER node

EXPOSE 3000

# Healthcheck uses the built-in health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/api/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
