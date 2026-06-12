# QA report

## Zakres testow

Sprawdzono lokalnie backend/plugin AICO, post-seed preflight helpery, runtime env validation, TypeScript, Strapi plugin build i API build.

## Co przeszlo

- Preflight helpery rozpoznaja `controlled` ads i `replicate` video jako kontrolowany profil.
- Provider readiness matrix w full autonomy ocenia wymaganych providerow, a nie opcjonalne kanaly spoza runtime.
- Read-only social connection preflight sanitizuje provider details i nie ujawnia raw token/payload.
- Ads activation blokuje oversubscription planow i uzywa budget ledger przed adapterem providera.
- Content publish przechodzi przez autonomy policy przed mutacja docelowego wpisu.
- Runtime production env validation wymaga AICO full autonomy flags, sekretow i controlled-live gates.
- System audit helper zapisuje automatyczne `content.publish.skipped`, `content.publish.attempt`, `ads.activate.attempt` i `ads.activate.skipped` przed efektami zewnetrznymi albo przy blokadach.
- Post-seed preflight przekazuje strict audit do finalnego `production-readiness`, gdy wymagany jest strict audit albo full autonomy.
- `production-readiness` ma potwierdzony testem pozytywny `GO` dla zielonego kontrolowanego profilu bez wlaczania live effects.
- Adminowy endpoint `autonomy.productionReadiness` domyslnie wlacza strict audit przy full autonomy, nawet bez parametru query/body.
- Publiczne `homepage/recommendations` zwraca tylko DTO bez relacji operacyjnych i filtruje po oknie `starts_at`/`expires_at`, nie tylko po statusie.
- `autonomy.runNow` ma kontrolowany tryb live: wymaga `AICO_ADMIN_RUN_NOW_ENABLED=true`, jawnego potwierdzenia i `production-readiness=GO`; inaczej nie wywoluje `orchestrator.tick()`.
- Full autonomy env/readiness wymagaja teraz `AICO_ADMIN_RUN_NOW_ENABLED=true`.
- Admin UI ma operator-safe controlled run-now: input potwierdzenia `RUN_AICO_CONTROLLED_TICK`, disabled button bez `production-readiness=GO`, oraz typed API call z payloadem live.
- `ads-agent.pause()` nie ustawia juz lokalnie `paused` bez decyzji adaptera providera; controlled pause zapisuje pause ledger, a live pause bez adaptera pozostaje zablokowany.
- Identyfikator kreacji reklamowej jest zapisywany do schematowego pola `provider_ad_id`, dzieki czemu activate -> pause uzywa jednego kontraktu danych.
- Globalny kill switch w `orchestrator.tick()` uruchamia teraz ads stop-loss sweep dla istniejacych planow `ready`/`active` przez `ads-agent.pauseActiveForKillSwitch()`.
- Stop-loss sweep uzywa tej samej provider-confirmed sciezki pauzy i raportuje attempted/paused/blocked/failed; nie wykonuje agresywnej pauzy przy samej awarii odczytu policy.
- Manualny admin endpoint `POST /ads/campaign-plans/stop-loss` wymaga `pauseAds` i potwierdzenia `PAUSE_ACTIVE_ADS`, a panel admina ma typed UI dla tej operacji.
- Bledne potwierdzenie manualnego stop-loss nie wywoluje sweepa i zapisuje audit skip; poprawne potwierdzenie wywoluje `manual_admin_stop_loss` i audytuje wynik.
- Provider-probe oznacza `meta_ads` i `google_ads` jako `ready` tylko dla `AICO_ADS_PROVIDER_MODE=controlled` + `AICO_CONTROLLED_LIVE_ENABLED=true` + komplet credential env, z metadanymi no-spend.
- Ten sam test potwierdza, ze `live` nadal pozostaje `blocked` bez sandbox/live smoke.
- Integracyjna regresja spina `provider-probe`, realny `provider-status.upsert()` i `production-readiness`, potwierdzajac `GO` dla zielonego controlled profilu bez live effects.
- `ops/predeploy-check.sh` ma osobny gate `RUN_AICO_POST_SEED_PREFLIGHT`, ktory w staging/production moze uruchomic `api:aico-post-seed-preflight` z tym samym env file co Portainer/production env guard.
- `aico-post-seed-preflight.js` potrafi wczytac env file przez `AICO_PREFLIGHT_ENV_FILE`/`COMPOSE_ENV_FILE` bez nadpisywania juz ustawionych envow procesu.
- `RUN_AICO_POST_SEED_PREFLIGHT` jest niezalezny od `RUN_DOMAIN_AUDITS`, wiec operator moze wymusic AICO readiness gate nawet bez audytow domenowych.
- AICO `AUDIT_RUNBOOK.md` i `DEPLOY_CHECKLIST.md` sa zgodne z obecnym kontraktem: `production-readiness=GO`, provider readiness i controlled no-spend profile sa wymagane przed full autonomy.
- `aico-post-seed-preflight.js` bootuje Strapi z katalogu `apps/api` wyliczonego wzgledem skryptu, a nie z `process.cwd()`.
- Test helpera zmienia current working directory i potwierdza, ze appDir pozostaje stabilny.
- `seed-core.js` bootuje Strapi z katalogu `apps/api` wyliczonego wzgledem skryptu, a nie z `process.cwd()`.
- Test seed-core zmienia current working directory na katalog tymczasowy i potwierdza, ze appDir pozostaje absolutnym `apps/api`.
- `aico-contract-audit.js`, `premium-content-audit.js` i `premium-content-backfill.js` korzystaja ze wspolnego helpera `release-env.js`.
- Helper release env laduje jawny `AICO_AUDIT_ENV_FILE` albo `COMPOSE_ENV_FILE`, potem root `.env` i `apps/api/.env`, bez nadpisywania envow procesu.
- Wynik helpera zwraca tylko nazwy kluczy, nie wartosci sekretow.
- `audit-sqlite.js` liczy relatywny `DATABASE_FILENAME` od `apps/api`, a nie od losowego cwd procesu.
- `aico-post-seed-preflight.js` zachowuje wlasny parser env, ale relatywny `AICO_PREFLIGHT_ENV_FILE`/`COMPOSE_ENV_FILE` liczy od root workspace przez `resolveFromWorkspace()`.
- Runtime `aico-contract.ts` liczy kandydatow `aico-content-contract.json` wzgledem modulu dla source/dist, zanim uzyje fallbackow `cwd`.
- Test runtime zmienia `process.cwd()` i nadal odczytuje prompt `socialTeaser` z kontraktu.
- `media-generator.ts` liczy public dir wzgledem modulu dla source/dist i zapisuje temp file pod `apps/api/public/uploads/tmp`.
- Test media generatora zmienia `process.cwd()`, mockuje Replicate/Axios/Strapi Upload, potwierdza filepath w upload service oraz cleanup temp file.
- `media-generator.generateAndUpload()` sprawdza `autonomy-policy` oraz `provider-status(media.generate -> replicate)` przed utworzeniem klienta Replicate.
- Testy potwierdzaja, ze odmowa policy albo blocked provider readiness nie wywoluja Replicate/Axios.
- `resolveImageGenToken()` wspiera input token, `AICO_IMAGE_GEN_TOKEN` i `REPLICATE_API_TOKEN` w tej kolejnosci.
- Runtime production env validation blokuje teraz `AICO_ALLOW_MISSING_TOKEN=true`, zgodnie z shellowym env guardem.
- `apps/api/.env.example` zawiera `AICO_ALLOW_MISSING_TOKEN=false`, tak jak root env example i Portainer stack.
- Portainer README opisuje pelny AICO full-autonomy env/release contract i wskazuje `RUN_AICO_POST_SEED_PREFLIGHT=true` jako blokujaca bramke dla pelnej autonomii.
- `.env.production.generated` zostal sprawdzony statycznie bez ujawniania wartosci i nadal blokuje release na brakach external provider/GA4/social oraz nowych full-autonomy flagach.

