FROM node:20-bookworm-slim AS builder

WORKDIR /app
ENV CI=true

COPY package*.json ./
COPY libs/shared/types/package.json libs/shared/types/package.json
COPY apps/api/src/plugins/ai-content-orchestrator/package.json apps/api/src/plugins/ai-content-orchestrator/package.json
RUN npm ci

COPY apps/api/package*.json apps/api/
RUN cd apps/api && npm ci

COPY . .
RUN npm exec nx run ai-content-orchestrator:build
RUN npm exec nx run api:build
RUN npm exec nx run frontend:build
RUN cd apps/api && npm prune --omit=dev

FROM node:20-bookworm-slim AS api-runtime

WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1337

# Apply Debian security updates to the base layer (clears reachable OS CVEs,
# e.g. libgnutls30 / libcap2 advisories that the upstream node image lags on).
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# Refresh the globally-bundled npm CLI. The npm shipped in the base image vendors
# its own (older) tar/glob/minimatch/cross-spawn copies that the scanner flags;
# this version vendors patched ones. npm is only used by the `npm run start`
# entrypoint, never on the request path, but keeping it current removes the noise.
RUN npm install -g npm@11.17.0 \
  && npm cache clean --force

COPY --from=builder --chown=node:node /app/apps/api /app/apps/api

# Remove only vite's bundled esbuild binary. vite's bundler is build-time only
# (the admin is pre-built in the builder stage); `strapi start` never runs it, and
# Strapi's runtime TS-config loader (esbuild-register) resolves the hoisted,
# patched top-level esbuild instead. This drops the Go-stdlib CVE carried by the
# older esbuild that vite pins, while keeping every module the CLI loads at start.
RUN rm -rf \
    node_modules/vite/node_modules/esbuild \
    node_modules/vite/node_modules/@esbuild

USER node
EXPOSE 1337
CMD ["npm", "run", "start"]

FROM node:20-bookworm-slim AS frontend-runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Apply Debian security updates to the base layer (same upstream node image as
# the API stage; clears the reachable OS CVEs, e.g. libgnutls30 / libcap2).
RUN apt-get update \
  && apt-get upgrade -y --no-install-recommends \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

# The Angular SSR server runs via `node` directly (see CMD); the bundled npm CLI
# is never used here, so remove it along with the CVEs its vendored deps carry.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

COPY --from=builder --chown=node:node /app/dist/frontend /app/dist/frontend

USER node
EXPOSE 4000
CMD ["node", "dist/frontend/server/server.mjs"]
