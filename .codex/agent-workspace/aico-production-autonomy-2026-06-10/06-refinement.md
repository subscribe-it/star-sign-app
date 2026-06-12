# Refinement

## Problem

Post-seed preflight powinien byc wiarygodnym dowodem gotowosci AICO, ale aktualnie moze generowac falszywy NO-GO dla docelowych trybow full autonomy.

## Uzytkownik

Operator/wlasciciel Star Sign, ktory chce bezpiecznie uruchomic autonomiczny system content + social + growth.

## Wartosc

Mniej recznej diagnostyki po seedzie i jasna sciezka do produkcyjnego GO bez obchodzenia guardrailow.

## Must-have

- Poprawna obsluga `controlled` i `replicate`.
- Read-only social connection preflight.
- Provider readiness tylko dla wymaganych providerow w full autonomy.
- Testy helperow.
- Walidacja Nx.

## Should-have

- Env examples dla opcjonalnej flagi social connection preflight poza full autonomy.
- Raport social preflight bez raw provider payloadow.

## Not now

- Realny live ads spend.
- Automatyczna publikacja testowego posta.
- Zapisywanie sekretow.

## Dowody

- Testy Vitest dla preflight helperow.
- Targety Nx dla AICO i API.
- `git diff --check`.

## Wniosek po polsku

Implementujemy maly, ale krytyczny most miedzy seedingiem, providerami i production-readiness. To nie ma luzowac zabezpieczen, tylko usuwac falszywe blokady.

## Refinement addendum: public homepage API time window

### Problem

Publiczny `GET /homepage/recommendations` filtruje rekomendacje po `status=active`, ale publiczna powierzchnia nie powinna polegac tylko na statusie, ktory moze nie zostac odswiezony po awarii crona albo recznej edycji.

### Akceptacja

- Publiczne rekomendacje zwracaja tylko wpisy aktywne w aktualnym oknie czasu: `starts_at` puste albo w przeszlosci oraz `expires_at` puste albo w przyszlosci.
- Endpoint nadal nie zwraca relacji operacyjnych ani metadanych wewnetrznych.
- Limit publiczny pozostaje przyciety do 24.

### Wniosek po polsku

Publiczny endpoint homepage musi sam egzekwowac okno publikacji, a nie zakladac, ze status jest zawsze idealnie zsynchronizowany.

## Refinement addendum: controlled admin run-now

### Problem

Adminowe `autonomy.runNow` domyslnie pozostaje dry-runem, ale potrzebuje kontrolowanej sciezki live dla recznego operacyjnego ticka w pelnej autonomii. Jednoczesnie zwykle klikniecie w panelu nie moze przypadkowo odpalic efektow zewnetrznych.

### Akceptacja

- Domyslny `runNow` bez jawnego trybu live pozostaje dry-runem.
- Kontrolowany live run-now wymaga env `AICO_ADMIN_RUN_NOW_ENABLED=true`, body `live=true` albo `mode=controlled_live` oraz potwierdzenia `RUN_AICO_CONTROLLED_TICK`.
- Przed `orchestrator.tick()` backend wymaga `production-readiness=GO` ze strict auditem.
- Brak bramki, brak potwierdzenia albo readiness inne niz GO nie wywoluje `orchestrator.tick()`.
- Proba i wynik sa audytowane.

### Wniosek po polsku

Live run-now ma byc produkcyjnie mozliwy, ale dopiero przez potwierdzona, audytowana i readiness-gated sciezke.
## Inkrement: release DB audits env loading

### Problem

`RUN_DOMAIN_AUDITS` jest czescia staging/production predeploy, ale dwa glowne audyty DB ladowaly env przez `process.cwd()`. To utrzymuje ryzyko falszywego fail/pass przy innym sposobie uruchomienia.

### Zakres MVP

- Wspolny helper `release-env.js` dla skryptow Node pod `apps/api/scripts`.
- Przepiecie `aico-contract-audit`, `premium-content-audit` i `premium-content-backfill` na helper.
- Stabilizacja `audit-sqlite` tak, aby relatywne `DATABASE_FILENAME` liczyc od `apps/api`.
- Testy helpera bez prawdziwych sekretow i bez laczenia z baza.

### Poza zakresem teraz

- Realne uruchomienie audytow na staging/production DB.
- Zmiana SQL, progow premium content albo kontraktu AICO.
- Migracja wszystkich pomocniczych skryptow API poza sciezkami release/audit.

### Wniosek po polsku

To jest technicznie maly, ale operacyjnie istotny krok: predeploy ma byc powtarzalny i odporny na cwd, zanim zaczniemy twierdzic, ze AICO jest produkcyjnie gotowe.
