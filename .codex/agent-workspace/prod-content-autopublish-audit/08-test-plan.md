# Strategia testow QA: produkcyjny seed, generowanie contentu i social autopublish

Date: 2026-05-08
Role: QA / Test Engineer
Zakres: audyt i plan testow, bez edycji kodu, bez produkcyjnych mutacji i bez live provider calls.

## Cel testow

Zweryfikowac, ze po kontrolowanym seedowaniu produkcja lub staging produkcyjny potrafi samodzielnie:

1. wlaczyc komplet workflowow AICO,
2. zapewnic backlog albo autopilot strategii,
3. wygenerowac i opublikowac content w Strapi,
4. utworzyc social tickety,
5. opublikowac lub jednoznacznie zablokowac publikacje na Facebooku, Instagramie i X.

## Istniejace targety warte uruchomienia

### Lokalny gate bez providerow

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`
- `rtk npm exec nx run-many --targets=test:unit,test:ts:back,test:ts:front,verify --projects=ai-content-orchestrator --outputStyle=static`
- `rtk npm exec nx run ai-content-orchestrator:lint --outputStyle=static`
- `rtk npm exec nx run api:test --outputStyle=static`
- `rtk npm exec nx run api:aico-contract-audit --outputStyle=static`
- `rtk npm exec nx run api:premium-content-audit --outputStyle=static`
- `rtk npm exec nx run frontend:test --configuration=coverage --outputStyle=static`
- `rtk npm exec nx run frontend-e2e:e2e --outputStyle=static`
- `rtk npm run ops:predeploy:local`

### Staging gate przed GO

- `rtk npm run ops:predeploy:staging` z realnym staging env, bez wypisywania sekretow.
- `rtk npm run ops:smoke` z `API_BASE_URL` i `FRONTEND_BASE_URL` ustawionymi na staging/production URL.
- AICO strict audit w Admin UI: `Decision: GO`.
- Social `Test Connection` i `Dry Run` tylko po jawnej autoryzacji operatora i na bezpiecznych kontach/sandboxie.

## Testy funkcjonalne wymagane przed GO

### 1. Seed i post-seed preflight

Sprawdzic na stagingowej kopii produkcji, nie bezposrednio na produkcji:

- `ALLOW_PRODUCTION_SEED=true` jest ustawione tylko na czas seeda.
- Po seedzie `ALLOW_PRODUCTION_SEED=false` i env guard dalej przechodzi.
- Seed raportuje liczbe wlaczonych workflowow AICO, obecny token LLM, liczbe media assets i liczbe topic queue items.
- Workflowy maja `enabled=true`, `auto_publish=true`, poprawne `generate_cron`, `publish_cron`, `timezone=Europe/Warsaw`, kategorie dla article/daily card.
- Blog ma backlog `topic-queue-item.status=pending` albo strategia ma jawny mechanizm auto-approve do kolejki.
- Globalne ustawienia AICO maja `aico_auto_publish_enabled !== false`.
- Jesli produkcja ma sama uzupelniac tematy, `aico_strategy_autopilot_enabled=true` i workflow blogowy ma `strategy_enabled=true`.

### 2. Runtime tick bez providerow live

Na stagingu z providerami zamockowanymi albo w trybie dry-run:

- Cron AICO jest zarejestrowany jako minute tick.
- Tick wykonuje kolejnosc: strategia -> generowanie -> publikacja contentu -> social publish.
- Runtime lock blokuje rownolegle ticki.
- Gdy brakuje tokena LLM, workflow nie generuje i raportuje czytelny blad.
- Gdy workflow nie ma backlogu, status pokazuje brak tematow zamiast ciszy.
- Wygenerowany content przechodzi Polish quality gate i ma `premiumContent`.
- Publication ticket zmienia content na `publishedAt`, a nie zostaje stale `scheduled`.

### 3. Social publishing

Testy powinny pokryc osobno Facebook, Instagram i X:

- `enabled_channels` zawiera oczekiwane kanaly.
- Brak credentiali powoduje `blocked_reason`: `missing_facebook_config`, `missing_instagram_config`, `missing_x_config`.
- Publiczny `target_url` uzywa domeny `https://star-sign.pl`, nie historycznej `https://star-sign.app`.
- `media_url` wskazuje publicznie osiagalny CDN/R2 URL i zwraca 200.
- X nie przyjmuje captionow powyzej 280 znakow.
- Instagram nie dostaje URL w tresci, tylko komunikat typu "Link w bio".
- Guardrails dzienne i per-run rescheduluja zamiast dublowac posty.
- Provider payload pozostaje prywatny i zredagowany.

