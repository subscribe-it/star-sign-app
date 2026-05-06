# Test Plan

## Walidacja zmian CI/CD

- `rtk sh -n` dla nowych lub zmienionych skryptów ops.
- YAML parse dla `.github/workflows/*.yml`.
- `rtk docker build --target api-runtime .` lokalnie, jeśli zasoby pozwolą.
- `rtk docker build --target frontend-runtime .` lokalnie, jeśli zasoby pozwolą.
- `rtk npm exec -- nx run api:build --outputStyle=static`.
- `rtk npm exec -- nx run frontend:build:production --outputStyle=static`.
- Po pushu: monitorować `Production Deploy` i porównać czasy jobów przed/po.

## Kryteria sukcesu

- `Production Deploy` pozostaje zielony.
- Czas build/push obrazów spada po rozgrzaniu cache.
- Post-deploy nie traci stałych 90 sekund, jeśli endpointy są gotowe wcześniej.
- Branch CI dla małych zmian nie uruchamia pełnego zestawu projektów, tylko affected.
