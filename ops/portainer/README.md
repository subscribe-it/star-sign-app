# Star Sign: produkcyjny deploy przez GitHub Actions, GHCR, Portainer Swarm i Traefik

Ten dokument opisuje pełną konfigurację produkcyjnego deployu Star Sign na VPS z Portainerem. Zakładany model to Nx monorepo budowane w GitHub Actions, dwa obrazy Docker w GHCR i stack Swarm aktualizowany przez webhook Portainera.

## Cel i architektura

Produkcja składa się z czterech serwisów w jednym stacku Portainer Swarm:

| Serwis | Rola | Obraz | Port wewnętrzny |
|---|---|---|---:|
| `frontend` | Angular SSR | `ghcr.io/subscribe-it/star-sign-frontend:<tag>` | `4000` |
| `api` | Strapi API | `ghcr.io/subscribe-it/star-sign-api:<tag>` | `1337` |
| `postgres` | baza danych aplikacji | `postgres:16-alpine` | `5432` |
| `redis` | cache i rate limit | `redis:7-alpine` | `6379` |

Routing i TLS robi istniejący stack Traefik z repo `subscribe-it/traefik-load-balancer`. Stack Star Sign nie uruchamia produkcyjnie Caddy, Mailpit, Stripe CLI ani Bugsink. Bugsink będzie osobnym stackiem po wdrożeniu Star Sign.

Produkcja używa Cloudflare R2 jako źródła prawdy dla mediów. Nie montujemy trwałego wolumenu `apps/api/public/uploads`, bo produkcyjne pliki mają być dostępne z CDN.

## Pliki w repo

| Plik | Zastosowanie |
|---|---|
| `.github/workflows/ci.yml` | quality gate dla każdego brancha i PR |
| `.github/workflows/deploy-production.yml` | build obrazów, push do GHCR, webhook Portainera i post-deploy checks na `main` |
| `ops/portainer/star-sign-production-stack.yml` | produkcyjny stack Portainer Swarm |
| `.env.example` | kompletna lista zmiennych do skopiowania i uzupełnienia wartościami produkcyjnymi |
| `ops/predeploy-check.sh` | lokalny i CI predeploy gate |
| `ops/production-env-check.sh` | statyczny guard produkcyjnych sekretów i URL-i |
| `ops/smoke.sh` | smoke test domen po deployu |
| `ops/security-headers-check.sh` | walidacja nagłówków bezpieczeństwa po deployu |

## Wymagania na VPS

Przed pierwszym deployem potwierdź:

- VPS ma aktywny Docker Swarm.
- Portainer obsługuje stacki Swarm.
- Działa zewnętrzna sieć overlay `traefik-public`.
- Działa stack Traefik z repo `subscribe-it/traefik-load-balancer`.
- Traefik ma skonfigurowany resolver Let's Encrypt o nazwie `letsencrypt`.
- W Traefiku istnieją middleware `real-ip@file`, `geo-block@file`, `rate-limit@file`, `inflight-req@file`.
- DNS domen produkcyjnych wskazuje na VPS.
- Portainer ma dostęp do GHCR, jeżeli obrazy są prywatne.

Minimalne DNS:

| Rekord | Wartość |
|---|---|
| `star-sign.pl` | `A` lub `AAAA` na VPS |
| `api.star-sign.pl` | `A` lub `AAAA` na VPS |
| `cdn.star-sign.pl` | rekord do Cloudflare R2/CDN, zgodnie z konfiguracją bucketu |

## Budżet zasobów

Profil jest ustawiony pod VPS `2 vCPU / 4 GB` i soft launch bez Bugsink:

| Serwis | CPU reservation | CPU limit | RAM reservation | RAM limit |
|---|---:|---:|---:|---:|
| `api` | `0.35` | `0.85` | `640M` | `1152M` |
| `frontend` | `0.10` | `0.35` | `160M` | `384M` |
| `postgres` | `0.25` | `0.50` | `512M` | `1024M` |
| `redis` | `0.03` | `0.10` | `64M` | `192M` |

Łączny hard cap stacka Star Sign to około `1.8 vCPU` i `2752M RAM`. Reszta zostaje dla systemu, Portainera, Traefika i innych usług na VPS.

Postgres w stacku ma tuning:

- `max_connections=50`
- `shared_buffers=256MB`
- `effective_cache_size=768MB`
- `work_mem=8MB`
- `maintenance_work_mem=64MB`

Redis działa z hasłem, bez trwałego AOF/RDB i z limitem pamięci `128mb`.

## GitHub Actions

### Workflow branch i PR

`.github/workflows/ci.yml` uruchamia się na każdy push do brancha, pull request i `workflow_dispatch`.

Ten workflow robi:

- `npm ci`
- `npm exec -- nx sync:check`
- lint dla `frontend,api,cart,@org/types,frontend-e2e,ai-content-orchestrator`
- typecheck dla `frontend,api,cart,@org/types,frontend-e2e`
- testy jednostkowe frontend z coverage
- `api:test`
- `cart:test`
- testy i verify pluginu AICO
- produkcyjne buildy `frontend,api,cart,@org/types`

To jest gate developerski. Nie publikuje obrazów i nie dotyka produkcji.

### Workflow produkcyjny

`.github/workflows/deploy-production.yml` uruchamia się na push do `main` oraz ręcznie przez `workflow_dispatch`.

Polityka concurrency dla CI/CD:

- każdy workflow ma `cancel-in-progress: true`;
- dla pushy do feature branchy nowy commit anuluje starszy run tego samego workflow dla tej gałęzi;
- dla PR używana jest nazwa branch head, więc kolejne zmiany w tym samym PR anulują starszy run;
- dla `main` nowy push anuluje poprzedni run CI/deploy dla `main`;
- workflow uruchamiane ręcznie też używają grupy po aktualnym `ref_name`, więc nie dublują aktywnych runów na tej samej referencji.

Kolejność jobów:

1. `release-gate`: zapisuje sekret `STAR_SIGN_PRODUCTION_ENV` do `.env.production` tylko w runnerze i uruchamia predeploy gate.
2. `build-and-push`: buduje targety Docker `api-runtime` i `frontend-runtime`, publikuje obrazy do GHCR.
3. `deploy`: wywołuje webhook Portainera.
4. `post-deploy`: czeka na rollout, uruchamia smoke, headers i Playwright e2e.

Publikowane obrazy:

```text
ghcr.io/subscribe-it/star-sign-api:main
ghcr.io/subscribe-it/star-sign-api:<git-sha>
ghcr.io/subscribe-it/star-sign-frontend:main
ghcr.io/subscribe-it/star-sign-frontend:<git-sha>
```

Trivy skanuje oba obrazy pod kątem `HIGH` i `CRITICAL`, ale na start działa raportowo przez `continue-on-error: true`. Po pierwszej klasyfikacji podatności można zmienić to na twardy gate.

### Uprawnienia GitHub

W repozytorium sprawdź:

- `Settings -> Actions -> General -> Workflow permissions`: `Read and write permissions`.
- Jeżeli organizacja blokuje publikację paczek, pozwól GitHub Actions pisać do GitHub Container Registry.
- Workflow używa wbudowanego `GITHUB_TOKEN` do pushowania obrazów do GHCR.

## GitHub Secrets

Ustaw w `Settings -> Secrets and variables -> Actions -> Secrets`.

| Secret | Wymagany | Gdzie używany | Opis |
|---|---:|---|---|
| `STAR_SIGN_PRODUCTION_ENV` | tak | `release-gate` | Pełny produkcyjny `.env` używany do statycznej walidacji w GitHub Actions |
| `PORTAINER_WEBHOOK_URL` | tak | `deploy` | Webhook stacka Portainer, który aktualizuje usługi po pushu obrazów |

`STAR_SIGN_PRODUCTION_ENV` to wieloliniowy secret. Powinien zawierać realne wartości produkcyjne w formacie `.env`, na przykład:

