# Runbook: pełna autonomia AICO + monetyzacja (2026-08-25)

Cel: agent kompleksowo prowadzi treść serwisu (plan→generacja→media→publikacja→social→feedback),
z twardymi limitami bezpieczeństwa. Silnik już istnieje — włączenie = konfiguracja.

## 1. Warstwa polityki (w panelu admina AICO / API)
- `autonomy-policy` (rekord globalny): `autonomy_mode=full`, budżety dzienne
  (`daily_ads_budget_pln` itd.), limity (`daily_llm_request_limit`, `daily_media_job_limit`,
  `max_auto_publish_per_day`, `max_social_posts_per_day`). Kill-switch zawsze dostępny.
- Ustawienia pluginu (store): `aico_strategy_autopilot_enabled=true`,
  `aico_auto_publish_enabled=true`.

## 2. Zmienne środowiskowe produkcji (GitHub secrets/vars → .env)
- Treść: `AICO_ENABLE_WORKFLOWS=true`, `AICO_OPENROUTER_TOKEN`, `AICO_OPENROUTER_MODEL`
- Media gen: `AICO_IMAGE_GEN_TOKEN` (Replicate), `AICO_IMAGE_GEN_MODEL`
- Publikacja auto: `AICO_AUTO_PUBLISH_ENABLED=true`, `AICO_STRICT_AUDIT_REQUIRED=true`
- Social (opcjonalnie): tokeny FB/IG/X/TikTok/YT; `AICO_SOCIAL_CHANNELS`; bez tokenów kanał po prostu nie publikuje.
- Reklamy płatne (pozyskanie, kosztuje): `AICO_ADS_PROVIDER_MODE`, tokeny Meta/Google,
  `AICO_META_AD_ACCOUNT_ID`/Google customer; **domyślnie zostawić wyłączone do decyzji budżetowej**.
- Insights/feedback: `AICO_INSIGHTS_ENABLED=true`, import GA4 (`AICO_GA*`).

## 3. Kolejność wdrożenia (bezpieczna ścieżka)
1. Uzupełnić tokeny OpenRouter + image gen → `npm run ops:predeploy:staging` na zielono.
2. Włączyć `guarded` z autopilotem strategii i auto-publish draftów → obserwować runy 2–3 dni.
3. Przejść na `full` przy zachowaniu limitów dziennych; social/ads dołączać etapami.
4. Monitoring: logi `[AICO]`, audit-event, Bugsink; stop-loss ads aktywny domyślnie.

## 4. Monetyzacja
### Premium (główny kanał — gotowe)
Stripe keys + price IDs są w prod env; gating treści działa. Smoke-check planów w `ops/smoke.sh`.
Kolejne dźwignie: CTA premium w artykułach (round 3 już dodaje), newsletter→premium lejek.
### Display ads (AdSense) — gotowe do podpięcia
- Serwer eksponuje `ADSENSE_CLIENT_ID` przez `/runtime-config.json` (ten PR).
- Do zrobienia osobnym małym PR frontendowym: loader skryptu po zgodzie marketing
  (cookie-banner już ma flagę) + `<ins class="adsbygoogle">` w istniejących slotach
  (home/premium/horoscope-reader). Bez ID sloty pozostają placeholderami (zero regresji).
- Wymaga konta wydawcy AdSense właściciela (nie da się tego „włączyć" kodem).

## 5. Co jeszcze blokuje pełną autonomię na prodzie (stan 2026-09-10 — po rundach dopracowania)

### Tryb „wklej tokeny i działa" (aktualny)
Cała pętla content→publikacja jest kompletna w kodzie (testy 376/376):
generacja (cron 23:00 dla horoskopów dziennych, wg harmonogramów w
`aico-content-contract.json`) → publikacja strony (00:00) → teaser social →
tickety → autopublish FB/IG/X. Seeding credentialy social z env działa
automatycznie przy starcie (commit 0e19223), RBAC Editor auto-grant włączony
w stacku (`AICO_SYNC_EDITOR_ROLE_PERMISSIONS=true`, commit fe1b832), watchdog
treści alarmuje przez Sentry przy cichych upadkach (commit 459d81f).

**Właściciel wkleja TYLKO do env stacka w Portainerze:**
1. `AICO_OPENROUTER_TOKEN` (OpenRouter) → włącza generowanie treści.
2. `AICO_FACEBOOK_PAGE_ID` + `AICO_FACEBOOK_ACCESS_TOKEN` → publikacja FB.
3. `AICO_INSTAGRAM_USER_ID` + `AICO_INSTAGRAM_ACCESS_TOKEN` → publikacja IG.
4. `AICO_X_API_KEY`/`AICO_X_API_SECRET`/`AICO_X_ACCESS_TOKEN`/`AICO_X_ACCESS_TOKEN_SECRET` → publikacja X.
5. (opcjonalnie) `AICO_IMAGE_GEN_TOKEN` → generowanie obrazów do artykułów.

Bez tokenów social dany kanał po prostu nie publikuje (fail-safe).
Weryfikacja po wklejeniu: admin → AICO → POST `/social/test-connection`
per kanał, potem `/social/dry-run`. Pierwszy horoskop pojawi się o 00:00
następnego dnia (generacja 23:00).

### Pozostałe blokady zewnętrzne
- Kontener API na VPS może działać na zabytkowym obrazie (Portainer CE
  webhook nie robi re-pull) — patrz `.codex/agent-workspace/.../12-deploy-status.md`;
  mechanizm `PORTAINER_API_KEY` (PUT /stacks/{id} z pullImage) jest gotowy
  w workflow, wymaga klucza od właściciela.
- Tryb `guarded` domyślny — świadomie; przełączenie decyzją właściciela.

## Generowanie treści wrażliwych prawnie — reguły Lex Machina

Przy tworzeniu lub redagowaniu treści o charakterze prawnym (regulaminy,
polityki, klauzule umowne) agent AICO stosuje metodologię repozytorium
`michaleiatrak-star/Lex-Machina`:

1. **HARD GATE cytowań** — zakaz przywoływania numerów artykułów z pamięci.
   Każdy przepis weryfikowany online w ISAP / API SEJM-ELI; bez potwierdzenia
   zostaje sam tytuł aktu („brak numeru jest lepszy niż błędny").
2. **Gradient weryfikacji** — treści konsumenckie i regulaminowe wymagają
   pełnej weryfikacji; wzmianki ogólne (np. „zgodnie z RODO") wystarczą dla
   kontekstu edytorialnego.
3. **Status źródeł** — sprawdzaj aktualność instytucji i platform przed
   kierowaniem do nich użytkowników (przykład: ODR UE wyłączona od
   20.07.2025 na mocy rozporządzenia (UE) 2024/3228).
4. **Przegląd człowieka** — publikacja zmian prawnych wymaga akceptacji
   właściciela; agent przygotowuje propozycję diffu, nie deployuje sam.
