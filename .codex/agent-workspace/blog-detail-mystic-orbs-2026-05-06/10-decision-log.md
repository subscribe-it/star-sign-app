# Decision Log

## Decision: Lokalna poprawka widoczności orbów na artykule

Date: 2026-05-06
Agents involved: Product Owner, Virtual User, Designer, Architect, Developer, QA

### Context

Elementy `mystic-orb` na stronie szczegółów artykułu były obecne w DOM, ale przez niską przezroczystość i duże rozmycie nie dawały widocznego efektu wizualnego.

### Decision

Wzmocnić orby lokalnie w komponencie `BlogDetail`, bez modyfikacji globalnej klasy `.mystic-orb`.

### Alternatives considered

- Zmiana globalnej klasy `.mystic-orb`.
- Dodanie nowych elementów dekoracyjnych.
- Pozostawienie aktualnego wyglądu.

### Rationale

Globalna klasa jest używana w wielu miejscach aplikacji. Lokalna poprawka usuwa regresję na artykule bez ryzyka zmiany wyglądu innych stron.

### Consequences

Widok artykułu ma własne klasy `article-hero__orb`. Jeśli w przyszłości pojawią się podobne problemy na innych stronach, można wyciągnąć kontrolowany wariant utility zamiast zmieniać bazową klasę.

### Polish summary

Naprawiamy widoczność orbów lokalnie w stronie artykułu, bo to najmniejsze i najbezpieczniejsze rozwiązanie.
