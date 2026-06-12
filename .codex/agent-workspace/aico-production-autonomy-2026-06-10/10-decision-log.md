# Decision log

## Decision: Runtime env validation mirrors AICO missing-token production guard

Date: 2026-06-11
Agents involved: supervisor, architect, QA

### Context

Shellowy `ops/production-env-check.sh` wymagal `AICO_ALLOW_MISSING_TOKEN=false`, ale runtime `validateProductionEnv()` nie znal tej flagi. Kontener moglby wystartowac z niebezpiecznym env, gdyby operator ominął shellowy preflight.

### Decision

Dodac `AICO_ALLOW_MISSING_TOKEN` do runtime schema, wymagac `false` w production, uzupelnic `apps/api/.env.example` oraz test regresyjny.

### Alternatives considered

Zostawic te kontrole tylko w shellowym guardzie. Odrzucone, bo runtime start kontenera powinien miec wlasny fail-closed guard dla produkcyjnej konfiguracji.

### Rationale

Shell preflight i runtime validation musza egzekwowac ten sam minimalny kontrakt bezpieczenstwa, zwlaszcza przy flagach omijajacych brak tokenu AICO.

### Consequences

Production boot z `AICO_ALLOW_MISSING_TOKEN=true` zostanie zablokowany w aplikacji, a nie tylko w skrypcie ops. Lokalny `.env.production.generated` nadal wymaga realnych sekretow i odswiezenia poza repo.

### Polish summary

Walidacja runtime blokuje teraz produkcyjny tryb AICO bez tokenu tak samo jak env guard.

## Decision: Post-seed preflight follows production readiness profile

Date: 2026-06-10
Agents involved: supervisor, Product Owner, Virtual User, Designer, Architect, QA

### Context

Production readiness i env guard wymagaja kontrolowanego profilu full autonomy, ale post-seed preflight moze falszywie blokowac `controlled` ads i `replicate` video.

### Decision

Zmieniamy post-seed preflight tak, aby byl zgodny z profilem full autonomy i wymaganymi providerami runtime.

### Alternatives considered

- Wylaczyc check w preflight: odrzucone, bo obniza wartosc bramki.
- Wymagac recznego klikniecia provider readiness w panelu: odrzucone jako zbyt kruche operacyjnie.

### Rationale

Preflight po seedzie jest naturalnym miejscem na read-only dowod gotowosci.

### Consequences

Raport bedzie bardziej wymagajacy wobec rzeczywistych providerow, ale mniej podatny na falszywe blokady opcjonalnymi kanalami.

### Polish summary

Post-seed preflight ma byc spojny z produkcyjna bramka AICO i ma sam odswiezac bezpieczne statusy providerow social.

## Decision: Controlled-live gates are runtime requirements

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

Adaptery ads/video i production-readiness wymagaja `AICO_CONTROLLED_LIVE_ENABLED`, ale env examples i runtime validation nie wymuszaly tego spójnie.

### Decision

Dodac `AICO_CONTROLLED_LIVE_ENABLED` do env contract i wymagac go w full autonomy w shellowym env guardzie oraz runtime `validateProductionEnv`.

### Alternatives considered

Pozostawienie tej flagi tylko jako ukrytego runtime warunku w adapterach.

### Rationale

Ukryty warunek powoduje pozny NO-GO i utrudnia operatorowi przygotowanie produkcji.

### Consequences

Produkcja z `AICO_FULL_AUTONOMY_REQUIRED=true` nie wystartuje bez jawnej decyzji o controlled-live preflight.

### Polish summary

Controlled-live gate jest czescia kontraktu produkcyjnego, nie tylko detalem adaptera.

## Decision: Ads activation must reserve budget before provider adapter

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`ads-budget-ledger` istnial, ale `ads-agent.activate()` nie uzywal go przed adapterem.

### Decision

Aktywacja ads rezerwuje ledger przed adapterem, blokuje bez ledger service, oznacza ledger jako applied po sukcesie i release po blokadzie providera.

### Alternatives considered

Poleganie tylko na `autonomy-policy.evaluate`.

### Rationale

Policy check nie daje atomowej/idempotentnej rezerwacji budzetu dla efektu providerowego.

### Consequences

Activation path jest bezpieczniejszy kosztowo, ale wymaga dostepnego `ads-budget-ledger`.

### Polish summary

Budzet reklam jest rezerwowany przed wywolaniem adaptera, a nie tylko sprawdzany deklaratywnie.

## Decision: Full-autonomy readiness must include strict audit

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

