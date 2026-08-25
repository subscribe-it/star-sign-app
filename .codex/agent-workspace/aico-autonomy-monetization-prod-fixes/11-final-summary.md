# Podsumowanie końcowe — 2026-08-25 · Status: **PR #34 otwarty**

## Rezultaty
1. **Zdjęcia znaków (P0)** — przyczyna źródłowa: pliki nie istniały nigdzie (repo/R2/DB).
   Fix: 12 grafik konstelacyjnych + self-heal w bootstrapie (`ensureSeedMedia` uploaduje,
   mapuje jako `zodiac_profile` i linkuje). Testy regresyjne dodane.
2. **SSR na produkcji** — przyczyna: pusty `allowedHosts` ⇒ CSR fallback dla każdego URL.
   Fix: allowlista z `FRONTEND_URL`/domen/env + `trustProxyHeaders`; obcy Host → 400.
   Zweryfikowano lokalnie na buildzie produkcyjnym.
3. **Regresja** — `ops/smoke.sh`: asercje zdjęć (≥10/12) i treści SSR; oba celowo failują
   na obecnej produkcji (dowód skuteczności).
4. **Autonomia AICO** — silnik kompletny; runbook `docs/aico-full-autonomy-runbook.md`
   z matrycą env/polityki dla trybu `full` (tokeny i przełączenie = decyzja właściciela).
5. **Monetyzacja** — premium/Stripe gotowe (smoke pilnuje); `ADSENSE_CLIENT_ID` eksponowany
   przez runtime-config; okablowanie slotów frontendowych = mały follow-up po podaniu ID wydawcy.

## Dowody
- API testy 366/366; lint+typecheck zielone; SSR lokalnie 200 z treścią trasy;
  smoke FAIL na prodzie 0/12 zdjęć (poprawnie wykrywa bug).

## Następne kroki
- CI na PR #34 → merge → deploy → weryfikacja smoke na prodzie (następna runda celu).
- Właściciel: tokeny OpenRouter/image-gen (+opcjonalnie social) wg runbooka, decyzja o `full`.
