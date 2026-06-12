# Test plan

## Unit tests

- `evaluateProviderMode`:
  - `controlled` dla Ads daje pass bez live spend.
  - `replicate` dla Video daje pass jako controlled external render.
  - `live` pozostaje fail.
- `evaluateProviderReadinessMatrix`:
  - full autonomy ignoruje opcjonalne blocked providerzy spoza required set.
  - required blocked provider nadal daje fail.
- Social preflight helper:
  - raportuje read-only status bez raw provider payloadow.
- Final production readiness:
  - post-seed preflight wlacza strict audit w readiness, gdy wymagany jest strict audit albo full autonomy.
  - w pelni zielony kontrolowany profil (`ads=controlled`, `video=replicate`, providerzy ready, strict audit GO) zwraca `production-readiness=GO`.
  - adminowy `autonomy.productionReadiness` domyslnie wlacza strict audit przy `AICO_FULL_AUTONOMY_REQUIRED=true`.
  - `production-readiness=GO` wymaga `AICO_ADMIN_RUN_NOW_ENABLED=true` w full autonomy.
- Public homepage API:
  - `site-alive.listPublic()` filtruje publiczne rekomendacje po statusie oraz oknie `starts_at`/`expires_at`.
  - DTO nadal nie populatuje relacji operacyjnych i zachowuje limit publiczny 24.
- Controlled admin run-now:
  - bez potwierdzenia pozostaje dry-run i nie wywoluje readiness ani `orchestrator.tick()`.
  - z `live=true`/`mode=controlled_live`, `confirmation=RUN_AICO_CONTROLLED_TICK`, env gate i readiness GO wywoluje `orchestrator.tick()`.
  - readiness inne niz GO blokuje live run-now przed tickiem i zapisuje audit skip.
  - panel admina wystawia input potwierdzenia i przycisk controlled run-now tylko przez typed API client.
- Ads pause hardening:
  - controlled pause przechodzi przez adapter providera, zapisuje ledger pauzy i utrzymuje identyfikatory `provider_campaign_id`, `provider_adset_id`, `provider_ad_id`.
  - live pause bez realnego adaptera nie ustawia falszywego `paused`, tylko zapisuje blokade i failed pause ledger.
  - activation zapisuje identyfikator kreacji do schematowego pola `provider_ad_id`.
- Kill-switch ads stop-loss:
  - `orchestrator.tick()` przy `global_kill_switch=true` nie uruchamia strategy/generation/publication/social i wywoluje `ads-agent.pauseActiveForKillSwitch({ reason: 'global_kill_switch' })`.
  - sweep pauzuje plany `ready`/`active` przez provider-confirmed `pause()`, zapisuje ledger pauzy i raportuje liczby attempted/paused/blocked/failed.
  - awaria policy nadal blokuje tick fail-closed, ale nie wykonuje agresywnego sweepa bez potwierdzonego kill switcha.
- Manual admin ads stop-loss:
  - `POST /ads/campaign-plans/stop-loss` wymaga RBAC `pauseAds`.
  - backend wymaga potwierdzenia `PAUSE_ACTIVE_ADS`, inaczej nie wywoluje sweepa i zapisuje audit skip.
  - poprawne potwierdzenie wywoluje `pauseActiveForKillSwitch({ reason: 'manual_admin_stop_loss' })` i audytuje attempted/paused/blocked/failed.
  - Admin UI ma typed API, input potwierdzenia i przycisk `Pause active ads`.

## Nx / TypeScript

- `npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`
- `npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`
- `npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`
- `npm exec nx run ai-content-orchestrator:verify --outputStyle=static`
- `npm exec nx run api:test --outputStyle=static`
- `NX_SKIP_NX_CACHE=true npm exec nx run api:typecheck --outputStyle=static`
- `npm exec nx run api:build --outputStyle=static`

## Ops checks

