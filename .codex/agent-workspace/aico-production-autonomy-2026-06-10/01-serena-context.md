# Serena context

## Uzycie Sereny

Serena jest dostepna i aktywna dla projektu `star-sign`.

Odczytane pamieci:

- `project/system_orientation_2026_06_06`
- `project/aico_full_autopilot_foundation_2026_06_06`
- `project/aico_autopilot_control_plane_2026_06_07`
- `project/aico_production_readiness_gate_2026_06_07`
- `project/aico_central_provider_probe_2026_06_07`
- `project/aico_controlled_ads_preflight_2026_06_07`
- `project/aico_ga4_readonly_import_2026_06_07`
- `project/aico_replicate_controlled_video_render_2026_06_07`
- `project/prod_full_autonomy_profile_2026_05_08`
- `project/prod_content_autopublish_p0_implementation_2026_05_08`

## Najwazniejsze ustalenia

- Repo to Nx monorepo: Angular SSR frontend, Strapi 5 API i plugin `ai-content-orchestrator`.
- AICO ma juz fundament autopilota: autonomy policy, provider status, traffic GA4, ads/video agents, production readiness, Growth Ops UI.
- Pelny produkcyjny GO byl celowo blokowany do czasu prawdziwych providerow, sekretow, provider readiness, strict audit i kontrolowanego smoke.
- Obecny kierunek produkcyjny nie oznacza niekontrolowanych efektow live. `production-readiness` zwraca `liveEffectsAllowed=false`, a bezpieczna sciezka to kontrolowane efekty: ads `controlled`, video `replicate`, social tylko po provider readiness i guardrailach.
- Social publisher ma juz realne sciezki publikacji FB/IG/X i read-only testy polaczen, ktore zapisuja `provider-status`.

## Konwencje narzedzi

- Targety Nx potwierdzone przez `npm exec nx show project ... --json`.
- Dla pluginu AICO istotne targety: `test:unit`, `test:ts:back`, `test:ts:front`, `verify`, `build`.
- Dla API istotne targety: `test`, `typecheck`, `build`, `aico-post-seed-preflight`.

## Wniosek po polsku

Najblizszy bezpieczny krok to nie omijanie bramek, tylko doprowadzenie preflightu po seedzie do zgodnosci z juz wdrozona architektura production readiness. System nie moze blokowac sie na opcjonalnych providerach ani falszywie uznawac `controlled`/`replicate` za wylaczone.

## Dodatkowy kontekst Sereny po ads pause hardening

- Odczytano `project/aico_production_autonomy_hardening_2026_06_10`, `project/aico_controlled_admin_run_now_2026_06_10` oraz `project/aico_admin_ui_controlled_run_now_2026_06_10`.
- Serena symbolicznie potwierdzila, ze `adsAgent.pause()` bylo prostym lokalnym update do `paused`, a `adsProviderAdapter.pauseCampaign()` ma oddzielny wynik `blocked` dla trybu live.
- Schemat `ad-campaign-plan` i typ `AdCampaignPlanRecord` wskazuja pole `provider_ad_id`; poprzedni zapis aktywacji do `provider_creative_id` byl niespojny ze schematem.

## Wniosek po polsku po ads pause hardening

Pauza reklam musiala zostac podlaczona do adaptera i ledgeru, bo inaczej panel mogl pokazywac zatrzymanie kampanii bez potwierdzonego efektu providerowego. Dodatkowo nalezalo ujednolicic zapis identyfikatora kreacji na `provider_ad_id`.

## Dodatkowy kontekst Sereny po kill-switch ads stop-loss sweep

- Odczytano `project/aico_ads_pause_provider_ledger_hardening_2026_06_10`, `project/aico_production_autonomy_hardening_2026_06_10`, `project/aico_controlled_admin_run_now_2026_06_10` oraz `project/aico_admin_ui_controlled_run_now_2026_06_10`.
- Serena pokazala, ze `orchestrator.tick()` blokowal generation/publication/social przy `global_kill_switch`, ale nie mial sciezki porzadkujacej istniejace plany reklam.
- Istniejaca sciezka `adsAgent.pause()` jest juz provider-confirmed i ledgered, wiec naturalnym rozwiazaniem jest sweep, ktory uzywa tej samej pauzy zamiast dublowac logike.

## Wniosek po polsku po kill-switch sweep

