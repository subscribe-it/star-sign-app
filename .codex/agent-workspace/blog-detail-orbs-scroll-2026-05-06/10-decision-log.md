# Decision Log

## Decision: Lokalny scroll artykułu zamiast globalnej zmiany routera

Date: 2026-05-06
Agents involved: Product Owner, Virtual User, Designer, Architect, Developer, QA

### Context

Problem dotyczy strony artykułu, która może zostać ponownie użyta przy zmianie sluga i zachować starą pozycję scrolla.

### Decision

Dodać browser-only scroll w komponencie `BlogDetail`, z pierwszeństwem dla `route.fragment` i fallbackiem do `article-content`.

### Alternatives considered

- Globalne `withInMemoryScrolling`.
- Brak lokalnego scrolla i poleganie na domyślnym zachowaniu routera.

### Rationale

Globalna zmiana mogłaby wpłynąć na inne flow. Lokalny mechanizm rozwiązuje konkretny problem artykułów.

### Consequences

Artykuły mają własny kontrakt anchorów. Jeśli podobny problem pojawi się w wielu sekcjach, można przenieść logikę do wspólnej usługi scrolla.

### Polish summary

Scroll i fragmenty obsługujemy lokalnie w artykułach, bez ryzyka regresji w reszcie aplikacji.

## Decision: Ostre orby zamiast rozmytej mgły

Date: 2026-05-06
Agents involved: Designer, Developer, QA

### Context

Po poprzedniej poprawce orby były widoczne, ale przez blur dalej wyglądały jak zamglone tło.

### Decision

Usunąć blur z lokalnego wariantu i dodać obramowanie oraz pierścienie.

### Alternatives considered

- Dalsze zwiększanie opacity rozmytych orbów.
- Zmiana globalnej klasy `.mystic-orb`.

### Rationale

Brak blur usuwa główne źródło problemu, a lokalny wariant nie wpływa na inne widoki.

### Consequences

Hero artykułu ma bardziej czytelny, redakcyjny efekt dekoracyjny.

### Polish summary

Orby w artykule są teraz ostre i kontrolowane lokalnie.
