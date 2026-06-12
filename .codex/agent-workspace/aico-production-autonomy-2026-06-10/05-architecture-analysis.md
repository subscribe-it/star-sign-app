# Architecture analysis

## Aktualny system

Plugin `ai-content-orchestrator` ma rozdzielone warstwy:

- Strapi content-types przechowuja workflowy, tickety, provider status, policy, ads/video/traffic rekordy.
- Serwisy wykonawcze obsluguja social publisher, ads agent, video agent, traffic ingestor, provider probe i production readiness.
- Admin routes/kontrolery wystawiaja Growth Ops API.
- Ops scripts (`production-env-check.sh`, `aico-post-seed-preflight.js`) sa bramka operacyjna przed GO.

## Problem architektoniczny

`production-readiness` i `ops/production-env-check.sh` znaja juz kontrolowany profil full autonomy:

- ads: `controlled`
- video: `replicate`
- social: provider readiness dla skonfigurowanych kanalow

`aico-post-seed-preflight.js` pozostaje czesciowo niespojny:

- nie rozpoznaje `controlled`/`replicate` jako poprawnych trybow,
- ocenia cala macierz providerow, przez co opcjonalne providerzy moga blokowac full autonomy,
- nie wykorzystuje istniejacego read-only social connection testu do odswiezenia provider readiness.

## Rekomendacja

Naprawic post-seed preflight jako warstwe integracyjna, bez ruszania realnych adapterow social:

- dodac helper wymaganych providerow zgodny z runtime channels,
- poprawic ocene provider modes,
- uruchamiac read-only social connection preflight przed provider readiness matrix, gdy full autonomy jest wymagane lub gdy wlaczono jawna flage preflightu.

## Wniosek po polsku

Najlepszy najblizszy inkrement to uszczelnienie bramki operacyjnej, bo ona laczy juz istniejace elementy AICO w realny proces produkcyjny.

## Raport architekta subagenta

Architekt potwierdzil, ze AICO ma solidna baze controlled autopilot, ale nie jest jeszcze potwierdzony jako pelna produkcyjna autonomia z nieograniczonymi efektami live. `production-readiness` pozostaje fail-closed i zwraca `liveEffectsAllowed=false`.

Najwazniejsze P0 wskazane przez architekta:

- Dac per-action `autonomy-policy.evaluate({ action: 'content.publish' })` w `orchestrator.publishTicket()`.
- Dopiac `ads-budget-ledger.reserveActivation / markApplied / release` do `ads-agent.activate()` przed adapterem providera.
- Przeniesc krytyczne reguly `AICO_FULL_AUTONOMY_REQUIRED` do runtime validation w `apps/api/config/env-validation.ts`.
- Wymagac controlled-live smoke/preflight jako dowodu przed pelnym GO.

W tej iteracji wdrozono pierwsze trzy punkty. Pelny live GO nadal wymaga target-environment smoke z sekretami i provider readiness.
## Inkrement: script-relative env loading dla audytow release

### Obecny stan

`ops/predeploy-check.sh` uruchamia `api:premium-content-audit` i `api:aico-contract-audit` w bloku `RUN_DOMAIN_AUDITS`. Targety Nx ustawiają `cwd: apps/api`, ale same skrypty laduja env przez `path.resolve(process.cwd(), '../../.env')` i `path.resolve(process.cwd(), '.env')`. Dodatkowo `aico-post-seed-preflight.js` ladowal jawny env file przez `path.resolve(process.cwd(), filename)`, co moglo rozjechac `COMPOSE_ENV_FILE=.env` miedzy root repo i `apps/api`.

### Decyzja architektoniczna

Wydzielic wspolny helper dla skryptow Node w `apps/api/scripts`, ktory:

- zna `APP_DIR` i `WORKSPACE_DIR` wzgledem `__dirname`,
- laduje jawny env file z `AICO_AUDIT_ENV_FILE` albo `COMPOSE_ENV_FILE`,
- laduje domyslnie root `.env` i `apps/api/.env`,
- nie nadpisuje istniejacych envow procesu.

