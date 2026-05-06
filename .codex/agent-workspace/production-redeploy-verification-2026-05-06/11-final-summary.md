# Final Summary

Po ręcznym repull/redeploy status zmienił się następująco:

- DNS dla `api.star-sign.pl` już działa.
- Frontend `https://star-sign.pl` działa i ma poprawny certyfikat.
- `api.star-sign.pl` nadal trafia w domyślny certyfikat Traefika i `404 page not found`.
- Nie należy jeszcze rerunować failed GitHub Action, bo smoke przejdzie przez DNS, ale spadnie na API routing/TLS.

Najbliższy krok operacyjny: w Portainerze sprawdzić task `api`, jego logi po ostatnim redeployu, labels serwisu oraz podpięcie do `traefik-public`.

## Aktualizacja: Redis WRONGPASS

Logi API potwierdziły, że główny runtime blocker to `WRONGPASS` Redis. Stack został utwardzony tak, żeby kontener API nie używał ręcznie ustawionych/starych `REDIS_URL`, `RATE_LIMIT_REDIS_URL` i `HTTP_CACHE_REDIS_URL`. Od teraz te wartości są generowane z jednego źródła, czyli `REDIS_PASSWORD`.

Po wdrożeniu tej zmiany w Portainerze trzeba zostawić w env stacka tylko `REDIS_PASSWORD` dla Redis i usunąć ręczne Redis URL-e.
