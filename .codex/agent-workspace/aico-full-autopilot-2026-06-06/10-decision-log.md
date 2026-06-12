# Decision log

## Decision: Implement foundation, not live provider spend

Date: 2026-06-06
Agents involved: PO, Architect, Developer, QA

### Context

Plan obejmuje live social, video i reklamy, ale realne provider calls wymagaja sekretow, approvali platform i osobnych smoke testow.

### Decision

Ta fala implementuje content-type'y, policy, dry-run tick i admin API. Live provider adaptery pozostaja za tymi kontraktami.

### Alternatives considered

- Od razu implementowac live Meta/Google/TikTok/YouTube calls.
- Zostawic tylko dokumentacje.

### Rationale

Fundament daje realny postep i jest testowalny bez ryzyka sekretow, publikacji i wydatkow.

### Consequences

Full autopilot ma struktury i kontrolki, ale production GO nadal wymaga provider integrations i preflightow.

### Polish summary

Budujemy bezpieczna podloge pod pelna autonomie, nie wlaczamy jeszcze niezwalidowanych live skutkow.

## Decision: Growth Autopilot Safety Gate before provider adapters

Date: 2026-06-07
Agents involved: PO, Architect, Security, QA, Developer

### Context

Multi-agent review potwierdzil, ze fundament AICO jest bezpieczny jako dry-run/control plane, ale live provider calls wymagaja twardszej bramki. Security wskazal P0: nowa `autonomy-policy` musi byc single source of truth takze dla starego `orchestrator.tick()`, nie tylko dla nowych preview/dry-run services.

### Decision

Przed live adapterami wdrazamy safety gate: globalny kill switch i `off` mode blokuja stary cron, deklarowane limity LLM/media/video/autopublish sa egzekwowane w policy evaluatorze, a nowe mutacje Growth Ops zapisza audit trail bez sekretow.

### Alternatives considered

- Przejsc od razu do provider adapterow Meta/Google/TikTok/YouTube.
- Zostawic safety gate tylko jako rekomendacje w dokumentacji.
- Blokowac tylko nowe `autopilot.run-now`, bez starego crona.

### Rationale

Autopilot nie moze miec dwoch roznych kill switchy ani obszarow runtime poza polityka. Safety gate jest odwracalny, testowalny bez sekretow i redukuje ryzyko publikacji/spendu przed integracjami live.

### Consequences

Kolejne prace nad providerami musza najpierw przejsc przez provider readiness, RBAC/preflight, idempotency i controlled live gate. Stary cron jest teraz podporzadkowany globalnej polityce autonomii, jesli serwis polityki jest dostepny.

### Polish summary

Najpierw domykamy bezpieczniki i audyt, dopiero potem dajemy agentom prawo do realnej publikacji lub wydatkow.

## Decision: Provider readiness gates runtime effects

Date: 2026-06-07
Agents involved: Security, QA, Developer

### Context

Security review wskazal NO-GO dla pelnego live PROD GO, dopoki provider readiness istnieje tylko w `autonomy/status` i `autopilot.dryRunTick()`, ale nie blokuje realnych sciezek efektow zewnetrznych. Najbardziej ryzykowna istniejaca sciezka to social publishing.

### Decision

Provider readiness jest traktowany jako runtime gate. `autonomy/status` pokazuje matrix gotowosci, `autopilot.dryRunTick()` blokuje kroki z brakujacymi providerami, a `social-publisher.publishTicket()` sprawdza `autonomy-policy` i `provider-status` przed wywolaniem providera.

### Alternatives considered

- Zostawic provider readiness tylko jako informacyjny dashboard.
- Wpiac gate dopiero przy nowych adapterach video/ads.
- Polegac tylko na starych credential checks w social-publisher.

### Rationale

Autonomia produkcyjna wymaga, aby ta sama bramka decyzyjna byla widoczna w dry-run i egzekwowana w runtime. Stare checks providera nie wystarczaja, bo nie obejmuja globalnej polityki, stanu preflightu i centralnych powodow blokady.

### Consequences

Nastepne live adaptery video/ads musza uzyc tego samego wzorca: policy evaluate, provider readiness, audit event, idempotency, controlled live flag. Pelny PROD GO pozostaje NO-GO bez sekretow, scope'ow, strict audit i controlled live smoke.

### Polish summary

