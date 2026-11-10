---
name: star-sign-orientation
description: Szybka orientacja w monorepo Star Sign (Angular SSR + Strapi 5 + Nx) - struktura, komendy, konwencje i pułapki. Użyj przed jakąkolwiek pracą w tym repozytorium.
whenToUse: Przed eksploracją, planowaniem lub implementacją czegokolwiek w repo star-sign.
---

# Star Sign — orientacja w repozytorium

Platforma astrologiczna (horoskopy, tarot, numerologia, blog, premium, sklep WIP).
Headless: Angular SSR z przodu, Strapi 5 z tyłu, monorepo **Nx 22.7** (npm workspaces).

## Struktura

| Ścieżka | Rola |
|---|---|
| `frontend/` | Angular 21 SSR (standalone, signals), design „Lumina Silk"; features w `src/app/features`, usługi/guardy w `src/app/core` |
| `apps/api/` | Strapi v5; content-typy w `src/api/*`, skrypty seedów w `scripts/` |
| `libs/frontend/cart` / `libs/shared/types` | koszyk; współdzielone typy TS |
| `frontend-e2e/` | Playwright (mock API + prod build) |
| `.serena/memories/` | pamięć projektu (czytaj przed decyzjami!) |
| `docs/` | audyty, launch-handoff, operacje |

## Komendy

```bash
npm start                 # frontend + api (nx run-many -t serve)
npm run client            # tylko frontend
npm run api               # tylko Strapi
npx nx test frontend      # Vitest
npx nx e2e frontend-e2e   # Playwright
npm exec nx run api:seed-dev   # seed + konta testowe demo@starsign.local / premium@starsign.local (Test1234!)
npm run ops:predeploy:local    # bramki pre-deploy (lint/typecheck/test/build/env/audit)
npm run ops:smoke              # smoke po deployu
```

## Konwencje i proces

- Proces wieloagentowy wg `AGENTS.md`: workspace zadania w `.codex/agent-workspace/<slug>/`, wnioski po polsku.
- MCP Serena obowiązkowa do nawigacji semantycznej i pamięci projektu, gdy dostępna.
- Zadania przez Nx (`pnpm/npx nx ...`), nie bezpośrednio przez narzędzia.
- Testy cel >90% coverage; QA evidence-based (najpierw kryteria, potem implementacja).

## Pułapki

- **Brak `node_modules` w root** → najpierw `npm install`, inaczej każde `nx ...` padnie („Could not find Nx modules").
- README mówi „Angular 19", ale faktycznie jest **Angular 21.2** (package.json).
- Sklep domyślnie ukryty: `SHOP_ENABLED=false` / `FRONTEND_SHOP_ENABLED=false`.
- Sekrety w `.env*` — nie commitować, rotacja przed produkcją; deploy: push na `main` → GH Actions → GHCR → Portainer webhooks.
- Treści (horoskopy, karta dnia, artykuły) tworzy zewnętrzny `marketing-os` przez REST API (token API Strapi: create/update/publish na articles, horoscopes, daily-tarot-draws, upload). Star Sign nie ma własnego generatora treści.

## Kontekst biznesowy (skrót)

Persony: Zofia (22-30, mobile-first, estetyka), Marta (30-42, SEO/newsletter), Klaudia (25-38, głębia merytoryczna, premium).
Cele: SEO 50k sesji/mies., newsletter 5k, monetyzacja 6-12 mies. Domeny: `star-sign.pl` / `api.star-sign.pl`.