### 4. Admin UI i operacyjna czytelnosc

- Operator widzi status: generowanie wlaczone, backlog, social gotowy, ostatni tick, ostatni blad.
- `Audit` pokazuje `GO` albo konkretne `needs_action`.
- `Social` pokazuje tickety z czytelnym `blocked_reason`.
- Brak potrzeby czytania surowych logow do zrozumienia, co blokuje automatyzacje.

### 5. Kill switch i rollback

- `aico_auto_publish_enabled=false` blokuje publication tickets i social publish.
- Wylaczenie `AICO_ENABLE_WORKFLOWS` albo workflow `enabled=false` zatrzymuje generowanie.
- Po awarii providera tickety zostaja `scheduled`/`failed` zgodnie z klasyfikacja i mozna je bezpiecznie retry/cancel.

## Braki w testach

- Brak testu integracyjnego `seed:prod`/`seed:stg` -> workflow enabled -> topic queue -> orchestrator tick -> publication ticket -> social ticket.
- Brak testu, ktory chroni przed wylaczeniem istniejacych workflowow, gdy runtime env nie ma tokena, ale DB ma juz zaszyfrowany token.
- Brak testu post-seed preflightu bez sekretow, ktory sprawdza realny stan DB i ustawien AICO.
- Brak mockowanych testow HTTP providerow dla pelnych sciezek Facebook/Instagram/X; obecne testy social koncentruja sie mocno na `publishPending` z podmienionym `publishToProvider`.
- Brak testu kanonicznej domeny social URL i wykrywania `star-sign.app` w runtime payloadach.
- Brak testu, ze produkcyjny seed i bootstrap ustawily Media Gen token/model w sposob zgodny z `AICO_IMAGE_GEN_TOKEN`/`REPLICATE_API_TOKEN`.
- Brak E2E/Admin UI dla zakladek AICO `Audit`, `Workflows`, `Social`.
- Brak automatycznego dowodu, ze CDN/R2 ma rekordy Strapi Media Library, a nie tylko pliki w bucket.

## Dowody wymagane przed GO

- Wyniki lokalnych i stagingowych targetow Nx zapisane bez sekretow.
- Sanitized log z seeda: liczby workflowow, topic queue, coverage mediow, bez tokenow.
- Zrzut/raport AICO strict audit: `Decision: GO`.
- Sanitized DB/read-only report: workflow count, enabled count, pending topics, scheduled/published/failed tickets, social channel readiness.
- Health/smoke dla `https://star-sign.pl` i `https://api.star-sign.pl`.
- Publiczne HTTP 200 dla przykladowych obrazow z CDN/R2.
- Social `Test Connection` dla FB/IG/X: `ready`, wykonany dopiero po zgodzie na provider calls.
- Kontrolowany live publish albo sandbox publish dla FB/IG/X przed publicznym GO, rowniez tylko po jawnej zgodzie.
- Dowod rollbacku: kill switch zatrzymuje publikacje i nie gubi juz utworzonych ticketow.

## Ryzyka regresji

