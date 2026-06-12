# Final summary

## Zaimplementowano

- Nowe content-type'y AICO: `autonomy-policy`, `generation-job`, `video-asset`, `traffic-snapshot`, `ad-campaign-plan`, `growth-experiment`, `provider-credential-status`.
- Rozszerzenia typow i schema: nowe workflow types, nowe media purposes, YouTube Shorts w social channel contract, video/experiment/UTM w social tickets, metryki ads/performance.
- Nowe serwisy: `autonomy-policy`, `autopilot`, `generation-jobs`, `traffic-ingestor`, `video-agent`, `ads-agent`, `experiment-agent`, `provider-status`.
- Nowe admin API: autonomy status/policy/tick, generation jobs retry/cancel, traffic snapshots/import, video assets/jobs, ads campaign plans/activate/pause, experiments, provider status.
- Testy safety layer: kill switch, ads budget cap 25 PLN/day, dry-run tick without live effects.

## Multi-agent safety gate update - 2026-06-07

- Uruchomiono rownolegly przeglad PO, Architect, Security i QA.
- Wspolny wniosek agentow: najblizszy sprint to Growth Autopilot Safety Gate / Provider Preflight + Controlled Live Gate, a nie kolejne live adaptery.
- `orchestrator.tick()` respektuje teraz `autonomy-policy`: `global_kill_switch` i `autonomy_mode=off` zatrzymuja stary cron strategii, generacji, publikacji i social publish.
- `autonomy-policy.evaluate()` egzekwuje dzienne limity LLM, media, video i auto-publish.
- Nowe mutacje admin API zapisza audit eventy: generation retry/cancel, video create job, ads create/activate/pause, traffic import i experiment choose winner.
- Testy rozszerzono do 62 testow pluginu i 140 testow API.

## Provider readiness update - 2026-06-07

- `provider-status` dostarcza matrix gotowosci dla wszystkich providerow AICO bez ekspozycji sekretow.
- `autonomy/status` zwraca `providerReadiness`, a dry-run autopilota blokuje kroki zalezne od brakujacych/failed providerow.
- Realny `social-publisher.publishTicket()` sprawdza globalna polityke autonomii i provider readiness przed `publishToProvider`.
- `generation-jobs` i `video-agent` sa idempotentne po `idempotencyKey`.
- `ads-agent` waliduje dodatni budzet, HTTPS target URL i allowliste domen przed policy evaluation/persistem.
- Admin permissions, admin workflow types i admin API client zostaly rozszerzone o domeny Growth Ops.
- Production env check zostal utwardzony o audit strict, audit hash salt, runtime locks i social content safety flags.

## Strict audit release gate update - 2026-06-07

- Provider readiness wymaga teraz wymaganych scope'ow i swiezego `last_tested_at`, nie tylko recznego statusu `ready`.
- Dodano `AICO_PROVIDER_READINESS_MAX_AGE_HOURS`.
- `aico-post-seed-preflight` blokuje full autonomy przy `AICO_STRICT_AUDIT_REQUIRED=true`, jesli pluginowy strict audit nie zwroci decyzji `GO`.
- API test suite wzroslo do 147 testow i pozostaje zielone.

## Adapter sandbox/control-plane update - 2026-06-07

- Dodano `ads-provider-adapter` i `video-provider-adapter` z trybami `disabled | sandbox | live`.
- `sandbox` jest deterministyczny i jawnie bez live spend/render; `live` pozostaje blokowany jako `provider_adapter_live_not_implemented`.
- `ads-agent.activate()` i `video-agent.render()` zapisuja provider mode/decision i nie wykonuja zewnetrznych live efektow.
- `autopilot.dryRunTick()` mapuje social readiness do providerow z `AICO_SOCIAL_CHANNELS`, wiec FB/IG/X nie wymaga gotowosci TikToka/YouTube.
- Social publish fail-closed przy `AICO_FULL_AUTONOMY_REQUIRED=true`, jesli provider readiness service nie jest dostepny.
- `social/test-connection` zapisuje wyniki probe'ow do centralnego `provider-status`, wiec readiness dla social ma realny call-site.
- Admin `Growth Ops` pokazuje autonomy policy/counts, provider readiness, dry-run preview, generation jobs, video assets, ads plans, experiments i provider records.
- `aico-post-seed-preflight` sprawdza provider readiness matrix, ads/video modes i redaguje potencjalne sekrety z ostatnich runow.
- Test suite wzroslo do 78 testow pluginu i 161 testow API.

