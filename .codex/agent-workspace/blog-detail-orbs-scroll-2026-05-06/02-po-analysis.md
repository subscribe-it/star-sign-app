# Product Owner Analysis

## Cel

Użytkownik po wejściu w artykuł ma widzieć dopracowaną, czytelną oprawę wizualną, a po przejściu między artykułami nie powinien lądować przypadkowo w środku lub na dole strony.

## Wartość

- Lepsze pierwsze wrażenie na stronach artykułów.
- Mniej frustracji przy klikaniu powiązanych artykułów.
- Możliwość linkowania do konkretnych sekcji przez `#fragment`.

## Kryteria akceptacji

- Dekoracyjne elementy w tle hero artykułu nie wyglądają jak rozmyta mgła.
- Link `/artykuly/:slug#article-share` przewija do wskazanego fragmentu, jeśli istnieje.
- Link `/artykuly/:slug` bez fragmentu przewija do początku treści artykułu.
- Zachowanie działa tylko w przeglądarce i nie psuje SSR.

## Poza zakresem

- Globalna zmiana wszystkich `mystic-orb` w aplikacji.
- Parsowanie treści artykułu do nagłówków z automatycznymi anchorami.
