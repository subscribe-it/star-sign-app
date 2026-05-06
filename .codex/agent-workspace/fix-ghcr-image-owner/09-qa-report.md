# QA report

## Status

PASS lokalnie.

## Co sprawdzono

- Serena memory potwierdziła model deployu: dwa obrazy GHCR i Portainer Swarm.
- `gh repo view` potwierdziło repo `Dawid268/star-sign-app`.
- `gh run list` pokazało ostatni `Production Deploy` jako failed.
- `rg` nie znalazł już referencji Star Sign do `ghcr.io/subscribe-it/...`.
- YAML parse dla `.github/workflows/deploy-production.yml` i `ops/portainer/star-sign-production-stack.yml`: PASS.
- `docker compose -f ops/portainer/star-sign-production-stack.yml --env-file .env.production.generated config --quiet`: PASS.
- `git diff --check`: PASS.

## Ryzyko

Jeżeli użytkownik celowo chce publikować obrazy do `subscribe-it`, trzeba będzie zamiast tej poprawki skonfigurować osobny token GHCR z prawem `write:packages` do organizacji i zmienić login workflow.

## Konkluzja po polsku

Poprawka jest gotowa do pushu. Lokalny `package-lock.json` ma niezwiązaną zmianę po npm i nie powinien trafić do commita tej poprawki.