Post-seed preflight wykonywal strict audit osobno, ale finalne `production-readiness` bylo wywolywane z `includeStrictAudit: false`. Taki profil mogl zwracac `GO_WITH_WARNINGS` mimo zielonych providerow i osobnego strict audit GO.

### Decision

Finalne `production-readiness` w post-seed preflight wlacza strict audit, gdy `AICO_STRICT_AUDIT_REQUIRED=true` albo `AICO_FULL_AUTONOMY_REQUIRED=true`. Kontrolowany profil moze dostac `GO` tylko wtedy, gdy providerzy sa ready, strict audit zwraca GO, polityka jest full i live effects pozostaja wylaczone.

### Alternatives considered

- Zostawic osobny strict audit poza readiness: odrzucone, bo finalna bramka release nadal widzialaby ostrzezenie.
- Wymusic live adaptery zamiast controlled profile: odrzucone jako zbyt ryzykowne kosztowo i operacyjnie na tym etapie.

### Rationale

Jedna finalna decyzja readiness jest czytelniejsza dla operatora i latwiej ja zautomatyzowac w deploy pipeline.

### Consequences

Preflight jest ostrzejszy przy full autonomy, ale zielony kontrolowany profil nie jest falszywie degradowany do `GO_WITH_WARNINGS`.

### Polish summary

Pelna autonomia wymaga strict audit w finalnym readiness, a zielony profil kontrolowany moze dac `GO` bez wlaczania live effects.

## Decision: Public homepage feed enforces active time window

Date: 2026-06-10
Agents involved: supervisor, Product Owner, Virtual User, QA

### Context

Publiczny endpoint `GET /homepage/recommendations` byl ograniczony do `status=active`, ale status moze pozostac niespojny, jezeli cron wygaszajacy rekomendacje nie wykona sie na czas albo operator zmieni rekord recznie.

### Decision

`site-alive.listPublic()` filtruje publiczne rekomendacje po `status` oraz po oknie czasu: `starts_at` moze byc puste albo w przeszlosci, a `expires_at` moze byc puste albo w przyszlosci.

### Alternatives considered

- Polegac tylko na `expireOldRecommendations()`: odrzucone, bo publiczny endpoint powinien byc odporny na opoznione joby.
- Usunac przyszle/wygasle rekordy po stronie aplikacji po pobraniu: odrzucone, bo query DB powinno ograniczac wynik i limit.

### Rationale

Publiczny feed homepage jest powierzchnia uzytkownika koncowego, wiec powinien miec defensywne filtry nawet przy problemach operacyjnych.

### Consequences

Rekomendacje z przyszlym `starts_at` albo przeszlym `expires_at` nie trafia do publicznego DTO, nawet jesli status zostal `active`.

### Polish summary

Publiczny feed homepage sam egzekwuje okno publikacji i nie ufa bezwarunkowo statusowi rekordu.

## Decision: Admin production readiness inherits strict full-autonomy audit

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

Post-seed preflight wlacza strict audit dla full autonomy, ale adminowy endpoint `autonomy.productionReadiness` wlaczal strict audit tylko po parametrze query/body. Panel operatora mogl wiec pokazywac lagodniejszy wynik niz pipeline.

### Decision

Controller `autonomy.productionReadiness` wlacza `includeStrictAudit` gdy request jawnie o to prosi albo gdy env ma `AICO_STRICT_AUDIT_REQUIRED=true` lub `AICO_FULL_AUTONOMY_REQUIRED=true`.

### Alternatives considered

- Wymagac, zeby frontend zawsze dodawal query param: odrzucone, bo backend powinien egzekwowac kontrakt produkcyjny.
- Zostawic GET jako szybki, bez strict audit: odrzucone dla full autonomy, bo daje niespojny sygnal operatorowi.

### Rationale

Readiness w panelu i readiness po seedzie musza miec te same semantyki dla produkcyjnej autonomii.

### Consequences

W full autonomy adminowy readiness moze byc wolniejszy, ale jest bardziej wiarygodny i nie ukrywa braku strict audit GO.

### Polish summary

Panel admina dziedziczy strict audit dla full autonomy, zamiast polegac na pamietaniu parametru w request.

## Decision: Admin run-now requires confirmation and production readiness GO

Date: 2026-06-10
Agents involved: supervisor, Product Owner, architect, QA

### Context

`autonomy.runNow` byl dotad `dry_run_only`, co blokowalo reczny operacyjny tick w produkcji. Proste wlaczenie live po kliknieciu byloby jednak zbyt ryzykowne, bo tick moze uruchomic generowanie, publikacje i social.

