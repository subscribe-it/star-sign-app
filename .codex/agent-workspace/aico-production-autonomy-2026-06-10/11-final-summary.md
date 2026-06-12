# Final summary

## Co zmieniono

- Post-seed preflight rozpoznaje kontrolowany profil full autonomy: ads `controlled`, video `replicate`, wymagani providerzy wedlug runtime social channels.
- Post-seed preflight moze uruchomic read-only social connection preflight i odswiezyc provider readiness bez publikacji.
- Ads planning/activation lepiej egzekwuje limity: planowanie blokuje oversubscription, a aktywacja uzywa `ads-budget-ledger`.
- Content publishing przechodzi przez `autonomy-policy.evaluate({ action: 'content.publish' })`.
- Runtime production env validation dostalo AICO full autonomy guardy.
- Dodano systemowy audit helper i pre-effect audit dla content publish oraz ads activate.
- Env examples, Portainer stack i shellowy env guard uwzgledniaja `AICO_CONTROLLED_LIVE_ENABLED` oraz social connection preflight.
- Finalny post-seed readiness wlacza strict audit dla full autonomy, a zielony kontrolowany profil ma test potwierdzajacy `production-readiness=GO` bez live effects.
- Publiczny endpoint homepage recommendations filtruje rekomendacje po `starts_at`/`expires_at`, nie tylko po statusie, i nadal zwraca bezpieczny DTO bez relacji operacyjnych.
- Adminowy endpoint production-readiness wlacza strict audit domyslnie w full autonomy, zeby panel i post-seed mialy spojny wynik.
- Adminowe `runNow` ma kontrolowany live path: wymaga `AICO_ADMIN_RUN_NOW_ENABLED=true`, potwierdzenia `RUN_AICO_CONTROLLED_TICK` i `production-readiness=GO` przed `orchestrator.tick()`.
- Panel admina wystawia controlled run-now przez input potwierdzenia i typed API payload, bez omijania readiness gate.
- `ads-agent.pause()` uzywa teraz adaptera providera i pause ledger, wiec live pause bez realnego adaptera konczy sie blokada zamiast falszywego `paused`.
- Zapis identyfikatora kreacji reklamowej zostal ujednolicony na polu Strapi `provider_ad_id`.
- Globalny kill switch w `orchestrator.tick()` uruchamia teraz ads stop-loss sweep dla istniejacych planow `ready`/`active`.
- Stop-loss sweep uzywa `ads-agent.pause()`, wiec zachowuje provider-confirmed pause path, ledger i jawne blokady dla braku live adaptera.
- Dodano manualny ads stop-loss w adminie: endpoint `POST /ads/campaign-plans/stop-loss`, RBAC `pauseAds`, potwierdzenie `PAUSE_ACTIVE_ADS`, audyt oraz typed UI `Pause active ads`.
- Centralny provider probe dla `meta_ads` i `google_ads` rozpoznaje kontrolowany no-spend preflight jako `ready` tylko przy `AICO_ADS_PROVIDER_MODE=controlled`, `AICO_CONTROLLED_LIVE_ENABLED=true` i komplecie credential env.
- `provider-status.upsert()` zapisuje metadane controlled ads readiness bez sekretow, m.in. `liveEffects=false`, `liveSpendEnabled=false` i `controlledExternalMutation=false`.
- `ops/predeploy-check.sh` ma teraz `RUN_AICO_POST_SEED_PREFLIGHT`, a staging predeploy/runbooki wlaczaja `api:aico-post-seed-preflight` jako czesc release gate.
- `aico-post-seed-preflight.js` moze bezpiecznie wczytac wskazany env file przez `AICO_PREFLIGHT_ENV_FILE`/`COMPOSE_ENV_FILE`, bez logowania wartosci i bez nadpisywania envow procesu.
- `RUN_AICO_POST_SEED_PREFLIGHT` dziala niezaleznie od `RUN_DOMAIN_AUDITS`, wiec AICO readiness gate nie znika przy zmianie zakresu audytow domenowych.
- AICO audit/deploy runbooki wskazuja teraz `production-readiness=GO`, provider readiness i controlled no-spend profile jako wymagany kontrakt, zamiast starego manual-only strict audit.
- `aico-post-seed-preflight.js` wylicza Strapi `appDir` wzgledem skryptu, wiec release gate nie zalezy od cwd procesu.
- `seed-core.js` wylicza Strapi `appDir` wzgledem skryptu, wiec produkcyjne seedy `dev/stg/prod` nie zaleza od cwd procesu.
- Dodano `release-env.js` dla skryptow release/audit; `aico-contract-audit`, `premium-content-audit` i `premium-content-backfill` laduja env z jawnego `AICO_AUDIT_ENV_FILE`/`COMPOSE_ENV_FILE` oraz stabilnych `.env`.
- `audit-sqlite.js` liczy relatywne `DATABASE_FILENAME` od `apps/api`, wiec lokalne audyty SQLite nie zaleza od cwd procesu.
- `aico-post-seed-preflight.js` liczy relatywny `AICO_PREFLIGHT_ENV_FILE`/`COMPOSE_ENV_FILE` od root workspace, wiec staging predeploy z `COMPOSE_ENV_FILE=.env` nie zalezy od cwd Nx.
- Runtime helper `aico-contract.ts` odnajduje `aico-content-contract.json` wzgledem modulu dla source/dist, wiec generowanie tresci nie zalezy od cwd procesu przy odczycie promptow.
- `media-generator.ts` zapisuje tymczasowe obrazy pod `apps/api/public/uploads/tmp` wyliczonym wzgledem modulu/app, wiec generowanie mediow nie zalezy od cwd procesu.
- `media-generator.generateAndUpload()` sprawdza `autonomy-policy`, `provider-status(media.generate -> replicate)` i token przed wywolaniem Replicate.
- Runtime production env validation blokuje `AICO_ALLOW_MISSING_TOKEN=true`, a `apps/api/.env.example` ma jawne `AICO_ALLOW_MISSING_TOKEN=false`.
- Portainer README opisuje aktualny pelny kontrakt AICO full autonomy, w tym strict audit, controlled ads, replicate video, social/GA4 credentials i `RUN_AICO_POST_SEED_PREFLIGHT=true` jako blokujaca bramke release.
- `.env.production.generated` zostal sprawdzony bez ujawniania wartosci i jest obecnie starszy od aktualnego kontraktu AICO; env guard blokuje release na 20 brakach.