## Central provider probe update - 2026-06-07

- Dodano `provider-probe` service i admin endpoint `POST /providers/test-readiness`.
- Growth Ops ma przycisk `Provider preflight`, ktory uruchamia lokalny credential probe bez live efektow.
- Probe zapisuje wynik do centralnego `provider-status`, bez zwracania tokenow/sekretow.
- OpenRouter, Replicate i OpenAI maja opcjonalne read-only connectivity probe po jawnym `includeConnectivity=true`.
- TikTok, YouTube, Meta Ads, Google Ads i GA4 maja jawne env slots oraz status credential/preflight, ale nie sa oznaczane jako live-ready bez dedykowanego smoke.
- Test suite wzroslo do 80 testow pluginu i 163 testow API.

## Production readiness GO/NO-GO update - 2026-06-07

- Dodano `production-readiness` service jako formalna bramke `GO | GO_WITH_WARNINGS | NO_GO`.
- Dodano admin endpointy `GET/POST /autonomy/production-readiness`.
- Growth Ops pokazuje kafel `PROD readiness` oraz sekcje `PROD GO / NO-GO` z checkerami, blockerami, warningami, liczba providerow i stanem live effects.
- `aico-post-seed-preflight` uzywa tego samego raportu przez check `autonomy.production-readiness`.
- Bramka agreguje `AICO_FULL_AUTONOMY_REQUIRED`, tryb `autonomy-policy`, kill switch, safety flags, cap reklam 25 PLN/day, provider readiness, strict audit flags, runtime locks, social safety, ads/video modes i controlled live gate.
- Obecny stan jest celowo fail-closed: `liveEffectsAllowed=false`, a live ads/video pozostaja `NO_GO`, dopoki nie ma prawdziwych adapterow i kontrolowanego smoke na srodowisku docelowym.
- Test suite wzroslo do 82 testow pluginu i 166 testow API.

## GA4 read-only traffic import update - 2026-06-07

- Dodano realny read-only GA4 Data API importer w `traffic-ingestor.importGa4()`.
- Import pobiera `runReport` dla `pagePath`, `screenPageViews`, `sessions`, `eventCount`, `conversions` i `totalRevenue`.
- Snapshoty GA4 sa idempotentne po `unique_key=ga4:<propertyId>:<day>` i zapisuja `top_content`, metryki oraz `operation=dry_run|created|updated`.
- Udany import aktualizuje `provider-status` dla `ga4` jako `ready` ze scope `analytics.readonly`; bledy zapisza `missing_credentials` albo `failed`.
- Admin API `POST /traffic/import` obsluguje `source=ga4`, a Growth Ops ma przycisk `Importuj GA4`.
- Env templates i Portainer stack maja puste sloty `AICO_GA4_ACCESS_TOKEN`, `GA4_SERVICE_ACCOUNT_JSON` i `GOOGLE_APPLICATION_CREDENTIALS`.
- `ops/production-env-check.sh` wymaga konfiguracji GA4, gdy `AICO_FULL_AUTONOMY_REQUIRED=true`.
- Po security review rozdzielono RBAC: `POST /traffic/import` wymaga `import-traffic`, a `POST /providers/test-readiness` wymaga `test-provider-readiness`.
- Utwardzono walidacje `GA4_PROPERTY_ID`, `day`, OAuth token endpoint oraz spojny kontrakt credentiali GA4 w env gate/provider-probe/importerze.
- Test suite wzroslo do 93 testow pluginu.

## Replicate-compatible controlled video render update - 2026-06-07

- Dodano `AICO_VIDEO_PROVIDER_MODE=replicate` w `video-provider-adapter`.
- Adapter tworzy async Replicate HTTP prediction przez `POST /v1/predictions` i zapisuje tylko lokalny status oraz `provider_job_id`.
- Tryb `replicate` wymaga `AICO_CONTROLLED_LIVE_ENABLED=true`, `AICO_VIDEO_GEN_MODEL` oraz `AICO_VIDEO_GEN_TOKEN` albo `REPLICATE_API_TOKEN`.
- Usunieto fallback video renderu na `AICO_IMAGE_GEN_TOKEN`.
- `video-agent.render()` failuje zamkniecie bez swiezego `provider-status` dla `video.generate`.
- Minimalne metadata nie zawieraja tokenow, modelu, prediction URL-i ani outputu.
- Dodano osobne RBAC `render-video` dla kosztownego provider render call.
- `ops/production-env-check.sh` wymaga `AICO_VIDEO_PROVIDER_MODE=replicate` przy full autonomy i sprawdza token/model dla replicate mode.
- `production-readiness` ma pozytywna sciezke dla kontrolowanego video render adaptera, ale pelny PROD GO nadal zalezy od pozostalych blockerow i smoke.
- Test suite wzroslo do 98 testow pluginu.

