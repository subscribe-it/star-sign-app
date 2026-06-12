# Decision Log

## Decision: Nie czytac `.env.production.generated`

Date: 2026-06-06
Agents involved: supervisor, architect, security

### Context

Aktywny plik IDE to `.env.production.generated`, ktory moze zawierac realne sekrety.

### Decision

Do rozpoznania systemu uzyto `.env.example`, dokumentacji ops i konfiguracji kodu. Nie odczytano potencjalnie sekretnego pliku produkcyjnego.

### Alternatives considered

- Odczytac `.env.production.generated` i anonimizowac wartosci.
- Pominac calkowicie kontrakt env.

### Rationale

`.env.example` wystarcza do zrozumienia kontraktu i nie ryzykuje ujawnienia sekretow.

### Consequences

Rozpoznanie env opisuje ksztalt konfiguracji, nie potwierdza aktualnosci realnych wartosci produkcyjnych.

### Polish summary

Bezpieczenstwo sekretow ma pierwszenstwo; mapa systemu opiera sie na publicznym szablonie env.

## Decision: Traktowac Nx jako source of truth dla targetow

Date: 2026-06-06
Agents involved: supervisor, architect, developer

### Context

Niektore targety sa inferowane przez pluginy Nx, a `project.json` nie pokazuje pelnej konfiguracji.

### Decision

Do mapowania projektow i targetow uzywac `npm exec nx show project <project> --json`.

### Alternatives considered

- Czytac tylko `project.json`.
- Wnioskowac po strukturze katalogow.

### Rationale

Nx pokazuje realny, zlozony obraz workspace'u.

### Consequences

Przyszle prace powinny zaczynac od `nx show project`, szczegolnie dla `frontend-e2e` i bibliotek.

### Polish summary

Pelna prawda o targetach jest w Nx CLI, nie zawsze w samym `project.json`.
