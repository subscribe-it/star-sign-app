# Product Owner / Business Analyst

## Cel biznesowy

Celem jest doprowadzenie soft launchu do stanu, w którym produkcyjna domena frontendowa i API przechodzą smoke checks po deployu z `main`.

## Kryteria sukcesu

- `https://star-sign.pl` działa z poprawnym certyfikatem.
- `https://api.star-sign.pl/api/health/ready` zwraca 200.
- GitHub Actions po deployu przechodzą smoke, security headers i e2e.
- API nie wymaga ręcznego obchodzenia certyfikatu ani lokalnego `--resolve`.

## Ryzyko

Jeśli API pozostanie poza routingiem Traefika, użytkownik zobaczy frontend, ale aplikacja będzie miała błędy SSR/API i nie przejdzie automatycznego gate produkcyjnego.

## Konkluzja

Frontend jest widoczny produkcyjnie, ale release nie jest jeszcze kompletny, dopóki API nie pojawi się jako aktywny router Traefika i nie przejdzie `/api/health/ready`.
