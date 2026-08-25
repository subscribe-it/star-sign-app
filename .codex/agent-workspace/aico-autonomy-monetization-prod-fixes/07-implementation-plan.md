# Plan implementacji — 2026-08-25

## Status

| # | Zadanie | Status |
|---|---|---|
| 1 | Grafiki znaków (12× webp konstelacyjne) w `apps/api/public/uploads` | ✅ `gen-zodiac.mjs` |
| 2 | `seed-media.ts`: `ZODIAC_PROFILE_SEED_ASSETS` + upload + media-asset + label per purpose; opcjonalne pomijanie | ✅ testy 366 ✅ |
| 3 | Testy regresyjne seeda znaków (upload+map+link, silent-skip) | ✅ |
| 4 | `frontend/src/server.ts`: SSR `allowedHosts` (env FRONTEND_URL/domeny/SSR_ALLOWED_HOSTS) + `trustProxyHeaders` | ✅ zweryfikowane lokalnie |
| 5 | Stack: `SSR_ALLOWED_HOSTS` passthrough | ✅ |
| 6 | `ops/smoke.sh`: asercja ≥10/12 zdjęć znaków + SSR route-content | ✅ (łapie prod bug!) |
| 7 | AdSense-ready sloty reklamowe (env-gated, fallback placeholder) | ⏳ ten round |
| 8 | Runbook pełnej autonomii AICO (`docs/aico-full-autonomy-runbook.md`) | ⏳ ten round |
| 9 | Lint+typecheck frontend/api, e2e smoke lokalnie | ⏳ |
| 10 | Commit na branch + PR | ⏳ |

## Kolejność dalszych kroków
7 → 8 → 9 → dokumenty QA (09) → commit/PR.