Globalny kill switch nie powinien tylko zatrzymywac nowych tickow. Powinien tez probowac zatrzymac istniejace plany reklam przez bezpieczna sciezke pauzy, a przy braku live adaptera jawnie raportowac blokade zamiast udawac sukces.

## Dodatkowy kontekst Sereny po manual admin ads stop-loss

- Odczytano `project/aico_kill_switch_ads_stop_loss_sweep_2026_06_10` oraz `project/aico_ads_pause_provider_ledger_hardening_2026_06_10`.
- Aktualny kod mial stop-loss sweep wywolywany przez `orchestrator.tick()` przy kill switchu, ale operator nie mial natychmiastowego endpointu/przycisku awaryjnego poza czekaniem na tick.
- Istniejace RBAC ma `pauseAds`, a `ads-agent.pauseActiveForKillSwitch()` jest juz bezpieczna sciezka zbiorczej pauzy.

## Wniosek po polsku po manual admin ads stop-loss

Manualny stop-loss reklam powinien byc dostepny dla operatora przez backendowy endpoint z RBAC `pauseAds`, wymaganym potwierdzeniem `PAUSE_ACTIVE_ADS`, audytem admina i UI, ktore tylko wywoluje typed API.

## Dodatkowy kontekst Sereny po controlled ads provider probe

- Odczytano `project/aico_controlled_ads_preflight_2026_06_07`, `project/aico_production_readiness_gate_2026_06_07`, `project/aico_production_autonomy_hardening_2026_06_10` oraz `project/aico_central_provider_probe_2026_06_07`.
- Serena symbolicznie potwierdzila, ze `provider-probe` zapisywal skonfigurowane `meta_ads` i `google_ads` jako `blocked` z powodami `*_sandbox_or_live_smoke_required`.
- `production-readiness` nie ma specjalnego obejscia dla ads providerow: jesli provider-status nie jest `ready`, `providers.required-ready` blokuje finalny `GO`.
- Istniejaca decyzja architektoniczna dopuszcza ads `controlled` jako no-spend preflight, ale nie jako live mutation/spend.

## Wniosek po polsku po controlled ads provider probe

Centralny provider probe musi umiec zapisac `ready` dla reklam w kontrolowanym profilu bez wydatkow, inaczej rzeczywisty target-env preflight sam zablokuje produkcyjny `GO`. To `ready` pozostaje ograniczone do `AICO_ADS_PROVIDER_MODE=controlled` i `AICO_CONTROLLED_LIVE_ENABLED=true`.

## Dodatkowy kontekst Sereny po AICO preflight release gate

- Nx potwierdzil target `api:aico-post-seed-preflight`, ktory wynika ze skryptu `apps/api/package.json`.
- `ops/predeploy-check.sh` uruchamial env guard, domain audits i AICO contract audit, ale nie uruchamial post-seed preflight/production-readiness.
- `aico-post-seed-preflight.js` dotad polegal na env procesu/Strapi, bez jawnego sposobu wskazania tego samego env file, ktorego uzywa Portainer/predeploy.

## Wniosek po polsku po AICO preflight release gate

Release gate musi uruchamiac AICO post-seed preflight na tym samym env file co production env guard, bo inaczej najwazniejszy readiness kontrakt pozostaje reczna czynnoscia. Lokalny predeploy nie powinien odpalac tej bramki przypadkiem na `.env.example`.

## Dodatkowy kontekst Sereny po cwd-independent seed-core

- Odczytano `project/aico_post_seed_preflight_cwd_independent_2026_06_10`, `project/aico_independent_release_gate_runbooks_2026_06_10` oraz `project/aico_production_autonomy_hardening_2026_06_10`.
- Nx potwierdzil, ze `api:seed:dev`, `api:seed:stg` i `api:seed:prod` sa targetami `nx:run-script` opartymi o skrypty z `apps/api/package.json`.
- `apps/api/scripts/seed-core.js` uzywal tego samego kruchego wzorca co wczesniejszy preflight: `compileStrapi({ appDir: process.cwd() })`.
- Production seed jest czescia przygotowania realnego target-env AICO, wiec nie powinien zalezec od tego, czy operator uruchamia go przez Nx, `npm --prefix apps/api`, z katalogu `apps/api`, czy z root workspace.

## Wniosek po polsku po cwd-independent seed-core

Seed core musi bootowac Strapi z katalogu `apps/api` wyliczonego wzgledem skryptu, tak samo jak post-seed preflight. To usuwa klase bledow operator/CI cwd bez zmiany kontraktu seedowania i bez dotykania sekretow.

