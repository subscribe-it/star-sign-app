# 08 — Plan testów (PL) · 2026-08-25

## Zakres zmian objętych planem
SSR allowlista · self-heal mediów zodiaku · smoke guardy · AdSlot/runtime-config.

## Testy jednostkowe (wykonane ✅)
1. seed-media: upload+map+link znaku; ciche pomijanie brakujących plików (2 nowe).
2. runtime-config: akceptacja `ca-pub-\d{10,}`; odrzucenie niepoprawnego ID (2 nowe).
3. ad-slot.spec: placeholder bez ID; placeholder bez zgody marketing; ładowanie
   skryptu raz + push do kolejki + guard drugiej instancji (3 nowe).
4. Regresja istniejących spec home/horoscope (teksty placeholderów, mock RC).
   Wynik: **392/392**, próg pokrycia 85% statements spełniony (quality gate CI ✅).

## Testy integracyjne/E2E (wykonane ✅ lokalnie, CI ✅)
- Build produkcyjny frontendu + start servera:
  - `Host: star-sign.pl` → 200 + treść trasy („Baran" ×5) — SSR działa;
  - `Host: www.star-sign.pl` → 200; `evil.example.com` → 400;
  - `/runtime-config.json` zawiera `ads.adsenseClientId` z env.
- e2e Playwright (mock API) w CI: pass.

## Weryfikacja produkcyjna (PO deployu — oczekuje na zatwierdzenie runu)
- `sh ops/smoke.sh`: ≥10/12 znaków z grafiką + treść SSR + sitemap + health.
- Ręcznie: liczba obiektów R2 rośnie o ~12 (uploady bootstrapowe), Media Library
  zawiera assety `Znak: *`, znaki mają `image` w API response.
- Placeholder reklamowy wizualnie niezmieniony (screenshot porównawczy opcjonalny).

## Ryzyka regresji
- Pierwszy bootstrap po deployu wykonuje 12 uploadów (jednorazowo) — obserwować logi.
- Zmiana Host handling: healthchecki kontenera muszą używać dozwolonego hosta
  (stack używa localhost — dozwolony).
- Coverage threshold: każdy przyszły nowy plik UI wymaga spec (wpis w pamięci Sereny).
