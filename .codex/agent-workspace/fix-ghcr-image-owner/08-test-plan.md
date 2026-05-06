# Test plan

## Walidacja lokalna

- Sprawdzić, że workflow i stack nie wskazują już obrazów `ghcr.io/subscribe-it/star-sign-*`.
- Sprawdzić YAML workflow.
- Sprawdzić `docker compose config` dla stacka Portainera.
- Uruchomić `git diff --check`.

## Walidacja CI

- Po pushu do `main` `Production Deploy` powinien przejść przez krok build/push obrazów.
- Jeżeli `PORTAINER_WEBHOOK_URL` jest pusty, kolejnym spodziewanym błędem będzie job `deploy`, nie build ani GHCR push.

## Konkluzja po polsku

Dowodem naprawy jest przejście joba `build-and-push` albo zmiana błędu z GHCR permission na brak webhooka Portainera.
