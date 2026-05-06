# QA Report

## Lokalne wyniki

- `rtk git diff --check`: PASS
- `rtk npm exec -- nx run api:test --outputStyle=static`: PASS, 112 testów
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`: PASS
- `rtk npm exec -- nx run api:build --outputStyle=static`: PASS
- `rtk npm exec -- nx run api:lint --outputStyle=static`: PASS, 0 błędów, istniejące ostrzeżenia lint w starszych plikach

## Produkcyjna diagnoza przed fixem

- `tarot-cards?populate=image`: karty zwracają `image: null`.
- `daily-tarot/today?populate[card][populate]=image`: karta dnia bez obrazu.
- `zodiac-signs?populate=image`: znaki bez obrazów, ale w repo nie ma lokalnych plików znaków do automatycznego seedowania.

## Co testują nowe unit testy

- Lista seed assetów ma 22 wpisy i zawiera mapowania specjalne: `glupiec -> daily_blazen.webp`, `kolo-fortuny -> daily_kolo_losu.webp`, `sad-ostateczny -> daily_sad.webp`.
- Brakujący rekord upload jest tworzony przez upload service.
- Karta tarota bez obrazu dostaje relację `image`.
- Istniejący rekord R2 jest używany ponownie bez duplikowania uploadu.

## Ryzyka

Automatycznie seedujemy tylko lokalne assety tarota. Obrazy znaków zodiaku wymagają osobnego zestawu plików lub manifestu mapowania.

## Konkluzja

Zmiana jest gotowa do deploymentu. Oczekiwany efekt po restarcie API: bootstrap utworzy rekordy Media Library i relacje dla kart tarota.
