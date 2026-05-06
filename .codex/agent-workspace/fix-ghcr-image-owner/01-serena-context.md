# Serena context

Data: 2026-05-06

## Odczytane memory

- `project/portainer_swarm_deploy_2026_05_05`
- `project/remove_aico_audit_bearer_2026_05_05`

## Kontekst techniczny

- Repozytorium GitHub to `Dawid268/star-sign-app`.
- Workflow `Production Deploy` ma `permissions.packages: write` i loguje się do GHCR przez wbudowany `GITHUB_TOKEN`.
- Poprzedni błąd Strapi admin `dist/admin/index.mjs` został rozwiązany przez budowanie `ai-content-orchestrator` przed `api:build`.
- Aktualny problem deployu to publikowanie obrazów do `ghcr.io/subscribe-it/...`, czyli namespace innego właściciela niż repo.

## Wniosek po polsku

Przy użyciu `GITHUB_TOKEN` obrazy powinny trafiać do namespace właściciela repo, czyli `ghcr.io/dawid268/...`. Publikacja do `subscribe-it` wymagałaby osobnego PAT albo konfiguracji uprawnień organizacji, więc nie jest dobrym domyślnym wariantem dla tego repo.
