# Sekrety produkcyjne — kompletny przewodnik generowania

Dokument operatora: gdzie i jak wygenerować KAŻDY sekret wymagany do pełnej
autonomii Star Sign. Wartości wpisuj wyłącznie do `.env.production` na VPS
(albo do zmiennych stacka w Portainerze) — nigdy do repo.

Walidacja po uzupełnieniu:

```bash
PRODUCTION_ENV_FILE=.env.production sh ops/production-env-check.sh
```

---

## 1. Strapi — klucze rdzenia (generujesz lokalnie)

Wygeneruj na swojej maszynie (każda komenda = jedna wartość):

```bash
# APP_KEYS — 4 klucze rozdzielone przecinkami:
echo "$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32),$(openssl rand -base64 32)"
openssl rand -base64 32   # API_TOKEN_SALT
openssl rand -base64 32   # ADMIN_JWT_SECRET
openssl rand -base64 32   # TRANSFER_TOKEN_SALT
openssl rand -base64 32   # JWT_SECRET
openssl rand -hex 32      # ENCRYPTION_KEY (hex!)
openssl rand -base64 32   # AICO_AUDIT_IP_HASH_SALT
```

| Zmienna | Uwagi |
|---|---|
| `APP_KEYS` | 4 klucze po przecinku, każdy ≥16 znaków |
| `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET` | unikalne, nie kopiuj między sobą |
| `ENCRYPTION_KEY` | hex — używany przez AICO do szyfrowania poświadczeń |
| `AICO_AUDIT_IP_HASH_SALT` | sól do hashowania IP w audit trail |

## 2. Baza i cache (generujesz lokalnie)

```bash
openssl rand -base64 24   # POSTGRES_PASSWORD (= DATABASE_PASSWORD)
openssl rand -base64 24   # REDIS_PASSWORD
openssl rand -base64 24   # BUGSINK_POSTGRES_PASSWORD
openssl rand -base64 48   # BUGSINK_SECRET_KEY
```

`REDIS_URL` / `RATE_LIMIT_REDIS_URL` / `HTTP_CACHE_REDIS_URL` budują się z hasła —
zob. `.env.example`.

## 3. OpenRouter (LLM — generowanie treści) ⚠️ ROTACJA

Stary klucz został ujawniony w czacie 2026-06-11 — **unieważnij go**.

1. Wejdź: <https://openrouter.ai/settings/keys>
2. Usuń stary klucz → **Create Key** (nazwa: `star-sign-prod`), ustaw miesięczny limit $ (zalecane na start: 20 USD).
3. Wpisz do `AICO_OPENROUTER_TOKEN` (format `sk-or-v1-...`).
4. `AICO_OPENROUTER_MODEL` — zostaw `openai/gpt-4.1-mini` lub wybierz inny.
5. `AICO_IMAGE_GEN_TOKEN` — ten sam klucz OpenRouter (lub osobny z własnym limitem — zalecane osobny, łatwiej kontrolować koszty obrazów); `AICO_IMAGE_GEN_MODEL` wg `.env.example`.

## 4. Replicate (wideo)

1. <https://replicate.com/account/api-tokens> → **Create token** (`star-sign-prod`).
2. `AICO_VIDEO_GEN_TOKEN` (format `r8_...`), `AICO_VIDEO_PROVIDER_MODE=replicate`.
3. Ustaw spending limit w <https://replicate.com/account/billing>.

## 5. Google Analytics 4 (analiza ruchu)

1. <https://analytics.google.com> → Admin → utwórz właściwość GA4 dla `star-sign.pl` (jeśli brak) → `GA4_MEASUREMENT_ID` (`G-...`) i `GA4_PROPERTY_ID` (liczbowy, Admin → Property Settings).
2. Konto serwisowe do odczytu danych:
   - <https://console.cloud.google.com> → utwórz projekt `star-sign-analytics`.
   - APIs & Services → Library → włącz **Google Analytics Data API**.
   - IAM → Service Accounts → **Create** (`aico-ga4-reader`) → Keys → **Add key (JSON)** — pobierz plik.
   - W GA4: Admin → Property Access Management → dodaj e-mail konta serwisowego z rolą **Viewer**.