```dotenv
NODE_ENV=production
PRODUCTION_DOMAIN=star-sign.pl
FRONTEND_URL=https://star-sign.pl
API_PUBLIC_URL=https://api.star-sign.pl
SERVER_URL=https://api.star-sign.pl
API_URL=http://api:1337/api
FRONTEND_DOMAIN=star-sign.pl
API_DOMAIN=api.star-sign.pl
CORS_ORIGIN=https://star-sign.pl
UPLOAD_ASSET_CSP_ORIGINS=https://cdn.star-sign.pl

GHCR_OWNER=subscribe-it
STAR_SIGN_IMAGE_TAG=main

POSTGRES_DB=star_sign
POSTGRES_USER=star_sign
POSTGRES_PASSWORD=<real-postgres-password>
DATABASE_CLIENT=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=star_sign
DATABASE_USERNAME=star_sign
DATABASE_PASSWORD=<real-postgres-password>
DATABASE_SSL=false

REDIS_PASSWORD=<real-redis-password>
REDIS_URL=redis://:<url-encoded-redis-password>@redis:6379
RATE_LIMIT_REDIS_URL=redis://:<url-encoded-redis-password>@redis:6379
HTTP_CACHE_REDIS_URL=redis://:<url-encoded-redis-password>@redis:6379
```

Nie używaj wartości `replace_me`, `changeme`, `sk_test_`, `pk_test_`, `whsec_test_` ani URL-i localhost. Guard produkcyjny przerwie deploy.

Ważne: `STAR_SIGN_PRODUCTION_ENV` waliduje release candidate w GitHub Actions, ale nie zasila runtime stacka w Portainerze. Te same wartości muszą być skonfigurowane osobno w zmiennych stacka Portainer.

## GitHub Variables

Ustaw w `Settings -> Secrets and variables -> Actions -> Variables`.

| Variable | Wymagany | Przykład | Opis |
|---|---:|---|---|
| `FRONTEND_BASE_URL` | tak | `https://star-sign.pl` | używany przez smoke, headers i e2e |
| `API_BASE_URL` | tak | `https://api.star-sign.pl/api` | używany przez smoke i headers |
| `DEPLOY_WAIT_SECONDS` | opcjonalny | `90` | opóźnienie przed post-deploy checks |

## GHCR i Portainer Registry

Jeżeli obrazy GHCR są prywatne, skonfiguruj registry w Portainerze:

1. Wejdź w `Portainer -> Registries -> Add registry`.
2. Wybierz `Custom registry`.
3. Ustaw `Registry URL`: `ghcr.io`.
4. Ustaw `Username`: użytkownik GitHub albo konto organizacyjne z dostępem do paczek.
5. Ustaw `Password`: GitHub PAT z uprawnieniem `read:packages`.
6. Zapisz registry i przypisz je do stacka, jeżeli Portainer tego wymaga.

Jeżeli image pull kończy się błędem `denied`, `unauthorized` albo `manifest unknown`, najpierw sprawdź registry credentials, nazwę ownera i tag `STAR_SIGN_IMAGE_TAG`.

## Stack Portainera

Rekomendowana nazwa stacka:

```text
star_sign_production
```

Użyj pliku:

```text
ops/portainer/star-sign-production-stack.yml
```

Możliwe tryby:

- `Repository`: Portainer pobiera stack z repo, branch `main`, path `ops/portainer/star-sign-production-stack.yml`.
- `Web editor`: wklejasz zawartość pliku ręcznie. To jest mniej wygodne, ale działa.

W obu trybach ustaw environment variables w Portainerze. Nie commituj produkcyjnego `.env` do repo.

## Zmienne Portainera

Poniżej są zmienne runtime dla stacka. Wartości w nawiasach to rekomendacje startowe, nie sekrety.

### Obrazy i domeny

| Zmienna | Wymagana | Przykład |
|---|---:|---|
| `GHCR_OWNER` | tak | `subscribe-it` |
| `STAR_SIGN_IMAGE_TAG` | tak | `main` albo konkretny `<git-sha>` |
| `PRODUCTION_DOMAIN` | tak | `star-sign.pl` |
| `API_DOMAIN` | tak | `api.star-sign.pl` |
| `UPLOAD_ASSET_CSP_ORIGINS` | tak | `https://cdn.star-sign.pl` |

`STAR_SIGN_IMAGE_TAG=main` oznacza zawsze najnowszy deploy z `main`. Do rollbacku ustaw konkretny SHA obrazu.

### Feature flags i publiczne integracje

