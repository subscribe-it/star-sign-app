# Architecture analysis

## Diagnoza

`deploy-production.yml` używa `docker/login-action` z `secrets.GITHUB_TOKEN`. Ten token ma prawo publikować paczki w kontekście repozytorium, ale nie powinien być traktowany jako token do dowolnego namespace GHCR.

## Decyzja

Ustawiamy `IMAGE_OWNER=dawid268` w GitHub Actions i domyślne `GHCR_OWNER=dawid268` w stacku Portainera.

## Alternatywy

- Zostawić `subscribe-it` i dodać `GHCR_TOKEN` z `write:packages`.
- Przenieść repo do organizacji `subscribe-it`.
- Użyć zewnętrznego registry.

## Konsekwencje

Portainer musi mieć registry credentials do `ghcr.io/dawid268/...`, jeżeli obrazy pozostaną prywatne. Rollback po SHA działa bez zmian.

## Konkluzja po polsku

Zmiana namespace jest najprostsza i najmniej ryzykowna. Nie zmienia architektury deployu, tylko wyrównuje GHCR ownera między repo, workflow i stackiem.
