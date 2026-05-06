# Implementation Plan

## Zmiany

- Przenieść styl cookie bannera z długich klas Tailwind do `cookie-banner.scss`.
- Usunąć desktopowy układ dzielący panel na wąską kolumnę tekstu i przyciski.
- Zachować istniejące `data-test` i metody zgód.
- Dodać `data-test="cookie-banner-title"` dla walidacji E2E.
- Rozszerzyć responsive smoke test o kontrolę wysokości nagłówka na tablet/desktop.
- Uelastycznić istniejącą asercję tarota w E2E tak, aby lokalny mock `The Star` i produkcyjny wariant `Gwiazda` nie blokowały pełnej walidacji.

## Pliki

- `frontend/src/app/core/components/cookie-banner/cookie-banner.html`
- `frontend/src/app/core/components/cookie-banner/cookie-banner.scss`
- `frontend-e2e/src/responsive-smoke.spec.ts`
- `frontend-e2e/src/soft-premium.spec.ts`

## Konkluzja

Naprawa jest UI-only. Nie zmienia consent cookie, analytics callback ani flag marketingowych.
