# Test Plan

## Unit

- `ensureSeedMedia` uploaduje lokalny tarot, linkuje kartę i tworzy AICO media asset.
- `ensureSeedMedia` linkuje znak zodiaku z istniejącego `zodiac_profile`.
- `ensureSeedMedia` linkuje seedowany artykuł z istniejącego `blog_article`.
- `suggestMediaMapping` zachowuje `sign_slug` dla `zodiac_profile`.

## Nx

- `rtk npm exec -- nx run api:test --outputStyle=static`
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`
- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`
- `rtk git diff --check`

## Lokalna walidacja API

Po starcie lokalnego API lub seedzie sprawdzić:

- `/api/tarot-cards?populate=image`
- `/api/daily-tarot/today`
- `/api/zodiac-signs?populate=image`
- `/api/articles?populate=image`

## Konkluzja

Dowodem gotowości jest przejście testów oraz obecność `image.url` w odpowiedziach API tam, gdzie istnieją zmapowane assets.

## Testy dopisane do zakresu `/znaki/baran`

- Unit API: istniejący upload `zodiac-baran-profile-01.webp` bez mapowania AICO jest rozpoznany, dostaje `media-asset` i zostaje podpięty do znaku Baran.
- Unit frontend: profil znaku z `image` renderuje obraz także w elementach profilu, nie tylko jako pojedynczy fallback symbolu.
- Walidacja Nx: `api:test`, `api:typecheck`, `frontend:test --configuration=coverage`, `frontend:typecheck`, `git diff --check`.
