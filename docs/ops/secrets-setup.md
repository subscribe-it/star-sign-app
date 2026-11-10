# Sekrety produkcyjne — kompletny przewodnik generowania

Dokument operatora: gdzie i jak wygenerować KAŻDY sekret wymagany do pełnej
produkcji Star Sign. Treści tworzy zewnętrzny marketing-os przez REST API (osobny token API Strapi). Wartości wpisuj wyłącznie do `.env.production` na VPS
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
```

| Zmienna | Uwagi |
|---|---|
| `APP_KEYS` | 4 klucze po przecinku, każdy ≥16 znaków |
| `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET` | unikalne, nie kopiuj między sobą |
| `ENCRYPTION_KEY` | hex — szyfrowanie danych Strapi (nie zmieniaj po starcie) |

## 2. Baza i cache (generujesz lokalnie)

```bash
openssl rand -base64 24   # POSTGRES_PASSWORD (= DATABASE_PASSWORD)
openssl rand -base64 24   # REDIS_PASSWORD
openssl rand -base64 24   # BUGSINK_POSTGRES_PASSWORD
openssl rand -base64 48   # BUGSINK_SECRET_KEY
```

`REDIS_URL` / `RATE_LIMIT_REDIS_URL` / `HTTP_CACHE_REDIS_URL` budują się z hasła —
zob. `.env.example`.

## 3. Stripe (premium / przyszły sklep)

1. <https://dashboard.stripe.com/apikeys> (tryb **Live**) → `STRIPE_SECRET_KEY` (`sk_live_...`).
2. Products → utwórz produkt „Star Sign Premium" z cenami miesięczną i roczną → `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, `STRIPE_PREMIUM_ANNUAL_PRICE_ID` (`price_...`).
3. Developers → Webhooks → **Add endpoint**: `https://api.star-sign.pl/api/stripe/webhook`, eventy: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed` → `STRIPE_WEBHOOK_SECRET` (`whsec_...`).

## 4. Brevo (e-mail / newsletter)

1. <https://app.brevo.com/settings/keys/api> → **Generate new API key** → `BREVO_API_KEY` (`xkeysib-...`).
2. SMTP: <https://app.brevo.com/settings/keys/smtp> → `BREVO_SMTP_USER` + `BREVO_SMTP_PASSWORD`.
3. Contacts → Lists → ID listy → `BREVO_LIST_ID`.
4. Webhook (potwierdzenia): wygeneruj sekret `openssl rand -hex 24` → `BREVO_WEBHOOK_SECRET` i skonfiguruj webhook w Brevo na `https://api.star-sign.pl/api/newsletter/webhook`.
5. Zweryfikuj domenę nadawcy (Senders & IPs → Domains: SPF + DKIM dla `star-sign.pl`).

## 5. Cloudflare (R2 + Turnstile)

R2 (media):
1. <https://dash.cloudflare.com> → R2 → utwórz bucket `star-sign` (jeśli brak) → `R2_BUCKET`.
2. R2 → **Manage R2 API Tokens** → Create (uprawnienia: Object Read & Write, tylko ten bucket) → `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`.
3. `R2_S3_ENDPOINT` = `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; podepnij domenę publiczną bucketa → `R2_PUBLIC_BASE_URL=https://cdn.star-sign.pl`.

Turnstile (anty-bot):
1. Dashboard → Turnstile → **Add site** (`star-sign.pl`, Managed) → `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`.

## 6. Bugsink (error tracking — wybrany zamiast Sentry)

Bugsink hostujesz sam (stack w `ops/` obok aplikacji):
1. Wygeneruj `BUGSINK_SECRET_KEY` i `BUGSINK_POSTGRES_PASSWORD` (sekcja 2).
2. Ustaw `BUGSINK_DOMAIN` (np. `bugs.star-sign.pl`) + rekord DNS na VPS.
3. Po starcie stacka zaloguj się, utwórz projekty `star-sign-api` i `star-sign-frontend` → skopiuj DSN-y do `SENTRY_DSN` i `FRONTEND_SENTRY_DSN` (SDK Sentry kieruje na Bugsink przez DSN).
4. `SENTRY_REQUIRED=true`, `BUGSINK_REQUIRED=true`, opcjonalnie `BUGSINK_ALERT_WEBHOOK_URL` (webhook Discord/Slack).

## 7. Webhook alertów ops

`OPS_ALERT_WEBHOOK_URL` — utwórz webhook w Discordzie (Ustawienia kanału → Integracje → Webhooki) lub Slacku; używany przez `uptime-watch.sh` i backupy.

---

## Kolejność wdrożenia

1. Sekcje 1–2 (klucze lokalne) + Cloudflare (R2/Turnstile) + Brevo + Bugsink → podstawowy serwis działa.
2. Stripe → premium.
3. `PRODUCTION_ENV_FILE=.env.production sh ops/production-env-check.sh` → musi przejść.
4. Deploy; potem token API Strapi dla marketing-os (create/update/publish na articles, horoscopes, daily-tarot-draws, upload).

## Zasady bezpieczeństwa

- Każdy token z minimalnym scope i (gdzie się da) limitem wydatków u dostawcy.
- Nigdy nie wklejaj sekretów do czatu, commitów ani logów; rotuj natychmiast po podejrzeniu ujawnienia.