- Bootstrap lub seed moze nadpisac `enabled=false`, jesli brakuje runtime tokena, mimo ze token istnieje juz w DB.
- Tymczasowe `ALLOW_PRODUCTION_SEED=true` moze zostac w produkcyjnym env i powinno byc blokowane przez env guard po seedzie.
- Brak topic queue lub brak auto-approve strategii daje pozornie poprawna konfiguracje, ale bez generowania bloga.
- Domena `star-sign.app` w social targetach moze psuc linki i zaufanie uzytkownikow.
- Multi-replica API moze zwiekszac ryzyko duplikacji ticketow/provider calls bez row claiming/lockingu na poziomie kolejki.
- Provider rate limits i cooldowny moga blokowac publikacje bez widocznego komunikatu dla operatora.
- Media w R2 bez rekordow `plugin::upload.file` w DB nie wystarcza do poprawnych obrazow.

## Polska konkluzja QA

Aktualny stan testow jest dobry dla jednostkowej logiki AICO, ale niewystarczajacy dla GO produkcyjnego autopilota. Przed naprawami trzeba zbudowac lub wykonac post-seed preflight i stagingowy test calej petli, a live providery uruchamiac dopiero jako kontrolowany, jawnie zatwierdzony etap.

## Aktualizacja QA/Test Engineer - 2026-05-08

Zakres: przeglad istniejacych testow w `apps/api` i `ai-content-orchestrator` pod minimalny plan testow dla seed AICO, publicznych URL-i social, blokady `star-sign.app` i post-seed preflightu. Kod produkcyjny nie byl edytowany.

### Obecny stan

- `apps/api/src/bootstrap/seed-core.test.ts` juz testuje helpery seeda: merge ustawien AICO, zachowanie credentiali social i produkcyjne guardrails strategii.
- `apps/api/src/plugins/ai-content-orchestrator/server/src/__tests__/runtime.test.ts` juz testuje domyslne URL-e `https://star-sign.pl` i override przez `FRONTEND_URL` oraz `AICO_SOCIAL_DEFAULT_IMAGE_URL`.
- `apps/api/scripts/aico-post-seed-preflight.js` istnieje, ale uruchamia `main()` bez `module.exports` i bez `require.main === module`, wiec obecnie nie ma wygodnego miejsca na izolowane testy jednostkowe.
- `apps/api/src/plugins/ai-content-orchestrator/server/src/__tests__/runtime.test.ts` nadal zawiera stare `star-sign.app` jako dane fixture w testach social/polish-quality; dlatego test repo-wide `not.toContain('star-sign.app')` bylby zbyt szeroki i falszywie czerwony. Nalezy testowac runtime output albo wydzielone funkcje URL/preflight.

### Minimalny plan testow

1. Rozszerzyc `apps/api/src/bootstrap/seed-core.test.ts`.
   - `it('preserves existing AICO settings when env does not provide replacements')`
   - `it('overrides only explicit production AICO settings from env')`
   Cel: zabezpieczyc `seedAicoSettings`/`buildAicoSettingsValue`, zeby seed nie kasowal istniejacego `image_gen_api_token_encrypted`, `aico_auto_publish_enabled`, `aico_strategy_autopilot_enabled` ani customowych ustawien, gdy env nie podaje nowych wartosci.

2. Rozszerzyc `apps/api/src/plugins/ai-content-orchestrator/server/src/__tests__/runtime.test.ts`.
   - `it('prefers AICO_PUBLIC_FRONTEND_URL for generated social target URLs')`
   - `it('falls back from invalid public frontend URL to canonical star-sign.pl')`
   - `it('uses AICO_SOCIAL_DEFAULT_IMAGE_URL for social dry-run media URL')`
   Cel: domknac publiczne URL-e social z env ponad obecne testy `FRONTEND_URL` i defaultu.

3. Dodac waski test antyregresyjny dla starej domeny w runtime output.
   Plik: `apps/api/src/plugins/ai-content-orchestrator/server/src/__tests__/runtime.test.ts`
   - `it('does not generate star-sign.app in public social URLs')`
   Zakres: asercja na `buildPublicFrontendUrl`, `getSocialDefaultImageUrl` i/lub danych tworzonych przez `dryRunPublish` bez input `targetUrl/mediaUrl`. Nie robic globalnego grep po fixture.

