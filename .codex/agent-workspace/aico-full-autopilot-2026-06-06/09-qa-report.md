# QA report

## Co przetestowano

- Policy evaluator blokuje akcje przy globalnym kill switchu.
- Ads agent respektuje globalny limit 25 PLN/day.
- Autopilot dry-run zwraca deterministyczne kroki bez tworzenia live jobow i planow reklam.
- Plugin AICO przechodzi unit tests, backend typecheck, frontend typecheck i verify.
- API przechodzi testy oraz typecheck.

## Wyniki

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 59 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 137 tests.
- `rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.

## Multi-agent safety gate update - 2026-06-07

Rownolegla runda agentow PO, Architect, Security i QA wskazala wspolny priorytet: przed live providerami potrzebny jest Growth Autopilot Safety Gate. W tej rundzie zaadresowano najwazniejsze P0/P1 z raportow:

- `orchestrator.tick()` respektuje teraz `autonomy-policy`: `global_kill_switch=true` albo `autonomy_mode=off` zatrzymuje stary cron strategii, generacji, publikacji i social publish.
- `autonomy-policy.evaluate()` egzekwuje deklarowane limity dla `llm.generate`, `media.generate`, `video.generate` i `content.publish`.
- Nowe mutacje admin API zapisza audit event: generation retry/cancel, video create job, ads create/activate/pause, traffic import, experiment choose winner.
- Testy rozszerzono o globalny kill switch dla starego orchestratora, matrix limitow autonomii oraz redacted audit event dla tworzenia planu reklamowego.

## Wyniki po safety gate update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 62 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 140 tests.
- `rtk npm exec nx run api:typecheck --outputStyle=static`: PASS, cached.

## Provider readiness and controlled live gate update - 2026-06-07

Po kontynuacji roadmapy domknieto kolejny blok P0/P1 bez live provider calls:

- `autonomy/status` zwraca matrix `providerReadiness` dla OpenRouter, Replicate/OpenAI, social, ads i GA4.
- `autopilot.dryRunTick()` blokuje kroki wymagajace providerow, jesli provider nie ma statusu `ready + has_credentials`.
- Realny `social-publisher.publishTicket()` sprawdza `autonomy-policy.evaluate('social.publish')` i `provider-status.checkProviders()` przed `publishToProvider`.
- `generation-jobs.create()` i `video-agent.createJob()` respektuja `idempotencyKey`.
- `ads-agent.createPlan()` blokuje niepoprawny budzet, nie-HTTPS target URL i target URL poza allowlista domen.
- Admin permissions i admin API client znaja nowe domeny Growth Ops.
- Production env check wymaga strict audit/runtime safety flag przy AICO workflows/full autonomy.

## Wyniki po provider readiness update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 67 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 145 tests.
- `rtk npm exec nx run api:typecheck --outputStyle=static`: PASS, cached.
- `rtk git diff --check`: PASS.

## Strict audit and runtime social gate update - 2026-06-07

Domknieto kolejne P0 z security review:

- Provider readiness wymaga teraz statusu `ready`, credentiali, wymaganych scope'ow i swiezego `last_tested_at`.
- `AICO_PROVIDER_READINESS_MAX_AGE_HOURS` steruje TTL gotowosci providerow.
- `aico-post-seed-preflight` ma blokujacy strict audit gate: przy `AICO_STRICT_AUDIT_REQUIRED=true` przechodzi tylko strict audit z decyzja `GO`.
- `production-env-check.sh` wymaga strict audit/runtime safety flag dla full autonomy.
- Realny social publish path blokuje provider call przy policy/provider readiness block.

## Wyniki po strict audit update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 67 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 147 tests.
- `rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.

## Adapter sandbox, Growth Ops UI and production preflight update - 2026-06-07

Domknieto kolejny blok P0/P1 wskazany przez agentow QA/Security:

- `ads-provider-adapter` i `video-provider-adapter` maja tryby `disabled | sandbox | live`.
- `sandbox` daje deterministyczne identyfikatory i jawne `liveSpendEnabled=false` / `liveRenderEnabled=false`.
- `live` jest nadal blokowany jako `provider_adapter_live_not_implemented`, zeby kod nie udawal produkcyjnych mutacji.
- `ads-agent.activate()` i `video-agent.render()` przechodza przez adapter i zapisza provider mode/decision w stanie planu lub metadata assetu.
- `autopilot.dryRunTick()` sprawdza social readiness tylko dla providerow wynikajacych z `AICO_SOCIAL_CHANNELS`, wiec profil FB/IG/X nie wymaga TikToka i YouTube.
- Realny social publish fail-closed przy `AICO_FULL_AUTONOMY_REQUIRED=true`, jesli service `provider-status` nie jest dostepny.
- `social/test-connection` zapisuje wynik probe'u FB/IG/X/TikTok/YT do centralnego `provider-status.upsert()`.
- Admin `Growth Ops` konsumuje teraz `autonomy/status`, generation jobs, video assets, ads plans, experiments i provider status.
- `aico-post-seed-preflight` sprawdza provider readiness matrix, ads/video provider modes i redaguje potencjalne sekrety w `recentRuns.error_message`.
- Testy dodano dla TTL/scope readiness, mapowania ads providerow, service-level disabled/live ads/video, social policy deny, fail-closed readiness oraz preflight provider/mode checks.

## Wyniki po adapter/preflight/UI update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 78 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 161 tests.
- `NX_SKIP_NX_CACHE=true rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `rtk sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `rtk git diff --check`: PASS.
- `rtk env PRODUCTION_ENV_FILE=.env.example npm run ops:env`: expected FAIL, 48 issue(s), kontrolowany negatywny test placeholderow/sekretow.

## Central provider probe update - 2026-06-07

Domknieto kolejny fragment provider readiness:

- Dodano `provider-probe` service z kontraktem `testProvider()` / `testProviders()`.
- Dodano admin endpoint `POST /providers/test-readiness`.
- Dodano admin API client i przycisk `Provider preflight` w Growth Ops.
- Probe zapisuje statusy do `provider-status.upsert()` bez sekretow w odpowiedzi.
- OpenRouter, Replicate i OpenAI maja opcjonalny read-only connectivity probe przez HTTP, wlaczany jawnie przez `includeConnectivity=true`.
- Pozostali providerzy maja credential/preflight status bez live efektow; ads/video/GA4 nie sa falszywie oznaczane jako production ready bez dedykowanego smoke.
- Dodano puste env slots dla TikTok, YouTube, Meta Ads, Google Ads i GA4 property credentials w `.env.example`, `apps/api/.env.example` i Portainer stacku.

## Wyniki po central provider probe update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 80 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 163 tests.
- `NX_SKIP_NX_CACHE=true rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.

## Production readiness GO/NO-GO gate update - 2026-06-07

Domknieto wymaganie jasnego PROD GO/NO-GO jako kod, nie tylko dokumentacje:

- Dodano `production-readiness` service.
- Dodano admin endpointy `GET/POST /autonomy/production-readiness`.
- Growth Ops pokazuje teraz kafel `PROD readiness` i sekcje `PROD GO / NO-GO` z checkerami, blockerami i warningami.
- `aico-post-seed-preflight` uzywa tego samego raportu przez check `autonomy.production-readiness`.
- Raport agreguje: `AICO_FULL_AUTONOMY_REQUIRED`, `autonomy_policy`, kill switch, safety flags, provider readiness, strict audit env, optional strict audit GO, runtime locks/social safety flags, ads/video provider modes i controlled live gate.
- Decyzja jest fail-closed: live effects pozostaja `false`, a obecne live ads/video adapter modes daja `NO_GO`, dopoki nie ma prawdziwych adapterow i controlled smoke.

## Wyniki po production readiness update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 82 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 166 tests.
- `node --check apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `rtk sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `NX_SKIP_NX_CACHE=true rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.

## GA4 read-only traffic importer and RBAC hardening update - 2026-06-07

Domknieto kolejny krok z roadmapy `traffic_analysis` i provider readiness:

