# Plan panelu admina AICO (Centrum Sterowania Autonomią)

**Data:** 2026-06-16
**Cel:** Panel w Strapi Admin, przez który nietechniczny, polskojęzyczny operator w pełni rozumie i kontroluje autonomicznego agenta AI zarządzającego stroną — z pełnymi opcjami, opisami, tooltipami, statusami i błędami, ale **bez przeładowania** (progresywne ujawnianie, prosty bezpieczny domyślny widok).

## Zasady projektowe (wg CLAUDE.md §6 UI/UX)

1. **Polski, prosty język.** Każda etykieta, tooltip, błąd i pusty stan po polsku, bez żargonu. Termin techniczny (np. „ROAS") zawsze z krótkim wyjaśnieniem w tooltipie.
2. **Najpierw najprostszy bezpieczny widok.** Domyślnie widać status + najważniejsze przełączniki. Opcje zaawansowane (capy szczegółowe, reguły stop-loss, progi) chowane w sekcjach rozwijanych („Zaawansowane").
3. **Każda opcja wyjaśniona.** Wzorzec: **etykieta** + jednozdaniowy opis pod spodem + **ikona „?" z tooltipem** (co to robi, konsekwencja, bezpieczny domyślny zakres).
4. **Stany zawsze widoczne.** Loading / empty / error / success mają jawne, spójne komponenty. Błędy z backendu pokazywane czytelnie (co się stało + co zrobić), nie surowy stack.
5. **Bezpieczeństwo na wierzchu.** Kill-switch, tryb autonomii, status providerów i ostatnie błędy widoczne od razu; akcje krytyczne wymagają potwierdzenia (istniejący wzorzec `RUN_AICO_CONTROLLED_TICK`).
6. **Czytelność > kompletność na jednym ekranie.** Grupowanie w karty/zakładki; nie więcej niż ~7 elementów w jednej grupie.

## Architektura informacji (zakładki)

Istniejące zakładki zostają, dochodzi nadrzędne **Centrum Autonomii** i pasek statusu globalnego.

| Zakładka | Zawartość | Priorytet |
| --- | --- | --- |
| **Przegląd** (dashboard) | Stan ogólny (ready/needs_action/blocked/degraded), dzisiejsze liczniki vs capy (paski postępu), ostatnie błędy, skróty akcji. | P0 |
| **Autonomia** (NOWA / z settings) | Centrum Sterowania Autonomią — patrz niżej. | P0 |
| Przepływy (workflows) | Konfiguracja workflowów; tooltipy przy cron/limitach/guardrails. | P1 |
| Tematy (topics) | Kolejka tematów + backlog. | P2 |
| Media | Biblioteka, pokrycie, cooldown. | P2 |
| Uruchomienia (runs) | Historia runów, kroki, ślady LLM, błędy. | P1 |
| Social | Tickety, test połączenia, dry-run, błędy publikacji. | P1 |
| Reklamy (z growth/ads) | Plany kampanii, ledger budżetu, stop-loss, realokacja, status providerów. | P0 |
| Wzrost (growth) | Eksperymenty A/B (istotność, zwycięzca, auto-apply), strategia. | P1 |
| Audyt | Zdarzenia audytowe, preflight, production-readiness. | P1 |
| Diagnostyka | Providerzy, błędy, środowisko, ostatnie niepowodzenia. | P1 |

## Centrum Sterowania Autonomią (rdzeń)

Pasek górny (zawsze widoczny): **Tryb autonomii** (off / tylko szkice / strzeżony / pełny) jako segmented control z opisem każdego trybu + **Wyłącznik awaryjny** (kill-switch, czerwony, z potwierdzeniem). Obok — wskaźnik „Co agent może teraz robić sam" (na bazie taksonomii critical/non-critical).

Sekcje (karty, każda z tooltipami):

1. **Tryb i bezpieczeństwo** — tryb autonomii (z wyjaśnieniem: *strzeżony = sam decyduje o niekrytycznych w marginesie; pełny = też o krytycznych w capach*), kill-switch, bramki brand-safety / legal / no-sensitive-targeting.
2. **Limity dzienne (capy)** — ilościowe (LLM/media/wideo/publikacje/social/mutacje ads) + **kosztowe w PLN** (nowe: LLM/media/wideo). Każdy z paskiem „zużyte dziś / limit". Tooltip: „twardy limit; po przekroczeniu agent wstrzymuje daną akcję do jutra".
3. **Budżet reklam** — globalny + per-platforma (Meta/Google), z paskiem rezerwacji z ledgera. Tooltip o atomowej rezerwacji i marginesie.
4. **Stop-loss (ochrona wydatków)** — (nowe, aktywuje martwe `stop_loss_rules`): próg % budżetu do pauzy (np. 90%), opcjonalne progi efektywności (max CPA, min ROAS, min CTR), okno karencji. Tooltip: „pauza jest zawsze bezpieczna — tylko zmniejsza wydatek".
5. **Decyzje na bazie danych** — przełączniki: auto-uzupełnianie backlogu, auto-zatwierdzanie planu, auto-apply zwycięzcy A/B (z progiem ufności), auto-pauza słabych, realokacja budżetu, autopilot homepage. Każdy z opisem ryzyka i domyślnie bezpieczną wartością.
6. **Kanały** — dozwolone kanały social i platformy ads (multi-select z opisem).
7. **Status na żywo** — tryb efektywny, ostatni tick, blokady (np. „policy_unavailable", „kill-switch"), gotowość providerów (zielony/żółty/czerwony z powodem), wynik production-readiness (GO / NO-GO z listą braków).

## System pomocy (reużywalny)

- Komponent `InfoTooltip` (ikona „?" + `Tooltip` z Design System) i `FieldHelp` (etykieta + opis + tooltip) — jedno źródło, spójny wygląd.
- Centralny słownik PL `help` (klucz → {label, hint}) w `admin/src/help.ts`, by copy było w jednym miejscu, łatwe do utrzymania i tłumaczeń.

## Obsługa błędów i stanów

- Reużywalny `ErrorBanner` (czytelny komunikat PL + szczegóły zwijane + sugestia akcji) i `EmptyState`/`LoadingState`.
- Każda lista (runy, tickety, plany, eksperymenty) ma jawny empty/loading/error.
- Globalny pasek „ostatni błąd autonomii" z linkiem do Diagnostyki.

## Realizacja (fazami, weryfikacja: `tsc -p admin/tsconfig.json`)

1. **P0:** `InfoTooltip`/`FieldHelp` + słownik PL; Centrum Autonomii (tryb+kill-switch+capy+budżet+stop-loss+data-driven) z pełnymi tooltipami i statusem/błędami. Wymaga wcześniejszego backendu (pola polityki: capy kosztowe, stop_loss_rules, przełączniki data-driven).
2. **P1:** Sekcja Reklamy (ledger/stop-loss/realokacja), Wzrost (eksperymenty z istotnością i auto-apply), Runy/Social/Audyt/Diagnostyka — tooltipy + spójne błędy.
3. **P2:** Pełna polonizacja pozostałych zakładek, dopieszczenie pustych stanów, mikrocopy.

> Uwaga realizacyjna: `HomePage.tsx` to monolit ~6,8k LOC. Zmiany wprowadzam przyrostowo i bezpiecznie (typecheck admina po każdej fali), priorytetyzując Centrum Autonomii jako wzorzec, a nie ryzykowny pełny przepis naraz.
