# GitHub Secrets i Variables — kompletna konfiguracja deployu (Star Sign + plugin AICO)

Ten dokument opisuje **wszystkie** sekrety i zmienne potrzebne do pełnego działania aplikacji oraz pluginu **AICO** na produkcji, oraz jak je ustawić.

## Jak działa deploy (kontekst)

Push na `main` → GitHub Actions (`.github/workflows/deploy-production.yml`) buduje obrazy → **GHCR** (`ghcr.io/subscribe-it/star-sign-{api,frontend}`) → webhook **Portainera** stawia stack na VPS. Pipeline składa plik `.env.production` z konfiguracji repo i waliduje go (`ops/production-env-check.sh`) zanim cokolwiek pójdzie dalej.

### Dwa tryby dostarczania configu (wybierany automatycznie)

1. **Indywidualny (docelowy)** — każda zmienna to osobny **GitHub Secret** (wrażliwe) lub **Variable** (niewrażliwe). Włącza się, gdy ustawiony jest sekret-wartownik **`APP_KEYS`**. Pipeline składa `.env.production` automatycznie ze wszystkich secrets+variables (`toJSON`), pomijając klucze sterujące deployem.
2. **Bundled (legacy, fallback)** — jeśli `APP_KEYS` nie jest ustawiony, a istnieje sekret **`STAR_SIGN_PRODUCTION_ENV`** (całe `.env` w jednym sekrecie), używany jest on. Pozwala to na bezpieczną migrację.

> **Migracja na indywidualne:** ustaw wszystkie indywidualne sekrety/zmienne → odpal deploy i potwierdź, że przeszedł → dopiero potem usuń `STAR_SIGN_PRODUCTION_ENV` (`gh secret delete STAR_SIGN_PRODUCTION_ENV`). Dopóki `APP_KEYS` jest ustawiony, ma on priorytet nad bundled.

## Klucze sterujące deployem (NIE wchodzą do `.env` aplikacji)

| Nazwa | Typ | Wymagane | Opis |
| --- | --- | --- | --- |
| `PORTAINER_WEBHOOK_URL` | secret | tak | Webhook stacka Portainera — wyzwala pull obrazów + redeploy na VPS. |
| `API_BASE_URL` | variable | tak | Bazowy URL API do smoke/e2e po deployu, np. `https://api.star-sign.pl/api`. |
| `FRONTEND_BASE_URL` | variable | tak | Bazowy URL frontu do smoke/e2e, np. `https://star-sign.pl`. |
| `DEPLOY_WAIT_SECONDS` | variable | nie (def. 90) | Ile czekać na rollout przed smoke testami. |
| `STAR_SIGN_PRODUCTION_ENV` | secret | tylko legacy | Całe `.env` w jednym sekrecie (fallback). Po migracji usuń. |
| `GITHUB_TOKEN` | auto | — | Wstrzykiwany automatycznie przez Actions (push do GHCR). Nie ustawiać. |

## Sekrety i zmienne aplikacji + AICO (wchodzą do `.env.production`)

Legenda: **S** = GitHub Secret (wrażliwe), **V** = GitHub Variable (jawne). „Wymóg": ✅ zawsze · 🔶 warunkowo (gdy dana funkcja włączona) · ⚪ opcjonalnie.

### Strapi core (zawsze)

| Klucz | Typ | Wymóg | Opis / jak wygenerować |
| --- | --- | --- | --- |
| `NODE_ENV` | V | ✅ | `production`. |
| `APP_KEYS` | S | ✅ | 4 losowe klucze po przecinku. **Wartownik trybu indywidualnego.** `printf '%s,%s,%s,%s' $(for i in 1 2 3 4; do openssl rand -base64 32; done)`. |
| `API_TOKEN_SALT` | S | ✅ | `openssl rand -base64 32`. |
| `ADMIN_JWT_SECRET` | S | ✅ | `openssl rand -base64 32`. |
| `TRANSFER_TOKEN_SALT` | S | ✅ | `openssl rand -base64 32`. |
| `JWT_SECRET` | S | ✅ | `openssl rand -base64 32`. |
| `ENCRYPTION_KEY` | S | ✅ | **hex, min 32 znaki** (szyfruje tokeny AICO): `openssl rand -hex 32`. |

