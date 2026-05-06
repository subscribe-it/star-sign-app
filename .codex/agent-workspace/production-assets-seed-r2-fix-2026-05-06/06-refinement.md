# Refinement

## Problem

Assety tarota są w repo i powinny być widoczne po deployu, ale produkcyjne API nie ma relacji `image`.

## Zakres must-have

- Dodać bootstrap seed mediów tarota.
- Zachować idempotencję.
- Nie logować sekretów ani pełnych envów.
- Nie wymagać `ALLOW_PRODUCTION_SEED=true`.
- Dodać testy mapowania i zachowania przy istniejącym rekordzie.

## Zakres not-now

- Pełny import wszystkich historycznych mediów z bucketu bez manifestu.
- Automatyczne przypinanie obrazów zodiaku bez plików źródłowych.
- Migracja istniejących ręcznych assetów, których nazwy nie są znane.

## Edge cases

- Plik lokalny nie istnieje: bootstrap ma ostrzec i kontynuować.
- Rekord upload już istnieje: nie uploadować ponownie.
- Karta ma już obraz: nie nadpisywać ręcznego wyboru, chyba że obraz jest pusty.

## Konkluzja

Wdrażamy seed tarota jako powtarzalny bootstrap, a brak assetów zodiaku traktujemy jako osobny zakres wymagający plików lub manifestu.
