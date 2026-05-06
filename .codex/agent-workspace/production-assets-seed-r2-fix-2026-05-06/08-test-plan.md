# Test Plan

## Lokalne

- `rtk npm exec -- nx run api:test --outputStyle=static`
- `rtk npm exec -- nx run api:typecheck --outputStyle=static`
- `rtk npm exec -- nx run api:build --outputStyle=static`
- `rtk git diff --check`

## Po deployu

- Sprawdzić `https://api.star-sign.pl/api/tarot-cards?populate=image`.
- Sprawdzić `https://api.star-sign.pl/api/daily-tarot/today?populate[card][populate]=image`.
- Sprawdzić frontend `/tarot/karta-dnia`.

## Konkluzja

Dowodem powodzenia będzie `image.url` w API produkcji po deployu i brak regresji testów API.
