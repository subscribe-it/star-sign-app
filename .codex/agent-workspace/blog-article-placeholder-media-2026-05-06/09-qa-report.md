# QA Report

## Co sprawdzono

- Unit testy API seed media.
- Unit testy frontend blog list.
- Typecheck API i frontend.
- Build API i frontend.
- Lokalny seed dev.
- Odpowiedź lokalnego Content API dla artykułów.
- Render `/artykuly` w Playwright.
- `git diff --check`.

## Wyniki

- `api:test`: PASS, 122 testy.
- `frontend:test --configuration=coverage`: PASS, 341 testów.
- `api:typecheck`: PASS.
- `frontend:typecheck`: PASS.
- `api:build`: PASS.
- `frontend:build`: PASS.
- `api:seed:dev`: PASS.
- Content API: `13/13` artykułów z `image.url`.
- Playwright lokalnie: `12` kart/hero na pierwszej stronie bloga, `12` załadowanych obrazów, `0` broken images, `0` fallback placeholder divów.
- `git diff --check`: PASS.

## Ryzyka

- Lokalne logi `api:seed:dev` nadal pokazują `articleLinked=0`, mimo że relacje w DB i API są poprawne. Wynika to z cleanupu legacy relacji wykonywanego bezpośrednio na tabeli relacji; efekt końcowy został zweryfikowany przez SQLite, API i Playwright.
- R2 public endpoint zwraca `application/octet-stream`, ale WebP renderuje się poprawnie w przeglądarce. SVG nie renderował się poprawnie, dlatego zastąpiono go WebP.

## Polska konkluzja

Zmiana jest gotowa lokalnie. Blog ma kompletne miniatury, a seed potrafi przejść z legacy SVG na aktualny WebP bez nadpisywania realnych obrazów.