- `node --check apps/api/scripts/aico-post-seed-preflight.js`
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`
- `git diff --check`

## Nietestowane bez sekretow

- Realne FB/IG/X connection checks na produkcyjnych tokenach.
- Realny Replicate prediction create.
- Realny GA4 Data API import.
- Pelne production GO na docelowym srodowisku.

## Wykonane testy

- `node --check apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `npm exec nx run api:test -- src/bootstrap/aico-post-seed-preflight.test.ts`: PASS, 15 tests.
- `npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 109 tests.
- `npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec nx run api:test -- src/config/env-validation.test.ts`: PASS, 7 tests.
- `npm exec nx run api:test --outputStyle=static`: PASS, 199 tests.
- `npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `NX_SKIP_NX_CACHE=true npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec nx run ai-content-orchestrator:build --outputStyle=static`: PASS.
- `npm exec nx run api:build --outputStyle=static`: PASS.
- `git diff --check`: PASS.

## Dodatkowe wykonane testy po UI controlled run-now

- `npm exec -- nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 109 tests.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 199 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `npm exec -- nx run ai-content-orchestrator:build --outputStyle=static`: PASS.
- `npm exec -- nx run api:build --outputStyle=static`: PASS.
- `git diff --check`: PASS.

Uwaga: `api:build` wypisuje ostrzezenia Strapi "Config file not loaded" dla wygenerowanych `*.d.ts` w config, ale build konczy sie sukcesem.

## Dodatkowe wykonane testy po ads pause hardening

- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 111 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 201 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:build --outputStyle=static`: PASS.
- `npm exec -- nx run api:build --outputStyle=static`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `git diff --check`: PASS.

Uwaga: `api:build` nadal wypisuje ostrzezenia Strapi "Config file not loaded" dla wygenerowanych `*.d.ts` w config, ale build konczy sie sukcesem.

## Dodatkowe wykonane testy po kill-switch ads stop-loss sweep

- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 112 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 202 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `git diff --check`: PASS.
- `npm exec -- nx run ai-content-orchestrator:build --outputStyle=static`: PASS.
- `npm exec -- nx run api:build --outputStyle=static`: PASS.

Uwaga: `api:build` nadal wypisuje ostrzezenia Strapi "Config file not loaded" dla wygenerowanych `*.d.ts` w config, ale build konczy sie sukcesem.

## Dodatkowe wykonane testy po manual admin ads stop-loss

- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 113 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 203 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:build --outputStyle=static`: PASS.
- `npm exec -- nx run api:build --outputStyle=static`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `git diff --check`: PASS.

Uwaga: `api:build` nadal wypisuje ostrzezenia Strapi "Config file not loaded" dla wygenerowanych `*.d.ts` w config, ale build konczy sie sukcesem.

## Plan testow: controlled ads provider probe

- Unit: provider-probe ma zwracac `ready` dla `meta_ads`/`google_ads` tylko w trybie `controlled` z wlaczonym `AICO_CONTROLLED_LIVE_ENABLED` i kompletem credential env.
- Unit: provider-probe ma pozostac fail-closed w `live`/`sandbox` bez dedykowanego smoke.
- Integracja serwisow: realny zapis `provider-status.upsert()` utworzony przez provider-probe ma pozwolic `production-readiness` przejsc `providers.required-ready` i finalnie `GO` dla zielonego controlled profilu.
- Walidacje po zmianie: AICO unit, backend TS, API test, typecheck, verify, buildy, shell syntax i `git diff --check`.

## Dodatkowe wykonane testy po controlled ads provider probe

- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 115 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 205 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:build --outputStyle=static`: PASS.
- `npm exec -- nx run api:build --outputStyle=static`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `git diff --check`: PASS.

Uwaga: `api:build` nadal wypisuje ostrzezenia Strapi "Config file not loaded" dla wygenerowanych `*.d.ts` w config, ale build konczy sie sukcesem.

## Dodatkowe wykonane testy po AICO preflight release gate

