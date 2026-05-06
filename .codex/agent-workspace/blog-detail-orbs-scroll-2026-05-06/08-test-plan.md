# Test Plan

## Unit

- `BlogDetail` renderuje dekoracyjne orby z `aria-hidden`.
- Orby mają lokalne klasy wariantów.
- Artykuł renderuje anchor `#article-content`.
- Przy fragmencie w URL komponent próbuje przewinąć do wskazanego elementu.
- Bez fragmentu komponent przewija do początku treści.

## Runtime

- Playwright desktop: wejście na artykuł, sprawdzenie orbów bez efektu mgły i scrolla bez fragmentu.
- Playwright desktop/mobile: wejście na artykuł z `#article-share`, sprawdzenie pozycji scrolla i braku błędów konsoli.

## Komendy

- `rtk npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static`
- `rtk npm exec -- nx run frontend:typecheck --outputStyle=static`
- `rtk npm exec -- nx run frontend:build --outputStyle=static`
- `rtk git diff --check`
