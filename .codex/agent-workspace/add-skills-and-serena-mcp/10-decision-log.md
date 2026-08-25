# Decision log — add-skills-and-serena-mcp

## Decision: Serena jako serwer MCP w warstwie użytkownika profilu web DSH

Date: 2026-08-25
Agents involved: Developer (konfiguracja), Architect (analiza harnessu)

### Context
AGENTS.md wymaga MCP Sereny do pracy nad projektem, ale sesja startowała bez narzędzi `mcp__serena__*`.
DSH (harness) wspiera MCP przez plugin `@deepseek-ai/dsh-mcp-client`; kompozycja profilu web
składa się z bundli + warstwy użytkownika `~/.dsh/profiles/web/cordis.patch.yml`.

### Decision
Dodać wpis `insert` z instancją `@deepseek-ai/dsh-mcp-client` (serverName: `serena`, transport stdio,
`uvx --from git+https://github.com/oraios/serena serena start-mcp-server --project /home/dawid/Projekty/star-sign
--context claude-code --enable-web-dashboard false`, toolCallTimeoutMs: 300000).
Ścieżka do `uvx` bezwzględna (środowisko dziecka jest czyszczone).

### Alternatives considered
- `~/.mcp.json` w stylu Claude Code — DSH tego formatu nie czyta (odrzucone po analizie dokumentacji pluginu).
- Transport sse/http — wymaga osobno zarządzanego procesu; stdio jest zarządzany przez hosta (reconnect, HMR).
- Pinowanie projektu pominąć i aktywować przez `activate_project` — mniej wygodnie; projekt jest jeden, pinujemy.

### Rationale
Stdio + HMR = zero dodatkowych procesów do pilnowania; wpis przeżyje restarty; backup oryginału pozwala cofnąć.

### Consequences
- Narzędzia dostępne jako `mcp__serena__<nazwa>` dla wszystkich sesji web w tym profilu.
- Pierwsze wywołania symbolowe mogą być wolne (start TS language server); timeout podniesiony do 5 min.
- Przy awarii uvx/git host loguje błędy reconnectu, ale nie pada (`failOnStartupError` domyślnie false).

### Polish summary
Serenę podpięto jako standardowy serwer MCP w konfiguracji profilu web DSH; wpis działa od razu dzięki hot-reloadowi i przetrwa restarty. Cofnięcie: przywrócenie pliku `.bak`.

---

## Decision: nx-mcp odłożony do czasu `npm install`

Date: 2026-08-25

### Context
`opencode.json` i AGENTS.md sugerują Nx MCP server, ale w repo brakuje `node_modules`;
`npx nx ...` bez instalacji kończy się „Could not find Nx modules".

### Decision
Nie dodawać `nx mcp` teraz; dodać dopiero po `npm install` (wtedy wystarczy analogiczny wpis:
command `npx`, args `['-y','nx','mcp']`).

### Polish summary
Nx MCP odłożone — bez node_modules i tak by nie działało; powrót do tematu po instalacji zależności.
