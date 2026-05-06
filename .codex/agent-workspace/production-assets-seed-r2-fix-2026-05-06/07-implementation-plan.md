# Implementation Plan

## Pliki

- `apps/api/src/bootstrap/seed-media.ts`
- `apps/api/src/bootstrap/seed-media.test.ts`
- `apps/api/src/bootstrap/content.ts`

## Kroki

1. Dodać definicję 22 lokalnych assetów tarota.
2. Dodać `ensureSeedMedia`, która uploaduje brakujące pliki i podpina je do kart.
3. Dodać AICO media asset dla każdego pliku tarota.
4. Wywołać `ensureSeedMedia` w `ensureBootstrapContent` po `seedTarotCards`.
5. Dodać testy jednostkowe.

## Konkluzja

Zmiana dotyczy wyłącznie bootstrapu mediów i nie zmienia publicznych kontraktów API.