### Decision

Dodac kontrolowany live run-now: env `AICO_ADMIN_RUN_NOW_ENABLED=true`, request `live=true` albo `mode=controlled_live`, potwierdzenie `RUN_AICO_CONTROLLED_TICK` i `production-readiness=GO` ze strict auditem sa wymagane przed `orchestrator.tick()`.

### Alternatives considered

- Zostawic run-now zawsze jako dry-run: odrzucone, bo utrzymuje produkcyjny blocker operacyjny.
- Wlaczyc live run-now bez potwierdzenia i readiness: odrzucone jako zbyt ryzykowne.

### Rationale

Operator dostaje realna sciezke awaryjnego/manualnego ticka, ale backend nadal egzekwuje readiness i jawne potwierdzenie.

### Consequences

Full autonomy env i readiness wymagaja nowej flagi `AICO_ADMIN_RUN_NOW_ENABLED=true`. Bez tej flagi albo bez GO live run-now failuje przed efektem.

### Polish summary

Admin run-now nie jest juz tylko dry-runem, ale live wykonanie jest mozliwe wylacznie po potwierdzeniu i zielonym production readiness.

## Decision: Ads pause must be provider-confirmed and ledgered

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`ads-agent.pause()` ustawial lokalnie `status=paused` bez wywolania adaptera providera, mimo ze adapter ma osobna decyzje dla live pause i moze zwrocic blokade. Dodatkowo aktywacja zapisywala identyfikator kreacji do nieschematowego pola `provider_creative_id`, podczas gdy content type i typy uzywaja `provider_ad_id`.

### Decision

Pauza kampanii przechodzi przez `ads-provider-adapter.pauseCampaign()`, zapisuje `ads-budget-ledger.recordPause()` i dopiero wynik adaptera decyduje o lokalnym statusie. Live pause bez realnego adaptera zwraca `blocked`, a nie `paused`. Identyfikator kreacji reklamowej zapisujemy do `provider_ad_id`.

### Alternatives considered

- Zostawic pauze jako lokalny update: odrzucone, bo UI mogloby pokazac sukces bez efektu providerowego.
- Wymagac live provider pause natychmiast: odrzucone, bo realny adapter Meta/Google Ads nadal wymaga osobnego wdrozenia i smoke testow.

### Rationale

Operacje zatrzymujace spend musza byc audytowalne i nie moga produkowac falszywie zielonego stanu. Controlled pause pozostaje bezpiecznym noopem bez live spend, a live pause failuje jawnie.

### Consequences

Pauza wymaga dostepnego ledger service dla trybow providerowych. Brak adaptera lub ledger service blokuje operacje zamiast maskowac problem statusem `paused`.

### Polish summary

Pauza reklam jest teraz potwierdzana przez adapter i zapisywana w ledgerze; bez prawdziwego live adaptera system nie udaje, ze kampania zostala zatrzymana.

## Decision: Global kill switch triggers ads stop-loss sweep

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`orchestrator.tick()` blokowal generation, publication i social przy `global_kill_switch`, ale nie probowal uporzadkowac juz istniejacych planow reklam `ready`/`active`. W produkcyjnym systemie kill switch powinien zatrzymywac nowe efekty i probowac ograniczyc istniejacy spend.

### Decision

Dodac `ads-agent.pauseActiveForKillSwitch()`, ktory wyszukuje plany `ready`/`active` i pauzuje je przez istniejaca provider-confirmed sciezke `pause()`. `orchestrator.tick()` wywoluje ten sweep przy potwierdzonym `global_kill_switch` albo `autonomy_mode=off`, ale nie przy samej awarii odczytu policy.

### Alternatives considered

- Zostawic kill switch jako sam return z ticka: odrzucone, bo nie adresuje istniejacych reklam.
- Pauzowac reklamy takze przy `policy_unavailable`: odrzucone jako zbyt agresywne na przejsciowe problemy DB/config.
- Dodac osobny provider kill API: odlozone, bo obecna bezpieczna sciezka pauzy juz ma adapter i ledger.

### Rationale

Najbezpieczniejszy inkrement wykorzystuje juz zahardeningowana pauze reklam, wiec nie tworzy drugiego kontraktu providerowego. Sweep daje operatorowi audytowalny stop-loss bez udawania live efektow.

### Consequences

Kill switch jest bardziej produkcyjny, ale skutecznosc live pauzy nadal zalezy od realnego live adaptera. W obecnym controlled/no-spend profilu sweep potwierdza i ledgeruje noop-pause.