Provider readiness nie jest kosmetyka w panelu; jest twarda bramka przed efektem zewnetrznym.

## Decision: Sandbox control plane before live ads and video adapters

Date: 2026-06-07
Agents involved: Security, QA, Architect, Developer

### Context

Read-only subagents potwierdzily, ze pelny PROD GO pozostaje NO-GO: `run-now` jest dry-run, ads/video live adaptery sa niezaimplementowane, a operator potrzebuje widocznosci provider readiness i kolejek Growth Ops.

### Decision

W tej fali wdrazamy sandbox/disabled/live-disabled adapter contract dla ads i video, rozbudowujemy Growth Ops UI o autonomy/provider/job/video/ads/experiment status oraz rozszerzamy post-seed preflight o provider readiness matrix i ads/video provider modes. Tryb `live` pozostaje blokowany, dopoki nie ma prawdziwego adaptera i controlled smoke.

### Alternatives considered

- Zdjac blokade `live` i wykonac pierwsze mutacje Meta/Google/Video z runtime.
- Oznaczyc `sandbox` jako produkcyjny GO.
- Zostawic Growth Ops tylko jako backend API bez operatorskiego widoku.

### Rationale

Bez sekretow, provider approvali i smoke testow nie wolno wlaczac realnego spendu ani renderingu. Sandbox contract jest testowalny, pozwala operatorowi widziec blokady, a jednoczesnie nie tworzy falszywego poczucia produkcyjnej gotowosci.

### Consequences

Staging moze cwiczyc pelny flow control-plane bez live efektow. Produkcja nadal wymaga realnych adapterow, provider probes, preflightu na srodowisku, strict audit GO i jawnej decyzji operatora przed wlaczeniem live.

### Polish summary

Najpierw widoczny, testowalny i bezpieczny control-plane; dopiero potem live spend/render po osobnym smoke.

## Decision: Central provider probes write readiness, but do not imply live GO

Date: 2026-06-07
Agents involved: Security, QA, Developer

### Context

Po social probe nadal brakowalo wspolnego mechanizmu aktualizacji readiness dla OpenRouter, Replicate/OpenAI, ads, video i GA4. Samo reczne utrzymywanie `provider-credential-status` byloby za slabe jako produkcyjny gate.

### Decision

Dodajemy `provider-probe` service i admin endpoint `POST /providers/test-readiness`. Probe zapisuje centralny status przez `provider-status.upsert()`, nie zwraca sekretow i domyslnie nie wykonuje connectivity. Opcjonalne connectivity jest read-only i dostepne tylko dla providerow, gdzie mamy bezpieczny endpoint bez kosztu/publikacji.

### Alternatives considered

- Oznaczac providerow jako `ready` tylko na podstawie obecnosci env.
- Wykonywac od razu live smoke dla ads/video/social.
- Zostawic readiness jako reczne rekordy w tabeli.

### Rationale

Credential-only status jest przydatny operacyjnie, ale nie moze oznaczac pelnego GO. Read-only connectivity daje mocniejszy dowod dla prostych providerow, a live ads/video wymagaja osobnych adapterow i kontrolowanego smoke.

### Consequences

Growth Ops ma jeden przycisk provider preflight, a postep readiness trafia do wspolnej macierzy. Pelny PROD GO nadal wymaga, aby providerzy krytyczni mieli swiezy status `ready` po realnym, odpowiednim probe/smoke na docelowym srodowisku.

### Polish summary

Provider probe aktualizuje prawde operacyjna, ale nie robi z konfiguracji automatycznie produkcyjnego GO.

## Decision: Formal production readiness GO/NO-GO is the release gate

Date: 2026-06-07
Agents involved: Architect, Security, QA, Developer

### Context

Po dodaniu policy, provider readiness, sandbox adapterow i Growth Ops nadal brakowalo jednego autorytatywnego miejsca, ktore odpowiada, czy AICO moze byc wlaczony jako pelny produkcyjny autopilot. Bez takiej bramki operator moglby mylic zielone testy control-plane z gotowoscia do realnych reklam, publikacji wideo i zewnetrznych mutacji.

### Decision

