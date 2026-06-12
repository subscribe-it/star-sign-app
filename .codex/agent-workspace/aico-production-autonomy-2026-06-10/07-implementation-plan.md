# Implementation plan

## Plan

1. Zmienic `apps/api/scripts/aico-post-seed-preflight.js`.
2. Dodac helper wymaganych providerow na podstawie bazowego AICO i `AICO_SOCIAL_CHANNELS`.
3. Poprawic `evaluateProviderReadinessMatrix`.
4. Poprawic `evaluateProviderMode`.
5. Dodac read-only `runSocialConnectionPreflight`.
6. Wywolac social preflight przed provider readiness matrix w full autonomy albo przy jawnej fladze.
7. Zaktualizowac env examples/Portainer o `AICO_SOCIAL_CONNECTION_PREFLIGHT`.
8. Rozszerzyc `apps/api/src/bootstrap/aico-post-seed-preflight.test.ts`.
9. Uruchomic walidacje Nx.

## Uwagi

Nie ruszac realnych tokenow ani nie wykonywac publikacji social. Test polaczenia moze wykonac tylko read-only API checks.

## Zrealizowane rozszerzenia P0

- `ads-agent.activate()` korzysta z `ads-budget-ledger` przed adapterem providera i zwalnia/zamyka ledger po wyniku adaptera.
- `orchestrator.publishTicket()` wykonuje `autonomy-policy.evaluate({ action: 'content.publish' })` przed mutacja wpisu docelowego.
- `apps/api/config/env-validation.ts` waliduje runtime AICO full autonomy flags i sekrety w `NODE_ENV=production`.
- Dodano `AICO_CONTROLLED_LIVE_ENABLED` do env examples, Portainer stack i `ops/production-env-check.sh`.
- `ads-agent.pause()` przechodzi przez `ads-provider-adapter.pauseCampaign()`, zapisuje `ads-budget-ledger.recordPause()` i nie ustawia lokalnie `paused`, gdy provider zwraca blokade.
- Ujednolicono identyfikator kreacji reklamowej na polu Strapi `provider_ad_id`.
- `ads-agent.pauseActiveForKillSwitch()` wykonuje stop-loss sweep dla planow `ready`/`active`, uzywajac tej samej sciezki `pause()`.
- `orchestrator.tick()` przy potwierdzonym `global_kill_switch` albo `autonomy_mode=off` uruchamia ads stop-loss sweep, a dopiero potem konczy tick bez generation/publication/social.
- Dodano manualny endpoint admina `POST /ads/campaign-plans/stop-loss`, chroniony `pauseAds`, wymagajacy potwierdzenia `PAUSE_ACTIVE_ADS`.
- Panel admina ma typed API i kontrolke `Pause active ads`, ktora wywoluje manualny stop-loss i odswieza Growth Ops.

## Plan rozszerzenia: controlled ads provider probe

1. Poprawic `provider-probe`, aby `meta_ads` i `google_ads` w trybie `AICO_ADS_PROVIDER_MODE=controlled` oraz przy `AICO_CONTROLLED_LIVE_ENABLED=true` zapisywaly `ready` jako bezpieczny no-spend preflight.
2. Zachowac `liveEffects=false`, `liveSpendEnabled=false` i `controlledExternalMutation=false` w wyniku/metadanych.
3. Nie oznaczac `live` ani `sandbox` jako ready bez osobnego smoke/adapters.
4. Rozszerzyc `provider-status.upsert()` o metadane kontrolowanego preflightu bez sekretow.
5. Dodac regresje provider-probe oraz readiness pokazujaca, ze realny zapis provider-status z probe moze przepuscic kontrolowany profil produkcyjny.

## Plan rozszerzenia: AICO preflight in release gate

1. Nauczyc `apps/api/scripts/aico-post-seed-preflight.js` opcjonalnego ladowania env file z `AICO_PREFLIGHT_ENV_FILE` albo `COMPOSE_ENV_FILE`.
2. Dodac test parsera/env loadera, zeby nie nadpisywac juz ustawionych sekretow procesu i nie zwracac wartosci sekretow.
3. Dodac `RUN_AICO_POST_SEED_PREFLIGHT` do `ops/predeploy-check.sh`, domyslnie `auto` dla staging/production przez istniejacy mechanizm `should_run_required_check`.
4. Wpiac `api:aico-post-seed-preflight` po domain audits, z tym samym `COMPOSE_ENV_FILE`, ktory widza production env guard i compose config.
5. Zaktualizowac root `ops:predeploy:staging` oraz runbooki produkcyjne.

## Plan rozszerzenia: niezalezny AICO release gate i aktualne runbooki

