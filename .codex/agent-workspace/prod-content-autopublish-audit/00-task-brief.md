# Audyt: produkcyjne generowanie contentu i autopublikacja

Date: 2026-05-08
Role: Product Owner / Business Analyst + Virtual User
Task size: Small/Medium audit, bez edycji kodu

## Kontekst Sereny i repo

Serena byla dostepna i aktywna dla projektu `star-sign`. Odczytane pamieci:

- `project/production_seed_and_media_gen_env_2026_05_06`
- `implementation/autonomous_social_publishing_2026_05_05`
- `implementation/aico_plan_autopilot_2026_05_05`
- `audits/aico_plugin_audit_2026_05_05`
- `audits/app_audit_2026_05_05`
- `project/local_seed_assets_api_parity_2026_05_06`
- `project/zodiac_profile_media_seed_auto_discovery_2026_05_06`
- `project/production_deployment_audit_2026_05_05`
- `project/production_deploy_status_2026_05_06`

Lekkie rozpoznanie repo:

- Nx projekty: `api`, `frontend`, `ai-content-orchestrator`, `cart`, `@org/types`, `frontend-e2e`.
- `api` ma target `seed:prod`.
- `ai-content-orchestrator` ma testy, build, lint i verify.
- Produkcyjny seed jest blokowany przez `ALLOW_PRODUCTION_SEED=true`.
- AICO cron rejestruje tick co minute i wywoluje kolejno strategię, generowanie, publikacje contentu oraz publikacje social.

## Wnioski PO / BA

Problem: produkcja ma byc samowystarczalna po seedzie, ale obecnie seed i ustawienia nie gwarantuja pelnej petli: planowanie tematow -> generowanie tresci -> publikacja w aplikacji -> utworzenie teaserow -> publikacja na Facebooku, Instagramie i X.

Najwazniejszy blocker biznesowy: sam seed moze wlaczyc workflowy, ale globalny `aico_strategy_autopilot_enabled` domyslnie pozostaje falszywy i `seedAicoSettings` zapisuje tylko `timezone` oraz `locale`. Bez autopilotu strategii blog moze szybko skonczyc backlog tematow albo nie tworzyc nowych tematow automatycznie.

Drugi blocker: autopilot strategii domyslnie tworzy pozycje planu, ale nie wrzuca ich do kolejki tematow, dopoki guardrail `auto_approve_plan` nie jest jawnie wlaczony. To jest bezpieczne, ale nie spelnia celu "sama generuje content" bez konfiguracji produkcyjnej.

Trzeci blocker: social publishing wymaga kompletnej konfiguracji per workflow: aktywne kanaly, publiczny URL obrazu, docelowy URL, tokeny/ID Facebooka i Instagrama oraz komplet credentiali X. Brak ktoregos elementu powinien blokowac publikacje zamiast cicho udawac sukces.

MVP zakres naprawy:

1. Seed produkcyjny powinien tworzyc bezpieczny tryb autopilotu dla produkcji: jawny globalny wlacznik strategii albo osobny seed/post-seed checklist, nie przypadkowy domysl.
2. Produkcyjny workflow blogowy musi miec `strategy_enabled=true` oraz guardrails strategii opisujace, czy plan ma byc auto-approved.
3. Po seedzie musi istniec minimalny backlog tematow lub automatyczne jego uzupelnianie.
4. Social channels dla MVP: Facebook, Instagram i X; TikTok zostaje poza zakresem jako draft-only.
5. Musi istniec preflight pokazujacy: workflow enabled, token LLM obecny, media coverage OK, image token/model OK, social credentials OK, publiczne media URL OK, domena produkcyjna OK.

## Akceptacja

- Po `ALLOW_PRODUCTION_SEED=true npm run seed:prod` system raportuje, ile workflowow AICO jest wlaczonych, czy jest token LLM, czy jest coverage mediow i ile tematow trafiło do kolejki.
- W produkcji cron AICO wykonuje tick i w logach lub run-logach widac etap strategii, generowania i publikacji.
- Blogowy workflow automatycznie ma co generowac: pending topic queue albo auto-approved strategy backlog.
- Wygenerowany content otrzymuje ticket publikacyjny i po czasie publikacji ma `publishedAt`.
- Dla opublikowanej tresci tworza sie social tickets dla Facebooka, Instagrama i X.
- `publishPending` publikuje lub jawnie blokuje ticket z czytelnym `blocked_reason`.
- Operator widzi, czy problemem jest brak credentiali, brak publicznego media URL, brak domeny, limit guardrails czy blad providera.

