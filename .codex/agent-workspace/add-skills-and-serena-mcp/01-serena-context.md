# Kontekst Serena — add-skills-and-serena-mcp

## Dostępność MCP Serena

**Na początku sesji narzędzia MCP Serena były NIEDOSTĘPNE** w zestawie narzędzi agenta
(brak funkcji `mcp__serena__*`). Pamięć Sereny istniała natomiast na dysku
(`.serena/memories/`) i była czytana bezpośrednio z plików:

- `project_overview.md` — struktura projektu, ostrzeżenie o nieaktualnym README (Angular 19 → faktycznie 21.2).

## Co ustalono o instalacji Sereny

- Projekt już zarejestrowany: `.serena/project.yml` (`project_name: star-sign`), globalna konfiguracja `~/.serena/serena_config.yml` (backend LSP).
- Serena dostępna przez `uvx --from git+https://github.com/oraios/serena serena` (wersja 1.7.1.dev0), cache uv rozgrzany.
- Smoke-test stdio OK: aktywacja projektu star-sign, 52 narzędzia; kontekst `ide-assistant` jest deprecated → użyto `claude-code` (ukrywa plikowe/powłokowe narzędzia zdublowane natywnie u agenta).

## Wiedza do zapisania

- Sposób podpinania serwerów MCP do DSH (patch profilu web) i lokalizacje discovery skilli — patrz `10-decision-log.md`.
