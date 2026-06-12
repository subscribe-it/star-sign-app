# Kontekst Serena i fakty z audytu

Date: 2026-05-08
Role: Lead / System Architect / Developer

## Użycie Sereny

Serena była dostępna i aktywna dla projektu `star-sign`. Odczytane pamięci:

- `project_overview`
- `style_and_conventions`
- `completion_checklist`
- `project/production_seed_and_media_gen_env_2026_05_06`
- `implementation/autonomous_social_publishing_2026_05_05`
- `implementation/aico_plan_autopilot_2026_05_05`
- `audits/aico_plugin_audit_2026_05_05`
- `audits/app_audit_2026_05_05`
- `project/local_seed_assets_api_parity_2026_05_06`
- `project/zodiac_profile_media_seed_auto_discovery_2026_05_06`
- `aico/growth_agents_v1_implementation_2026_05_04`
- `aico/admin_ui_growth_ops_v1`
- `aico/plugin_p1_hardening_2026_05_05`

Użyto też semantycznej nawigacji Sereny dla symboli:

- `seedWithMode`, `getModeDefaults`, `seedAicoSettings`, `seedAicoWorkflows`, `seedAicoTopicQueue`, `seedAicoMediaAssets` w `apps/api/scripts/seed-core.js`.
- `ensureBootstrapContent`, `ensureGlobalSettings`, `upsertAicoWorkflows` w `apps/api/src/bootstrap/content.ts`.
- `tick`, `processGenerationTick`, `processPublicationTick`, `isAutoPublishGloballyEnabled` w `apps/api/src/plugins/ai-content-orchestrator/server/src/services/orchestrator.ts`.
- `generateTeaser`, `publishTicket`, `resolveMediaUrlForTicket` w `apps/api/src/plugins/ai-content-orchestrator/server/src/services/social-publisher.ts`.
- `normalizeRuntime`, `decryptImageTokenForRuntime` w `apps/api/src/plugins/ai-content-orchestrator/server/src/services/workflows.ts`.

## Fakty z repo

- Workspace Nx ma projekty: `api`, `frontend`, `ai-content-orchestrator`, `cart`, `@org/types`, `frontend-e2e`.
- `api` ma target `seed:prod`, który uruchamia `apps/api/scripts/seed-prod.js` i dalej `seedWithMode('prod')`.
- `ai-content-orchestrator` ma targety `test:unit`, `test:ts:back`, `test:ts:front`, `verify`, `build`, `lint`.
- Strapi cron jest aktywny domyślnie według lokalnego `node_modules/@strapi/core/dist/providers/cron.js`, jeśli `server.cron.enabled` nie jest ustawione na `false`.
- Plugin AICO rejestruje tick co minutę przez `CRON_TICK_RULE='* * * * *'`.
- Tick wykonuje kolejno: strategię, generowanie, publikację contentu, a potem `socialPublisher.publishPending(now)`, jeśli globalny kill switch nie jest `false`.

## Fakty z env i produkcji

- Lokalny plik `.env.production.generated` ma `AICO_ENABLE_WORKFLOWS=false`.
- Ten sam plik ma pusty `AICO_OPENROUTER_TOKEN`.
- Ten sam plik nie zawiera kluczy `AICO_IMAGE_GEN_TOKEN`, `REPLICATE_API_TOKEN`, `AICO_SOCIAL_DEFAULT_IMAGE_URL` ani credentiali FB/IG/X.
- `ops/portainer/star-sign-production-stack.yml` przekazuje do API tylko podstawowe `AICO_OPENROUTER_*`, `AICO_ENABLE_WORKFLOWS`, `AICO_ALLOW_MISSING_TOKEN`, `AICO_BACKUP_ENABLED`; nie przekazuje image/social env.
- `ops/production-env-check.sh` przechodzi dla `.env.production.generated`, bo token OpenRouter jest wymagany tylko wtedy, gdy `AICO_ENABLE_WORKFLOWS=true`.
- Live smoke 2026-05-08:
  - `https://star-sign.pl/`: HTTP 200.
  - `https://star-sign.pl/healthz`: HTTP 200.
  - `https://api.star-sign.pl/api/health/ready`: HTTP 200.
  - `https://api.star-sign.pl/api/articles`: HTTP 200.
  - `https://api.star-sign.pl/api/horoscopes`: HTTP 200.
  - `https://api.star-sign.pl/api/ai-content-orchestrator/homepage/recommendations`: HTTP 200, ale `data=[]`.
- Live content:
  - Najnowsze artykuły mają `publishedAt=2026-05-06T14:47:45.170Z`.
  - Najnowsze horoskopy mają `date=2026-05-06` i `publishedAt=2026-05-06T14:47:47.514Z`.
  - W dniu audytu, 2026-05-08, brak publicznego dowodu, że produkcja wygenerowała świeży content za 2026-05-07 albo 2026-05-08.
- `https://star-sign.app/assets/og-default.jpg` nie rozwiązuje DNS, a kod ma tę domenę jako fallback social image.

## Reusable knowledge do pamięci

- Produkcyjny problem jest integracyjny: env, seed, global settings, workflow flags, backlog, media, domeny i credentiale social muszą być sprawdzane razem.
- `seedAicoSettings` w `seed-core.js` ustawia tylko `timezone` i `locale`, więc może nadpisać istniejące globalne ustawienia AICO, w tym `image_gen_model`, `image_gen_api_token_encrypted` oraz `aico_auto_publish_enabled`.
- Social target URL i fallback image nie mogą mieć hard-coded `star-sign.app`; powinny wynikać z `FRONTEND_URL`, `SERVER_URL` albo jawnego `AICO_SOCIAL_DEFAULT_IMAGE_URL`.

## Polska konkluzja

Serena potwierdziła, że AICO ma już mechanizmy crona, generowania, publikacji i social publishing. Problem nie wygląda na brak silnika, tylko na brak kompletnego produkcyjnego onboarding/preflightu po seedzie oraz na rozjazd między seedem, env i ustawieniami runtime.
