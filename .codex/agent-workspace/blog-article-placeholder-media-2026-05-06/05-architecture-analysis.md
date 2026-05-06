# Analiza Architektury

## Obecny przepływ

- `apps/api/src/bootstrap/seed-media.ts` uploaduje lokalne assety przez provider Strapi.
- Ten sam moduł tworzy lub wykrywa AICO `media-asset`.
- `ensureArticleImages` podpina `blog_article` media assets do seeded artykułów po slugach.
- Frontend bloga korzysta z `ArticleService`, który pobiera `populate=image`.

## Decyzja techniczna

Dodajemy stały asset `blog_placeholder.svg` w lokalnym katalogu uploadów seedowych. Seed używa aktywnego upload providera, więc lokalnie może działać przez local provider, a na produkcji przez R2.

## Trade-off

- SVG jest mały, wersjonowalny i wystarczający jako placeholder.
- Dedykowane zdjęcia blogowe nadal powinny być docelowo podpinane przez mapowanie `blog_article`.
- Placeholder nie powinien blokować przyszłej wymiany na realny asset.

## Polska konkluzja

Najbezpieczniejszy wariant to rozszerzenie istniejącego seed gate, bez nowej usługi i bez osobnej migracji. Strapi pozostaje źródłem relacji media, a R2 pozostaje źródłem plików.