| Zmienna | Rekomendacja dla soft launchu | Uwagi |
|---|---|---|
| `SHOP_ENABLED` | `false` | backend shop |
| `FRONTEND_SHOP_ENABLED` | `false` | UI shop |
| `PREMIUM_MODE` | `open` | Premium otwarte bez płatności |
| `TURNSTILE_ENABLED` | `true` | jeżeli klucze są gotowe |
| `TURNSTILE_SITE_KEY` | realny site key | widoczny publicznie |
| `TURNSTILE_SECRET_KEY` | realny sekret | tylko runtime API |
| `TURNSTILE_FAIL_OPEN` | `false` | nie wpuszczać ruchu po awarii walidacji |
| `GA4_MEASUREMENT_ID` | `G-...` | wymagany przez production env guard |
| `GTM_CONTAINER_ID` | `GTM-...` albo puste | opcjonalnie |

### Sekrety Strapi

Wszystkie wartości muszą być unikalne dla produkcji. Nie używaj sekretów z lokalnego developmentu.

| Zmienna | Wymagana | Minimalna rekomendacja |
|---|---:|---|
| `APP_KEYS` | tak | 4 losowe wartości oddzielone przecinkiem |
| `API_TOKEN_SALT` | tak | losowe 32+ bajty |
| `ADMIN_JWT_SECRET` | tak | losowe 32+ bajty |
| `TRANSFER_TOKEN_SALT` | tak | losowe 32+ bajty |
| `JWT_SECRET` | tak | losowe 32+ bajty |
| `ENCRYPTION_KEY` | tak | minimum 32 znaki |

Przykładowe generowanie:

```bash
openssl rand -base64 32
```

Dla `APP_KEYS` wygeneruj cztery osobne wartości i wpisz je jako:

```dotenv
APP_KEYS=value1,value2,value3,value4
```

### Baza danych

| Zmienna | Wymagana | Przykład |
|---|---:|---|
| `POSTGRES_DB` | tak | `star_sign` |
| `POSTGRES_USER` | tak | `star_sign` |
| `POSTGRES_PASSWORD` | tak | losowy sekret |
| `DATABASE_SSL` | zalecane | `false` dla wewnętrznej sieci Swarm |

Stack sam mapuje Strapi na wewnętrzny host `postgres`. W `STAR_SIGN_PRODUCTION_ENV` dla walidacji trzymaj też kompatybilne wpisy:

```dotenv
DATABASE_CLIENT=postgres
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=star_sign
DATABASE_USERNAME=star_sign
DATABASE_PASSWORD=<ten-sam-sekret-co-POSTGRES_PASSWORD>
```

### Redis

| Zmienna | Wymagana | Przykład |
|---|---:|---|
| `REDIS_PASSWORD` | tak | losowy sekret |
| `REDIS_URL` | zalecane | `redis://:<encoded-password>@redis:6379` |
| `RATE_LIMIT_REDIS_URL` | zalecane | `redis://:<encoded-password>@redis:6379` |
| `HTTP_CACHE_REDIS_URL` | zalecane | `redis://:<encoded-password>@redis:6379` |

Jeżeli hasło Redis zawiera znaki specjalne, zakoduj je URL encodingiem w URL-ach. Najprostsza operacyjnie opcja to wygenerować hasło z bezpiecznego alfabetu bez `@`, `:`, `/`, `?`, `#`, `&`.

Rate limit i cache:

| Zmienna | Rekomendacja |
|---|---|
| `RATE_LIMIT_ENABLED` | `true` |
| `RATE_LIMIT_PATHS` | `/api/auth/local,/api/auth/local/register,/api/contact,/api/newsletter,/api/checkout/session,/api/account/subscription` |
| `RATE_LIMIT_WINDOW_MS` | `900000` |
| `RATE_LIMIT_MAX` | `80` |
| `RATE_LIMIT_FAIL_OPEN` | `false` |
| `RATE_LIMIT_TRUST_PROXY` | `true` |
| `HTTP_CACHE_ENABLED` | `true` |

### Cloudflare R2 i media

| Zmienna | Wymagana | Przykład |
|---|---:|---|
| `R2_UPLOAD_ENABLED` | tak | `true` |
| `R2_ACCESS_KEY_ID` | tak | access key z Cloudflare |
| `R2_SECRET_ACCESS_KEY` | tak | secret key z Cloudflare |
| `R2_S3_ENDPOINT` | tak | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_BUCKET` | tak | `star-sign` |
| `R2_REGION` | zalecane | `auto` |
| `R2_FORCE_PATH_STYLE` | zalecane | `true` |
| `R2_PUBLIC_BASE_URL` | tak | `https://cdn.star-sign.pl` |
| `R2_ROOT_PATH` | tak | `production` |

