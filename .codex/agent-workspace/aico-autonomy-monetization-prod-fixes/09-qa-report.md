# Raport QA — dopracowanie systemu (2026-08-25)

## Co przetestowano i przeszło ✅
1. **Unit/API**: `nx run api:test` → **366/366** (w tym 2 nowe testy seeda zodiaku:
   upload→map→link oraz ciche pomijanie braków).
2. **SSR lokalnie (build prod)**:
   - przed fixem: każdy URL = identyczny shell 31 218 B, log „Falling back to CSR";
   - po fixie: `/znaki/baran` z `Host: star-sign.pl` → **200, ~83 kB, „Baran" ×5**;
     `www.` → 200; `Host: evil.example.com` → **400** (allowlist działa);
   - `/runtime-config.json` eksponuje `ads.adsenseClientId` z env.
3. **Lint/typecheck**: frontend + api → zielono.
4. **Smoke (regresja produkcyjna)**: nowy check poprawnie **FAILuje na żywej produkcji**
   (`zodiac images: 0/12`) — dowód, że strażnik łapie realny bug; po deployu powinien przejść.
5. Grafiki webp: 12/12 wygenerowane, metadane 1200×800 webp OK.

## Czego NIE przetestowano ⚠️
- Pełnego bootstrapu API na czystej bazie z R2 (wymaga kontenera/DB) — pokryte unitami
  mockującymi te ścieżki; weryfikacja end-to-end nastąpi w post-deploy smoke.
- E2E Playwright na prodzie (uruchamia CI po merge).
- Ścieżki AdSense bez ID (placeholder) — niezmienione UI, ryzyko regresji niskie.

## Ryzyka pozostałe
- Deploy musi zbudować obrazy z tą gałęzią; do czasu merge produkcja dalej serwuje CSR shell i 0/12 zdjęć.
- Pierwsze uruchomienie seeda na prodzie wykona 12 uploadów do R2 (jednorazowy koszt ~100 kB).

## Werdykt
Zmiany gotowe do PR. Po merge + deploy: oczekiwany smoke „zodiac images 12/12" i SSR OK.
