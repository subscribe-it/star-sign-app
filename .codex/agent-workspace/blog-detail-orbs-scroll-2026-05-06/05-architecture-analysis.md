# Architecture Analysis

## Stan obecny

- `BlogDetail` ładuje artykuł przez `ActivatedRoute.paramMap`.
- Router nie ma globalnego `anchorScrolling`.
- Komponent jest standalone i działa w SSR, więc użycie `window`/`document` musi być zabezpieczone przez `isPlatformBrowser`.

## Decyzja techniczna

Wprowadzić lokalny mechanizm scrolla w `BlogDetail`:

- `route.fragment` jako signal;
- po załadowaniu artykułu wybrać target:
  - `fragment`, jeśli podany i element istnieje;
  - `article-content`, jeśli fragmentu brak albo element nie istnieje;
- wykonać scroll tylko w browserze;
- zapamiętać ostatni `slug#target`, żeby nie scrollować wielokrotnie przez efekty SEO/analytics.

## Konkluzja

Lokalny mechanizm jest mniej ryzykowny niż globalna zmiana routera, bo dotyczy tylko problematycznego flow artykułów.
