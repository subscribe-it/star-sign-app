# QA Report

Data: 2026-05-06

## Co sprawdzono

- Unit testy API po rozszerzeniu `ensureSeedMedia`.
- Unit testy AICO po poprawce `zodiac_profile -> sign_slug`.
- Typecheck API.
- Lint API.
- Build API.
- Frontend coverage test po lokalnej poprawce template tarota.
- Lokalny `api:seed:dev`.
- Lokalne endpointy po seedzie.

## Wyniki

- `rtk npm exec -- nx run api:test --outputStyle=static`: PASS, 15 plików, 115 testów.
- `rtk npm exec -- nx run ai-content-orchestrator:test:unit --outputStyle=static`: PASS, 1 plik, 52 testy.
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec -- nx run api:lint --outputStyle=static`: PASS z istniejącymi warningami `no-explicit-any`.
- `rtk npm exec -- nx run api:build --outputStyle=static`: PASS.
- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`: PASS, 58 plików, 338 testów.
- `rtk npm exec -- nx run api:seed:dev --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.

## Dowody lokalnego API

- `/api/tarot-cards?populate=image`: `22/22` kart ma obraz.
- `/api/daily-tarot/today`: zwraca `card.image.url`.
- `/api/zodiac-signs?populate=image`: `0/12` znaków ma obraz, bo lokalna baza nie ma jeszcze zmapowanych AICO assets dla znaków.
- `/api/articles?populate=image`: `0/13` artykułów ma obraz, bo lokalna baza nie ma jeszcze zmapowanych AICO assets typu `blog_article`.

## Ryzyka

- Dla zodiaku i bloga kod jest gotowy na istniejące mapowania, ale nie tworzy obrazów z niczego. Trzeba mieć rekord `plugin::upload.file` i zlinkowany AICO `media-asset`.
- Lokalny healthcheck zwracał `503`, bo Redis lokalnie nie był gotowy/włączony; endpointy contentowe działały.

## Konkluzja

Tarot i Karta Dnia działają lokalnie z obrazami. Zodiak i artykuły będą działać automatycznie po dodaniu lub zaimportowaniu zmapowanych AICO assets z relacją do Media Library. Workflowy AICO pozostają wyłączone i seed dev nie dodaje już nowych pozycji topic queue, jeśli workflow jest wyłączony.

## Doprecyzowanie QA dla `/znaki/baran`

### Co przeszło

- `rtk npm exec -- nx run api:test --outputStyle=static`: PASS, 15 plików, 117 testów.
- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`: PASS, 58 plików, 339 testów.
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`: PASS.
- `rtk npm exec -- nx run frontend:typecheck --outputStyle=static`: PASS.
- `rtk npm exec -- nx run api:build --outputStyle=static`: PASS.
- `rtk npm exec -- nx run frontend:build --outputStyle=static`: PASS.
- `rtk npm exec -- nx run api:seed:dev --outputStyle=static`: PASS.
- `rtk git diff --check`: PASS.

### Dowód danych lokalnych

Pierwszy lokalny seed zakończył się wynikiem `zodiacLinked=0`, bo lokalna tabela uploadów zawierała tylko pliki `daily_*.webp` dla tarota. Po read-only liście R2 zaimportowano lokalnie po jednym istniejącym obiekcie dla 12 znaków jako rekord `plugin::upload.file`, bez kopiowania plików i bez wypisywania sekretów.

Po ponownym seedzie:

- `rtk npm exec -- nx run api:seed:dev --outputStyle=static`: `mediaAssets=34`, `zodiacLinked=12`.
- API `http://localhost:1337/api/zodiac-signs?sort=id:asc&populate[0]=image`: `12/12` znaków ma `image`, Baran ma obraz.
- Playwright dla `http://localhost:4200/znaki/baran`: `9` obrazów z alt zawierającym `Baran`, wszystkie załadowane (`naturalWidth=1024`, `naturalHeight=1536`).

### Wniosek

Kod i testy dla automapowania są gotowe. Lokalny widok `/znaki/baran` pokazuje teraz zdjęcia w elementach profilu. Dla kolejnych środowisk obowiązuje zasada: bucket musi mieć odpowiadający rekord Strapi Media Library, a seed podepnie relację automatycznie.