4. Utestowac post-seed preflight po minimalnym wydzieleniu helperow.
   Docelowy plik testu: `apps/api/src/bootstrap/aico-post-seed-preflight.test.ts`
   Minimalny wymagany seam w skrypcie: eksport funkcji budujacej raport lub helperow oraz guard `if (require.main === module)`.
   - `it('passes social URL check for canonical star-sign.pl env')`
   - `it('fails social URL check when public URL or default image points to star-sign.app')`
   - `it('reports missing social credentials without leaking encrypted/token values')`
   - `it('fails when blog has no pending topics and strategy auto approve is disabled')`
   Cel: potwierdzic post-seed GO/NO-GO bez uruchamiania Strapi i bez sekretow.

### Minimalne komendy weryfikacyjne

- `rtk npm exec nx run api:test --outputStyle=static`
- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`

Wynik lokalny z przegladu: oba targety przechodza. `api:test`: 16 plikow, 127 testow. `ai-content-orchestrator:test:unit`: 1 plik, 55 testow.

## Wyniki po implementacji - 2026-05-08

### Testy dopisane

- `apps/api/src/bootstrap/seed-core.test.ts`: merge ustawień AICO, zachowanie istniejących settings, social credentials i guardrails strategii.
- `apps/api/src/bootstrap/aico-post-seed-preflight.test.ts`: helpery preflightu dla publicznych URL-i, braków social credentials, braku backlogu i priorytetu `AICO_PUBLIC_FRONTEND_URL`.
- `apps/api/src/plugins/ai-content-orchestrator/server/src/__tests__/runtime.test.ts`: fallback `https://star-sign.pl`, priorytet env URL-i, override obrazu social i antyregresja dla `star-sign.app` w helperach publicznych URL-i.

### Komendy wykonane lokalnie

- `rtk node -c apps/api/scripts/seed-core.js`
- `rtk node -c apps/api/scripts/aico-post-seed-preflight.js`
- `rtk npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`
- `rtk npm exec -- nx run api:test --outputStyle=static`
- `rtk npm exec -- nx run-many --targets=test:ts:back,test:ts:front,verify --projects=ai-content-orchestrator --outputStyle=static`
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`
- `rtk npm exec -- nx run api:aico-contract-audit --outputStyle=static`
- `rtk npm exec -- nx run api:premium-content-audit --outputStyle=static`
- `rtk npm exec -- nx run ai-content-orchestrator:lint --outputStyle=static`
- `rtk npm exec -- nx run api:lint --outputStyle=static`
- `rtk env PRODUCTION_ENV_FILE=.env.production.generated sh ops/production-env-check.sh`
- `rtk docker compose -f ops/portainer/star-sign-production-stack.yml --env-file .env.production.generated config --quiet`
- `rtk git diff --check`

### Wynik

- `api:test`: PASS, 17 plików, 134 testy.
- `ai-content-orchestrator:test:unit`: PASS, 1 plik, 56 testów.
- `ai-content-orchestrator` testy TS/verify: PASS.
- `api:typecheck`: PASS.
- Audyty AICO i premium content: PASS.
- Env check i walidacja compose: PASS.
- Linty: PASS bez błędów; zostały istniejące ostrzeżenia `@typescript-eslint/no-explicit-any`.
- `git diff --check`: PASS.

### Polska konkluzja QA

Zakres P0/P1 został zweryfikowany lokalnie bez providerów live. Testy potwierdzają seed merge, publiczne URL-e, preflight helpery i brak starej domeny w nowych helperach runtime. GO produkcyjne nadal wymaga post-seed preflightu na stagingu/produkcji oraz kontrolowanego testu FB/IG/X.
