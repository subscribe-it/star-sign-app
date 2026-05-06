# Final Summary

## Co zmieniono

- Dodano `apps/api/src/bootstrap/seed-media.ts`.
- Bootstrap contentu wywołuje teraz `ensureSeedMedia` po seedzie kart tarota.
- Dodano testy jednostkowe `apps/api/src/bootstrap/seed-media.test.ts`.

## Efekt

Po restarcie API Strapi sprawdzi lokalne assety `apps/api/public/uploads/daily_*.webp`, wrzuci brakujące do aktywnego providera uploadu, podepnie je do `tarot-card.image` i zarejestruje w AICO media assets.

## Ważne ograniczenie

Ta poprawka obejmuje lokalne assety tarota. Zodiak nadal wymaga osobnego manifestu lub plików obrazów, bo takich assetów nie ma obecnie w repo.

## Walidacja

API test, typecheck, build, lint i `diff --check` przeszły lokalnie. Po deploymentcie trzeba sprawdzić publiczne API produkcji dla `tarot-cards` i `daily-tarot`.
