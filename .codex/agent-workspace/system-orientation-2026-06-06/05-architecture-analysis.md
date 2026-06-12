# System Architect Agent

## Monorepo

Projekty Nx:

- `frontend` - aplikacja Angular SSR, `frontend/src`, targety: build, serve, serve-static, test, lint, typecheck.
- `api` - Strapi 5 w `apps/api`, targety: build, serve, test, typecheck, seedy, audyty premium/AICO i komendy Strapi.
- `frontend-e2e` - Playwright E2E, zalezy od `frontend`.
- `@org/types` - wspolne typy TypeScript.
- `cart` - biblioteka koszyka w `libs/frontend/cart`.
- `ai-content-orchestrator` - plugin Strapi w `apps/api/src/plugins/ai-content-orchestrator`.

## Frontend

- Routing w `frontend/src/app/app.routes.ts`, z lazy-loaded standalone components.
- `App` w `frontend/src/app/app.ts` odpowiada za maintenance, app settings, cart, checkout i shell.
- Build produkcyjny to Angular SSR z `outputMode: server`, service workerem i hidden source maps.
- Runtime config i feature flags sa w core services oraz envach runtime.

## Backend

- Strapi 5 z content type'ami: analytics-event, app-setting, article, category, daily-tarot-draw, horoscope, newsletter-subscription, numerology-profile, order, order-item, product, tarot-card, user-profile, user-reading, zodiac-sign.
- Dodatkowe publiczne/operacyjne endpointy: health, account, checkout, contact, newsletter, stripe, tarot-card orchestrator.
- Middleware: rate limit, HTTP cache, public permissions, security/body limits.

## Operacje

- Lokalny Docker Compose: Postgres, Redis, Bugsink, API, frontend SSR, Caddy, opcjonalnie Mailpit i Stripe CLI.
- Produkcyjnie dokumentacja wskazuje Portainer Swarm + Traefik + GHCR obrazy `star-sign-api` i `star-sign-frontend`.
- Media produkcyjne ida przez Cloudflare R2.
- Backup i restore Postgresa sa oskryptowane w `ops/`.

## Ryzyka architektoniczne

- Working tree jest zabrudzony, wiec przed release trzeba oddzielic zakresy zmian.
- Produkcja historycznie miala P0 blokery: audit API, audyty domenowe na bazie, AICO preflight, staging smoke i clean checkout.
- Redis URL ma kilka konsumentow: rate limit, HTTP cache i podstawowy Redis; trzeba pilnowac single source of truth.
- Sekrety musza zostac poza repo i poza workspace'ami agentow.

## Polish summary

Architektura jest modularna i sensowna dla MVP/soft launch: Angular SSR + Strapi + Nx + Playwright + skrypty ops. Glowna trudnosc nie lezy w braku struktury, tylko w bramkach produkcyjnych, feature flagach i integracjach premium/AICO.
