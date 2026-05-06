# Refinement

## Problem

Artykuły blogowe muszą mieć miniatury w lokalnym i produkcyjnym seedzie. Brak dedykowanego obrazu ma skutkować domyślnym placeholderem, a nie pustą kartą.

## Zakres

- Dodać wersjonowany placeholder blogowy jako WebP.
- Seedować go przez aktywny provider Strapi Upload.
- Utworzyć/utrzymać AICO `media-asset` `blog-placeholder-default`.
- Podpinać placeholder do artykułów bez obrazu.
- Przepinać legacy placeholder SVG na aktualny WebP.
- Dodać frontendowy fallback wizualny, gdy API zwróci brak obrazu.

## Kryteria gotowości

- API zwraca `image.url` dla każdego seedowanego artykułu.
- Lokalny blog ładuje realne `<img>` z niezerową szerokością naturalną.
- Testy API i frontend są zielone.

## Polska konkluzja

Rozwiązanie ma działać bez AI workflows i bez ręcznego klikania w panelu Strapi. Źródłem prawdy pozostaje Media Library plus relacja `article.image`.