### Polish summary

Globalny kill switch zatrzymuje nowe ticki i uruchamia audytowalny sweep pauzujacy istniejace plany reklam przez provider-confirmed pause path.

## Decision: Manual admin ads stop-loss requires typed confirmation

Date: 2026-06-10
Agents involved: supervisor, Product Owner, Virtual User, architect, QA

### Context

Stop-loss sweep byl uruchamiany przez `orchestrator.tick()` przy kill switchu, ale operator nie mial natychmiastowego sposobu zatrzymania planow reklam z panelu. Czekanie na kolejny tick jest zbyt wolne dla awaryjnej operacji ograniczajacej spend.

### Decision

Dodac endpoint `POST /ads/campaign-plans/stop-loss` z permission `pauseAds`, backendowym potwierdzeniem `PAUSE_ACTIVE_ADS`, audytem admina i wywolaniem `ads-agent.pauseActiveForKillSwitch({ reason: 'manual_admin_stop_loss' })`. Panel admina dostaje typed API oraz input/przycisk `Pause active ads`.

### Alternatives considered

- Polegac tylko na cyklicznym ticku: odrzucone, bo awaryjne zatrzymanie reklam musi byc natychmiastowe.
- Wystawic endpoint bez potwierdzenia: odrzucone, bo operacja zbiorcza ma potencjalny efekt zewnetrzny i wymaga jawnej intencji operatora.
- Implementowac osobny provider kill path: odlozone, bo bezpieczna provider-confirmed pauza juz istnieje i ma ledger.

### Rationale

Backendowe potwierdzenie i RBAC utrzymuja safety boundary niezaleznie od UI, a typed client zmniejsza ryzyko surowych payloadow w panelu.

### Consequences

Operator moze zatrzymac aktywne/ready plany reklam z panelu bez czekania na tick. Skutecznosc live pauzy nadal zalezy od realnego live adaptera; w jego braku endpoint zwraca i audytuje blokady.

### Polish summary

Manualny ads stop-loss jest dostepny z panelu, ale tylko z RBAC `pauseAds`, potwierdzeniem `PAUSE_ACTIVE_ADS` i audytowanym wynikiem sweepa.

## Decision: Controlled ads provider probe is no-spend ready only in controlled mode

Date: 2026-06-10
Agents involved: supervisor, Product Owner, architect, QA

### Context

Centralny `provider-probe` zapisywal `blocked` dla skonfigurowanych `meta_ads` i `google_ads`, bo wymagal sandbox/live smoke. To chronilo przed falszywym live-ready, ale rozjezdzalo sie z decyzja, ze controlled ads jest bezpiecznym no-spend preflightem dla produkcyjnego profilu kontrolowanego.

### Decision

Oznaczac `meta_ads` i `google_ads` jako `ready` tylko gdy credentiale sa kompletne, `AICO_ADS_PROVIDER_MODE=controlled` i `AICO_CONTROLLED_LIVE_ENABLED=true`. Wynik i metadane musza jawnie pokazac `liveEffects=false`, `liveSpendEnabled=false` i `controlledExternalMutation=false`.

### Alternatives considered

- Zostawic `blocked`: odrzucone, bo kontrolowany profil nigdy nie dojdzie do prawdziwego `GO` po centralnym probe.
- Oznaczyc ready takze dla `live`: odrzucone, bo bez realnego adaptera/smoke bylby to falszywy sygnal produkcyjny.
- Ominac ads providerow w readiness: odrzucone, bo ukryloby brak credentiali albo nieaktualny status.

### Rationale

Controlled probe jest deklaracja gotowosci konfiguracji i bezpiecznej sciezki bez wydatkow, nie potwierdzeniem live mutacji Meta/Google Ads. Taki kontrakt pasuje do obecnego `production-readiness`, ktore nadal utrzymuje `liveEffectsAllowed=false`.

### Consequences

Docelowe srodowisko moze uzyskac kontrolowany `GO` po realnym probe i bez live spendu. Prawdziwe live kampanie nadal wymagaja osobnego adaptera, smoke testu, audytu i decyzji operatora.

### Polish summary

Provider probe dla reklam daje `ready` tylko w kontrolowanym trybie no-spend; live ads pozostaja zablokowane bez dedykowanego smoke.

## Decision: AICO post-seed preflight belongs in release gate

Date: 2026-06-10
Agents involved: supervisor, Product Owner, architect, QA

### Context

