# Serena context

Data: 2026-05-06

## Odczytane memory

- `project/production_deploy_status_2026_05_06`

## Kontekst

Produkcja uruchamia Strapi poprawnie, ale `/api/health/ready` zwraca `503`, bo Redis probe rzuca:

```text
Stream isn't writeable and enableOfflineQueue options is false
```

Redis jako serwis startuje poprawnie i przyjmuje połączenia.

## Wniosek po polsku

Problem nie jest w samym Redisie, tylko w sposobie wykonywania probe. Klient `ioredis` w healthchecku jest `lazyConnect: true` i `enableOfflineQueue: false`, więc `PING` musi poczekać na status `ready`.