Nie dodawaj wolumenu na `apps/api/public/uploads` w produkcji. Kontener API może używać lokalnego katalogu tymczasowo, ale trwałe źródło prawdy to R2.

Po deployu sprawdź ręcznie w Strapi Media Library:

- przykładowy obraz ma URL z `https://cdn.star-sign.pl`;
- rekordy w bazie `upload_file` istnieją;
- same pliki w bucket nie są traktowane jako kompletna migracja, jeżeli Strapi nie ma rekordów DB.

### Brevo i e-mail

| Zmienna | Wymagana dla newslettera | Przykład |
|---|---:|---|
| `BREVO_API_KEY` | tak | realny klucz Brevo |
| `BREVO_LIST_ID` | tak | ID listy |
| `BREVO_SMTP_HOST` | tak | `smtp-relay.brevo.com` |
| `BREVO_SMTP_PORT` | tak | `587` |
| `BREVO_SMTP_SECURE` | tak | `false` |
| `BREVO_SMTP_USER` | tak | login SMTP |
| `BREVO_SMTP_PASSWORD` | tak | hasło SMTP |
| `BREVO_FROM_EMAIL` | tak | `Star Sign <noreply@star-sign.pl>` |
| `BREVO_REPLY_TO` | tak | `kontakt@star-sign.pl` |
| `NEWSLETTER_DOUBLE_OPT_IN` | zalecane | `true` |
| `BREVO_WEBHOOK_SECRET` | zalecane | losowy sekret |

Nie używaj Mailpit w production stacku.

### AICO

| Zmienna | Rekomendacja | Uwagi |
|---|---|---|
| `AICO_OPENROUTER_TOKEN` | realny sekret | wymagany, gdy workflows są włączone |
| `AICO_OPENROUTER_MODEL` | `openai/gpt-4.1-mini` | można zmienić później po kosztach i jakości |
| `AICO_ENABLE_WORKFLOWS` | `true` | włącza automatyzację AICO |
| `AICO_ALLOW_MISSING_TOKEN` | `false` | produkcja nie powinna działać bez tokenu, jeśli AICO jest aktywne |
| `AICO_BACKUP_ENABLED` | `true` | backup treści AICO |

AICO audit nie blokuje deploya. Po deployu sprawdź zakładkę `Audit` w panelu Strapi ręcznie, gdy oceniasz gotowość automatyzacji contentu.

### Observability

