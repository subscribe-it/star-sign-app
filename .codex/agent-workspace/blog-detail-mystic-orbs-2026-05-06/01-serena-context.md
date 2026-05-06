# Serena Context

Data: 2026-05-06

## Odczytane pamięci

- `project/local_seed_assets_api_parity_2026_05_06`
- `project/cookie_banner_layout_regression_2026_05_06`

## Zapisana pamięć

- `project/blog_detail_mystic_orbs_visibility_2026_05_06`

## Ustalenia

- Serena MCP w tej sesji udostępnia pamięci, ale nie udostępnia narzędzi semantycznej nawigacji symboli.
- Widok artykułu znajduje się w `frontend/src/app/features/blog-detail/`.
- Playwright potwierdził, że `.mystic-orb` istnieją w DOM, ale są bardzo słabe wizualnie: tła `/10`, duży blur i jasne tło hero.

## Polska konkluzja

Problem nie wynika z braku renderowania Angulara, tylko z za słabego kontrastu i nieprecyzyjnych warstw dekoracyjnych w hero artykułu.
