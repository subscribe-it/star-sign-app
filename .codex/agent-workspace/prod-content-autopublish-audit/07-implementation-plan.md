# Plan naprawy

Date: 2026-05-08
Role: Developer Agent

## Priorytet P0: odblokować generowanie po seedzie

1. Ustalić docelowy tryb produkcji:
   - `AICO_ENABLE_WORKFLOWS=true`,
   - realny `AICO_OPENROUTER_TOKEN`,
   - `AICO_ALLOW_MISSING_TOKEN=false`.
2. Zmienić `seedAicoSettings()` tak, aby mergował obecne settings zamiast je nadpisywać.
3. Dodać do seeda obsługę image generation:
   - `AICO_IMAGE_GEN_TOKEN` albo `REPLICATE_API_TOKEN`,
   - `AICO_IMAGE_GEN_MODEL`,
   - status bez wypisywania wartości tokena.
4. Dodać post-seed preflight, który raportuje:
   - workflow total/enabled,
   - token LLM obecny,
   - Media Gen token/model obecny,
   - global `aico_auto_publish_enabled`,
   - topic queue pending,
   - media coverage,
   - ostatnie run-logi i błędy.

## Priorytet P0: naprawić domeny social

1. Usunąć hard-coded `https://star-sign.app` z social/orchestratora.
2. Dodać helper budujący publiczne URL-e na podstawie:
   - `FRONTEND_URL`,
   - `SERVER_URL`,
   - opcjonalnie `AICO_PUBLIC_FRONTEND_URL`,
   - `AICO_SOCIAL_DEFAULT_IMAGE_URL`.
3. Dodać test, który failuje, jeśli runtime social payload używa `star-sign.app`.
4. Ustawić w stack/env publiczny fallback image na CDN/R2.

## Priorytet P1: social credentials jako część produkcyjnego onboarding

1. Dodać obsługiwane env bez wypisywania wartości:
   - `AICO_FACEBOOK_PAGE_ID`,
   - `AICO_FACEBOOK_ACCESS_TOKEN`,
   - `AICO_INSTAGRAM_USER_ID`,
   - `AICO_INSTAGRAM_ACCESS_TOKEN`,
   - `AICO_X_API_KEY`,
   - `AICO_X_API_SECRET`,
   - `AICO_X_ACCESS_TOKEN`,
   - `AICO_X_ACCESS_TOKEN_SECRET`.
2. Seed powinien szyfrować te wartości przez `admin::encryption` i zapisywać do workflowów, jeśli env są ustawione.
3. Jeśli env nie są ustawione, preflight ma zwracać `needs_action`, nie cichy sukces.
4. Ustalić zakres kanałów:
   - MVP: Facebook, Instagram, X.
   - TikTok pozostaje `draft_only`.

## Priorytet P1: backlog i strategia

1. Produkcyjny seed ma tworzyć minimum 7 tematów w `topic-queue-item`, jeśli workflow blogowy jest aktywny.
2. Dodać flagę produkcyjną dla strategii, np. `AICO_STRATEGY_AUTOPILOT_ENABLED=true`.
3. Dla pełnej automatyzacji dodać jawny guardrail:

```json
{
  "strategy": {
    "enabled": true,
    "auto_approve_plan": true,
    "min_topic_backlog": 3,
    "max_plan_items_per_tick": 2
  },
  "social": {
    "max_posts_per_run": 6
  }
}
```

4. Jeśli operator nie chce auto-approve, preflight powinien mówić: "plan powstaje, ale nie trafi sam do kolejki".

## Priorytet P2: operator UX

1. W Admin UI pokazać prostą gotowość autopilota:
   - generowanie,
   - backlog,
   - media,
   - social credentials,
   - domena,
   - ostatni tick,
   - ostatni `blocked_reason`.
2. Nie wymagać od operatora czytania logów.
3. Zachować krótkie komunikaty po polsku.

## Testy po implementacji

- `rtk npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`
- `rtk npm exec -- nx run-many --targets=test:ts:back,test:ts:front,verify --projects=ai-content-orchestrator --outputStyle=static`
- `rtk npm exec -- nx run api:test --outputStyle=static`
- `rtk npm exec -- nx run api:aico-contract-audit --outputStyle=static`
- `rtk npm exec -- nx run api:premium-content-audit --outputStyle=static`
- staging post-seed preflight bez sekretów
- social `Test Connection` i `Dry Run` dopiero po zgodzie operatora

## Polska konkluzja

Naprawa powinna iść w małych krokach: najpierw env/seed/preflight i domeny, potem social credentials, potem automatyczne odnawianie backlogu. Bez tego sama obecność crona nie wystarczy.

## Status implementacji - 2026-05-08

### Zrobione

- P0 seed/settings: `seed-core.js` merguje ustawienia AICO, zachowuje istniejące sekrety i dopisuje tylko jawnie skonfigurowane wartości.
- P0 Media Gen: seed obsługuje token/model i raportuje obecność tokenu bez ujawniania wartości.
- P0 preflight: dodano `apps/api/scripts/aico-post-seed-preflight.js` oraz skrypt `aico-post-seed-preflight` w `apps/api/package.json`.
- P0 domeny social: dodano helper `public-url.ts`; orchestrator i social publisher używają `star-sign.pl` albo jawnego env zamiast `star-sign.app`.
- P1 social credentials: seed obsługuje Facebook, Instagram i X oraz zachowuje istniejące zaszyfrowane credentiale.
- P1 strategy/backlog: seed obsługuje flagi autopilota strategii i guardrails dla workflowów article.
- P1 env/ops: `.env.example`, `apps/api/.env.example`, stack Portainera i `ops/production-env-check.sh` opisują nowe zmienne.

### Nadal do wykonania przed GO

- Uzupełnić realne sekrety w bezpiecznym secret managerze/Portainerze, nie w repo.
- Uruchomić seed na stagingowej kopii produkcji.
- Uruchomić `aico-post-seed-preflight` po seedzie i zapisać sanitized wynik.
- Wykonać social `Test Connection`, `Dry Run` i pojedynczy kontrolowany publish dopiero po zgodzie operatora.
- Rozszerzyć preflight o rzeczywiste HTTP 200 dla publicznego obrazu social, jeśli ma stać się twardą bramką release.

### Polska konkluzja

Implementacja domyka pierwszy etap naprawy: aplikacja ma teraz mechanizm przygotowania produkcyjnego seeda i audytu po seedzie. Pełne uruchomienie autopilota wymaga jeszcze danych produkcyjnych i kontrolowanej walidacji providerów.
