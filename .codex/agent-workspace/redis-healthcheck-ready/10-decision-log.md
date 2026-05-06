# Decision log

## Decision: Czekać na gotowość Redis przed PING

Date: 2026-05-06
Agents involved: Debugging, DevOps, QA

### Context

Produkcja zwracała `503` na `/api/health/ready`, mimo że Redis działał.

### Decision

Healthcheck ma przed `PING` doprowadzić klienta `ioredis` do statusu `ready`.

### Alternatives considered

- Wyłączyć Redis z ready checka.
- Włączyć offline queue.
- Usunąć `lazyConnect`.

### Rationale

Ready check powinien dalej weryfikować Redis, ale bez fałszywych błędów wynikających z wyścigu inicjalizacji połączenia.

### Consequences

Probe może poczekać do 1 sekundy na gotowość Redis. To mieści się w timeoutach healthchecka i jest lepsze niż fałszywe `503`.

### Polish summary

Nie obniżamy jakości healthchecka. Naprawiamy kolejność połączenia i komendy Redis.
