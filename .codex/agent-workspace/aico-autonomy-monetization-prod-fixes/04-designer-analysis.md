# 04 — Analiza Designer Agent (skrót, PL) · 2026-08-25

## Zasada nadrzędna
Design system „Lumina Silk" (mystic-rose/mystic-cocoa/serif-display, zaokrąglenia
3xl, dashed obramowania slotów) jest zaakceptowany — **zero zmian wizualnych**
poza podmianą statycznego boxa na komponent o identycznych klasach.

## Stany AdSlot (pokryte implementacją)
| Stan | Render |
|---|---|
| brak ADSENSE_CLIENT_ID (prod dziś) | placeholder 1:1 z obecnym („Reklama" + tytuł) |
| ID + brak zgody marketing (RODO) | placeholder (skrypt NIE jest ładowany) |
| ID + zgoda marketing | `<ins class="adsbygoogle">` w tych samych wymiarach, `overflow-hidden` |
| błąd sieci AdSense | catch → zostaje ostatni poprawny stan, brak crashu UI |

## Dostępność / responsywność
- Wysokości jak dotychczas: home h-24→md:h-40; horoscope h-32 — brak CLS
  (rezerwacja miejsca przed załadowaniem jednostki).
- Kontrast tekstu placeholder bez zmian (klasy odziedziczone).
- SSR: komponent nie ładuje skryptu po stronie serwera (isPlatformBrowser).

## Ryzyka i decyzje
- Auto-format AdSense (`data-ad-format=auto`) może dobrać kreatywę inna niż
  estetyka strony → przy konfiguracji ID rozważyć sloty o stałych proporcjach.
  ⏸ Decyzja właściciela na etapie konta AdSense.
