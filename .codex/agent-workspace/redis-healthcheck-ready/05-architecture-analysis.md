# Architecture analysis

## Przyczyna

Healthcheck tworzył klienta Redis z `lazyConnect: true`, ale od razu wykonywał `redis.ping()`. Przy `enableOfflineQueue: false` ioredis nie kolejkuje komendy przed gotowością socketu, więc zwraca błąd mimo działającego serwera Redis.

## Decyzja

Przed `PING` healthcheck jawnie czeka na gotowość klienta Redis:

- status `ready`: wykonuje `PING`;
- status `wait` albo `end`: wywołuje `connect()`;
- status pośredni: czeka na event `ready` z timeoutem.

## Podsumowanie po polsku

Gotowość API ma zależeć od realnego `PONG`, ale probe nie może fałszywie padać przez wyścig inicjalizacji klienta Redis.