## Dodatkowy kontekst Sereny po release DB audits env loading

- Odczytano `project/aico_seed_core_cwd_independent_2026_06_10`, `project/aico_post_seed_preflight_cwd_independent_2026_06_10` oraz `project/aico_independent_release_gate_runbooks_2026_06_10`.
- Nx potwierdzil, ze `api:premium-content-audit` i `api:aico-contract-audit` sa targetami uruchamianymi przez `ops/predeploy-check.sh` w bloku `RUN_DOMAIN_AUDITS`.
- `aico-contract-audit.js`, `premium-content-audit.js` i `premium-content-backfill.js` mialy duplikowany loader env oparty o `process.cwd()`.
- `audit-sqlite.js` rowniez liczyl domyslne `.tmp/data.db` wzgledem `process.cwd()`, co rozbijalo reczne uruchomienia z root workspace.
- `aico-post-seed-preflight.js` mial juz script-relative `appDir`, ale relatywny env file nadal byl liczony przez `path.resolve(process.cwd(), filename)`.

## Wniosek po polsku po release DB audits env loading

Audyty, backfill DB i AICO post-seed preflight powinny korzystac ze wspolnego rozumienia sciezek wzgledem `apps/api` i root repo. Release gate nie moze zalezec od tego, z jakiego katalogu zostal wywolany wrapper Nx albo reczna komenda.

## Dodatkowy kontekst Sereny po runtime AICO contract path hardening

- Odczytano `project/aico_release_env_workspace_relative_2026_06_10`, `project/aico_seed_core_cwd_independent_2026_06_10` oraz `project/aico_production_autonomy_hardening_2026_06_10`.
- `server/src/utils/aico-contract.ts` byl ostatnim runtime helperem AICO, ktory szukal `aico-content-contract.json` przez kandydatow opartych najpierw o `process.cwd()`.
- Helper jest uzywany przez `orchestrator`, `social-publisher` i `image-designer`, wiec blad odczytu kontraktu zatrzymalby generowanie/publikowanie contentu.
- Istniejacy test runtime promptow zostal rozszerzony o regresje zmieniajaca `process.cwd()`.

## Wniosek po polsku po runtime AICO contract path hardening

Runtime prompt catalog musi miec stabilne, module-relative kandydaty dla source i dist. Fallback `cwd` moze zostac dla kompatybilnosci, ale poprawne dzialanie generowania nie powinno od niego zalezec.

## Dodatkowy kontekst Sereny po media-generator temp path hardening

- Odczytano `project/aico_runtime_contract_path_module_relative_2026_06_10`, `project/aico_replicate_controlled_video_render_2026_06_07` oraz `project/aico_production_autonomy_hardening_2026_06_10`.
- `media-generator.ts` byl ostatnim runtime serwisem AICO znalezionym przez grep, ktory zapisywal pliki przez `process.cwd()/public/uploads/tmp`.
- Serwis pobiera obraz z providera, zapisuje temp file i przekazuje go do Strapi Upload, wiec zly cwd mogl kierowac zapis poza `apps/api/public`.
- `apps/api/public` istnieje w repo i jest naturalnym katalogiem Strapi public dla upload/temp path.

## Wniosek po polsku po media-generator temp path hardening

Temp file dla generowania mediow musi byc liczony wzgledem aplikacji/pluginu, nie cwd procesu. Test z mockowanym Replicate/Axios/Upload potwierdza sciezke i cleanup bez realnych providerow.

## Dodatkowy kontekst Sereny po media-generator effect guard

- `provider-status.ts` definiuje `media.generate -> replicate`, a `autonomy-policy.ts` ma dzienny limit `media.generate`.
- `media-selector.ts` wywoluje `media-generator.generateAndUpload()`, ale sam `media-generator` jest oddzielnym plugin service i powinien failowac zamkniecie przy bezposrednim uzyciu.
- Przed zmiana `media-generator` tworzyl klienta Replicate przed sprawdzeniem policy/provider readiness.
- Env validation i seed dopuszczaja `AICO_IMAGE_GEN_TOKEN`, a stary runtime fallback w generatorze bral tylko `REPLICATE_API_TOKEN`.

## Wniosek po polsku po media-generator effect guard

