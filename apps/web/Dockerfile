# Web image. Build from the repo root (npm workspaces):
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=https://api.example/api/v1 .
# On Railway, set RAILWAY_DOCKERFILE_PATH=apps/web/Dockerfile on the web service.
FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w web -w @omni/shared --include-workspace-root --no-audit --no-fund

COPY packages/shared packages/shared
COPY apps/web apps/web

# NEXT_PUBLIC_* values are baked into the bundle at build time (Railway passes service variables declared as ARG).
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_REALTIME_URL
# With NEXT_PUBLIC_API_URL=/api/v1, API_ORIGIN is where /api/v1 is forwarded (see next.config.ts).
ARG API_ORIGIN
# Leave unset in public deployments: when set, the login page shows one-click demo accounts.
ARG NEXT_PUBLIC_DEMO_PASSWORD
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_REALTIME_URL=$NEXT_PUBLIC_REALTIME_URL \
    API_ORIGIN=$API_ORIGIN \
    NEXT_PUBLIC_DEMO_PASSWORD=$NEXT_PUBLIC_DEMO_PASSWORD \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @omni/shared && npm run build -w web

ENV NODE_ENV=production
EXPOSE 3000
# `next start` listens on $PORT, which the host provides.
CMD ["npm", "run", "start", "-w", "web"]