| Zmienna | Rekomendacja |
|---|---|
| `SENTRY_DSN` | ustaw, jeżeli backend ma raportować błędy |
| `FRONTEND_SENTRY_DSN` | ustaw, jeżeli frontend ma raportować błędy |
| `SENTRY_ENVIRONMENT` | `production` |
| `SENTRY_RELEASE` | opcjonalnie SHA release |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` na start, zwiększyć świadomie |
| `SENTRY_REQUIRED` | `false` na start, `true` gdy Sentry jest krytyczne |
| `BUGSINK_REQUIRED` | `false` w stacku Star Sign |

Bugsink nie jest częścią tego stacka. Dodaj go później jako osobny stack, z własnym budżetem zasobów.

### Security, body limits i seed guard

| Zmienna | Rekomendacja |
|---|---|
| `STRAPI_DOCUMENTATION_ENABLED` | `false` |
| `STRAPI_SEO_PLUGIN_ENABLED` | `true` |
| `SECURITY_HSTS_ENABLED` | `true` |
| `ALLOW_PRODUCTION_SEED` | `false` |
| `BODY_JSON_LIMIT` | `1mb` |
| `BODY_FORM_LIMIT` | `1mb` |
| `BODY_TEXT_LIMIT` | `1mb` |
| `UPLOAD_MAX_FILE_SIZE` | `10485760` |

Production env guard przerwie deploy, jeżeli `ALLOW_PRODUCTION_SEED=true` albo `STRAPI_DOCUMENTATION_ENABLED=true`.

### Stripe i Premium paid

Dla soft launchu z `PREMIUM_MODE=open`:

```dotenv
PREMIUM_MODE=open
STRIPE_REQUIRED=false
SHOP_ENABLED=false
FRONTEND_SHOP_ENABLED=false
```

Dla płatnego Premium:

```dotenv
PREMIUM_MODE=paid
STRIPE_REQUIRED=true
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PREMIUM_MONTHLY_PRICE_ID=price_...
STRIPE_PREMIUM_ANNUAL_PRICE_ID=price_...
```

Nie uruchamiaj paid Premium bez osobnego testu live Stripe, webhooków, success/cancel flow i portalu klienta.

## Traefik routing

Frontend:

- `Host(${PRODUCTION_DOMAIN}) -> frontend:4000`
- middleware: `real-ip@file,geo-block@file,rate-limit@file,inflight-req@file,star-sign-frontend-headers`
- HTTP przekierowuje na HTTPS

API:

- `Host(${PRODUCTION_DOMAIN}) && PathPrefix(/api) -> api:1337`
- `Host(${API_DOMAIN}) -> api:1337`
- middleware: `real-ip@file,rate-limit@file,inflight-req@file,star-sign-api-headers`
- celowo bez `geo-block@file`, żeby nie zablokować Stripe, Brevo i innych webhooków

Nagłówki ustawione przez labels:

- HSTS `31536000`
- `contentTypeNosniff=true`
- `frameDeny=true`
- `referrerPolicy=strict-origin-when-cross-origin`
- `permissionsPolicy` bez camera, microphone, geolocation i podobnych uprawnień
- minimalny CSP: `frame-ancestors 'none'; base-uri 'self'; object-src 'none'`

Jeżeli Traefik zwraca `404`, zwykle problemem jest DNS, brak `traefik-public`, literówka w `PRODUCTION_DOMAIN` lub niedostępny stack Traefika.

## Pierwszy deploy krok po kroku

1. Skonfiguruj DNS dla `star-sign.pl`, `api.star-sign.pl` i `cdn.star-sign.pl`.
2. Potwierdź, że Traefik i sieć `traefik-public` działają.
3. W GitHub ustaw secrets: `STAR_SIGN_PRODUCTION_ENV`, `PORTAINER_WEBHOOK_URL`.
4. W GitHub ustaw variables: `FRONTEND_BASE_URL`, `API_BASE_URL`, opcjonalnie `DEPLOY_WAIT_SECONDS`.
5. W Portainerze dodaj GHCR registry credentials, jeżeli obrazy są prywatne.
6. Utwórz stack `star_sign_production` z pliku `ops/portainer/star-sign-production-stack.yml`.
7. W Portainerze wpisz wszystkie wymagane zmienne runtime.
8. Wykonaj lokalną walidację formatu stacka:

```bash
rtk docker compose -f ops/portainer/star-sign-production-stack.yml --env-file .env.example config --quiet
```

9. Na realnym env przed deployem uruchom:

```bash
rtk env PRODUCTION_ENV_FILE=.env npm run ops:env
```

10. Jeżeli masz realny `.env` lokalnie lub w bezpiecznym środowisku CI, uruchom pełny staging gate:

```bash
rtk env \
  COMPOSE_FILE=ops/portainer/star-sign-production-stack.yml \
  COMPOSE_ENV_FILE=.env \
  PREDEPLOY_SCOPE=staging \
  FRONTEND_BASE_URL=https://star-sign.pl \
  API_BASE_URL=https://api.star-sign.pl/api \
  RUN_ENV_GUARD=true \
  RUN_FRONTEND_FULL=true \
  RUN_E2E=true \
  RUN_DOMAIN_AUDITS=true \
  RUN_SECURITY_HEADERS=true \
  npm run ops:predeploy:staging