Post-seed preflight pozostawia wlasny parser `.env`, bo obsluguje `export` i escape'y w istniejacych testach, ale uzywa `resolveFromWorkspace()` do stabilnej interpretacji sciezek wzglednych.

### Ryzyka

- Nie wolno logowac wartosci envow ani sekretow.
- Nie wolno zmienic semantyki wyboru bazy poza stabilizacja zrodel env.
- Backfill nie jest obecnie czescia predeploy gate, ale moze korzystac z tego samego helpera pozniej.

### Wniosek po polsku

Najbezpieczniejszy inkrement to wspolny, testowalny helper env dla audytow DB oraz uzycie tego samego workspace-relative resolution w post-seed preflight. Nie zmienia zapytan SQL ani kontraktu danych, tylko stabilizuje warstwe uruchomieniowa.

## Inkrement: module-relative runtime AICO contract

### Obecny stan

`server/src/utils/aico-contract.ts` mial liste kandydatow oparta o `process.cwd()`. W typowym Strapi/Nx uruchomieniu to przechodzilo, ale runtime pluginu nie powinien wymagac konkretnego cwd, szczegolnie po buildzie albo w wrapperach deploymentowych.

### Decyzja architektoniczna

Dodac eksportowane `getAicoContractCandidates()` i `resolveAicoContentContractPath()`, gdzie pierwsze kandydaty sa liczone wzgledem `__dirname`:

- source: `apps/api/src/bootstrap/aico-content-contract.json`,
- dist: `apps/api/dist/src/bootstrap/aico-content-contract.json`,
- fallbacki `cwd` tylko dla kompatybilnosci starszych uruchomien.

### Wniosek po polsku

Runtime AICO korzysta ze stabilnej sciezki do katalogu promptow bez zmiany modelu danych ani promptow. To jest warstwa niezawodnosci, nie zmiana biznesowa.

## Inkrement: app-relative media generator temp path

### Obecny stan

`media-generator.ts` tworzyl `public/uploads/tmp` przez `path.join(process.cwd(), 'public')`. W standardowym uruchomieniu z `apps/api` to dzialalo, ale proces Strapi/Nx/CI nie powinien wymagac konkretnego cwd dla zapisu plikow runtime.

### Decyzja architektoniczna

Dodac `getMediaPublicDirCandidates()` i `resolveMediaPublicDir()`, gdzie pierwsze kandydaty sa liczone wzgledem `__dirname` dla source i dist, a `process.cwd()/public` zostaje tylko kompatybilnosciowym fallbackiem. `generateAndUpload()` uzywa `resolveMediaPublicDir()/uploads/tmp`.

### Wniosek po polsku

Media generator zapisuje temp file w katalogu public aplikacji, niezaleznie od cwd procesu. Nie zmienia to providera, upload service ani modelu danych.

## Inkrement: media.generate effect guard

### Obecny stan

`media-generator.generateAndUpload()` byl bezposrednim effect boundary dla Replicate image generation. `provider-status` i `autonomy-policy` mialy juz kontrakty dla `media.generate`, ale generator nie egzekwowal ich samodzielnie.

### Decyzja architektoniczna

Dodać `assertMediaGenerationAllowed()` w `media-generator.ts`, wykonywane przed `new Replicate()`:

- `autonomy-policy.evaluate({ action: 'media.generate', requiresBrandSafety: true })`,
- `provider-status.checkProviders({ action: 'media.generate', providers: ['replicate'] })`,
- `resolveImageGenToken()` z kolejnoscia `input.apiToken`, `AICO_IMAGE_GEN_TOKEN`, `REPLICATE_API_TOKEN`.

### Wniosek po polsku

Guard przy samym efekcie jest potrzebny nawet wtedy, gdy wyzsza warstwa zwykle robi planowanie. To wzmacnia produkcyjna granice kosztow i provider readiness.
