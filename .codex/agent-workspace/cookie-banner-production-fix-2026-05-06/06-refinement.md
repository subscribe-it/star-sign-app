# Refinement

## Problem

Produkcja pokazała regresję wizualną banera cookies. Układ desktopowy dzielił zbyt wąski panel na kolumny, przez co nagłówek łamał się pionowo.

## Zakres

Must-have:

- poprawić wygląd banera cookies na desktopie i mobile,
- zachować obecny flow zgód,
- dodać zabezpieczenie E2E przed ponownym pionowym łamaniem tytułu,
- przeprowadzić walidację lokalną i po deployu.

Out of scope:

- zmiana consent modelu,
- zmiana integracji GA4,
- zmiana treści polityki prywatności,
- przebudowa całego systemu cookie preferences.

## Akceptacja

- Baner jest czytelny na 390, 768 i 1440 px.
- Tytuł pozostaje w normalnym układzie tekstowym.
- Pełne `frontend-e2e:e2e` przechodzi lokalnie.
- Po wdrożeniu produkcyjny screenshot potwierdza poprawę.

## Konkluzja

To szybka poprawka produkcyjnego UX z małym zakresem technicznym, ale wysokim wpływem na pierwsze wrażenie użytkownika.
