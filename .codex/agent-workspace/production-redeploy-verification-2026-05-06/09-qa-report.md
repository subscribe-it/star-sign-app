# QA Report

## Wyniki

- `https://star-sign.pl`: PASS, HTTP 200 i certyfikat poprawny.
- `https://star-sign.pl/healthz`: PASS, HTTP 200.
- DNS `api.star-sign.pl`: PASS, domena wskazuje na IP VPS.
- `https://api.star-sign.pl/api/health/ready`: FAIL, walidacja TLS nie przechodzi.
- `https://api.star-sign.pl/api/health/ready` z `-k`: FAIL, HTTP 404 z Traefika.
- Certyfikat `api.star-sign.pl`: FAIL, serwowany jest `TRAEFIK DEFAULT CERT`.
- Ostatni deploy workflow `25422588184`: FAIL tylko na post-deploy smoke/e2e, wcześniejsze gate, build, push i webhook przeszły.

## Co nie było możliwe

Nie sprawdzono tasków i logów bezpośrednio przez Portainer API, bo w repo nie ma lokalnego tokena Portainera. Weryfikacja opiera się na publicznych endpointach i GitHub Actions.

## Konkluzja

Produkcja frontendu działa, ale API nie jest jeszcze gotowe produkcyjnie. Blokuje routing/certyfikat `api.star-sign.pl` oraz prawdopodobnie zdrowie taska API lub widoczność labels w Traefiku.

## Aktualizacja po logach API

Logi Strapi z Portainera potwierdziły:

- `Strapi started successfully`
- `/api/health/ready` zwraca 503
- Redis probe zwraca `WRONGPASS invalid username-password pair or user is disabled`

To potwierdza, że task API startuje, ale nie jest uznawany za ready, bo hasło używane przez klienta Redis w API nie zgadza się z hasłem wymaganym przez Redis.

## Walidacja poprawki stacka

Wprowadzono zmianę, aby stack Portainera generował `REDIS_URL`, `RATE_LIMIT_REDIS_URL` i `HTTP_CACHE_REDIS_URL` wyłącznie z `REDIS_PASSWORD`, zamiast przyjmować ręczne/stare URL-e z Portainera.

Wyniki lokalne:

- `sh -n ops/production-env-check.sh`: PASS
- `docker compose -f ops/portainer/star-sign-production-stack.yml --env-file .env.example config --quiet`: PASS
- `env COMPOSE_FILE=ops/portainer/star-sign-production-stack.yml npm run ops:predeploy:local`: PASS
- `git diff --check`: PASS

Pozostałe ostrzeżenia lint i npm audit są znanymi ostrzeżeniami niezwiązanymi z tą poprawką i nie zatrzymały predeploy check.

## Aktualizacja: security headers

Po naprawie Redis production smoke przeszedł, ale GitHub Actions zatrzymał się na `Verify security headers`, ponieważ `ops/security-headers-check.sh` sprawdzał bazowy `API_BASE_URL`, czyli `https://api.star-sign.pl/api`. Strapi poprawnie zwraca dla tego adresu 404, bo realny endpoint do sprawdzenia gotowości to `/api/health/ready`.

Poprawiono skrypt tak, aby przy `API_BASE_URL=https://api.star-sign.pl/api` sprawdzał `https://api.star-sign.pl/api/health/ready`.

Walidacja:

- `sh -n ops/security-headers-check.sh`: PASS
- `FRONTEND_BASE_URL=https://star-sign.pl API_BASE_URL=https://api.star-sign.pl/api npm run ops:headers`: PASS
- `SECURITY_HEADER_URLS=https://star-sign.pl,https://api.star-sign.pl/api/health/ready npm run ops:headers`: PASS

## Aktualizacja: Playwright E2E soft premium

Live API zwraca obecnie `ready`, a Redis w healthchecku ma status `true`. Najnowszy workflow produkcyjny przeszedł smoke i security headers, ale zatrzymał się na jednym teście Playwright:

- `frontend-e2e/src/soft-premium.spec.ts`
- test `keeps daily tarot readable and adds the premium analysis teaser`
- przyczyna: selektor `getByRole('heading', { name: 'Gwiazda' })` trafiał jednocześnie w `h1` i `h3`, więc Playwright zgłosił strict mode violation.

Poprawka zawęża asercję do głównego nagłówka:

- `getByRole('heading', { level: 1, name: 'Gwiazda' })`

To jest korekta testu, nie zmiana zachowania produktu.
