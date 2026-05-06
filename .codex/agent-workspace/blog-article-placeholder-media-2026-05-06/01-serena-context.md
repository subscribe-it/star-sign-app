# Serena Context

Data: 2026-05-06

## Odczytane pamięci Sereny

- `project/local_seed_assets_api_parity_2026_05_06`
- `project/zodiac_profile_media_seed_auto_discovery_2026_05_06`

## Najważniejsze ustalenia

- Sam plik w Cloudflare R2 nie wystarcza do renderowania obrazów w aplikacji. Strapi musi mieć rekord `plugin::upload.file` i relację na encji, np. `article.image`.
- Deterministyczny punkt seedowania mediów znajduje się w `apps/api/src/bootstrap/seed-media.ts`.
- Seed mediów potrafi już mapować istniejące uploady do AICO `media-asset` dla `zodiac_profile`, `horoscope_sign` i `blog_article`.
- Lista bloga pobiera artykuły z `populate=image`, więc poprawne podpięcie `article.image` wystarczy, aby miniatury pojawiły się w UI.

## Ograniczenia

- Nie zapisujemy sekretów z lokalnych envów do workspace ani pamięci.
- Nie uruchamiamy aktywnych operacji produkcyjnych poza lokalnym seedem/testami.

## Polska konkluzja

Zmiana powinna być backend-first: seed ma utworzyć domyślny asset blogowy, dodać go do Media Library przez aktywny provider uploadu i podpiąć do seeded artykułów bez obrazu. Frontend powinien nadal mieć wizualny fallback na wypadek niepełnych danych API.