## Business rules

- Produkcyjny seed musi byc jawnie potwierdzony przez `ALLOW_PRODUCTION_SEED=true`.
- Brak tokena OpenRouter w trybie prod ma blokowac wlaczenie workflowow lub seed.
- Autopublikacja social nie moze publikowac na kanal, ktory nie jest aktywny w workflow.
- X musi respektowac limit 280 znakow.
- Publikacja social wymaga publicznego URL obrazu.
- TikTok nie jest kanalem live w MVP.
- Sekrety nie trafiaja do repo, workspace, logow audytowych ani pamieci Sereny.

## Out of scope

- Rozbudowana strategia SEO, sezonowosc astrologiczna i zaawansowana ocena jakosci tematow.
- TikTok live publishing.
- Enterprise multi-replica hardening ponad minimalny runtime lock.
- Live testy providerow bez jawnej autoryzacji i prawdziwych credentiali.
- Redesign Admin UI.

## Ryzyka

- `targetUrl` w generowaniu teaserow jest obecnie na `https://star-sign.app`, co moze byc niespojne z produkcja `star-sign.pl`.
- Autopilot strategii jest globalnie opt-in, wiec produkcja moze wygladac "zielono" po seedzie, ale nie generowac nowych tematow.
- Seed topic queue zalezy od aktywnego workflow blogowego albo wymuszenia `AICO_SEED_TOPIC_QUEUE_ENABLED=true`.
- Social tickets powstaja przy generowaniu contentu, nie przy samym publish ticku. Jesli generowanie nie dziala, social pipeline tez nie ruszy.
- Historycznie produkcja miala problemy DNS/Traefik; social target URL i media URL musza byc publicznie osiagalne.
- W audytach AICO nadal widnieja ryzyka P1/P0 dotyczace provider payload, RBAC, audytu i multi-replica locking.

## Pytania otwarte

- Czy po seedzie produkcja ma od razu auto-approve'owac tematy blogowe, czy najpierw tylko tworzyc plan do zatwierdzenia?
- Jaka domena ma byc zrodlem linkow w postach social: `star-sign.pl` czy inna kanoniczna domena?
- Czy wszystkie workflowy maja publikowac social, czy tylko blog/tarot/horoskopy?
- Czy produkcja ma dzialac jako single-worker API, czy jest plan na wiecej replik?
- Czy dostepne sa juz prawdziwe credentiale Meta i X oraz zgoda na live/dry-run testy?

## Obserwacje Virtual User

Jako operator nietechniczny oczekiwalbym jednego ekranu "Gotowosc autopilota", a nie czytania logow. Chce zobaczyc proste statusy: "generowanie wlaczone", "sa tematy", "social gotowy", "ostatnia publikacja", "co blokuje nastepny post".

Najwieksze zrodlo frustracji: seed konczy sie powodzeniem, ale aplikacja nic nie publikuje, bo brak jednego ukrytego przelacznika lub credentiala. To powinno byc pokazane jako konkretna akcja: "Wlacz autopilot strategii" albo "Uzupelnij token X".

W MVP uzytkownik zaakceptuje konserwatywne limity, ale nie zaakceptuje ciszy. Kazdy brak publikacji powinien miec zrozumialy powod po polsku.

## Polska konkluzja

Najbardziej prawdopodobny powod, dla ktorego produkcja po seedzie nadal sama nie generuje contentu, to nie brak crona, tylko brak kompletnej konfiguracji autopilota strategii i/lub brak automatycznego uzupelniania kolejki tematow. Dla sociali krytyczne sa credentiale providerow, publiczne media URL i kanoniczna domena. MVP naprawy powinno skupic sie na deterministycznym post-seed preflight oraz jawnych ustawieniach produkcyjnych, nie na przebudowie calego AICO.

## Lead audit update

Date: 2026-05-08
Role: Lead / System Architect / Developer

### Fakty produkcyjne

- `https://star-sign.pl/`, `/healthz`, `https://api.star-sign.pl/api/health/ready`, articles i horoscopes zwracają HTTP 200.
- Publiczny endpoint AICO homepage recommendations zwraca HTTP 200, ale `data=[]`.
- Najnowsze publiczne artykuły mają `publishedAt=2026-05-06T14:47:45.170Z`.
- Najnowsze publiczne horoskopy mają `date=2026-05-06` i `publishedAt=2026-05-06T14:47:47.514Z`.
- Audyt wykonano 2026-05-08, więc brak publicznego dowodu generowania treści za 2026-05-07 albo 2026-05-08.

