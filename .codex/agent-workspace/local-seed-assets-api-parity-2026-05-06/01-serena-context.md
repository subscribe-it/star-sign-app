# Serena Context

Data: 2026-05-06

## Użycie Sereny

Serena była dostępna. Odczytano pamięci związane z wdrożeniem produkcji, Redis healthcheck oraz testem Playwright dla tarota. Przez Serenę sprawdzono symbole w `apps/api/src/bootstrap/seed-media.ts`, `apps/api/src/bootstrap/content.ts` i widoku tarota.

## Najważniejsze ustalenia

- Produkcyjny problem obrazów nie wynika z samego bucketu R2. Strapi musi mieć rekordy `plugin::upload.file` oraz relacje `image` na content type.
- Dotychczasowy bootstrap podłączał lokalne assety tylko dla tarota.
- `seed-core.js` potrafił tworzyć placeholdery AICO, ale bootstrap runtime nie podłączał zmapowanych AICO assets do seedowanych artykułów i znaków zodiaku.
- AICO media mapping gubił `sign_slug` dla `zodiac_profile`, mimo że selektor obrazów znaków wymaga `purpose=zodiac_profile` oraz `sign_slug`.

## Konkluzja

Trzeba utrzymać seedy jako deterministyczne i offline: bez wywołań providerów AI, bez generowania przyszłych wpisów, ale z podpinaniem już istniejących, zmapowanych plików z Media Library do obecnych seedów.

## Doprecyzowanie dla `/znaki/baran`

Odczytano pamięć `project/local_seed_assets_api_parity_2026_05_06` i sprawdzono symbole `ensureSeedMedia` oraz `ZodiacProfile`. Widok `/znaki/:slug` już pobiera `zodiac-signs?populate=image` i renderuje obraz znaku, ale zależy od relacji `zodiac-sign.image`. Jeśli pliki są tylko w Media Library lub R2 bez AICO `media-asset`, frontend nie ma czego wyświetlić.

## Konkluzja po doprecyzowaniu

Potrzebny jest dodatkowy krok seedujący: rozpoznać istniejące uploady po nazwach typu `zodiac-baran-profile`, `baran`, `aries`, `znak-baran`, utworzyć deterministyczne mapowanie AICO i dopiero potem podpiąć obraz do znaku zodiaku.