- `node --check apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `npm exec -- nx run api:test -- src/bootstrap/aico-post-seed-preflight.test.ts`: PASS, 17 tests.
- `sh -n ops/predeploy-check.sh ops/production-env-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 207 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 115 tests.
- `npm exec -- nx run api:build --outputStyle=static`: PASS.
- `git diff --check`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:build --outputStyle=static`: PASS.

Uwaga: `api:build` nadal wypisuje ostrzezenia Strapi "Config file not loaded" dla wygenerowanych `*.d.ts` w config, ale build konczy sie sukcesem.

## Dodatkowe wykonane testy po niezaleznym AICO release gate

- `sh -n ops/predeploy-check.sh ops/production-env-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `git diff --check`: PASS.
- `node --check apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `npm exec -- nx run api:test -- src/bootstrap/aico-post-seed-preflight.test.ts`: PASS, 17 tests.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 115 tests.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.

Nie uruchamiano pelnego `RUN_AICO_POST_SEED_PREFLIGHT=true` na lokalnym `.env.example`, bo ta bramka wymaga realnego env file i DB target-env. To jest celowa granica walidacji lokalnej.

## Dodatkowe wykonane testy po cwd-independent AICO preflight

- `node --check apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `npm exec -- nx run api:test -- src/bootstrap/aico-post-seed-preflight.test.ts`: PASS, 18 tests.
- `git diff --check`: PASS.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 115 tests.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `sh -n ops/predeploy-check.sh ops/production-env-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.

## Plan testow: cwd-independent seed-core

- Unit/regresja: `getAppDir()` w `seed-core.js` ma zwracac absolutny katalog `apps/api` niezaleznie od `process.cwd()`.
- Node syntax: `seed-core.js` ma pozostac poprawnym CommonJS.
- Regresja release gate: post-seed preflight cwd test nadal ma przechodzic, zeby oba production scripts mialy ten sam kontrakt.
- Typecheck/shell: zmiana w skrypcie seed nie moze popsuc API typecheck ani shellowych gate'ow ops.

## Dodatkowe wykonane testy po cwd-independent seed-core

- `node --check apps/api/scripts/seed-core.js`: PASS.
- `npm exec -- nx run api:test -- src/bootstrap/seed-core.test.ts`: PASS, 5 tests.
- `git diff --check`: PASS.
- `npm exec -- nx run api:test -- src/bootstrap/aico-post-seed-preflight.test.ts`: PASS, 18 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `sh -n ops/predeploy-check.sh ops/production-env-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.

## Plan testow: release DB audits env loading

- Unit: wspolny helper env ma zwracac kandydatow env file niezaleznie od `process.cwd()`.
- Unit: helper ma ladowac jawny `AICO_AUDIT_ENV_FILE`/`COMPOSE_ENV_FILE` przed domyslnymi plikami i nie nadpisywac istniejacych envow procesu.
- Unit/regresja: `aico-post-seed-preflight.loadEnvFile()` ma liczyc wzgledny env file od root workspace, nawet po zmianie `process.cwd()`.
- Syntax: `aico-post-seed-preflight.js`, `aico-contract-audit.js`, `premium-content-audit.js` i helper maja przejsc `node --check`.
- Nx: targetowane testy helpera oraz shell syntax predeploy.

## Dodatkowe wykonane testy po release DB audits env loading