## Dowody

Wykonane komendy i wyniki sa zapisane w `08-test-plan.md`. Wszystkie uruchomione walidacje przeszly.

## Nietestowane

- Realne provider smoke z produkcyjnymi sekretami.
- Realna publikacja FB/IG/X.
- Realny Replicate prediction i GA4 Data API na docelowym srodowisku.
- Pelny `production-readiness=GO` w produkcji na realnych sekretach i provider smoke.
- Rzeczywisty request HTTP do publicznego endpointu na uruchomionej instancji.
- Realne klikniecie live `autonomy.runNow` na target env z produkcyjnymi sekretami.
- Realny provider smoke Meta/Google Ads na sandbox/live API; obecny probe potwierdza tylko controlled no-spend readiness.
- Odswiezenie sekretowego `.env.production.generated` o realne wartosci operatora; lokalny plik jest starszy od obecnego kontraktu AICO.

## Wniosek po polsku

Lokalny backend/control-plane oraz panel admina sa po tej iteracji bardziej produkcyjne i testy potwierdzaja kluczowe bramki, w tym lokalny `production-readiness=GO` dla w pelni zielonego profilu kontrolowanego, spojny admin/post-seed readiness, bezpieczniejszy publiczny feed homepage oraz gated live `runNow` dostepny z UI. Pelny produkcyjny GO nadal wymaga sekretow, swiezej provider readiness matrix i kontrolowanego smoke na docelowym srodowisku.

Po dodatkowym hardeningu ads pause system nie pokazuje falszywego sukcesu pauzy, gdy provider/live adapter jej nie wykonal. To zmniejsza ryzyko rozjazdu miedzy UI, ledgerem i rzeczywistym stanem kampanii.

Po dodatkowym hardeningu kill switch nie tylko zatrzymuje nowe ticki, ale tez probuje zatrzymac istniejace plany reklam. To przybliza system do produkcyjnego stop-loss: nowe dzialania sa blokowane, a potencjalny spend jest sprzatany przez audytowalna sciezke pauzy.