`api:aico-post-seed-preflight` jest formalna bramka AICO po seedzie i zawiera `production-readiness`, provider readiness, social preflight oraz strict audit. `ops/predeploy-check.sh` uruchamial domain audits, ale nie uruchamial tej bramki, wiec release mogl przejsc bez AICO readiness.

### Decision

Dodac osobny przelacznik `RUN_AICO_POST_SEED_PREFLIGHT` z domyslnym trybem `auto`, uruchamiany w staging/production razem z domain audits. Skrypt preflight dostaje `AICO_PREFLIGHT_ENV_FILE`, a sam `aico-post-seed-preflight.js` potrafi wczytac wskazany env file bez nadpisywania envow procesu.

### Alternatives considered

- Uruchamiac preflight zawsze: odrzucone, bo lokalny `.env.example` i brak DB falszywie psulyby lokalny predeploy.
- Tylko udokumentowac reczna komende: odrzucone, bo produkcyjna bramka powinna byc czescia release gate.
- Parsowac env file w shellu: odrzucone, bo skrypt Node moze trzymac odpowiedzialnosc blisko preflightu i nie musi wypisywac sekretow.

### Rationale

Oddzielny przelacznik pozwala operatorowi wymusic gate jawnie, a `auto` zachowuje istniejacy wzorzec staging/production. Wczytanie env file w Node ogranicza rozjazd miedzy `production-env-check`, compose config i AICO readiness.

### Consequences

Staging/production predeploy moze teraz failowac na rzeczywistym AICO `NO_GO`, zamiast przejsc tylko po statycznym env guardzie. Lokalny predeploy pozostaje lekki, dopoki operator nie wlaczy `RUN_AICO_POST_SEED_PREFLIGHT=true`.

### Polish summary

AICO post-seed preflight jest teraz czescia release gate dla staging/production i uzywa wskazanego env file, ale lokalnie pozostaje opt-in.

## Decision: AICO post-seed gate is independent from domain audits

Date: 2026-06-10
Agents involved: supervisor, Product Owner, architect, QA

### Context

Pierwsze wpiecie `RUN_AICO_POST_SEED_PREFLIGHT` bylo zagniezdzone pod `RUN_DOMAIN_AUDITS`. W praktyce staging script ustawial oba przelaczniki, ale operator mogl jawnie wlaczyc AICO gate i jednoczesnie pominac go przez `RUN_DOMAIN_AUDITS=false`.

### Decision

Przeniesc AICO post-seed preflight do osobnego bloku w `ops/predeploy-check.sh`, z wlasna decyzja `should_run_required_check "$RUN_AICO_POST_SEED_PREFLIGHT"`. Domain audits i AICO readiness gate pozostaja niezalezne.

### Alternatives considered

- Zostawic zagniezdzenie: odrzucone, bo ukrywa krytyczna bramke pod niepowiazana flaga.
- Wymusic domain audits zawsze, gdy AICO gate jest wlaczony: odlozone, bo nie jest wymagane technicznie i zmniejsza elastycznosc operatora.

### Rationale

Production readiness AICO jest osobna bramka biznesowo-techniczna. Jej uruchomienie nie powinno zalezec od tego, czy w tym samym przebiegu wlaczono audyty domenowe.

### Consequences

Operator moze wymusic AICO post-seed preflight niezaleznie. Staging/production `auto` nadal uruchamia gate, a lokalny predeploy pozostaje opt-in.

### Polish summary

AICO readiness gate jest teraz samodzielna bramka predeploy, a nie podkrok domain audits.

## Decision: AICO post-seed preflight appDir is script-relative

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`aico-post-seed-preflight.js` uzywal `compileStrapi({ appDir: process.cwd() })`. To jest kruche, bo cwd zalezy od sposobu uruchomienia przez Nx, npm albo operatora. Release gate powinien bootowac Strapi z `apps/api` niezaleznie od cwd procesu.

### Decision

Wyliczac `APP_DIR` jako `path.resolve(__dirname, '..')` i przekazywac go do `compileStrapi`. Wyeksportowac `getAppDir()` i dodac test, ktory zmienia `process.cwd()`.

### Alternatives considered

- Polegac na Nx `run-script` cwd: odrzucone, bo to mniej jawny kontrakt i latwo go zlamac recznym uruchomieniem.
- Wymagac uruchamiania tylko z `apps/api`: odrzucone, bo release gate powinien byc odporny na operatora i CI.

### Rationale