- `node --check apps/api/scripts/release-env.js && node --check apps/api/scripts/aico-post-seed-preflight.js && node --check apps/api/scripts/audit-sqlite.js && node --check apps/api/scripts/aico-contract-audit.js && node --check apps/api/scripts/premium-content-audit.js && node --check apps/api/scripts/premium-content-backfill.js`: PASS.
- `npm exec -- nx run api:test -- src/bootstrap/release-env.test.ts`: PASS, 4 tests.
- `npm exec -- nx run api:test -- src/bootstrap/release-env.test.ts src/bootstrap/seed-core.test.ts src/bootstrap/aico-post-seed-preflight.test.ts`: PASS, 28 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `sh -n ops/predeploy-check.sh ops/production-env-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.

## Plan testow: runtime AICO contract path

- Unit: runtime test zmienia `process.cwd()` na katalog tymczasowy i potwierdza, ze `resolveAicoContentContractPath()` wskazuje `apps/api/src/bootstrap/aico-content-contract.json`.
- Unit: po zmianie `cwd` `getAicoPromptTemplate('socialTeaser')` nadal zwraca prompt z kontraktu.
- TS/verify: backend pluginu i Strapi plugin verify musza przejsc po eksporcie nowych helperow.

## Dodatkowe wykonane testy po runtime AICO contract path

- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 116 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.

## Plan testow: media-generator temp dir path

- Unit: helper public dir zwraca `apps/api/public` niezaleznie od `process.cwd()`.
- Unit: `generateAndUpload()` zapisuje temp file pod `apps/api/public/uploads/tmp`, przekazuje te sciezke do upload service i usuwa plik po upload.
- Mocki: Replicate i Axios bez realnych zewnetrznych requestow; Strapi Upload i entityService jako lokalne mocki.

## Dodatkowe wykonane testy po media-generator temp dir path

- `npm exec -- nx run ai-content-orchestrator:test:unit -- --run server/src/__tests__/media-generator.test.ts`: PASS, 1 test.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 117 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.

## Plan testow: media.generate effect guard

- Unit: happy path wywoluje `autonomy-policy.evaluate()` i `provider-status.checkProviders()` przed Replicate.
- Unit: odmowa policy blokuje Replicate/Axios i nie pyta provider readiness.
- Unit: blocked Replicate readiness blokuje Replicate/Axios.
- Unit: `resolveImageGenToken()` preferuje jawny input, potem `AICO_IMAGE_GEN_TOKEN`, potem `REPLICATE_API_TOKEN`.

## Dodatkowe wykonane testy po media.generate effect guard

- `npm exec -- nx run ai-content-orchestrator:test:unit -- --run server/src/__tests__/media-generator.test.ts`: PASS, 4 tests.
- `npm exec -- nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 120 tests.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.

## Plan testow: production env parity i missing-token guard

- Unit: runtime `validateProductionEnv()` musi odrzucac `AICO_ALLOW_MISSING_TOKEN=true` w production.
- Env contract: `apps/api/.env.example`, Portainer stack, shell guard i runtime validation musza znac te sama flage.
- Statyczny env guard: `.env.production.generated` ma byc sprawdzany bez ujawniania wartosci sekretow.
- Ops docs: Portainer README ma opisywac AICO full-autonomy release gate jako blokujacy kontrakt, nie jako reczny post-deploy audit.

## Dodatkowe wykonane testy po production env parity