### URL-e i CORS (zawsze)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `PRODUCTION_DOMAIN` / `FRONTEND_DOMAIN` / `API_DOMAIN` / `BUGSINK_DOMAIN` | V | ✅/⚪ | Domeny (Traefik/Caddy). |
| `FRONTEND_URL` | V | ✅ | `https://star-sign.pl` (HTTPS, nie-localhost). |
| `API_PUBLIC_URL`, `SERVER_URL` | V | ✅ | `https://api.star-sign.pl` (`SERVER_URL` wymagany dla mediów social/AICO). |
| `API_URL` | V | ✅ | Wewnętrzny URL API dla SSR, np. `http://api:1337/api`. |
| `CORS_ORIGIN` | V | ✅ | CSV dozwolonych originów (HTTPS), np. `https://star-sign.pl`. |
| `UPLOAD_ASSET_CSP_ORIGINS` | V | ⚪ | Origin CDN do CSP, np. `https://cdn.star-sign.pl`. |
| `ACME_EMAIL` | V | ⚪ | E-mail do certyfikatów. |
| `GHCR_OWNER`, `STAR_SIGN_IMAGE_TAG` | V | ⚪ | `subscribe-it`, `main`. |

### Baza danych / Redis (zawsze)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `DATABASE_CLIENT` | V | ✅ | `postgres` (sqlite odrzucane na prod). |
| `DATABASE_HOST`/`DATABASE_PORT`/`DATABASE_NAME`/`DATABASE_USERNAME` | V | ✅ | Połączenie z Postgres. |
| `DATABASE_SSL` | V | ⚪ | `true`/`false`. |
| `DATABASE_PASSWORD` | S | ✅ | Hasło DB. `openssl rand -base64 24`. |
| `POSTGRES_DB`/`POSTGRES_USER` | V | ✅ | Dla kontenera Postgres (zgodne z DATABASE_*). |
| `POSTGRES_PASSWORD` | S | ✅ | = `DATABASE_PASSWORD`. |
| `REDIS_PASSWORD` | S | ✅ | `openssl rand -base64 24`. |
| `REDIS_URL` / `RATE_LIMIT_REDIS_URL` / `HTTP_CACHE_REDIS_URL` | S | ✅ | `redis://:HASŁO@redis:6379` (zawierają hasło → sekret). |

### Limity / cache / bezpieczeństwo (zawsze, mają sensowne domyślne)

| Klucz | Typ | Opis |
| --- | --- | --- |
| `RATE_LIMIT_ENABLED` | V | musi `true` na prod. |
| `RATE_LIMIT_TRUST_PROXY` | V | `true` (za Caddy/Traefik). |
| `RATE_LIMIT_TRUSTED_PROXY_HOPS` | V | liczba zaufanych proxy (domyślnie 1). |
| `RATE_LIMIT_KEY_PREFIX`/`_PATHS`/`_WINDOW_MS`/`_MAX`/`_FAIL_OPEN` | V | strojenie limitera. |
| `HTTP_CACHE_*` (ENABLED/KEY_PREFIX/TTL/STALE) | V | cache HTTP. |
| `SECURITY_HSTS_ENABLED` | V | `true`. |
| `BODY_*_LIMIT`, `UPLOAD_MAX_FILE_SIZE` | V | limity ciała/uploadu. |

### Media — Cloudflare R2 (zawsze, gdy upload włączony)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `R2_UPLOAD_ENABLED` | V | ✅ | `true`. |
| `R2_ACCESS_KEY_ID` | S | 🔶 | Klucz R2. |
| `R2_SECRET_ACCESS_KEY` | S | 🔶 | Sekret R2. |
| `R2_S3_ENDPOINT`/`R2_BUCKET`/`R2_REGION`/`R2_FORCE_PATH_STYLE`/`R2_PUBLIC_BASE_URL`/`R2_ROOT_PATH` | V | 🔶 | Konfiguracja bucketu/CDN. |