Po dodaniu manualnego stop-loss operator nie musi czekac na kolejny tick, zeby awaryjnie zatrzymac reklamy. Backend nadal egzekwuje potwierdzenie i RBAC, wiec UI nie jest jedyna bariera bezpieczenstwa.

Po dodaniu controlled ads provider probe target-env preflight moze realnie dojsc do kontrolowanego `production-readiness=GO`, jesli credentiale i pozostali providerzy sa swiezo zieloni. Nie oznacza to gotowosci live spendu: wynik jawnie zapisuje `liveEffects=false`, `liveSpendEnabled=false` i `controlledExternalMutation=false`.

Po dopieciu AICO post-seed preflight do predeploy gate release nie polega juz tylko na recznym uruchomieniu readiness. Staging/production gate moze wymusic ten sam skrypt z realnym env file, a lokalny predeploy nadal nie odpala go przypadkiem na `.env.example`.

Po rozdzieleniu gate'ow AICO post-seed preflight nie jest juz ukrytym podkrokiem domain audits. To zmniejsza ryzyko, ze produkcyjna bramka readiness zostanie pominięta przez konfiguracje predeploy.

Po ustabilizowaniu `appDir` AICO post-seed preflight jest bardziej odporny na roznice miedzy `nx`, `npm --prefix`, recznym `node apps/api/scripts/...` i CI. To wzmacnia release gate bez wymagania realnych sekretow w lokalnej walidacji.

Po ustabilizowaniu `appDir` w seed-core produkcyjne seedy `dev/stg/prod` maja ten sam operacyjny kontrakt co post-seed preflight: bootuja Strapi z `apps/api` niezaleznie od cwd operatora albo CI. Lokalna walidacja potwierdza regresje bez uruchamiania realnych seedow na target-env DB.

Po dodaniu `release-env.js` audyty DB w release gate sa bardziej powtarzalne: widza jawny env file z predeploy/compose i stabilne domyslne `.env`, niezaleznie od cwd. Ten sam problem wzglednego `COMPOSE_ENV_FILE` zostal usuniety z AICO post-seed preflight. Nadal nie wykonano realnego audytu na staging/production DB w tej lokalnej iteracji, wiec target-env GO pozostaje do potwierdzenia poza lokalnym testem helpera.

Po utwardzeniu runtime AICO contract path generowanie tresci, social teaser i image designer nie zależą juz od cwd procesu przy odczycie wspolnego katalogu promptow. To usuwa kolejny lokalny punkt awarii przed target-env smoke.

Po utwardzeniu media-generator generowanie obrazow nie pisze juz temp file do przypadkowego `process.cwd()/public`. Lokalny test nie wykonuje realnego requestu providerowego ani uploadu R2, ale potwierdza kontrakt sciezki i cleanup.

Po dodaniu effect guard image generation nie wykonuje kosztownego provider call bez policy allow, swiezej readiness Replicate i tokena. To jest lokalnie potwierdzone mockami; realny Replicate/R2 smoke nadal wymaga target-env.

Po production env parity check runtime API nie moze juz wystartowac w production z `AICO_ALLOW_MISSING_TOKEN=true`, nawet jesli ktos ominie shellowy predeploy. Lokalny `.env.production.generated` pozostaje blokowany przez env guard i wymaga odswiezenia realnymi danymi operatora, zanim sensowne bedzie uruchamianie post-seed preflight na target-env.

Po lokalnym release-candidate gate kod i lockfile przechodza aktualny zestaw lokalnych bramek: production high npm audit root/API, `ops:predeploy:local`, lint, typecheck, API/plugin/cart tests, frontend coverage, frontend production build, Playwright E2E i Docker Compose config. To oznacza, ze po stronie repo nie zostal znany lokalny blocker produkcyjny poza sekretami/env oraz docelowym smoke na realnym srodowisku.

Nadal nie wolno uznac target-env za produkcyjnie uruchomiony, dopoki `.env.production.generated` nie przejdzie `ops/production-env-check.sh`, a potem target-env `api:aico-post-seed-preflight` nie potwierdzi `production-readiness=GO` na realnych providerach. Klucz OpenRouter nie zostal wpisany do komend ani raportow; realny smoke uzyl wartosci z env file i nie logowal sekretu. Poniewaz sekret pojawil sie w rozmowie, nadal powinien zostac zrotowany przed docelowym release.

Po dodaniu bezpiecznego OpenRouter smoke realny request do OpenRouter przeszedl na env file bez logowania tokenu. Env guard zostal zaostrzony dla controlled ads: brak Meta/Google Ads credentials jest teraz wykrywany przed Strapi/provider readiness. `.env.production.generated` ma juz bezpieczne flagi controlled full-autonomy RC, a pozostale 20 blockerow to realne sekrety, provider IDs albo model/credentials do uzupelnienia przez operatora.