Kosztowny provider call dla obrazu musi miec ostatnia bramke przy samym efekcie. `media-generator` powinien sprawdzac `autonomy-policy`, `provider-status(media.generate)` i token zanim utworzy klienta Replicate.

## Dodatkowy kontekst Sereny po production env parity check

- Odczytano `project/aico_independent_release_gate_runbooks_2026_06_10`, `project/aico_release_env_workspace_relative_2026_06_10`, `project/aico_post_seed_preflight_release_gate_2026_06_10`, `project/aico_controlled_ads_provider_probe_2026_06_10`, `project/production_env_generation_2026_05_05` oraz `project/production_env_gate_2026_05_05`.
- Statyczny `ops/production-env-check.sh` na `.env.production.generated` nie ujawnil wartosci sekretow, ale zablokowal release na brakach AICO full-autonomy, GA4 i social provider credentials.
- Porownanie samych nazw kluczy pokazalo, ze `.env.production.generated` jest starszy od obecnego kontraktu AICO i nie zawiera wielu nowych nazw env.
- `ops/production-env-check.sh` wymagal `AICO_ALLOW_MISSING_TOKEN=false`, ale runtime `apps/api/config/env-validation.ts` nie egzekwowal tej flagi przy starcie kontenera.

## Wniosek po polsku po production env parity check

Runtime validation musi blokowac `AICO_ALLOW_MISSING_TOKEN=true` tak samo jak shellowy env guard. Lokalny `.env.production.generated` pozostaje sekretowym artefaktem do odswiezenia przez operatora; nie nalezy go poprawiac przez jawny diff, bo mogloby to ujawnic kontekst sekretow.

## Dodatkowy kontekst Sereny po lokalnym release-candidate gate

- Odczytano wczesniejsze pamieci AICO dotyczace missing-token runtime guard, niezaleznego release gate, workspace-relative env, media generation effect guard i controlled ads provider probe.
- Lokalny `ops:predeploy:local` ujawnil produkcyjne high audit blokery w zaleznosciach root/API. Zostaly usuniete przez bezpieczne aktualizacje lockfile i Angular runtime do `21.2.13`, bez `npm audit fix --force`.
- API production audit po aktualizacji Strapi lockfile przechodzi gate high, a pozostale drukowane advisories sa low/moderate albo wymagaja osobnej breaking decyzji poza obecnym production high gate.
- User przekazal sekret OpenRouter do testow, ale nie zostal on zapisany w repo, raportach, pamieci ani uzyty w komendach. Dalsze realne smoke powinno korzystac z env/secret managera po rotacji ujawnionego klucza.

## Wniosek po polsku po lokalnym release-candidate gate

Kod, lockfile i lokalne bramki sa w stanie release-candidate: produkcyjne high audyty, predeploy, lint/typecheck/test/build oraz E2E sa zielone. Granica pozostaje celowo operacyjna: `.env.production.generated` musi zostac uzupelniony realnymi sekretami i flagami, a target-env post-seed/provider smoke moze ruszyc dopiero po przejsciu env guarda.

## Dodatkowy kontekst po OpenRouter smoke i env guard hardening

- Lokalny `.env.production.generated` zawieral juz `AICO_OPENROUTER_TOKEN` i model, ale brakowalo nowych nie-sekretnych flag full-autonomy RC oraz wielu provider credentials.
- Dodano opcjonalny target `api:aico-openrouter-smoke`, ktory wczytuje env file przez `AICO_SMOKE_ENV_FILE`/`COMPOSE_ENV_FILE`, wykonuje minimalny request do OpenRouter i loguje tylko status/model/usage.
- Smoke zostal poprawiony tak, aby pusty env procesu nie zaslanial tokenu z jawnie wskazanego env file.
- Runtime i shellowy env guard wymagaja teraz Meta Ads oraz Google Ads credentials, gdy `AICO_ADS_PROVIDER_MODE=controlled`, zgodnie z provider-probe i runbookiem.
- `.env.production.generated` dostal bezpieczne, nie-sekretne ustawienia controlled full-autonomy RC; puste zostaly tylko realne sekrety, property IDs i provider credentials.

## Wniosek po polsku po OpenRouter smoke

OpenRouter jest realnie osiagalny z aktualnym env file i modelem `openai/gpt-4.1-mini`, co usuwa jeden z praktycznych blockerow AICO. Produkcyjny NO-GO pozostaje na brakach GA4, Replicate/video, Meta/Google Ads oraz social publish credentials.
