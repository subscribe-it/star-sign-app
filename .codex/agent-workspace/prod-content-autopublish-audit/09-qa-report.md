# Raport QA: audyt bezpieczny offline

Date: 2026-05-08
Role: QA / Test Engineer

## Zakres wykonany

- Uzyto Sereny: initial instructions, projekt `star-sign`, onboarding, pamieci projektowe i wyszukiwanie semantyczne/pattern search.
- Uzyto Nx MCP docs i skill `nx-workspace` do rozpoznania targetow.
- Uzyto skill `test-master` do strategii QA.
- Wykonano lekkie, lokalne targety bez providerow live.
- Nie edytowano kodu aplikacji.
- Nie uruchomiono produkcyjnego seeda, live provider calls ani operacji destrukcyjnych.

## Uruchomione komendy

| Komenda | Wynik | Uwagi |
|---|---:|---|
| `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static` | PASS | 1 plik, 53 testy |
| `rtk npm exec nx run api:aico-contract-audit --outputStyle=static` | PASS | Kontrakt `2026-05-05.aico-content-contract.v2`, 12 workflowow |

## Co potwierdzono

- AICO ma minute tick rejestrowany w bootstrapie pluginu.
- Tick wywoluje strategia -> generowanie -> publikacja contentu -> social publish.
- Produkcyjny seed jest jawnie blokowany przez `ALLOW_PRODUCTION_SEED`.
- Kontrakt AICO obejmuje 12 workflowow, w tym horoskopy, tarot dnia i blog.
- Unit testy AICO pokrywaja wazne elementy: runtime lock, autopilot strategii, social guardrails, redakcje provider payload i kolejke social.
- Dokumentacja AICO wymaga recznego strict audit przed wlaczeniem autonomicznych workflowow.

## Czego nie testowano

- Nie testowano prawdziwej produkcji.
- Nie uruchamiano `api:seed:prod`.
- Nie wykonywano polaczen do OpenRouter, Replicate, Meta, Instagram Graph ani X.
- Nie wykonywano live publish ani dry-run providerow.
- Nie testowano Admin UI przez Playwright, bo zadanie bylo audytem strategii, nie walidacja dzialajacego srodowiska.

## Werdykt QA

Status: NO-GO dla stwierdzenia, ze produkcja po seedzie automatycznie generuje content i publikuje na FB/IG/X.

Powod: brakuje dowodu end-to-end oraz automatycznego post-seed preflightu. Istniejace testy pokazuja, ze komponenty moga dzialac, ale nie dowodza, ze produkcyjny seed i runtime sa skonfigurowane jako kompletna petla automatyzacji.

## Rekomendacja

Najpierw wykonac stagingowy, niedestrukcyjny test calej petli z mockowanymi providerami i sanitized DB/reportem. Dopiero potem, po zgodzie operatora, wykonac `Test Connection`, `Dry Run` i pojedynczy kontrolowany live/sandbox publish dla Facebooka, Instagrama i X.

## Raport QA po implementacji P0/P1

Date: 2026-05-08
Role: QA / Test Engineer

### Co testowano

- Seed AICO: merge global settings, zachowanie istniejących sekretów, Media Gen model/token, globalny autopublish, autopilot strategii i social credentials.
- Preflight po seedzie: publiczne URL-e, detekcja `star-sign.app`, brakujące credentiale social bez wycieku sekretów, gotowość blog automation.
- Runtime public URL: fallback do `https://star-sign.pl`, priorytet `AICO_PUBLIC_FRONTEND_URL`, override `AICO_SOCIAL_DEFAULT_IMAGE_URL`.
- Ops/env: production env check z opcjonalnymi bramkami Media Gen/social, walidacja stacka Portainera.

### Wyniki

- Syntax check skryptów: PASS.
- `api:test`: PASS, 134 testy.
- `ai-content-orchestrator:test:unit`: PASS, 56 testów.
- `ai-content-orchestrator` TS back/front/verify: PASS.
- `api:typecheck`: PASS.
- `api:aico-contract-audit`: PASS.
- `api:premium-content-audit`: PASS.
- `ai-content-orchestrator:lint`: PASS z istniejącymi ostrzeżeniami.
- `api:lint`: PASS z istniejącymi ostrzeżeniami `no-explicit-any`.
- `ops/production-env-check.sh` na `.env.production.generated`: PASS.
- `docker compose config --quiet` dla stacka produkcyjnego: PASS.
- `git diff --check`: PASS.

### Czego nie testowano

- Nie uruchomiono `api:seed:prod`.
- Nie wykonywano połączeń do OpenRouter/Replicate/Meta/Instagram/X.
- Nie publikowano testowych postów.
- Nie sprawdzono rzeczywistego HTTP 200 dla finalnego `AICO_SOCIAL_DEFAULT_IMAGE_URL` po produkcyjnym seedzie.

### Ryzyka pozostające

- Produkcja nadal wymaga realnych sekretów w Portainerze/secret managerze.
- `AICO_MEDIA_GEN_REQUIRED` i `AICO_SOCIAL_PUBLISH_REQUIRED` są domyślnie opcjonalne, więc operator musi świadomie podnieść bramki przed pełnym GO.
- Stare fixture’y testowe nadal zawierają `star-sign.app`, dlatego antyregresję trzeba trzymać na runtime helperach/outputach, nie na globalnym `rg`.

### Werdykt QA

Status: GO dla lokalnej implementacji P0/P1.

Status: NO-GO dla pełnego produkcyjnego autopilota do czasu uzupełnienia sekretów, seedowania kontrolowanego środowiska i przejścia post-seed preflightu oraz testów providerów.
