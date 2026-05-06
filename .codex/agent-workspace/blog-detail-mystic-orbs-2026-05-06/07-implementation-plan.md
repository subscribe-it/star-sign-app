# Implementation Plan

## Zmiany

- `frontend/src/app/features/blog-detail/blog-detail.html`
  - dodanie klasy `article-hero`;
  - oznaczenie orbów przez `data-test`;
  - dodanie `aria-hidden="true"`;
  - zwiększenie rozmiaru i korekta pozycji orbów.

- `frontend/src/app/features/blog-detail/blog-detail.scss`
  - lokalne style `article-hero__orb`;
  - mocniejsze radial gradients;
  - `z-index: 1`, `opacity: 0.88`, `filter: blur(48px)`;
  - `isolation: isolate` na hero, żeby warstwy były przewidywalne.

- `frontend/src/app/features/blog-detail/blog-detail.spec.ts`
  - test obecności orbów, klas wariantów i `aria-hidden`.

## Decyzja implementacyjna

Nie ruszać globalnej klasy `.mystic-orb`. Problem dotyczył konkretnego kontrastu na stronie artykułu, więc najmniejsze ryzyko daje lokalne wzmocnienie wizualne.
