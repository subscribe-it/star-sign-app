# System Architect

## Obserwacje techniczne

- `api.star-sign.pl` rozwiązuje się na IP VPS.
- TLS dla `api.star-sign.pl` używa certyfikatu `TRAEFIK DEFAULT CERT`, a nie certyfikatu dla subdomeny API.
- Żądanie z `-k` do `https://api.star-sign.pl/api/health/ready` zwraca `404 page not found`, co wygląda jak brak dopasowanego routera Traefika.
- `https://star-sign.pl/api/health/ready` zwraca 500 z frontendu Express, co sugeruje, że router API dla `Host(star-sign.pl) && PathPrefix(/api)` nie przejmuje ruchu.

## Najbardziej prawdopodobne przyczyny

1. Serwis `api` w Swarm nadal nie ma zdrowego taska, więc Traefik nie tworzy routera dla jego labels.
2. Portainer uruchomił stack z nieoczekiwanymi wartościami env dla domen lub bez aktualnego pliku `ops/portainer/star-sign-production-stack.yml`.
3. Traefik nie widzi labels serwisu `api` albo serwis nie jest podpięty do `traefik-public`.

## Rekomendacja

Najpierw sprawdzić w Portainerze stan tasków `api`, bieżące logi API i labels serwisu. Dopiero po potwierdzeniu, że API jest zdrowe i labels są obecne, ponawiać GitHub Actions.

## Ustalenie: requesty FE do `/api`

Frontend produkcyjny ma w `frontend/src/environments/environment.prod.ts` ustawione `apiUrl: '/api'`. Dodatkowo `frontend/src/server.ts` ma produkcyjny proxy handler `app.use('/api', ...)`, który przekazuje requesty do `API_URL`, a stack Portainera ustawia `API_URL: http://api:1337/api`.

To oznacza, że request w przeglądarce do `https://star-sign.pl/api/...` jest zgodny z aktualną architekturą. Powinien działać na dwa sposoby:

1. Traefik powinien przechwycić `Host(star-sign.pl) && PathPrefix(/api)` i skierować ruch do Strapi.
2. Jeżeli ruch trafi do frontendu, SSR proxy powinno przekazać go wewnętrznie do `api:1337`.

Skoro publicznie `star-sign.pl/api/...` zwraca 500, a `api.star-sign.pl` zwraca 404/default cert, problem nie jest w URL klienta. Problemem jest brak zdrowego/widocznego serwisu API albo jego niewidoczność dla Traefika i/lub frontendowego proxy.

## Konkluzja

Nie wygląda to już na problem obrazu GHCR ani DNS. Obecnie blocker jest po stronie runtime routingu/health serwisu API w Swarm.
