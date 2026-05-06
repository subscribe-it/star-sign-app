# Implementation Plan

## Zmiany w kodzie

- `blog-detail.scss`
  - usunięcie blur z lokalnego wariantu orbów;
  - dodanie obramowania, cienia i pierścieni przez pseudo-elementy;
  - dodanie `scroll-margin-top` dla anchorów artykułu.

- `blog-detail.html`
  - dodanie anchorów: `article-content`, `article-text`, `article-premium`, `article-share`, `related-articles`;
  - zachowanie dekoracyjnych orbów jako `aria-hidden`.

- `blog-detail.ts`
  - dodanie `route.fragment` jako signal;
  - browser-only scroll po załadowaniu artykułu;
  - retry dla fragmentów renderowanych asynchronicznie;
  - fallback do `article-content`.

- `blog-detail.spec.ts`
  - test anchorów;
  - test scrolla bez fragmentu;
  - test scrolla do istniejącego fragmentu;
  - test fallbacku dla błędnego fragmentu.

## Konkluzja

Implementacja zachowuje zmianę w granicach jednego komponentu i jego testów.
