# Serena context

## Uzycie Sereny

- Serena aktywna dla projektu `star-sign`.
- Odczytano instrukcje Sereny przez `initial_instructions`.
- Odczytano pamieci:
  - `project_overview`
  - `style_and_conventions`
  - `suggested_commands`
  - `project/production_deployment_audit_2026_05_05`
  - `project/maintenance_mode_implementation_2026_05_05`
- Uzyto symbol overview dla:
  - `frontend/src/app/app.routes.ts`
  - `frontend/src/app/app.config.ts`
  - `frontend/src/app/app.ts`
  - `apps/api/src/index.ts`
- Uzyto wyszukiwania Sereny po `.codex/agent-workspace`, aby potwierdzic istnienie historii produkcyjnej: deploy, maintenance, R2/assets, AICO/autopublishing, cookie banner, GHCR.

## Najwazniejsze ustalenia

- `project_overview` potwierdza: Angular SSR frontend, Strapi 5 backend, Playwright E2E, wspolne typy i domeny produkcyjne `https://star-sign.pl/` oraz `https://api.star-sign.pl/`.
- README jest czesciowo starsze: wspomina Angular 19, a `package.json` pokazuje Angular 21.2 i Nx 22.7.
- Repo wymaga pracy przez Nx; `project.json` bywa czesciowy, a pelny obraz targetow daje `npm exec nx show project <project> --json`.
- W pamieci produkcyjnej z 2026-05-05 publiczna produkcja miala status `NO-GO`, z warunkowym GO dla trybu maintenance/staging po domknieciu bramek.
- Maintenance mode jest zaimplementowany przez Strapi App Settings i publiczny endpoint app settings; frontend ukrywa shell, gdy tryb jest aktywny poza dozwolonymi sciezkami.

## Ograniczenia

- Narzedzie Angular CLI MCP nie wykrylo workspace'u, prawdopodobnie dlatego, ze projekt jest prowadzony przez Nx bez klasycznego `angular.json`.
- Nx MCP docs zwrocilo blad 500, wiec w tym rozpoznaniu uzyto lokalnego Nx CLI i skill `nx-workspace`.

## Polish summary

Serena potwierdzila, ze system ma juz zapisana historie decyzji i wdrozen. Najwazniejsze przy przyszlych pracach: czytac pamieci Sereny, uzywac Nx do targetow, nie zakladac aktualnosci README bez sprawdzenia konfiguracji kodu.
