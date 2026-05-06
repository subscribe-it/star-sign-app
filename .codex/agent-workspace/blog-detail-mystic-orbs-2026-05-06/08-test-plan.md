# Test Plan

## Testy

- Unit test komponentu BlogDetail sprawdza obecność dwóch orbów z `data-test`.
- Playwright sprawdza `/artykuly/:slug`, computed style i realny render w desktop viewport.
- `frontend:test --configuration=coverage`
- `frontend:typecheck`
- `frontend:build`
- `git diff --check`

## Polska konkluzja

Najważniejszy dowód to browser check: elementy mają być nie tylko w DOM, ale też renderować się z niezerowym rozmiarem, widocznym tłem i poprawną warstwą.
