# Architecture analysis

## Decyzja

Utrzymujemy `subscribe-it` jako właściciela repo i GHCR namespace dla produkcyjnych obrazów Star Sign.

## Konsekwencje

- `deploy-production.yml` używa `IMAGE_OWNER=subscribe-it`.
- Portainer stack domyślnie pobiera z `ghcr.io/subscribe-it/...`.
- `GHCR_OWNER` w Portainer runtime env musi mieć wartość `subscribe-it`.
- Registry credentials Portainera muszą mieć dostęp `read:packages` do paczek organizacji `subscribe-it`, jeżeli obrazy są prywatne.

## Podsumowanie po polsku

Docelowa architektura jest spójna: repo, GHCR i Portainer są w namespace `subscribe-it`.