```

11. Zrób merge lub push do `main`.
12. Obserwuj GitHub Actions, szczególnie joby `release-gate`, `build-and-push`, `deploy`, `post-deploy`.
13. Obserwuj Portainer `Services` i logi `api`, `frontend`, `postgres`, `redis`.
14. Po deployu sprawdź ręcznie Strapi Media Library i przykładowe media z CDN.

## Komendy po deployu

Smoke:

```bash
rtk env FRONTEND_BASE_URL=https://star-sign.pl API_BASE_URL=https://api.star-sign.pl/api npm run ops:smoke
```

Nagłówki:

```bash
rtk env FRONTEND_BASE_URL=https://star-sign.pl API_BASE_URL=https://api.star-sign.pl/api npm run ops:headers
```

E2E:

```bash
rtk env BASE_URL=https://star-sign.pl npm exec -- nx run frontend-e2e:e2e --outputStyle=static
```

AICO audit:

Uruchamiaj ręcznie w panelu Strapi w zakładce AICO `Audit`. Ten check jest operacyjny, nie blokuje automatycznego deploya.

## Rollback

Workflow publikuje tag `main` i immutable tag z pełnym SHA commita.

Rollback przez Portainer:

1. Wejdź w stack `star_sign_production`.
2. Ustaw `STAR_SIGN_IMAGE_TAG=<poprzedni-sprawdzony-git-sha>`.
3. Zaktualizuj stack.
4. Poczekaj na rollout.
5. Uruchom smoke, headers i e2e.

Po stabilizacji możesz zostawić konkretny SHA albo wrócić do `STAR_SIGN_IMAGE_TAG=main` przy kolejnym deployu.

## Troubleshooting

| Objaw | Najczęstsza przyczyna | Co sprawdzić |
|---|---|---|
| GitHub `release-gate` failuje na env | placeholder, test secret, localhost albo brak wymaganej wartości | `STAR_SIGN_PRODUCTION_ENV`, `ops/production-env-check.sh` |
| Image pull denied w Portainerze | brak dostępu do GHCR | registry credentials, PAT `read:packages`, `GHCR_OWNER`, tag |
| Traefik zwraca `404` | router nie pasuje albo usługa nie jest w sieci | DNS, `PRODUCTION_DOMAIN`, `API_DOMAIN`, `traefik-public` |
| Traefik zwraca `502` | kontener niezdrowy albo zły port | healthcheck, logi serwisu, port `4000` lub `1337` |
| API nie startuje | brak sekretów, DB albo Redis | logi `api`, `postgres`, `redis`, zmienne Portainera |
| Redis auth error | hasło niezgodne lub niezakodowane w URL | `REDIS_PASSWORD`, `REDIS_URL`, URL encoding |
| Media nie działają | brak rekordów DB albo zły CDN/R2 | Strapi Media Library, `upload_file`, `R2_PUBLIC_BASE_URL`, CSP |
| Webhook Stripe/Brevo nie dochodzi | blokada middleware albo zły URL | API nie ma `geo-block@file`, sprawdź route i provider webhook |
| E2E po deployu failuje | rollout jeszcze trwa albo UI/API niedostępne | zwiększ `DEPLOY_WAIT_SECONDS`, sprawdź smoke i logi |

## Zasady bezpieczeństwa

- Nie commituj realnych `.env`, tokenów, sekretów, kluczy R2, Stripe, Brevo ani Portainer webhook URL.
- Nie zapisuj sekretów w `.codex/agent-workspace/` ani Serena memory.
- `STAR_SIGN_PRODUCTION_ENV` jest tylko kopią walidacyjną dla GitHub Actions. Portainer musi mieć własne zmienne runtime.
- Nie dodawaj `geo-block@file` na API bez sprawdzenia webhooków.
- Nie włączaj `STRIPE_REQUIRED=true` i `PREMIUM_MODE=paid` bez osobnego testu live Stripe.
- Nie dodawaj trwałego wolumenu uploadów, dopóki R2 jest źródłem prawdy.

## Minimalna checklista GO

- GitHub branch/PR CI przechodzi.
- `main` workflow buduje i publikuje oba obrazy GHCR.
- Portainer pobiera obrazy i aktualizuje stack.
- `frontend`, `api`, `postgres`, `redis` są healthy.
- Smoke i security headers przechodzą na domenach produkcyjnych.
- Playwright e2e przechodzi przeciw `https://star-sign.pl`.
- AICO audit w panelu Strapi został sprawdzony ręcznie przed włączeniem autonomicznych workflow.
- Strapi Media Library pokazuje URL-e z `https://cdn.star-sign.pl`.
- `PREMIUM_MODE=open` działa bez paywalla.
- Paid Premium pozostaje wyłączone, dopóki nie przejdzie osobny test Stripe live.