## Status

Lokalne testy i buildy przeszly. Lokalny kontrakt readiness potwierdza `GO` dla pelnego zielonego profilu kontrolowanego, adminowy readiness jest spojny z post-seed, publiczny feed homepage ma defensywny filtr czasu, admin run-now ma gated live mode dostepny z panelu, pauza reklam nie maskuje juz braku realnego live adaptera, kill switch probuje zatrzymac istniejace plany reklam przez audytowalny stop-loss sweep, operator ma reczny stop-loss bez czekania na tick, centralny provider probe nie blokuje juz bezpiecznego controlled ads preflightu, a release gate potrafi uruchomic AICO post-seed preflight z realnym env file, nie zalezy od domain audits ani od cwd procesu. Produkcyjne seedy AICO/Strapi, audyty DB release, relatywne env file w preflight, runtime prompt catalog oraz media generator temp files rowniez nie zaleza juz od cwd procesu. Media generation ma teraz dodatkowy effect-boundary guard przed kosztem Replicate.

Pelny produkcyjny GO nadal wymaga realnych sekretow, swiezej provider readiness i kontrolowanego smoke na docelowym srodowisku. Live run-now jest zaimplementowany, ale powinien byc uzyty dopiero po target-env GO i jawnej decyzji operatora.

Aktualny sekretowy `.env.production.generated` nie jest jeszcze gotowy do pelnej autonomii: brakuje m.in. strict audit/controlled/video flag, GA4 property/credentials oraz social provider credentials. Dopoki `PRODUCTION_ENV_FILE=.env.production.generated sh ops/production-env-check.sh` nie przejdzie, nie nalezy uruchamiac post-seed preflightu przeciw realnej bazie/providerom.

## Aktualizacja RC z 2026-06-11

- Produkcyjne high npm audit gates sa zielone dla root i API.
- Angular runtime/dev tooling zostal zrownany do `21.2.13`, a lockfile API przyjal poprawki Strapi 5.x/transitive bez `npm audit fix --force`.
- `npm run ops:predeploy:local` przechodzi w calosci.
- Frontend ma zielone coverage testy, production build i Playwright E2E.
- Docker Compose config dla Portainera przechodzi na `.env.production.generated`.
- `.env.production.generated` nadal blokuje production env guard na 20 znanych brakach, czyli repo jest gotowe do uzupelnienia sekretow/env, ale target-env GO nie jest jeszcze potwierdzony.
- Klucz OpenRouter nie zostal wpisany do komend ani raportow; realny smoke uzyl wartosci z env file i nie logowal sekretu. Poniewaz sekret pojawil sie w rozmowie, przed docelowym release nadal trzeba go zrotowac i ustawic przez env/secret manager.

## Aktualizacja OpenRouter / env z 2026-06-11

- Dodano `api:aico-openrouter-smoke` i opcjonalny `RUN_AICO_OPENROUTER_SMOKE` w predeploy.
- Realny OpenRouter smoke przeszedl na `.env.production.generated`: model `openai/gpt-4.1-mini`, total_tokens=40, bez logowania sekretu.
- Runtime i shellowy env guard wymagaja teraz Meta/Google Ads credentials dla `AICO_ADS_PROVIDER_MODE=controlled`.
- `.env.production.generated` ma dopisane bezpieczne flagi controlled full-autonomy RC: strict audit, controlled live, admin run-now, ads controlled, video replicate, social connection preflight.
- Produkcyjny NO-GO po tej iteracji to juz konkretne brakujace credentiale/env: audit salt, GA4, Replicate/video, Meta/Google Ads, Facebook, Instagram i X.
