# API image. Build from the repo root (npm workspaces):
#   docker build -f apps/api/Dockerfile .
# On Railway, set RAILWAY_DOCKERFILE_PATH=apps/api/Dockerfile on the API service.
FROM node:22-bookworm-slim

# Prisma's query engine needs OpenSSL.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install only the API + shared workspaces. Every workspace manifest must be present for `npm ci` to accept the lockfile.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w @omni/api -w @omni/shared --include-workspace-root --ignore-scripts --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @omni/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @omni/api

ENV NODE_ENV=production
EXPOSE 4000
# Apply pending migrations, then start. Safe with a single instance; PORT comes from the host.
CMD ["sh", "-c", "npx prisma migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/main.js"]
