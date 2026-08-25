# Podsumowanie końcowe — add-skills-and-serena-mcp

Data: 2026-08-25 · Status: **zakończone**

## Co zostało zrobione

1. **Analiza możliwości** — DSH pozwala agentowi samodzielnie rozszerzać narzędzia:
   - skille: `<projekt>/.agents/skills/`, `<projekt>/.dsh/skills/`, `~/.dsh/skills/` (watcher na żywo),
   - MCP: plugin `@deepseek-ai/dsh-mcp-client` wpisywany do `~/.dsh/profiles/web/cordis.patch.yml` (HMR).
2. **MCP Serena skonfigurowane** — patch profilu web z instancją `mcp-serena` (stdio, projekt star-sign,
   kontekst `claude-code`, dashboard off, timeout 5 min). Backup: `cordis.patch.yml.bak-20260825-124822`.
3. **Weryfikacja na żywo** — host podjął zmianę bez restartu: proces Sereny uruchomiony przez DSH,
   TS language serverystarty; katalog skilli odświeżył się w trakcie sesji.
4. **Skill projektowy** — `.agents/skills/star-sign-orientation/SKILL.md` (struktura, komendy,
   konwencje AGENTS.md, pułapki) — potwierdzony w katalogu skilli.
5. **Notatki zadania** — brief, kontekst Serena, decision log.

## Stan narzędzi

- Narzędzia `mcp__serena__*` rejestrują się po stronie hosta; widoczne dla modelu od następnej tury /
  nowej sesji. Jeśli w kolejnej turze ich nie będzie — wystarczy restar sesji web (konfiguracja już siedzi w profilu).
- Nx MCP: świadomie odłożone do czasu `npm install` (patrz decision log).

## Ryzyka / uwagi QA

- YAML patcha zwalidowany parserem przed zastosowaniem; oryginał zachowany w kopii `.bak`.
- Pierwsze wywołania narzędzi symbolowych Sereny mogą trwać dłużej (rozgrzewka LSP).
- Zmiany dotyczą tylko środowiska agenta — żaden kod produktu nie został zmieniony.