Skrypt zna swoje polozenie, wiec moze sam wskazac katalog aplikacji Strapi. To usuwa zaleznosc od zewnetrznego cwd i upraszcza operacyjny runbook.

### Consequences

`api:aico-post-seed-preflight`, `npm --prefix apps/api run aico-post-seed-preflight` i reczny `node apps/api/scripts/aico-post-seed-preflight.js` bootuja ten sam Strapi appDir.

### Polish summary

AICO post-seed preflight nie zalezy juz od current working directory procesu.

## Decision: Production seed core appDir is script-relative

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`apps/api/scripts/seed-core.js` uzywal `compileStrapi({ appDir: process.cwd() })`, a produkcyjne seedy sa odpalane przez targety Nx `api:seed:dev`, `api:seed:stg` i `api:seed:prod`. Taki kontrakt jest kruchy, bo current working directory zalezy od operatora, CI, `npm --prefix` albo wrappera Nx.

### Decision

Wyliczac `APP_DIR` jako `path.resolve(__dirname, '..')`, przekazywac `getAppDir()` do `compileStrapi` i pokryc to testem, ktory zmienia `process.cwd()` na katalog tymczasowy.

### Alternatives considered

- Polegac na Nx `run-script` cwd: odrzucone, bo reczne uruchomienie skryptu albo zmiana wrappera moglyby bootowac zlego Strapi appDir.
- Wymagac uruchamiania seedow tylko z katalogu `apps/api`: odrzucone, bo runbook produkcyjny powinien byc odporny na typowe roznice operator/CI.

### Rationale

Skrypt seed-core zna swoje polozenie w repo, wiec moze sam stabilnie wskazac katalog aplikacji Strapi. To jest ten sam wzorzec, ktory zostal przyjety dla AICO post-seed preflight.

### Consequences

Seed `dev/stg/prod` bootuje ten sam Strapi appDir niezaleznie od cwd procesu. Zmiana nie uruchamia realnych seedow lokalnie i nie dotyka sekretow; regresja testuje sam kontrakt sciezki.

### Polish summary

Production seed core nie zalezy juz od current working directory procesu i uzywa appDir wyliczonego wzgledem skryptu.

## Decision: Release gates use workspace-relative env loading

Date: 2026-06-10
Agents involved: supervisor, Product Owner, Virtual User, architect, QA

### Context

`ops/predeploy-check.sh` uruchamia `premium-content-audit` i `aico-contract-audit` jako czesc `RUN_DOMAIN_AUDITS`, a `aico-post-seed-preflight` jako osobna bramke AICO. Audyty ladowaly `.env` z `path.resolve(process.cwd(), '../../.env')` i `path.resolve(process.cwd(), '.env')`, `audit-sqlite.js` liczyl `.tmp/data.db` od `process.cwd()`, a preflight liczyl jawny env file od runtime `cwd`. To bylo kruche przy Nx, CI, `npm --prefix` i recznych uruchomieniach.

### Decision

Dodac `apps/api/scripts/release-env.js` jako wspolny helper sciezek/env, przepiac audyty i backfill na `loadReleaseEnvFiles()`, liczyc relatywny SQLite `DATABASE_FILENAME` od `apps/api` przez `resolveFromApp()`, oraz uzyc `resolveFromWorkspace()` dla relatywnego env file w AICO post-seed preflight.

### Alternatives considered

- Zostawic Nx `cwd: apps/api` jako jedyny kontrakt: odrzucone, bo release runbook i reczne debugowanie powinny byc odporne na wrapper.
- Skopiowac poprawiony loader do kazdego skryptu: odrzucone, bo duplikacja utrudnia utrzymanie i testy.
- Ladowac env tylko z `COMPOSE_ENV_FILE`: odrzucone, bo lokalne i manualne audyty nadal potrzebuja sensownych domyslnych `.env`.

### Rationale

Wspolny helper daje jeden testowalny kontrakt: jawny env file ma pierwszenstwo, domyslne pliki sa script-relative, istniejace envy procesu nie sa nadpisywane, a raporty testowe nie zwracaja wartosci sekretow.

### Consequences

Predeploy domain audits i AICO post-seed preflight sa bardziej powtarzalne i mniej zalezne od cwd. Relatywny `DATABASE_FILENAME` jest teraz interpretowany wzgledem `apps/api`; to zachowuje dotychczasowe zachowanie Nx i poprawia reczne uruchomienia z root repo.

### Polish summary

Bramki release korzystaja ze wspolnego, workspace-relative rozwiązywania env/sciezek i nie zależa juz od current working directory procesu.