### Najważniejsze blokery z kodu/env

- `.env.production.generated` ma `AICO_ENABLE_WORKFLOWS=false` i pusty `AICO_OPENROUTER_TOKEN`.
- `seedAicoSettings()` zapisuje tylko `timezone/locale`, więc powinno zostać zmienione na merge istniejących global settings.
- Produkcyjny stack/env nie przekazuje Media Gen tokenu ani credentiali FB/IG/X.
- Social fallback target/image używa `https://star-sign.app`, a domena nie rozwiązuje DNS podczas audytu.

### Werdykt lead

NO-GO dla pełnego autopilota produkcyjnego po seedzie. Silnik AICO istnieje, ale proces produkcyjnego seeda i konfiguracji nie zostawia jeszcze systemu w stanie samodzielnego generowania i publikowania.

## QA / Test Engineer update

Date: 2026-05-08
Role: QA / Test Engineer

### Dodatkowy kontekst Sereny i Nx

Odczytane dodatkowo pamieci Sereny:

- `completion_checklist`
- `suggested_commands`
- `project_overview`
- `style_and_conventions`
- `project/predeploy_gate_2026_05_05`
- `project/production_env_gate_2026_05_05`
- `project/production_redeploy_verification_2026_05_06`

Uzyte umiejetnosci: `nx-workspace` do rozpoznania projektow i targetow Nx oraz `test-master` do struktury strategii QA. MCP Nx docs potwierdzil uzycie `nx run`, `run-many` i targetow affected/run-many. Angular CLI MCP nie wykryl osobnego workspace Angular (`workspaces: []`), wiec za zrodlo prawdy przyjeto Nx.

### Rozpoznane targety i testy

- Projekty Nx: `api`, `frontend`, `frontend-e2e`, `ai-content-orchestrator`, `cart`, `@org/types`.
- `api`: ma targety `test`, `typecheck`, `build`, `seed:prod`, `seed:stg`, `aico-contract-audit`, `premium-content-audit`.
- `ai-content-orchestrator`: ma targety `test:unit`, `test:ts:back`, `test:ts:front`, `verify`, `lint`, `build`.
- `frontend-e2e`: Playwright, domyslnie Chromium z mock API; pelna macierz przez `E2E_FULL_MATRIX=true`.
- Istniejace testy AICO obejmuja m.in. runtime lock, autopilot strategii, kolejnosc ticka, social caption repair, publishPending, guardrails, provider payload redaction i audit preflight.

### Dowody z lekkiego uruchomienia lokalnego

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 1 plik, 53 testy.
- `rtk npm exec nx run api:aico-contract-audit --outputStyle=static`: PASS, kontrakt `2026-05-05.aico-content-contract.v2`, 12 workflowow.

Nie uruchamiano produkcyjnego seeda, live provider calls, testow polaczenia Meta/X ani zadnych operacji wobec produkcji.

### Najwazniejszy wniosek QA

Obecne testy dobrze chronia pojedyncze elementy AICO, ale nie dowodza, ze po produkcyjnym seedzie cala petla dziala automatycznie. Krytyczna luka to brak automatycznego, bezpiecznego dowodu typu: seed/post-seed -> workflow enabled -> backlog/strategy gotowy -> cron tick generuje -> content ma `publishedAt` -> powstaja tickety social -> Facebook/Instagram/X publikuja albo zwracaja jawny `blocked_reason`.

## Implementation update

Date: 2026-05-08
Role: Developer Agent + System Architect + QA / Test Engineer

### Zakres implementacji P0/P1