- `PRODUCTION_ENV_FILE=.env.production.generated sh ops/production-env-check.sh`: FAIL expected, 20 issue(s), tylko nazwy kluczy i typy brakow; bez wartosci sekretow.
- Porownanie nazw kluczy `.env.example` -> `.env.production.generated`: FAIL expected, wygenerowany env jest starszy od obecnego kontraktu AICO.
- `npm exec -- nx run api:test --outputStyle=static -- src/config/env-validation.test.ts`: PASS, 8 tests.
- `NX_SKIP_NX_CACHE=true npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `docker compose -f ops/portainer/star-sign-production-stack.yml --env-file .env.production.generated config --quiet`: PASS.
- `git diff --check`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 220 tests.
- `npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 120 tests.
- `npm exec -- nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.

Nie uruchamiano `api:aico-post-seed-preflight` na `.env.production.generated`, bo statyczny env guard juz blokuje release przed bootem Strapi i bezpieczniej nie dotykac target DB/providerow przy znanych brakach.

## Dodatkowe wykonane testy po lokalnym release-candidate gate

- `npm audit --omit=dev --audit-level=high`: PASS, 0 vulnerabilities.
- `npm --prefix apps/api audit --omit=dev --audit-level=high`: PASS gate high. Audit nadal drukuje nizsze advisories, ale nie blokuja produkcyjnego high gate.
- `npm run ops:predeploy:local`: PASS. Wykonane m.in. npm ci dry-run root/API, `nx sync check`, production npm audit high gate root/API, docker compose config, workspace typecheck, workspace lint, API tests, cart tests, AICO plugin checks, API production build i `git diff --check`.
- `npm exec -- nx run-many -t lint --projects=frontend,api,cart,@org/types,frontend-e2e,ai-content-orchestrator --outputStyle=static`: PASS.
- `npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`: PASS, 58 files, 346 tests. Coverage: statements 85.6%, branches 82.02%, functions 79.67%, lines 86.64%.
- `npm exec -- nx run frontend:build:production --outputStyle=static`: PASS.
- `npm exec -- nx run frontend-e2e:e2e --outputStyle=static`: PASS, 76 tests.
- `docker compose -f ops/portainer/star-sign-production-stack.yml --env-file .env.production.generated config --quiet`: PASS.
- `git diff --check`: PASS.
- `PRODUCTION_ENV_FILE=.env.production.generated sh ops/production-env-check.sh`: FAIL expected, 20 issue(s), bez ujawniania wartosci sekretow.

## Aktualne lokalne blokery produkcyjnego GO po RC gate

- `.env.production.generated` nadal nie przechodzi env guarda: brakuje m.in. `AICO_AUDIT_IP_HASH_SALT`, strict audit flags, controlled live flags, ads/video provider mode, GA4 property/credentials oraz social provider credentials.
- Nie wykonano realnego target-env `api:aico-post-seed-preflight`, bo statyczny env guard blokuje release przed dotykaniem DB/providerow.
- Nie wykonano realnego OpenRouter/Replicate/GA4/social smoke, bo sekret przekazany w czacie nie moze byc zapisywany ani uzywany poza kontrolowanym env/secret managerem.

## Dodatkowe wykonane testy po OpenRouter smoke i ads env guard hardening

- `node --check apps/api/scripts/aico-openrouter-smoke.js && sh -n ops/production-env-check.sh ops/predeploy-check.sh`: PASS.
- `npm exec -- nx run api:test --outputStyle=static -- src/config/env-validation.test.ts`: PASS, 9 tests.
- `AICO_SMOKE_ENV_FILE=.env.production.generated npm exec -- nx run api:aico-openrouter-smoke --outputStyle=static`: PASS, realny request OpenRouter, model `openai/gpt-4.1-mini`, total_tokens=40, bez logowania sekretu.
- `PRODUCTION_ENV_FILE=.env.production.generated sh ops/production-env-check.sh`: FAIL expected, 20 issue(s), juz tylko realne sekrety/credential IDs/provider env, bez brakow controlled-live flag/mode.
- `npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `npm exec -- nx run api:test --outputStyle=static`: PASS, 19 files, 221 tests.
- `npm run ops:predeploy:local`: PASS.
- `git diff --check`: PASS.

## Aktualne blokery po OpenRouter smoke

- `AICO_AUDIT_IP_HASH_SALT`.
- GA4: `GA4_PROPERTY_ID` oraz jeden z `AICO_GA4_ACCESS_TOKEN`, `GA4_SERVICE_ACCOUNT_JSON`, `GOOGLE_APPLICATION_CREDENTIALS`.
- Replicate/video: `AICO_VIDEO_GEN_MODEL` oraz `AICO_VIDEO_GEN_TOKEN` albo `REPLICATE_API_TOKEN`.
- Controlled ads: `AICO_META_ADS_ACCESS_TOKEN`, `AICO_META_AD_ACCOUNT_ID`, `AICO_GOOGLE_ADS_DEVELOPER_TOKEN`, `AICO_GOOGLE_ADS_CLIENT_ID`, `AICO_GOOGLE_ADS_CLIENT_SECRET`, `AICO_GOOGLE_ADS_REFRESH_TOKEN`, `AICO_GOOGLE_ADS_CUSTOMER_ID`.
- Social publish: Facebook page/token, Instagram user/token, X API/access credentials.