### Newsletter / e-mail — Brevo (zawsze, gdy newsletter aktywny)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `BREVO_API_KEY` | S | 🔶 | Klucz API Brevo. |
| `BREVO_SMTP_USER` / `BREVO_SMTP_PASSWORD` | S | 🔶 | SMTP. |
| `BREVO_WEBHOOK_SECRET` | S | 🔶 | Sekret webhooka (porównywany w czasie stałym). `openssl rand -hex 24`. |
| `BREVO_LIST_ID`/`BREVO_SMTP_HOST`/`BREVO_SMTP_PORT`/`BREVO_SMTP_SECURE`/`BREVO_FROM_EMAIL`/`BREVO_REPLY_TO`/`NEWSLETTER_DOUBLE_OPT_IN` | V | 🔶 | Konfiguracja. |

### Anty-bot — Turnstile (gdy włączony)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `TURNSTILE_ENABLED` | V | ⚪ | `true`/`false`. |
| `TURNSTILE_SITE_KEY` | V | 🔶 | Klucz publiczny. |
| `TURNSTILE_SECRET_KEY` | S | 🔶 | Klucz tajny. |
| `TURNSTILE_FAIL_OPEN` | V | ⚪ | `false`. |

### Analityka — GA4 (measurement zawsze; reszta dla autonomii AICO)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `GA4_MEASUREMENT_ID` | V | ✅ | `G-XXXX` (publiczny). |
| `GTM_CONTAINER_ID` | V | ⚪ | `GTM-XXXX`. |
| `GA4_PROPERTY_ID` | V | 🔶 | Property ID (dla insightów AICO). |
| `AICO_GA4_ACCESS_TOKEN` | S | 🔶 | Token dostępu GA4 Data API. |
| `GA4_SERVICE_ACCOUNT_JSON` | S | 🔶 | JSON konta serwisowego (jeśli wieloliniowy — zakoduj base64 i odkoduj w starcie, albo trzymaj jako jedno-liniowy JSON). |
| `GOOGLE_APPLICATION_CREDENTIALS` | V | ⚪ | Ścieżka do pliku poświadczeń (alternatywa). |

### Płatności — Stripe (gdy `STRIPE_REQUIRED=true`)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `STRIPE_REQUIRED` | V | ⚪ | `true` włącza sklep premium + walidację. |
| `STRIPE_SECRET_KEY` | S | 🔶 | **live** `sk_live_...`. |
| `STRIPE_WEBHOOK_SECRET` | S | 🔶 | `whsec_...`. |
| `STRIPE_PREMIUM_MONTHLY_PRICE_ID` / `STRIPE_PREMIUM_ANNUAL_PRICE_ID` | V | 🔶 | `price_...` (nie tajne). |
| `SHOP_ENABLED`/`FRONTEND_SHOP_ENABLED`/`PREMIUM_MODE` | V | ⚪ | Flagi sklepu. |

### AICO — rdzeń (gdy `AICO_ENABLE_WORKFLOWS=true`)

| Klucz | Typ | Wymóg | Opis |
| --- | --- | --- | --- |
| `AICO_ENABLE_WORKFLOWS` | V | ⚪ | `true` włącza silnik AICO. |
| `AICO_OPENROUTER_TOKEN` | S | 🔶 | Token OpenRouter `sk-or-v1-...`. **Rotuj** (wyciek 2026-06-11). Ustaw limit USD. |
| `AICO_AUDIT_IP_HASH_SALT` | S | 🔶 | `openssl rand -base64 32`. |
| `AICO_ALLOW_MISSING_TOKEN`/`AICO_RUNTIME_LOCKS_DISABLED`/`AICO_SOCIAL_CONTENT_SAFETY_DISABLED` | V | 🔶 | Muszą być `false` na prod. |
| `AICO_OPENROUTER_MODEL`, `AICO_BACKUP_ENABLED`, `AICO_AUDIT_TRAIL_STRICT`, `AICO_STRICT_AUDIT_REQUIRED`, `AICO_PROVIDER_READINESS_MAX_AGE_HOURS`, `AICO_INSIGHTS_ENABLED` | V | ⚪ | Strojenie/flagi. |

