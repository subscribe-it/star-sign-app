# Refinement

## Ustalenia

- Naprawiamy tylko stronę szczegółów artykułu.
- Tło ma być nadal dekoracyjne, ale nie zamglone.
- Fragmenty wspierane lokalnie w `BlogDetail`:
  - `#article-content`
  - `#article-text`
  - `#article-premium`
  - `#article-share`
  - `#related-articles`, jeśli sekcja jest wyrenderowana.
- Bez fragmentu komponent scrolluje do `#article-content`.
- Jeśli fragment nie istnieje, komponent wykonuje krótki retry, a potem fallback do `#article-content`.

## Kryteria akceptacji

- CSS orbów ma `filter: none`.
- Orby mają wyraźne pierścienie i obramowanie.
- Wejście w artykuł bez fragmentu ustawia początek treści pod sticky nav.
- Wejście z fragmentem próbuje scrollować do danego elementu.
- SSR nie dotyka `window` ani `document`.

## Konkluzja

Zakres jest lokalny i nie wymaga globalnych zmian routera.
