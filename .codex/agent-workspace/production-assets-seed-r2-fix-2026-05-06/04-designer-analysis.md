# Designer Analysis

## UX Impact

Karta tarota bez obrazu traci główny element wizualny. To szczególnie dotyczy `/tarot/karta-dnia`, gdzie obraz jest częścią rytuału i pierwszego wrażenia.

## Stany

- Stan oczekiwany: API zwraca `card.image.url`, a frontend renderuje obraz.
- Stan obecny: `card.image` jest puste, więc widok wygląda niekompletnie.

## Konkluzja

To nie jest problem CSS. UI potrzebuje kompletnego DTO z obrazem. Naprawa powinna być po stronie bootstrapu mediów i relacji Strapi.