## Decision: Runtime AICO contract path is module-relative

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`server/src/utils/aico-contract.ts` odczytuje katalog promptow uzywany przez `orchestrator`, `social-publisher` i `image-designer`. Dotad szukal pliku przez kilka kandydatow opartych o `process.cwd()`, co bylo kruche przy innym sposobie startu procesu albo po buildzie.

### Decision

Dodac `getAicoContractCandidates()` i `resolveAicoContentContractPath()`. Pierwsze kandydaty sa liczone wzgledem `__dirname`, dla source i dist, a dotychczasowe sciezki `cwd` zostaja jako fallback kompatybilnosci.

### Alternatives considered

- Import JSON bezposrednio w runtime helperze: odlozone, bo obecny helper czyta plik przez `fs` i dziala w testach/plugin runtime bez zmiany bundlingu.
- Usunac wszystkie fallbacki `cwd`: odrzucone na tym etapie, bo mogloby zlamac nietypowe lokalne uruchomienia, a module-relative kandydaci i tak maja pierwszenstwo.

### Rationale

Runtime AICO powinien miec deterministyczna sciezke do kontraktu promptow. Test zmieniajacy `process.cwd()` daje bezposredni dowod dla klasy awarii, ktora wczesniej dotyczyla seed/preflight/audytow.

### Consequences

Generowanie tresci nie zalezy od cwd przy odczycie prompt catalog. Fallbacki pozostaja, ale nie sa wymagane w standardowym source/dist runtime.

### Polish summary

Runtime AICO contract jest teraz odnajdywany wzgledem modulu, wiec prompt catalog nie zalezy od current working directory procesu.

## Decision: Media generator temp path is app-relative

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`media-generator.ts` pobiera obraz z providera, zapisuje go tymczasowo i przekazuje do Strapi Upload. Dotad temp katalog byl `process.cwd()/public/uploads/tmp`, co jest kruche przy innym sposobie startu procesu.

### Decision

Dodac `getMediaPublicDirCandidates()` i `resolveMediaPublicDir()`. Pierwsze kandydaty sa liczone wzgledem `__dirname` dla source i dist, a `process.cwd()/public` zostaje fallbackiem kompatybilnosci. `generateAndUpload()` zapisuje temp file w `resolveMediaPublicDir()/uploads/tmp`.

### Alternatives considered

- Zostawic `process.cwd()`: odrzucone, bo kontynuowaloby znana klase bledow operator/CI/runtime cwd.
- Wymusic nowy env dla public dir: odlozone, bo repo ma stabilne `apps/api/public`, a dodatkowy env nie jest potrzebny dla aktualnego problemu.

### Rationale

Serwis zna polozenie modulu, wiec moze sam znalezc katalog public aplikacji. Test z mockami potwierdza sciezke bez kosztownych zewnetrznych efektow.

### Consequences

Autonomiczne generowanie obrazow zapisuje temp file pod `apps/api/public/uploads/tmp` niezaleznie od cwd procesu i sprzata go po upload. Realny provider/R2 smoke nadal wymaga target-env.

### Polish summary

Media generator nie zalezy juz od current working directory przy zapisie tymczasowego pliku obrazu.

## Decision: Media generation provider call is guarded at the effect boundary

Date: 2026-06-10
Agents involved: supervisor, architect, QA

### Context

`provider-status` i `autonomy-policy` definiuja bramki dla `media.generate`, ale `media-generator.generateAndUpload()` mogl bezposrednio utworzyc klienta Replicate. Jako service efektowy powinien failowac zamkniecie nawet przy bezposrednim wywolaniu.

### Decision

Przed `new Replicate()` `media-generator` sprawdza `autonomy-policy.evaluate({ action: 'media.generate', requiresBrandSafety: true })`, potem `provider-status.checkProviders({ action: 'media.generate', providers: ['replicate'] })`, a nastepnie wymaga tokena z `input.apiToken`, `AICO_IMAGE_GEN_TOKEN` albo `REPLICATE_API_TOKEN`.

### Alternatives considered

- Polegac tylko na `media-selector`/autopilot: odrzucone, bo service efektowy moze byc uzyty bezposrednio.
- Sprawdzac tylko token: odrzucone, bo token nie dowodzi policy allow ani swiezej provider readiness.

### Rationale

Kosztowny zewnetrzny call musi miec ostatnia bramke tuz przed efektem. To jest ten sam wzorzec, ktory byl juz stosowany przy ads/video.

### Consequences

