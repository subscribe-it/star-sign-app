# PO Analysis

## Problem

Produkcja ma treści seedowane, ale użytkownik nie widzi obrazów kart tarota, mimo że assety istnieją lokalnie i powinny być dostępne po deployu.

## Wartość

Obrazy kart są podstawowym elementem doświadczenia tarota. Brak obrazów sprawia wrażenie niepełnego wdrożenia i obniża zaufanie do aplikacji.

## Acceptance Criteria

- Karty tarota mają podpięte obrazy w Strapi Media Library.
- Karta dnia zwraca obraz w publicznym API po `populate`.
- Bootstrap jest idempotentny i nie tworzy duplikatów przy każdym starcie.
- Produkcja nadal nie wymaga trwałego wolumenu `public/uploads`.
- R2 pozostaje źródłem prawdy dla produkcyjnych uploadów.

## Poza zakresem

- Nie seedujemy obrazów zodiaku, jeśli nie ma odpowiadających plików w repo lub jawnie zmapowanych plików w Media Library.
- Nie wykonujemy ręcznego importu sekretów ani live operacji administracyjnych poza zwykłym deploymentem.

## Konkluzja

Najmniejsza wartościowa poprawka to automatyczne podpięcie assetów tarota w bootstrapie produkcyjnym i deweloperskim, bez zmiany modelu R2.