Dodajemy `production-readiness` service jako formalna bramke `GO | GO_WITH_WARNINGS | NO_GO`. Ten sam raport jest dostepny przez admin API, widoczny w Growth Ops i uzywany przez `aico-post-seed-preflight`. Bramka sprawdza wymagany tryb full autonomy, kill switch, safety flags, cap reklam 25 PLN/day, provider readiness, strict audit flags, runtime locks, social safety, controlled live gate oraz tryby ads/video providerow. Live effects pozostaja `false`, dopoki pelny zestaw checkow nie przejdzie.

### Alternatives considered

- Traktowac wynik `verify` i `api:build` jako wystarczajacy produkcyjny GO.
- Zostawic GO/NO-GO jako reczna decyzje w dokumentacji.
- Oznaczyc sandbox ads/video jako produkcyjnie gotowy etap.

### Rationale

Pelny autopilot moze generowac koszty i publikowac tresci, wiec potrzebuje fail-closed release gate w kodzie. Testy lokalne potwierdzaja poprawnosc control-plane, ale nie dowodza gotowosci live providerow, sekretow, scope'ow ani zgodnosci reklam. Jawny `NO_GO` jest bezpieczniejszy niz ciche zalozenie, ze brak bledu builda oznacza gotowosc produkcji.

### Consequences

Pelny PROD GO pozostaje zablokowany, dopoki realne adaptery live ads/video/social, provider smoke, strict audit i kontrolowany run na srodowisku docelowym nie dadza zielonego raportu. Nowe adaptery musza integrowac sie z ta sama bramka i nie moga omijac globalnego capu ani safety flags.

### Polish summary

Od teraz produkcyjna gotowosc AICO jest decyzja raportowana przez kod, panel i preflight. Zielony build nie oznacza automatycznie live GO; obecny stan celowo pozostaje NO-GO dla realnych reklam i wideo bez kontrolowanego smoke.

## Decision: GA4 traffic import is external-read plus local-write, not view-only

Date: 2026-06-07
Agents involved: Security, QA, Developer

### Context

Roadmapa full autopilot wymaga realnej analizy ruchu, a nie tylko lokalnych eventow. GA4 Data API jest bezpieczniejszym pierwszym live providerem niz ads/video, bo jest read-only po stronie Google, ale import nadal zapisuje `traffic-snapshot` i aktualizuje `provider-status`.

### Decision

Dodajemy `traffic-ingestor.importGa4()` jako read-only GA4 Data API `runReport` z zapisem idempotentnego snapshotu. Endpoint `POST /traffic/import` dostaje osobna permisje `import-traffic`, a `POST /providers/test-readiness` osobna permisje `test-provider-readiness`. GA4 credential contract jest wspolny dla env gate, provider-probe i importu: `GA4_PROPERTY_ID` plus `AICO_GA4_ACCESS_TOKEN`, `GA4_SERVICE_ACCOUNT_JSON` albo `GOOGLE_APPLICATION_CREDENTIALS`. Produkcyjnie preferowany jest service account/ADC ze scope `analytics.readonly`; access token traktujemy jako tymczasowy smoke path.

### Alternatives considered

- Zostawic GA4 jako reczny provider status bez realnego importu.
- Uzyc tylko first-party `analytics_events`.
- Trzymac POST import/probe pod `viewTraffic`/`viewProviderStatus`.
- Dodac pelny Google SDK zamiast malego klienta JWT/fetch.

### Rationale

Autopilot potrzebuje prawdziwego zrodla ruchu do strategii i homepage/ads decisions. Read-only GA4 import przesuwa system blizej produkcji bez live spend ani publikacji. Osobne RBAC zamyka ryzyko, ze operator z uprawnieniem tylko do podgladu uruchomi zapis snapshotow albo provider readiness probe.

### Consequences

Realny PROD GO nadal wymaga kontrolowanego GA4 smoke na docelowym srodowisku i swiezego `provider-status` ze scope `analytics.readonly`. Dalsze provider importy/probes musza byc traktowane jako mutacje operatorskie, nawet jesli zewnetrzny provider jest read-only.

### Polish summary

GA4 import to pierwszy konkretny live-read provider w autopilocie, ale lokalnie zapisuje stan, wiec wymaga osobnego RBAC, audytu i provider readiness. To przesuwa traffic-analysis do produkcji bez wlaczania reklam ani publikacji.

## Decision: Replicate video render is controlled external render, not social publish

Date: 2026-06-07
Agents involved: Security, QA, Developer

### Context