## Controlled Ads Preflight update - 2026-06-07

- Dodano `AICO_ADS_PROVIDER_MODE=controlled` w `ads-provider-adapter`.
- Tryb `controlled` wymaga `AICO_CONTROLLED_LIVE_ENABLED=true`, ale nie wykonuje zewnetrznych mutacji Meta/Google Ads i nie wlacza live spend.
- `ads-agent.activate()` w trybie `controlled` wymaga centralnego `provider-status` dla `ads.mutate` oraz target URL preflightu.
- `ads-agent.createPlan()` blokuje niebezpieczne target URL: brak HTTPS, userinfo, host poza allowlista, sciezki poza allowlistowanymi prefiksami, URL fragments i tokenopodobne query keys.
- `creativePayload` jest skanowany pod zakazane claimy, a `targetingPayload` pod targetowanie wrazliwe.
- `ad-campaign-plan` i `provider-credential-status` sa ukryte przed bezposrednia edycja w Content Managerze.
- Dodano osobne RBAC `activate-ads` i `pause-ads`.
- `ops/production-env-check.sh` przy full autonomy wymaga `AICO_ADS_PROVIDER_MODE=controlled` oraz `AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED=true`.
- `production-readiness` rozpoznaje controlled ads jako preflight bez live spend, ale realny `live` nadal jest `NO_GO`.
- Test suite wzroslo do 103 testow pluginu i 187 testow API.

## Ograniczenia

- `run-now` autopilota zwraca dry-run only do czasu implementacji live provider adapterow.
- `ads activate` nie wykonuje live provider mutation; `sandbox` symuluje identyfikatory, a `live` blokuje plan z `provider_adapter_live_not_implemented`.
- `ads controlled` wykonuje tylko bezpieczny preflight i zapis planowanych provider IDs; nie tworzy kampanii u providera i nie wydaje budzetu.
- `video render` nie wykonuje live renderingu; `sandbox` symuluje render, a `live` blokuje asset z `provider_adapter_live_not_implemented`.
- TikTok i YouTube Shorts sa dodane do kontraktu, ale live publish wymaga osobnych adapterow i preflightu.
- Meta Ads, Google Ads, GA4, TikTok i YouTube maja credential slots/probe status, ale nadal potrzebuja dedykowanych provider smoke/probes do realnego GO.
- GA4 importer jest gotowy kodowo, ale realny provider readiness wymaga kontrolowanego Data API smoke na srodowisku z sekretami.
- Replicate video render jest gotowy kodowo jako async job-id-only, ale realny provider readiness wymaga kontrolowanego prediction smoke na srodowisku z sekretami i kontrola kosztow.
- Live ads/video nadal wymagaja provider adapterow, sekretow, scope'ow i controlled live smoke.
- Pelne ads live wymagaja provider-side pause/kill, atomowego spend ledger, realnego sandbox/live smoke i dowodu, ze kampanie startuja bezpiecznie bez przekroczenia capu.
- Pelny PROD GO nadal jest NO-GO bez strict audit `GO` i provider readiness z realnego srodowiska.

## Polish summary

Pierwsza implementacja pelnego autopilota jest w kodzie jako bezpieczny backendowy i operatorski control-plane. Po multi-agent safety/provider/strict-audit/production-readiness gate system ma globalny kill switch, realne limity autonomii, audyt nowych mutacji, provider readiness w statusie, runtime social gate, social probe upsert, centralny provider probe, read-only GA4 traffic importer, kontrolowany Replicate-compatible video render adapter, controlled ads preflight bez live spend, Growth Ops UI, blokujacy post-seed preflight oraz formalny raport PROD GO/NO-GO. Production full GO nadal jest NO-GO bez sekretow, scope'ow providerow, prawdziwych live adapterow ads/social, provider-side pause/ledger, strict audit evidence i kontrolowanych live preflightow.