3. Zawartość JSON wklej (jedna linia) do `GA4_SERVICE_ACCOUNT_JSON` **albo** wgraj plik na VPS i ustaw `GOOGLE_APPLICATION_CREDENTIALS=/sciezka/plik.json`.

## 6. Facebook + Instagram (publikacja socjali)

Wymaga: strona na Facebooku + konto Instagram **Business** połączone ze stroną.

1. <https://developers.facebook.com> → **Create App** (typ: Business, nazwa: `Star Sign Publisher`).
2. Dodaj produkty: *Facebook Login for Business* + *Instagram Graph API*.
3. Graph API Explorer (<https://developers.facebook.com/tools/explorer>):
   - wybierz aplikację, wygeneruj **User Token** ze scope: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`, `business_management`.
4. Wymień na **long-lived token** (60 dni), potem pobierz **Page Access Token** (nie wygasa, dopóki user token jest ważny):
   ```bash
   curl "https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=APP_ID&client_secret=APP_SECRET&fb_exchange_token=USER_TOKEN"
   curl "https://graph.facebook.com/v19.0/me/accounts?access_token=LONG_LIVED_USER_TOKEN"
   ```
5. Wpisz: `AICO_FACEBOOK_PAGE_ID` (z `me/accounts`), `AICO_FACEBOOK_ACCESS_TOKEN` (Page token).
6. Instagram: `curl "https://graph.facebook.com/v19.0/PAGE_ID?fields=instagram_business_account&access_token=PAGE_TOKEN"` → `AICO_INSTAGRAM_USER_ID`; `AICO_INSTAGRAM_ACCESS_TOKEN` = ten sam Page token.
7. Po testach przełącz aplikację w tryb **Live** (App Review wymagany dla pełnych uprawnień publish).

## 7. X / Twitter

1. <https://developer.x.com/en/portal/dashboard> → projekt + aplikacja (plan **Basic** wystarczy do postowania).
2. App settings → User authentication: **Read and write**.
3. Keys and tokens: `AICO_X_API_KEY`, `AICO_X_API_SECRET` (Consumer Keys) oraz `AICO_X_ACCESS_TOKEN`, `AICO_X_ACCESS_TOKEN_SECRET` (Access Token and Secret — wygeneruj po ustawieniu read-write).

## 8. Meta Ads (reklamy)

1. <https://business.facebook.com> → Business Settings → Ad Accounts → utwórz/wybierz konto → ID (cyfry) do `AICO_META_AD_ACCOUNT_ID` (format `act_<ID>` lub same cyfry — zob. `.env.example`).
2. System User (zalecane zamiast osobistego tokena): Business Settings → Users → **System Users** → Add (`star-sign-ads`, rola Admin) → **Generate Token** ze scope `ads_management`, `ads_read`, `business_management` → `AICO_META_ADS_ACCESS_TOKEN`.
3. Przypisz System Usera do konta reklamowego (Assign Assets).
4. Podepnij kartę / ustaw limit wydatków konta (Payment Settings) — niezależny bezpiecznik od stop-lossu AICO (25 PLN/dzień).

## 9. Google Ads (reklamy)

1. Konto Google Ads: <https://ads.google.com> → `AICO_GOOGLE_ADS_CUSTOMER_ID` (format `123-456-7890`, wpisz bez myślników).
2. **Developer token**: konto MCC (<https://ads.google.com/home/tools/manager-accounts/>) → Tools → API Center → wniosek o token (start: poziom Test, do realnych kampanii wymagany Basic — wniosek trwa kilka dni!) → `AICO_GOOGLE_ADS_DEVELOPER_TOKEN`.
3. OAuth: w projekcie Google Cloud (może być ten z GA4) → APIs & Services → Credentials → **Create OAuth client ID** (Desktop app) → `AICO_GOOGLE_ADS_CLIENT_ID` + `AICO_GOOGLE_ADS_CLIENT_SECRET`.
4. Refresh token — przejdź flow OAuth (np. `oauth2l` albo skrypt z dokumentacji google-ads):
   scope `https://www.googleapis.com/auth/adwords` → `AICO_GOOGLE_ADS_REFRESH_TOKEN`.

## 10. Stripe (premium / przyszły sklep)

1. <https://dashboard.stripe.com/apikeys> (tryb **Live**) → `STRIPE_SECRET_KEY` (`sk_live_...`).
2. Products → utwórz produkt „Star Sign Premium" z cenami miesięczną i roczną → `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_ANNUAL_PRICE_ID` (`price_...`).
3. Developers → Webhooks → **Add endpoint**: `https://api.star-sign.pl/api/stripe/webhook`, eventy: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET` (`whsec_...`).

## 11. Brevo (e-mail / newsletter)

1. <https://app.brevo.com/settings/keys/api> → **Generate new API key** → `BREVO_API_KEY` (`xkeysib-...`).
2. SMTP: <https://app.brevo.com/settings/keys/smtp> → `BREVO_SMTP_USER` + `BREVO_SMTP_PASSWORD`.
3. Contacts → Lists → ID listy → `BREVO_LIST_ID`.
4. Webhook (potwierdzenia): wygeneruj sekret `openssl rand -hex 24` → `BREVO_WEBHOOK_SECRET` i skonfiguruj webhook w Brevo na `https://api.star-sign.pl/api/newsletter/webhook`.
5. Zweryfikuj domenę nadawcy (Senders & IPs → Domains: SPF + DKIM dla `star-sign.pl`).

## 12. Cloudflare (R2 + Turnstile)

R2 (media):
1. <https://dash.cloudflare.com> → R2 → utwórz bucket `star-sign` (jeśli brak) → `R2_BUCKET`.
2. R2 → **Manage R2 API Tokens** → Create (uprawnienia: Object Read & Write, tylko ten bucket) → `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`.
3. `R2_S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; podepnij domenę publiczną bucketa → `R2_PUBLIC_BASE_URL=https://cdn.star-sign.pl`.

Turnstile (anty-bot):
1. Dashboard → Turnstile → **Add site** (`star-sign.pl`, Managed) → `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`.

## 13. Bugsink (error tracking — wybrany zamiast Sentry)

Bugsink hostujesz sam (stack w `ops/` obok aplikacji):
1. Wygeneruj `BUGSINK_SECRET_KEY` i `BUGSINK_POSTGRES_PASSWORD` (sekcja 2).
2. Ustaw `BUGSINK_DOMAIN` (np. `bugs.star-sign.pl`) + rekord DNS na VPS.
3. Po starcie stacka zaloguj się, utwórz projekty `star-sign-api` i `star-sign-frontend` → skopiuj DSN-y do `SENTRY_DSN` i `FRONTEND_SENTRY_DSN` (SDK Sentry kieruje na Bugsink przez DSN).
4. `SENTRY_REQUIRED=true`, `BUGSINK_REQUIRED=true`, opcjonalnie `BUGSINK_ALERT_WEBHOOK_URL` (webhook Discord/Slack).

## 14. Webhook alertów ops

`OPS_ALERT_WEBHOOK_URL` — utwórz webhook w Discordzie (Ustawienia kanału → Integracje → Webhooki) lub Slacku; używany przez `uptime-watch.sh` i backupy.

---

## Kolejność wdrożenia

1. Sekcje 1–2 (klucze lokalne) + 12 (R2/Turnstile) + 11 (Brevo) + 13 (Bugsink) → podstawowy serwis działa.
2. Sekcja 3 (OpenRouter z rotacją!) + 5 (GA4) → generowanie treści + analityka.
3. Sekcje 6–7 (FB/IG/X) → publikacja socjali.
4. Sekcja 10 (Stripe) → premium.
5. Sekcje 8–9 (Meta/Google Ads) → reklamy (uwaga: Google developer token Basic = kilka dni oczekiwania — złóż wniosek od razu).
6. `PRODUCTION_ENV_FILE=.env.production sh ops/production-env-check.sh` → musi przejść.
7. Deploy → `RUN_AICO_POST_SEED_PREFLIGHT=true` → production-readiness **GO** → włączenie autonomii.

## Zasady bezpieczeństwa

- Każdy token z minimalnym scope i (gdzie się da) limitem wydatków u dostawcy.
- Tokeny Meta/X wygasają lub mogą być unieważnione — panel AICO → Providers pokazuje świeżość (`AICO_PROVIDER_READINESS_MAX_AGE_HOURS`).
- Nigdy nie wklejaj sekretów do czatu, commitów ani logów; rotuj natychmiast po podejrzeniu ujawnienia.