- `traffic-ingestor.importGa4()` wykonuje read-only GA4 Data API `runReport` dla `pagePath`, `screenPageViews`, `sessions`, `eventCount`, `conversions` i `totalRevenue`.
- Import obsluguje `AICO_GA4_ACCESS_TOKEN`, `GA4_SERVICE_ACCOUNT_JSON` albo `GOOGLE_APPLICATION_CREDENTIALS`, ale nie zapisuje tokenow/JWT/private key w snapshotach, auditach ani odpowiedziach.
- Udany import GA4 aktualizuje centralny `provider-status` dla `ga4` jako `ready` ze scope `analytics.readonly`.
- Bledy GA4 aktualizuja `provider-status` jako `missing_credentials` albo `failed` bez wycieku sekretow.
- `traffic-snapshot` dostaje idempotentny `unique_key=ga4:<propertyId>:<day>`, `top_content`, `metadata.provider` i `operation=dry_run|created|updated`.
- Admin `POST /traffic/import` obsluguje `source=ga4`, a Growth Ops ma przycisk `Importuj GA4`.
- `ops/production-env-check.sh` wymaga `GA4_PROPERTY_ID` i jednej metody credentiali GA4, gdy `AICO_FULL_AUTONOMY_REQUIRED=true`.
- Security sidecar wskazal i domknieto RBAC: `POST /traffic/import` wymaga `import-traffic`, a `POST /providers/test-readiness` wymaga `test-provider-readiness`; `viewTraffic` i `viewProviderStatus` zostaja tylko dla GET.
- `providers.test-readiness` i `traffic.import` zapisza audit eventy takze dla operacji probe/failure.
- Utwardzono walidacje `GA4_PROPERTY_ID` jako liczbowego ID i `day` jako `YYYY-MM-DD`; OAuth service-account uzywa stalego `https://oauth2.googleapis.com/token` jako audience/endpoint.
- Provider-probe, env gate i importer maja spojny kontrakt credentiali GA4.

## Wyniki po GA4 read-only importer update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 93 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `node --check apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `rtk sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 177 tests.
- `NX_SKIP_NX_CACHE=true rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `git diff --check`: PASS.

## Replicate-compatible controlled video render update - 2026-06-07

Domknieto kolejny krok z roadmapy `short video pipeline`:

- `video-provider-adapter` ma tryb `replicate`, ktory tworzy async Replicate HTTP prediction przez `POST /v1/predictions`.
- Adapter wymaga `AICO_CONTROLLED_LIVE_ENABLED=true`, `AICO_VIDEO_GEN_MODEL` oraz `AICO_VIDEO_GEN_TOKEN` albo `REPLICATE_API_TOKEN`.
- Usunieto fallback video renderu na `AICO_IMAGE_GEN_TOKEN`.
- Adapter wymusza async job-id-only: zapisuje lokalnie `provider=replicate`, `provider_job_id`, status `rendering` i minimalne nietajne metadata; nie zapisuje `prediction.urls`, outputu, modelu ani tokenow.
- `video-agent.render()` failuje zamkniecie dla trybu `replicate`, jesli nie ma `provider-status.checkProviders({ action: 'video.generate' })` albo provider readiness nie jest ready.
- `provider-status` dla `replicate` jest aktualizowany po kontrolowanym utworzeniu prediction jako `ready` ze scope `predictions.write`; bledy trafiaja jako `missing_credentials`, `blocked` albo `failed`.
- Dodano osobny RBAC `render-video` dla `POST /video/assets/:id/render`; zwykle `manage-video` nie wystarcza do kosztownego provider render call.
- `ops/production-env-check.sh` wymaga `AICO_VIDEO_PROVIDER_MODE=replicate` przy full autonomy oraz modelu/tokena, gdy tryb replicate jest wlaczony.
- Security sidecar wymusil dodatkowy hardening: controlled-live gate, strict provider readiness, token separation, async only i minimal metadata.

## Wyniki po Replicate video render update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 98 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 182 tests.
- `NX_SKIP_NX_CACHE=true rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `git diff --check`: PASS.

## Controlled Ads Preflight and Safety Hardening update - 2026-06-07

Domknieto kolejny fragment roadmapy `capped live ads`, ale bez wlaczania realnych mutacji Meta/Google:

- `ads-provider-adapter` ma teraz tryb `controlled`, obok `disabled`, `sandbox` i zablokowanego `live`.
- Tryb `controlled` wymaga `AICO_CONTROLLED_LIVE_ENABLED=true`, przechodzi przez `provider-status.checkProviders({ action: 'ads.mutate' })` i zwraca planowane provider IDs bez live spend oraz bez external mutation.
- `ads-agent.createPlan()` blokuje niebezpieczne URL-e: brak HTTPS, userinfo, host poza allowlista, sciezke poza allowlistowanymi prefiksami, fragment URL oraz tokenopodobne query keys.
- `ads-agent.createPlan()` skanuje `creativePayload` pod zakazane claimy oraz `targetingPayload` pod targetowanie wrazliwe.
- `ads-agent.activate()` w trybach `controlled`/`live` failuje zamkniecie bez provider readiness i target URL preflightu.
- `ad-campaign-plan` i `provider-credential-status` ukryto przed bezposrednia edycja w Content Managerze.
- Dodano osobne RBAC: `activate-ads` i `pause-ads`.
- `ops/production-env-check.sh` przy full autonomy wymaga `AICO_ADS_PROVIDER_MODE=controlled` oraz `AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED=true`.
- `production-readiness` rozpoznaje `controlled` ads jako preflight bez live spend; realny `live` nadal pozostaje `NO_GO`.

## Wyniki po Controlled Ads Preflight update - 2026-06-07

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 103 tests.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:test:ts:front --outputStyle=static`: PASS.
- `rtk sh -n ops/production-env-check.sh ops/predeploy-check.sh ops/smoke.sh ops/security-headers-check.sh apps/api/scripts/aico-post-seed-preflight.js`: PASS.
- `rtk npm exec nx run ai-content-orchestrator:verify --outputStyle=static`: PASS.
- `rtk npm exec nx run api:test --outputStyle=static`: PASS, 187 tests.
- `NX_SKIP_NX_CACHE=true rtk npm exec nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec nx run api:build --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.
- `rtk env PRODUCTION_ENV_FILE=.env.example npm run ops:env`: expected FAIL, 48 issue(s), placeholdery/sekrety zablokowane przez env gate.

## Czego nie testowano

- Live provider calls do Meta, Google Ads, TikTok, YouTube, OpenAI, Replicate.
- Produkcyjny seed i post-seed preflight.
- Render admin UI w przegladarce przez Playwright; wykonano TypeScript/build panelu Strapi.
- Live provider calls, strict audit na realnym srodowisku, provider scopes i controlled smoke na zewnetrznych platformach.
- Realne ads sandbox/live mutation i video render/upload.
- Realny GA4 Data API call na produkcyjnych sekretach; lokalnie pokryto mockowany `fetch`.
- Realny Replicate video prediction na produkcyjnych sekretach; lokalnie pokryto mockowany `fetch`.
- Realne tworzenie, pauzowanie albo synchronizacja kampanii Meta/Google Ads po stronie providera.
- Atomowy provider-side spend ledger oraz provider-side emergency pause/kill dla aktywnych kampanii reklamowych.

## Polish summary

Fundament full autopilot jest testowalny i zielony lokalnie. Po multi-agent review domknieto safety gate, provider readiness gate, strict audit release gate, sandbox/live-disabled adapter modes, operatorski Growth Ops control plane, centralny provider probe endpoint, formalny production readiness GO/NO-GO gate, realny read-only GA4 traffic importer, kontrolowany Replicate-compatible video render adapter oraz kontrolowany ads preflight bez live spend. Social test-connection aktualizuje centralny provider readiness, centralny probe potrafi zapisywac credential/read-only connectivity status, GA4 import moze zapisac prawdziwy traffic snapshot bez live publish/spend, video render moze utworzyc async provider job bez publikacji social, a ads controlled mode moze przygotowac provider-plan bez zewnetrznej mutacji. System ma teraz mocne, widoczne NO-GO dla live ads/social bez realnych adapterow, sekretow, scope'ow, provider-side pause/ledger i smoke testow. Realne publikowanie wideo/social, reklamy live i pelny PROD GO nadal wymagaja provider integrations oraz kontrolowanych live preflightow na srodowisku ze sprawdzonymi sekretami.
