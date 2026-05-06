# Serena Context

## Użycie Sereny

Serena jest dostępna. Odczytano listę pamięci projektu i uwzględniono wcześniejsze decyzje o produkcyjnym wdrożeniu Portainer/R2 oraz o tym, że trwałych uploadów nie montujemy lokalnym wolumenem.

## Diagnoza kodu

- Produkcja uruchamia bootstrap w `apps/api/src/index.ts`.
- `ensureBootstrapContent` z `apps/api/src/bootstrap/content.ts` seeduje znaki, artykuły, tarot, numerologię, horoskopy i global settings.
- `scripts/seed-prod.js` jest osobnym ręcznym seedem i jest celowo blokowany przez `ALLOW_PRODUCTION_SEED=false`.
- Obecny bootstrap tworzy wpisy `tarot-card`, ale nie tworzy rekordów `plugin::upload.file` i nie przypina ich do pola `image`.
- Frontend pobiera obrazy przez `populate=image`, więc sam plik w Cloudflare R2 nie wystarczy. Strapi musi mieć rekord Media Library i relację w DB.
- W repo istnieją lokalne assety `apps/api/public/uploads/daily_*.webp`, które trafiają do obrazu Docker API, bo `.dockerignore` ich nie wyklucza.

## Produkcyjny objaw

Publiczne API produkcji zwraca:

- `tarot-cards?populate=image`: `image: null` dla kart tarota.
- `daily-tarot/today?populate[card][populate]=image`: karta dnia bez obrazu.
- `zodiac-signs?populate=image`: znaki bez obrazów, ale w repo nie ma lokalnych assetów znaków do automatycznego podpięcia.

## Konkluzja

Trzeba dodać bezpieczny, idempotentny bootstrap mediów dla lokalnych assetów tarota: upload do aktualnego providera Strapi, utworzenie rekordu Media Library, przypięcie do `tarot-card.image` oraz rejestracja w AICO media assets.
