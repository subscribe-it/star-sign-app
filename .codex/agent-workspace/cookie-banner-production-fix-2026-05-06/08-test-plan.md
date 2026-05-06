# Test Plan

## Testy lokalne

- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`
- `rtk npm exec -- nx run frontend:lint --outputStyle=static`
- `rtk npm exec -- nx run frontend:build:production --outputStyle=static`
- `rtk npm exec -- nx run frontend-e2e:e2e --outputStyle=static`
- Playwright screenshot mobile i desktop przed/po.

## Testy po deployu

- Monitorować `CI` i `Production Deploy`.
- Sprawdzić screenshot produkcji po wdrożeniu.

## Konkluzja

Najważniejsze dowody to brak regresji E2E oraz wizualny screenshot desktopu, gdzie tytuł nie łamie się pionowo.
