# Decision Log

## Decision: Component CSS dla cookie bannera

Date: 2026-05-06
Agents involved: Product Owner, Designer, Architect, Developer, QA

### Context

Produkcja ujawniła, że długi zestaw klas Tailwind w template nie daje stabilnego desktopowego layoutu dla banera cookies.

### Decision

Przenieść układ i wygląd banera do `cookie-banner.scss`, zostawiając template czytelny i stabilny.

### Alternatives considered

- Korekta pojedynczych klas Tailwind w HTML.
- Zostawienie obecnego layoutu i tylko zwiększenie szerokości panelu.

### Rationale

Component CSS daje większą kontrolę nad responsywnością, ogranicza ryzyko przypadkowego zawężenia tekstu i ułatwia utrzymanie.

### Consequences

Trzeba pilnować budżetu SCSS komponentu, ale build produkcyjny przechodzi bez przekroczenia limitu.

### Polish summary

Wybrano dedykowane style komponentu, bo problem był layoutowy i wymagał precyzyjnej kontroli responsywności.

## Decision: E2E guard dla wysokości tytułu

Date: 2026-05-06
Agents involved: Developer, QA

### Context

Regresja objawiała się pionowym łamaniem tytułu, którego wcześniejsze testy overflow nie łapały.

### Decision

Dodać `data-test="cookie-banner-title"` i sprawdzać maksymalną wysokość tytułu w responsive smoke testach.

### Alternatives considered

- Poleganie tylko na screenshotach.
- Sprawdzanie samego overflow dokumentu.

### Rationale

Deterministyczny guard E2E szybciej wykryje powrót tego samego błędu w CI.

### Consequences

Test pozostaje prosty, ale zależy od rozsądnych limitów wysokości dla viewportów.

### Polish summary

Dodano test, który broni konkretnie przed ponownym pionowym łamaniem nagłówka banera.
