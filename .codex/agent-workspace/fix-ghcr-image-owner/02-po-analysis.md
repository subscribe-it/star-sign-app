# Product Owner analysis

## Problem

Deploy produkcyjny nie może utworzyć obrazów GHCR, mimo że sam build API przechodzi dalej niż poprzednio.

## Wartość biznesowa

Najmniejsza wartościowa poprawka to przywrócenie automatycznego publikowania obrazów z `main`, bez dokładania nowego sekretu i bez blokowania launchu konfiguracją organizacji.

## Kryteria akceptacji

- Workflow publikuje obrazy do namespace, do którego `GITHUB_TOKEN` ma prawo zapisu.
- Portainer domyślnie pobiera z tego samego namespace.
- Dokumentacja nie sugeruje już błędnego ownera dla obrazów Star Sign.
- Nie dotykamy sekretów ani lokalnego `.env.production.generated`.

## Konkluzja po polsku

Dla obecnego repo najlepszym domyślnym ownerem GHCR jest `dawid268`. To usuwa zbędną zależność od PAT lub od konfiguracji organizacji `subscribe-it`.
