# Star Sign Launch Handoff

Ostatnia aktualizacja: 2026-04-28

## Aktualny zakres

- API: Strapi 5, publiczne RBAC dla contentu, sklep domyślnie ukryty przez `SHOP_ENABLED=false`. Domena produkcyjna: `https://api.star-sign.pl/`.
- Frontend: Angular SSR, sklep ukryty przez `features.shopEnabled=false` i `FRONTEND_SHOP_ENABLED=false`. Domena produkcyjna: `https://star-sign.pl/`.
- Dane: seed dev/prod zapewnia znaki zodiaku, tarot, numerologię, artykuły, horoskopy, daily tarot i workflow AICO.
- AICO: `Run now`, `Stop`, `Delete workflow`, monitoring runów, kroki, prompt, raw response, parsed JSON i błędy.
- Mail: Brevo jako newsletter i SMTP przez Strapi email provider. Skonfigurowane pod `star-sign.pl`.
- VPS: przygotowany Dockerfile multi-target, `docker-compose.yml`, Caddy, Postgres, smoke script i backup Postgresa.

## Konta testowe po `npm exec nx run api:seed-dev`

- Demo: `demo@starsign.local` / `Test1234!`
- Premium: `premium@starsign.local` / `Test1234!`

## Env produkcyjny

Start z `.env.example`. Na VPS skopiować do `.env` i uzupełnić realne wartości:

- domeny: `FRONTEND_URL`, `API_PUBLIC_URL`, `SERVER_URL`, `FRONTEND_DOMAIN`, `API_DOMAIN`, `CORS_ORIGIN`
- sekrety Strapi: `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY`
- baza: `POSTGRES_*`, `DATABASE_*`
- media: `R2_*`
- newsletter/mail: `BREVO_API_KEY`, `BREVO_LIST_ID`, `BREVO_SMTP_*`, `BREVO_WEBHOOK_SECRET`
- AI: `AICO_OPENROUTER_TOKEN`, `AICO_ENABLE_WORKFLOWS`, `AICO_BACKUP_ENABLED`
- observability: `SENTRY_DSN`

Sekrety z lokalnych `.env` należy rotować przed produkcją.

## Komendy weryfikacji

```bash
npm run ops:predeploy:local
npm exec nx sync:check
npm exec nx run api:typecheck
npm exec nx run api:build
npm exec nx run frontend:typecheck
npm exec nx run frontend:build
```

Smoke lokalny po uruchomieniu API i frontendu:

```bash
API_BASE_URL=http://localhost:1337/api FRONTEND_BASE_URL=http://localhost:4200 npm run ops:smoke
```

Smoke VPS po deployu:

```bash
API_BASE_URL=https://api.example.com/api FRONTEND_BASE_URL=https://example.com npm run ops:smoke
```

Audit gate przed promocją deploya:

```bash
PREDEPLOY_SCOPE=staging \
RUN_ENV_GUARD=true \
RUN_FRONTEND_FULL=true \
RUN_E2E=true \
RUN_DOMAIN_AUDITS=true \
RUN_SECURITY_HEADERS=true \
FRONTEND_BASE_URL=https://star-sign.pl \
API_BASE_URL=https://api.star-sign.pl/api \
npm run ops:predeploy:local
```

Same nagłówki edge można sprawdzić osobno:

```bash
SECURITY_HEADER_URLS=https://star-sign.pl,https://api.star-sign.pl/api/health/ready npm run ops:headers
```

Produkcyjny plik env można sprawdzić osobno bez startu kontenerów:

```bash
PRODUCTION_ENV_FILE=.env npm run ops:env
```

## Smoke checklist frontendu przed launchem

- Strona główna ładuje hero, znaki zodiaku, artykuły i newsletter; przy braku danych pokazuje gotowe puste stany zamiast wiecznych skeletonów.
- Logowanie działa dla kont testowych po seedzie:
  - `demo@starsign.local` / `Test1234!`
  - `premium@starsign.local` / `Test1234!`
- Przy buildzie nieprodukcyjnym przyciski szybkiego wypełnienia kont demo/premium są widoczne na `/logowanie`; w produkcji nie mogą się renderować.
- Panel użytkownika pokazuje profil, dzisiejszy rytuał, subskrypcję i zapisane odczyty albo czytelny stan pusty.
- Newsletter: formularz na stronie głównej pokazuje stan wysyłania, sukces z prośbą o potwierdzenie oraz błąd z możliwością ponowienia.
- Linki `/newsletter/potwierdz?token=...` i `/newsletter/wypisz?token=...` pokazują success/error oraz prowadzą z powrotem do formularza newslettera.
- Legal pages `/regulamin`, `/polityka-prywatnosci`, `/cookies`, `/disclaimer` są dostępne i nadal zawierają widoczne TODO dla danych administratora.
- Przy `FRONTEND_SHOP_ENABLED=false` oraz `SHOP_ENABLED=false` nawigacja, stopka, home, blog, konto i numerologia nie pokazują linków do sklepu.
- Przy wyłączonym sklepie `/sklep`, `/sklep/produkt/:id`, `/checkout/success` i `/checkout/cancel` nie są dostępne jako normalne ścieżki zakupowe.
- Przy wyłączonym sklepie `/sitemap.xml` nie zawiera `/sklep` ani `/sklep/produkt/*`.

## Deployment VPS, kiedy przyjdzie pora

Docelowy deploy produkcyjny idzie przez GitHub Actions, GHCR i Portainer Swarm:

- stack: `ops/portainer/star-sign-production-stack.yml`
- API image: `ghcr.io/subscribe-it/star-sign-api:main`
- frontend image: `ghcr.io/subscribe-it/star-sign-frontend:main`
- reverse proxy: istniejący Traefik `traefik-load-balancer`
- media: Cloudflare R2, bez trwałego lokalnego wolumenu `uploads`

Przed pierwszym deployem ustaw w GitHub:

- secret `STAR_SIGN_PRODUCTION_ENV`
- secret `PORTAINER_WEBHOOK_URL`
- variables `FRONTEND_BASE_URL`, `API_BASE_URL`

W Portainerze ustaw realne zmienne środowiskowe i registry credentials dla GHCR.

Seed produkcyjny tylko świadomie:

```bash
ALLOW_PRODUCTION_SEED=true docker compose exec api npm run seed:prod
```

Backup Postgresa:

```bash
POSTGRES_DB=star_sign POSTGRES_USER=star_sign ./ops/backup-postgres.sh
```

- [x] Uzupełnić realne dane administratora w polityce prywatności i regulaminie. (Uzupełnione danymi star-sign.pl)
- [x] Infinite Scroll dla listy artykułów (bloga).
- Dodać docelową domenę, DNS, SPF, DKIM i DMARC dla Brevo.
- Zdecydować, czy przed launch przenosimy auth z JWT w `localStorage` do cookie `Secure HttpOnly`.
- Ustawić docelowe limity AICO i dodać realny token OpenRouter.
- [x] Po pierwszym buildzie admina sprawdzić ręcznie plugin SEO w Strapi Admin i dodać komponent `seo` do content type, jeśli ma być zarządzany edytorsko. (Komponent shared.seo dodany do Article, ZodiacSign, Horoscope, NumerologyProfile)