Roadmapa wymaga short video pipeline, ale pelny live social publish i ads nadal sa zbyt ryzykowne bez provider approvali i smoke testow. Najbezpieczniejszy kolejny krok to uruchomienie kontrolowanego render joba u providera video, bez publikowania na TikToku/YouTube/IG.

### Decision

Dodajemy `AICO_VIDEO_PROVIDER_MODE=replicate` jako kontrolowany external render job przez Replicate-compatible HTTP predictions. Adapter wymaga `AICO_CONTROLLED_LIVE_ENABLED=true`, `AICO_VIDEO_GEN_MODEL`, `AICO_VIDEO_GEN_TOKEN` albo `REPLICATE_API_TOKEN`, swiezego `provider-status` dla `video.generate` i osobnej permisji `render-video`. Render pozostaje async job-id-only: zapisujemy `provider=replicate`, `provider_job_id`, status lokalny `rendering` i minimalne nietajne metadata; nie zapisujemy outputu, prediction URL-i, modelu ani tokenow.

### Alternatives considered

- Zostawic video tylko w sandbox/live-disabled.
- Uzyc trybu `live` bez osobnej bramki controlled-live.
- Zapisywac pelny provider payload z URL-ami i statusem.
- Pozwolic na fallback do image tokena.

### Rationale

Async job-id-only zmniejsza ryzyko wycieku danych providerowych i kosztownego polling/uploadu w tej samej operacji. Oddzielny RBAC i readiness gate chronia operatorow przed przypadkowym uruchomieniem kosztownego renderu. Brak publikacji social utrzymuje granice: video render jest external provider call, ale nie jest jeszcze live distribution.

### Consequences

Pelny PROD GO nadal wymaga realnego smoke na sekretach, provider readiness ze scope `predictions.write`, monitoring kosztow i osobnego upload/publish pipeline. Ten krok usuwa jednak blocker `provider_adapter_live_not_implemented` dla kontrolowanego renderu wideo i daje produkcyjnie testowalny poczatek video pipeline.

### Polish summary

Replicate video render jest od teraz kontrolowanym zewnetrznym render jobem, nie publikacja social. Musi przejsc przez controlled-live, provider readiness, osobny RBAC i minimalne metadata.

## Decision: Controlled ads preflight is not live ads GO

Date: 2026-06-07
Agents involved: Security, QA, Architect, Developer

### Context

Roadmapa wymaga capped live ads, ale security review wskazal, ze pelne zewnetrzne mutacje Meta/Google Ads sa nadal NO-GO bez provider-side pause/kill, atomowego budget/spend ledger, realnego sandbox/live smoke i scislych walidatorow kreacji oraz targetowania.

### Decision

Dodajemy `AICO_ADS_PROVIDER_MODE=controlled` jako etap preflightowy: wymaga `AICO_CONTROLLED_LIVE_ENABLED=true`, swiezego provider readiness dla `ads.mutate`, target URL preflightu i walidacji copy/targeting, ale nie wykonuje provider mutation ani nie wlacza live spend. Produkcyjny env gate przy full autonomy wymaga controlled ads oraz `AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED=true`; tryb `live` pozostaje zablokowany.

### Alternatives considered

- Wlaczyc prawdziwe Meta/Google Ads mutate operations od razu po provider readiness.
- Traktowac dotychczasowy `sandbox` jako wystarczajacy etap produkcyjny.
- Zostawic reklamy tylko jako lokalne plany bez preflightu target URL i provider readiness.

### Rationale

`controlled` daje operatorowi i release gate mocniejszy dowod niz lokalny sandbox, ale nadal nie tworzy kosztow ani zmian u providera. To pozwala testowac policy, RBAC, URL/copy/targeting guardy, provider readiness i production readiness bez ryzyka wydatkow lub naruszen polityk reklamowych.

### Consequences

Realny PROD GO dla reklam nadal wymaga osobnej implementacji provider adapters, provider-side pause/kill, atomowego budget ledger, controlled sandbox/live smoke na docelowym srodowisku i dowodu, ze kampanie startuja w bezpiecznym statusie. `controlled` moze dac zielony preflight control-plane, ale nie oznacza gotowosci do realnego spendu.

### Polish summary

Controlled ads to bezpieczny preflight bez wydatkow i bez mutacji providera. Pelne reklamy live pozostaja NO-GO do czasu provider-side safety, ledgerow i kontrolowanego smoke.
