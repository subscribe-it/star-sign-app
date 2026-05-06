# Architecture Analysis

## Zakres techniczny

Komponent jest standalone Angular:

- `frontend/src/app/core/components/cookie-banner/cookie-banner.html`
- `frontend/src/app/core/components/cookie-banner/cookie-banner.scss`
- `frontend/src/app/core/components/cookie-banner/cookie-banner.ts`

SCSS komponentu był pusty, a template zawierał długie klasy Tailwind. To utrudnia utrzymanie i doprowadziło do złego układu desktopowego.

## Decyzja

Zostawiamy logikę TypeScript bez zmian. Poprawiamy tylko HTML/SCSS:

- dedykowane klasy komponentowe;
- stabilne szerokości i grid akcji;
- zachowane `data-test` dla E2E.

## Konkluzja

Zmiana jest niskiego ryzyka, bo nie dotyka cookies, analityki ani zapisu zgód.
