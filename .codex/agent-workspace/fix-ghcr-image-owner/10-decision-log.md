# Decision log

## Decision: GHCR owner zgodny z repo

Date: 2026-05-06
Agents involved: Product Owner, Architect, Developer, QA

### Context

Workflow produkcyjny publikuje obrazy przez `GITHUB_TOKEN`, ale tagi wskazywały `ghcr.io/subscribe-it/...`.

### Decision

Użyć `dawid268` jako domyślnego ownera obrazów Star Sign w workflow, stacku Portainera i dokumentacji.

### Alternatives considered

- Osobny PAT do `subscribe-it`.
- Migracja repo do organizacji.
- Zewnętrzny registry.

### Rationale

To najmniejsza zmiana, która pasuje do uprawnień obecnego repo i nie wymaga nowych sekretów.

### Consequences

Portainer powinien pobierać `ghcr.io/dawid268/star-sign-api` i `ghcr.io/dawid268/star-sign-frontend`. Dla prywatnych paczek nadal potrzebuje registry credentials z `read:packages`.

### Polish summary

Obrazy produkcyjne Star Sign są domyślnie publikowane w namespace właściciela repo, żeby wbudowany `GITHUB_TOKEN` mógł je pushować bez dodatkowego PAT.