1. Rozdzielic `RUN_AICO_POST_SEED_PREFLIGHT` od `RUN_DOMAIN_AUDITS`, zeby jawne wlaczenie AICO gate nie bylo przypadkiem pomijane.
2. Zaktualizowac `AUDIT_RUNBOOK.md`, bo reczny strict audit nie jest juz wystarczajaca definicja produkcyjnego GO.
3. Zaktualizowac `DEPLOY_CHECKLIST.md` o `production-readiness`, provider readiness, controlled no-spend profile, stop-loss i controlled run-now.
4. Uruchomic shell syntax, post-seed helper tests, AICO unit/verify i API typecheck.

## Plan rozszerzenia: cwd-independent AICO post-seed preflight

1. Zmienic `aico-post-seed-preflight.js`, aby Strapi `appDir` byl wyliczany wzgledem lokalizacji skryptu (`apps/api`), a nie `process.cwd()`.
2. Wyeksportowac helper `getAppDir()` do testow.
3. Dodac regresje, ktora zmienia `process.cwd()` i potwierdza, ze `getAppDir()` nadal wskazuje `apps/api`.
4. Uruchomic `node --check`, test helperow post-seed, AICO unit/verify, API typecheck, shell syntax i `git diff --check`.

## Plan rozszerzenia: cwd-independent seed-core

1. Zmienic `apps/api/scripts/seed-core.js`, aby `compileStrapi` otrzymywal `appDir` wyliczony wzgledem lokalizacji skryptu (`apps/api`), a nie `process.cwd()`.
2. Wyeksportowac `getAppDir()` z `seed-core.js`, zeby kontrakt byl testowalny bez bootowania pelnego Strapi.
3. Dodac regresje w `apps/api/src/bootstrap/seed-core.test.ts`, ktora zmienia `process.cwd()` na katalog tymczasowy i potwierdza, ze `getAppDir()` nadal wskazuje absolutne `apps/api`.
4. Uruchomic skladnie skryptu, targetowany test seed-core, regresje post-seed preflight, API typecheck, shell syntax i `git diff --check`.

## Plan rozszerzenia: release DB audits env loading

1. Dodac `apps/api/scripts/release-env.js` jako wspolny helper dla skryptow release/audit:
   - `getAppDir()` i `getWorkspaceDir()` script-relative,
   - `AICO_AUDIT_ENV_FILE`/`COMPOSE_ENV_FILE`,
   - root `.env` i `apps/api/.env`,
   - brak nadpisywania istniejacych envow.
2. Przepiac `aico-contract-audit.js`, `premium-content-audit.js` i `premium-content-backfill.js` na `loadReleaseEnvFiles()`.
3. Przepiac `audit-sqlite.js`, aby relatywny `DATABASE_FILENAME` byl liczony od `apps/api`, nie od `process.cwd()`.
4. Poprawic `aico-post-seed-preflight.js`, aby relatywny `AICO_PREFLIGHT_ENV_FILE`/`COMPOSE_ENV_FILE` byl liczony od root workspace.
5. Dodac `apps/api/src/bootstrap/release-env.test.ts` oraz rozszerzyc test preflight o regresje cwd/env/no-secret-values.
6. Uruchomic `node --check`, targetowane testy API, API typecheck, shell syntax i `git diff --check`.

## Plan rozszerzenia: runtime AICO contract path

1. Zmienic `server/src/utils/aico-contract.ts`, aby kandydaci kontraktu byli najpierw liczeni wzgledem `__dirname`, dla source i dist.
2. Wyeksportowac `resolveAicoContentContractPath()` do testu runtime.
3. Dodac regresje w `runtime.test.ts`, ktora zmienia `process.cwd()` i nadal odczytuje `socialTeaser`.
4. Uruchomic AICO unit, backend TS, verify, API typecheck i `git diff --check`.

## Plan rozszerzenia: media-generator temp dir path

1. Dodac w `media-generator.ts` helpery `getMediaPublicDirCandidates()` i `resolveMediaPublicDir()`.
2. Zmienic temp upload dir z `process.cwd()/public/uploads/tmp` na `resolveMediaPublicDir()/uploads/tmp`.
3. Dodac test z mockowanym Replicate, Axios, Strapi Upload i zmienionym `process.cwd()`.
4. Uruchomic AICO unit, backend TS, verify, build, API typecheck i `git diff --check`.

## Plan rozszerzenia: media.generate effect guard

1. Dodac w `media-generator.ts` guard `assertMediaGenerationAllowed()` wywolywany przed `new Replicate()`.
2. Sprawdzac `autonomy-policy` i `provider-status` dla akcji `media.generate`.
3. Dodac `resolveImageGenToken()` z fallbackiem `AICO_IMAGE_GEN_TOKEN` przed `REPLICATE_API_TOKEN`.
4. Rozszerzyc test `media-generator.test.ts` o blokade policy, blokade provider readiness i fallback tokena.
5. Uruchomic targeted test, pelny unit pluginu, backend TS, verify, API typecheck, build i `git diff --check`.
