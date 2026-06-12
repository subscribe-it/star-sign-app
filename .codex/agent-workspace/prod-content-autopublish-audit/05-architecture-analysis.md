# Analiza architektury

Date: 2026-05-08
Role: System Architect

## Obecny przepływ

1. API Strapi startuje i w `apps/api/src/index.ts` wykonuje bootstrap contentu, mediów i workflowów AICO.
2. Produkcyjny seed ręczny uruchamia `apps/api/scripts/seed-prod.js`, dalej `seedWithMode('prod')`.
3. Plugin AICO rejestruje cron co minutę.
4. `orchestrator.tick()` robi:
   - `processStrategyAutomationTick(now)`,
   - `processGenerationTick(now)`,
   - `processPublicationTick(now)`,
   - `socialPublisher.publishPending(now)`.
5. Social tickety powstają przy wygenerowaniu treści przez `generateTeaser()`, a publikowane są później przez `publishPending()`.

## Główne blokery architektoniczne

### 1. Env produkcyjny wyłącza generowanie

Lokalny `.env.production.generated` ma `AICO_ENABLE_WORKFLOWS=false` i pusty `AICO_OPENROUTER_TOKEN`. W takim stanie seed może zakończyć się poprawnie operacyjnie, ale nie włączy workflowów AICO. To spójne z live objawem: publiczny content zatrzymał się na 2026-05-06.

### 2. Seed global settings może nadpisać ustawienia AICO

`seedAicoSettings()` zapisuje w store tylko:

```json
{
  "timezone": "Europe/Warsaw",
  "locale": "pl"
}
```

To jest ryzykowne, bo bootstrap potrafi przygotować `image_gen_model` i zaszyfrowany token Media Gen, a seed może później zredukować store do dwóch pól. Ten seed powinien mergować istniejące ustawienia i dopisywać brakujące klucze, a nie zastępować cały obiekt.

### 3. Seed nie konfiguruje strategii i autopilota jako gotowego trybu produkcyjnego

Nowe workflowy dostają domyślne pola z kontraktu, ale `strategy_enabled` i `auto_publish_guardrails.strategy.auto_approve_plan` nie są jawnie ustawione dla produkcyjnego bloga. To oznacza, że system może mieć workflowy, ale nie mieć trwałego mechanizmu odnawiania kolejki tematów.

### 4. Social publishing nie ma kompletnego onboarding przez env/seed

Schema workflow obsługuje credentiale:

- Facebook: `fb_page_id`, `fb_access_token_encrypted`
- Instagram: `ig_user_id`, `ig_access_token_encrypted`
- X: `x_api_key`, `x_api_secret_encrypted`, `x_access_token_encrypted`, `x_access_token_secret_encrypted`

Natomiast stack/env nie mają zmiennych do ich bezpiecznego przekazania seedowi. Bez ręcznej konfiguracji w Admin UI albo seed importu z env social publikacja będzie blokowana przez `missing_*_config`.

### 5. Social URL ma starą domenę

Kod używa `https://star-sign.app` jako fallback:

- `AICO_SOCIAL_DEFAULT_IMAGE_URL || 'https://star-sign.app/assets/og-default.jpg'`
- fallback `targetUrl` w social publisherze,
- target URL w orchestratorze dla horoskopów, tarota i artykułów.

Ta domena nie rozwiązuje DNS podczas audytu. Produkcja powinna używać `https://star-sign.pl` i publicznych URL-i CDN/R2.

## Rekomendowana architektura naprawy

### Warstwa seed/post-seed

- Dodać deterministyczny post-seed preflight bez sekretów.
- Rozszerzyć produkcyjny seed tak, aby:
  - wymagał tokena OpenRouter, jeśli ma włączać workflowy,
  - mergował global settings,
  - konfigurował image generation z env,
  - konfigurował blog workflow pod autopilot strategii,
  - tworzył minimalny backlog topic queue,
  - importował credentiale social z env tylko jako zaszyfrowane wartości w DB albo jasno raportował, że wymagają ręcznego ustawienia.

### Warstwa runtime

- Zostawić jeden API worker w produkcji dopóki nie ma row claiming dla kolejek social/publication.
- Użyć istniejącego runtime locka dla ticka.
- Dodać czytelne statusy blokad: brak tokena, brak backlogu, brak media, brak credentiali, zła domena.

### Warstwa social

- Zastąpić hard-coded `star-sign.app` konfiguracją:
  - `FRONTEND_URL=https://star-sign.pl`,
  - `SERVER_URL=https://api.star-sign.pl`,
  - `AICO_SOCIAL_DEFAULT_IMAGE_URL=https://cdn.star-sign.pl/...`.
- W preflight sprawdzać HTTP 200 dla przykładowego target URL i media URL.
- Live provider calls wykonywać dopiero po jawnej zgodzie operatora.

## Alternatywy

- Ręczna konfiguracja w Admin UI po każdym seedzie: szybka, ale nietrwała i podatna na pomyłki.
- Tylko topic queue bez autopilota strategii: bezpieczne MVP, ale skończy się po kilku tematach.
- Pełny autopilot z auto-approve: spełnia cel "samo generuje", ale wymaga mocnych guardrails i monitoringu.

## Polska konkluzja

Najlepsza ścieżka to nie przepisywanie AICO, tylko uszczelnienie produkcyjnego onboarding: env, seed, preflight, domeny i social credentials. Silnik jest już w repo, ale nie ma jeszcze niezawodnej procedury, która po seedzie zostawia produkcję w stanie "autopilot działa".
