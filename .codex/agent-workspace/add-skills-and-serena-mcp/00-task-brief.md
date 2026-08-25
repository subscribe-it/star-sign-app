# Task brief — dodanie skilli i MCP (Serena) do harnessu DSH

Data: 2026-08-25
Zlecenie: „czy możesz dodać sobie skille i mcp? takie jak serena itd?"
Klasyfikacja: **Small task** (konfiguracja środowiska agenta, bez zmian w kodzie produktu).

## Cel

1. Wyjaśnić, czy agent może samodzielnie rozszerzać swoje narzędzia (skille + serwery MCP) w harnessie DSH.
2. Skonfigurować MCP Serena dla projektu star-sign.
3. Dodać przykładowy, użyteczny skill projektowy i potwierdzić mechanizm discovery.

## Wynik

- Mechanizm potwierdzony: skille z `<projekt>/.agents/skills/` są wykrywane na żywo (watcher); MCP przez plugin `@deepseek-ai/dsh-mcp-client` w warstwie użytkownika profilu web z hot-reloadem (HMR).
- Szczegóły: `11-final-summary.md`.