### AICO — obraz / wideo (gdy włączone providery)

| Klucz | Typ | Opis |
| --- | --- | --- |
| `AICO_IMAGE_GEN_TOKEN` | S | Token generacji obrazów (OpenRouter). |
| `AICO_IMAGE_GEN_MODEL`, `AICO_MEDIA_GEN_REQUIRED` | V | Model/flagi. |
| `AICO_VIDEO_PROVIDER_MODE` | V | `disabled`→`replicate`. **Domyślnie disabled** (bezpiecznie). |
| `AICO_VIDEO_GEN_TOKEN` | S | Token Replicate `r8_...`. |
| `AICO_VIDEO_GEN_MODEL`, `AICO_VIDEO_GEN_CANCEL_AFTER`, `AICO_VIDEO_GEN_INPUT_JSON` | V | Konfiguracja renderu. |

### AICO — social (gdy `AICO_SOCIAL_PUBLISH_REQUIRED=true`)

| Klucz | Typ | Opis |
| --- | --- | --- |
| `AICO_SOCIAL_PUBLISH_REQUIRED`, `AICO_AUTO_PUBLISH_ENABLED`, `AICO_SOCIAL_CHANNELS`, `AICO_SOCIAL_CONNECTION_PREFLIGHT` | V | Flagi i lista kanałów. |
| `AICO_PUBLIC_FRONTEND_URL`, `AICO_SOCIAL_DEFAULT_IMAGE_URL` | V | URL-e publiczne. |
| `AICO_FACEBOOK_PAGE_ID`, `AICO_INSTAGRAM_USER_ID`, `AICO_YOUTUBE_CLIENT_ID` | V | Identyfikatory. |
| `AICO_FACEBOOK_ACCESS_TOKEN`, `AICO_INSTAGRAM_ACCESS_TOKEN` | S | Tokeny Meta. |
| `AICO_X_API_KEY`, `AICO_X_API_SECRET`, `AICO_X_ACCESS_TOKEN`, `AICO_X_ACCESS_TOKEN_SECRET` | S | X/Twitter. |
| `AICO_TIKTOK_ACCESS_TOKEN`, `AICO_YOUTUBE_CLIENT_SECRET`, `AICO_YOUTUBE_REFRESH_TOKEN` | S | TikTok/YouTube. |

### AICO — reklamy (gdy `AICO_ADS_PROVIDER_MODE` = controlled/live)

