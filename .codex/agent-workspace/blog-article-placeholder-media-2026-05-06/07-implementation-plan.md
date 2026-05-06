# Implementation Plan

## Zmiany

- `apps/api/public/uploads/blog_placeholder.webp` jako domyślna miniatura bloga.
- `apps/api/src/bootstrap/seed-media.ts`
  - helper uploadu lokalnych assetów seedowych,
  - domyślny AICO media asset `blog-placeholder-default`,
  - fallback selection z pierwszeństwem dla domyślnego placeholdera,
  - pominięcie auto-discovery dla pliku placeholdera,
  - cleanup relacji `article.image` ze starego SVG na WebP.
- `apps/api/src/bootstrap/content.ts`
  - ujednolicenie sluga artykułu Premium z seedem JS.
- `frontend/src/app/features/blog-list/blog-list.html`
  - wizualny fallback dla hero i kart bloga.
- Testy API i frontend pokrywają fallback oraz render miniatur.

## Polska konkluzja

Wdrożenie jest małe, ale usuwa realny problem danych i UI. Produkcja po seedzie będzie używać R2 przez istniejący upload provider.