- Produkcyjny seed AICO merguje istniejące global settings zamiast nadpisywać je samym `timezone/locale`.
- Seed obsługuje Media Gen przez `AICO_IMAGE_GEN_TOKEN` / `REPLICATE_API_TOKEN` i `AICO_IMAGE_GEN_MODEL`, bez logowania sekretów.
- Seed obsługuje credentiale Facebooka, Instagrama i X przez env, szyfruje je przez `admin::encryption` i zachowuje istniejące wartości, jeśli env nie dostarcza zamiennika.
- Seed może ustawić globalny autopublish i autopilot strategii przez jawne flagi env.
- Dla workflowów article dodano seedowanie guardrails strategii: `auto_approve_plan`, `min_topic_backlog`, `max_plan_items_per_tick`.
- Dodano skrypt `aico-post-seed-preflight`, który raportuje workflowy, token LLM, Media Gen, social credentials, publiczne URL-e, backlog/strategię, kolejki i ostatnie run-logi.
- Runtime social/orchestrator nie używa już `https://star-sign.app` jako fallbacku linków publicznych; linki są budowane z `AICO_PUBLIC_FRONTEND_URL`, `FRONTEND_URL`, `PUBLIC_FRONTEND_URL` albo fallbacku `https://star-sign.pl`.
- Stack Portainera, przykładowe env i production env check dostały komplet zmiennych dla Media Gen, social publishing i autopilota strategii.

### Ograniczenia

- Nie uruchomiono produkcyjnego seeda.
- Nie wykonano live provider calls do OpenRouter, Meta, Instagram Graph ani X.
- Preflight sprawdza poprawność i brak starej domeny w URL-ach, ale jeszcze nie wykonuje rzeczywistego HTTP 200 dla docelowego obrazu social.
- `AICO_MEDIA_GEN_REQUIRED` i `AICO_SOCIAL_PUBLISH_REQUIRED` są opcjonalnymi bramkami env; domyślnie pozostają `false`, żeby obecny env produkcyjny mógł przejść bez sekretów providerów.

### Polska konkluzja

Pierwsza implementacja usuwa główne blokery operacyjne: seed nie kasuje ustawień, potrafi przygotować Media Gen i social credentials, preflight daje jawny GO/NO-GO, a runtime nie generuje już publicznych linków do nieaktywnej domeny `star-sign.app`. Do realnego GO nadal potrzebne są prawdziwe tokeny, seed na stagingu/produkcji i kontrolowany test providerów.

## Production autonomy update

Date: 2026-05-08
Role: Product Owner / DevOps / Security / QA

### Decyzja operatora

Użytkownik potwierdził, że docelowy system ma działać w produkcji jako pełny autopilot: sam planuje, generuje content, publikuje w aplikacji i udostępnia na Facebooku, Instagramie oraz X.

### Zmieniony profil produkcyjny

- `.env.production.generated` ustawiono w tryb pełnej autonomii:
  - `AICO_ENABLE_WORKFLOWS=true`
  - `AICO_FULL_AUTONOMY_REQUIRED=true`
  - `AICO_AUTO_PUBLISH_ENABLED=true`
  - `AICO_MEDIA_GEN_REQUIRED=true`
  - `AICO_SOCIAL_PUBLISH_REQUIRED=true`
  - `AICO_STRATEGY_AUTOPILOT_ENABLED=true`
  - `AICO_STRATEGY_AUTO_APPROVE_PLAN=true`
  - backlog strategii: minimum 7 tematów, maksymalnie 3 pozycje planu na tick.
- Stack Portainera przekazuje `AICO_FULL_AUTONOMY_REQUIRED` i `AICO_AUTO_PUBLISH_ENABLED`.
- `ops/production-env-check.sh` blokuje teraz pełny tryb autonomii, jeśli brakuje któregoś z wymaganych przełączników lub sekretów.
- Poprawiono default obrazu social z `.jpg` na realnie istniejący `https://star-sign.pl/assets/og-default.png`.

### Aktualny stan bramki produkcyjnej

`ops/production-env-check.sh` celowo zwraca NO-GO, bo brakuje jeszcze realnych wartości:

- `AICO_OPENROUTER_TOKEN`
- `AICO_IMAGE_GEN_TOKEN`
- `AICO_FACEBOOK_PAGE_ID`
- `AICO_FACEBOOK_ACCESS_TOKEN`
- `AICO_INSTAGRAM_USER_ID`
- `AICO_INSTAGRAM_ACCESS_TOKEN`
- `AICO_X_API_KEY`
- `AICO_X_API_SECRET`
- `AICO_X_ACCESS_TOKEN`
- `AICO_X_ACCESS_TOKEN_SECRET`

### Polska konkluzja

Repo i lokalny profil produkcyjny są teraz ustawione pod pełną automatyzację, ale produkcyjny guard słusznie blokuje start do czasu uzupełnienia realnych sekretów providerów. To jest zamierzone: system ma działać sam, ale nie może udawać gotowości bez kluczy do generowania i publikacji.
