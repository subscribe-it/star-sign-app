# Decision log

## Decision: Repo i GHCR zostają w subscribe-it

Date: 2026-05-06
Agents involved: Developer, DevOps, Portainer

### Context

Repozytorium zostało przeniesione do organizacji `subscribe-it`.

### Decision

Używamy `subscribe-it` jako docelowego ownera GitHub i GHCR.

### Alternatives considered

- Pozostawić `dawid268` jako GHCR namespace mimo transferu repo.

### Rationale

Po transferze repo `GITHUB_TOKEN` działa w kontekście organizacji `subscribe-it`, więc obrazy powinny być publikowane w tym samym namespace.

### Consequences

Portainer musi używać `GHCR_OWNER=subscribe-it`, a registry credentials muszą mieć dostęp do paczek organizacji.

### Polish summary

Docelowy owner projektu i obrazów to `subscribe-it`.
