# QA Report

## Testy automatyczne

- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`
  - wynik: PASS
  - 58 plików testowych
  - 346 testów

- `rtk npm exec -- nx run frontend:typecheck --outputStyle=static`
  - wynik: PASS

- `rtk npm exec -- nx run frontend:build --outputStyle=static`
  - wynik: PASS

- `rtk git diff --check`
  - wynik: PASS

## Walidacja Playwright

Browser plugin nie był dostępny, więc użyto lokalnego Playwright i serwera statycznego z mockowanymi endpointami API.

Desktop:

- `filter: none` dla orbów.
- `borderTopWidth: 1px` i `::before` ring obecne.
- Brak poziomego overflow.
- Bez fragmentu scroll trafia w `#article-content`, `contentTop: 96`.

Fragment:

- URL z `#article-share` zachowuje hash.
- Mobile ustawia `#article-share` pod sticky nav, `shareTop: 96`.
- Desktop dociera do fragmentu, ale przy krótkiej stronie nie może ustawić elementu wyżej niż pozwala maksymalny scroll dokumentu.

## Artefakty

- `/tmp/blog-detail-crisp-orbs-desktop.png`
- `/tmp/blog-detail-fragment-mobile.png`

## Konkluzja QA

Zmiana przechodzi testy, build i walidację wizualną. Zachowanie fragmentów działa, z naturalnym ograniczeniem przeglądarki dla elementów blisko końca krótkiej strony.