Bez policy allow albo Replicate readiness media generation konczy sie przed provider call. Testy mockuja providerow, wiec lokalnie nie ma kosztow ani efektow zewnetrznych.

### Polish summary

Generowanie obrazow przez Replicate jest teraz blokowane przy samym efekcie, jesli policy albo provider readiness nie sa zielone.

## Decision: Production high audit gate must be clean without force downgrades

Date: 2026-06-11
Agents involved: supervisor, architect, QA

### Context

Lokalny `ops:predeploy:local` zatrzymal release-candidate na production npm audit high gate. Root mial podatnosc `@angular/platform-server` oraz `fast-uri`, a API mialo high/critical advisories w zaleznosciach transitive. `npm audit fix --force` nie jest akceptowalnym domyslem dla release, bo moze proponowac breaking zmiany i downgrade glownego frameworka.

### Decision

Wyczyscic produkcyjne high audit gates przez normalne aktualizacje kompatybilne z obecnymi zakresami: Angular runtime/dev tooling zostal podniesiony do `21.2.13`, lockfile zostal odswiezony, a API lockfile przyjal bezpieczne Strapi 5.x/transitive poprawki. Nie uzywac `npm audit fix --force` w tym RC.

### Alternatives considered

- Zignorowac audit w lokalnym RC: odrzucone, bo predeploy ma blokowac znane high production vulnerabilities.
- Uzyc `npm audit fix --force`: odrzucone, bo proponowane breaking/downgrade sciezki wymagaja osobnej migracji i moglyby pogorszyc stabilnosc.
- Naprawiac tylko root albo tylko API: odrzucone, bo `ops:predeploy:local` uruchamia oba production high gates.

### Rationale

Release-candidate powinien miec czyste produkcyjne high audyty bez ryzykownych skokow wersji. Aktualizacja patch/minor w ramach obecnych glownych wersji minimalizuje ryzyko regresji i zachowuje zgodnosc z predeploy contract.

### Consequences

Root i API przechodza `npm audit --omit=dev --audit-level=high`. API audit nadal moze drukowac low/moderate advisories, a pelny dev audit moze wymagac osobnych decyzji, ale nie blokuje obecnego production high release gate.

### Polish summary

Produkcjne high audyty musza byc zielone, ale bez automatycznego `--force`; RC aktualizuje zaleznosci w stabilnym zakresie i zostawia nizsze/dev advisories do osobnej decyzji.

## Decision: Provider smoke and controlled ads credentials are first-class release gates

Date: 2026-06-11
Agents involved: supervisor, DevOps, architect, QA

### Context

OpenRouter byl kluczowym providerem AICO, ale repo nie mialo taniego smoke testu samego endpointu/tokenu. Jednoczesnie provider-probe i runbook wymagaly Meta/Google Ads credentials dla controlled ads readiness, podczas gdy shell/runtime env guard nie wykrywal ich braku wystarczajaco wczesnie.

### Decision

Dodac target `api:aico-openrouter-smoke` i opcjonalny predeploy gate `RUN_AICO_OPENROUTER_SMOKE`. Smoke wczytuje env file, wykonuje minimalny request JSON do OpenRouter i loguje tylko status/model/usage. Dodatkowo shellowy `ops/production-env-check.sh` oraz runtime `validateProductionEnv()` wymagaja Meta/Google Ads credentials, gdy `AICO_ADS_PROVIDER_MODE=controlled`.

### Alternatives considered

- Polegac tylko na post-seed `production-readiness`: odrzucone, bo OpenRouter/token i ads credentials powinny byc diagnozowane szybciej i czytelniej.
- Logowac provider response body przy smoke: odrzucone, bo moze ujawniac diagnostyke providera albo dane promptu.
- Wpisac token OpenRouter do repo albo komendy: odrzucone, bo sekret musi zostac w env/secret managerze.

### Rationale

Provider smoke daje tanie potwierdzenie, ze LLM provider jest osiagalny, a env guard powinien blokowac znane braki konfiguracji przed dotykaniem DB i provider readiness. To skraca feedback loop i ogranicza ryzyko poznych NO-GO.

### Consequences

Staging/production predeploy moze wlaczyc realny OpenRouter smoke przez `RUN_AICO_OPENROUTER_SMOKE=true` albo `PREDEPLOY_SCOPE=staging/production`. Controlled ads bez Meta/Google Ads env zostanie zablokowane juz w env guard/runtime validation.

### Polish summary

OpenRouter smoke i controlled ads credentials sa teraz jawna czescia release gate, z logami bez sekretow.
