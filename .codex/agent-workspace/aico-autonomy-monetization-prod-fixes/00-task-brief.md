# Task brief — dopracowanie systemu: zdjęcia prod, pełna autonomia AICO, monetyzacja

Data: 2026-08-25
Zlecenie użytkownika (PL): „dopracuj cały system; UI/UX jest OK — nie ruszaj, chyba że znajdziesz większe błędy/niezgodności; dopracuj AICO — strona ma być kompletnie zarządzana przez agenta i ma zacząć na siebie zarabiać; problem: zdjęcia nie pokazują się na produkcji star-sign.pl".

Klasyfikacja: **Large task** → pełny proces wieloagentowy.

## Zakres

1. **P0 — zdjęcia na produkcji** (diagnoza + naprawa + regresja).
2. **P0/SEO — SSR na produkcji nie renderuje treści** (znalezione podczas diagnozy; wpisuje się w „większe błędy niezgodności").
3. **AICO full autonomy** — agent kompleksowo zarządza treścią/media/publikacją w bezpiecznych widełkach.
4. **Monetyzacja** — strona zaczyna zarabiać (premium/Stripe jako baza; decyzje PO co dalej).
5. Ogólne usprawnienia bez redesignu UI.

## Status diagnozy (2026-08-25)

- Prod API: `zodiac-signs` → 12/12 z `"image": null`; tarot 22/22 OK; artykuły 12/13 OK.
- W repo/kontenerze **brak plików zdjęć znaków** (`apps/api/public/uploads`: 139 plików, 0 zodiakalnych).
- Bootstrap uruchamia `ensureSeedMedia` przy każdym starcie, ale dla znaków tylko *discovery* istniejących uploadów — nie ma czego odkryć.
- Frontend na prodzie serwuje identyczny shell CSR (~31 kB) dla każdego URL-a — SSR nie renderuje.
- Deploy: push na `main` → GHCR → webhook Portainera; brak SSH z maszyny deweloperskiej.

Szczegóły: `05-architecture-analysis.md`, plan: `07-implementation-plan.md`.
