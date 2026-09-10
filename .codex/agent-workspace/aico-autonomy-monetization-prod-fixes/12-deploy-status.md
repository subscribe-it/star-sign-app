# Status deployu — 2026-09-10

## Obecny stan (twarde dowody z probów produkcyjnych)

| Element | Stan | Świadectwo |
|---|---|---|
| Pipeline CI (gate → build → push GHCR → webhook) | ✅ zielony | run 34501445800: wszystkie 3 joby success |
| Webhook Portainera | ✅ działa | nowy URL (sekret zaktualizowany 2026-08-26), HTTP 200 |
| Kontener FRONTEND | ✅ aktualny | SSR pełny render, nagłówki x-ssr-*, strony prawne live |
| Kontener API | ❌ ZAMROŻONY na obrazie sprzed ~10 commitów | pole `seedMediaDiag` nieobecne w `/api/app-settings/public`; zodiac 0/12; brak logów `[seed-media-diag]` |

## Root cause (rozstrzygnięty, udokumentowany)

Portainer **CE** stack webhook wykonuje wyłącznie „force update" usług Swarma — **bez pobrania obrazu** z rejestru (`prePullImage`/`rePullImage` w API to flagi wyłącznie wersji EE; potwierdzone w swaggerze `portainer/client-api-go` i issues #8373/#10630). Swarm nie re-pulluje, gdy referencja obrazu (tag `:main`) się nie zmienia — dlatego API przez wiele deployów działało na zabytkowym obrazie mimo „sukcesów" pipeline'u.

Naprawy już wdrożone w kodzie (czekają na aktywację re-pull):

1. **R2 SignatureDoesNotMatch** (zdjęcia 0/12): `@aws-sdk ≥3.739` domyślnie podpisuje PUT z CRC32; Cloudflare R2 odrzuca (403). Fix: `requestChecksumCalculation/responseChecksumValidation: WHEN_REQUIRED` w `apps/api/config/plugins.ts` (commit 7152df2).
2. **Seed social tokens z env** (commit 0e19223 + testy 350bf37): workflowy AICO samoseedują FB/IG/X credentialy z env Portainera (merge-safe). 369/369 testów.
3. **Trwały re-pull** (commit 850dd9c): deploy job po webhooku robi `PUT /api/stacks/{id}` z `pullImage:true` + `STAR_SIGN_IMAGE_TAG=SHA` + stackFileContent z repo. **Wymaga sekretu `PORTAINER_API_KEY`** — bez niego krok pomijany (runy z 2026-09-10 potwierdzają).

## Akcje ownera (jednorazowe, łącznie ~5 minut)

1. **Klucz API**: Portainer → Settings → API keys → + Add API key („github-deploy") → `gh secret set PORTAINER_API_KEY --body "<klucz>"` (albo przekazać klucz agentowi).
2. **Env social** (do pełnego autopublishingu; szczegóły w pamięci Serena `aico/aico_social_publishing_architecture`):
   - `AICO_FACEBOOK_PAGE_ID` + `AICO_FACEBOOK_ACCESS_TOKEN`
   - `AICO_INSTAGRAM_USER_ID` + `AICO_INSTAGRAM_ACCESS_TOKEN`
   - `AICO_X_API_KEY` / `AICO_X_API_SECRET` / `AICO_X_ACCESS_TOKEN` / `AICO_X_ACCESS_TOKEN_SECRET`
   - `AICO_OPENROUTER_TOKEN` + `AICO_ENABLE_WORKFLOWS=true`
3. Alternatywnie do pkt 1 (jednorazowo, ręcznie): Stacks → star-sign → **Re-pull image and redeploy** — uruchomi naprawy 1–2 natychmiast, ale problem wróci przy kolejnych deployach bez klucza.

## Po wykonaniu — przewidywana sekwencja (automatyczna)

Deploy → PUT pullImage → Swarm pulluje SHA → API restartuje z nowym obrazem → bootstrap: `[seed-media-diag]` w logu + pole w `/api/app-settings/public` → self-heal wgraje 12 zdjęć znaków do R2 → smoke „zodiac images 12/12" zielony → post-deploy e2e zielone → pipeline w pełni zielony po raz pierwszy od czerwca.

## Historia blokad (RF #5–8 → ten cel, rundy 1–4)

- Bramka `action_required` (toJSON(secrets)) — rozwiązana 2026-08-25.
- Wygasły webhook URL (404) — rozwiązany 2026-08-26 (sekret PORTAINER_WEBHOOK_URL).
- GHCR registry credentials — owner twierdzi „poprawione"; pull nadal nie zachodził z powodu root cause CE (patrz wyżej), więc stan rejestru nie został ostatecznie zweryfikowany osobno — nowy mechanizm PUT+pullImage rozstrzygnie to przy najbliższym deployu.