| Klucz | Typ | Opis |
| --- | --- | --- |
| `AICO_ADS_PROVIDER_MODE` | V | `disabled`→`sandbox`→`controlled`→`live`. **Domyślnie disabled.** `live` wydaje realne pieniądze (wymaga `AICO_CONTROLLED_LIVE_ENABLED=true` + kompletu credentiali + ready provider-status). |
| `AICO_CONTROLLED_LIVE_ENABLED`, `AICO_ADMIN_RUN_NOW_ENABLED`, `AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED`, `AICO_ADS_PROVIDER_TIMEOUT_MS`, `AICO_META_GRAPH_API_VERSION`, `AICO_GOOGLE_ADS_API_VERSION` | V | Bramki/wersje API. |
| `AICO_META_AD_ACCOUNT_ID`, `AICO_GOOGLE_ADS_CLIENT_ID`, `AICO_GOOGLE_ADS_CUSTOMER_ID`, `AICO_GOOGLE_ADS_LOGIN_CUSTOMER_ID` | V | Identyfikatory kont. |
| `AICO_META_ADS_ACCESS_TOKEN` | S | Token System User Meta. |
| `AICO_GOOGLE_ADS_DEVELOPER_TOKEN`, `AICO_GOOGLE_ADS_CLIENT_SECRET`, `AICO_GOOGLE_ADS_REFRESH_TOKEN` | S | Google Ads. |
| `AICO_FULL_AUTONOMY_REQUIRED`, `AICO_STRATEGY_AUTOPILOT_ENABLED`, `AICO_STRATEGY_AUTO_APPROVE_PLAN`, `AICO_STRATEGY_MIN_TOPIC_BACKLOG`, `AICO_STRATEGY_MAX_PLAN_ITEMS_PER_TICK` | V | Sterowanie autonomią (patrz panel „Centrum Autonomii"). |

### Obserwowalność (opcjonalnie)

| Klucz | Typ | Opis |
| --- | --- | --- |
| `SENTRY_DSN`, `FRONTEND_SENTRY_DSN` | S | DSN Sentry (jeśli `SENTRY_REQUIRED=true`). |
| `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_REQUIRED`, `SENTRY_TRACES_SAMPLE_RATE` | V | Konfiguracja. |
| `BUGSINK_SECRET_KEY` (min 50), `BUGSINK_POSTGRES_PASSWORD`, `BUGSINK_CREATE_SUPERUSER`, `BUGSINK_ALERT_WEBHOOK_URL` | S | Self-hosted Bugsink. |
| `BUGSINK_REQUIRED`, `BUGSINK_BASE_URL`, `BUGSINK_SITE_TITLE`, `BUGSINK_SINGLE_USER`, `BUGSINK_USER_REGISTRATION` | V | Konfiguracja. |
| `OPS_ALERT_WEBHOOK_URL` | S | Webhook alertów (Discord/Slack). |
| `STRAPI_DOCUMENTATION_ENABLED`, `STRAPI_SEO_PLUGIN_ENABLED`, `ALLOW_PRODUCTION_SEED`, `BACKUP_RETENTION_DAYS` | V | Pozostałe flagi. |

## Minimalny zestaw do startu (bez autonomii AICO)

Strapi core (7) + URL-e/CORS + DB/Redis + `RATE_LIMIT_ENABLED=true` + `GA4_MEASUREMENT_ID` + R2 (jeśli upload) + Brevo (jeśli newsletter). AICO: `AICO_ENABLE_WORKFLOWS=true` z `AICO_ADS_PROVIDER_MODE=disabled` i `AICO_VIDEO_PROVIDER_MODE=disabled` → agent generuje treści, ale **nie wydaje pieniędzy i nie publikuje na żywo**. Pełna autonomia/wideo/reklamy: dołóż odpowiednie sekcje + przełącz tryby (patrz panel admina AICO).

## Jak ustawić

### A) `gh` CLI (zalecane)

```bash
# Variable (jawne):
gh variable set NODE_ENV --body "production"
gh variable set GA4_MEASUREMENT_ID --body "G-XXXX"

# Secret (wrażliwe) — przez stdin, bez śladu w historii powłoki:
printf '%s' "$(openssl rand -base64 32)" | gh secret set JWT_SECRET
gh secret set STRIPE_SECRET_KEY    # interaktywnie poprosi o wartość
gh secret set GA4_SERVICE_ACCOUNT_JSON < service-account.json

# Z gotowego pliku .env (wsadowo) — tylko sekrety:
while IFS='=' read -r k v; do
  case "$k" in ''|\#*) continue;; esac
  printf '%s' "$v" | gh secret set "$k"
done < .env.production
```

### B) GitHub UI

`Settings → Secrets and variables → Actions` → zakładka **Secrets** (wrażliwe) lub **Variables** (jawne) → `New repository secret/variable`.

### C) Generowanie wartości

Szczegółowy przewodnik per-provider: [docs/ops/secrets-setup.md](secrets-setup.md). Szybkie: `openssl rand -base64 32` (sekrety tekstowe), `openssl rand -hex 32` (ENCRYPTION_KEY).

## Bezpieczeństwo
- Sekretów **nie commituj** ani nie wklejaj do logów. `.env*` jest w `.gitignore` (poza `.env.example`).
- Po wdrożeniu zrotuj sekrety, które kiedykolwiek pojawiły się poza GitHub Secrets (czat, historia powłoki) — zwł. Stripe, DB, OpenRouter.
- `gitleaks` skanuje repo; `production-env-check.sh` odrzuca placeholdery/`localhost`/sqlite na prod.
