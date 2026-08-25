# Kontekst Serena — aico-autonomy-monetization-prod-fixes

Data: 2026-08-25 · Serena MCP: **dostępna** (projekt `star-sign` aktywny, TS LSP).

## Przeczytane wspomnienia

- `project/production_seed_and_media_gen_env_2026_05_06` — seed prod wymaga `ALLOW_PRODUCTION_SEED=true`; media gen przez Replicate; **pliki w buckecie bez rekordów `plugin::upload.file` w DB nie wystarczają**.
- `project/zodiac_profile_media_seed_auto_discovery_2026_05_06` — frontend `/znaki/:slug` zależy od `zodiac-sign.image`; discovery rozpoznaje nazwy typu `zodiac-baran-profile-01.webp`, `baran.webp`, `aries.webp`; w R2 tylko uploady z providerem `aws-s3`.
- `project/system_orientation_2026_06_06` — struktura, ostrzeżenie o nieaktualnym README.
- `suggested_commands`, `style_and_conventions` — komendy Nx, proces PL.

## Nawigacja semantyczna (kluczowe symbole)

- `apps/api/src/index.ts` → bootstrap: users-permissions settings → `ensureBootstrapContent` → `syncContentApiReadPermissions` → workflow AICO.
- `bootstrap/content.ts@959` `ensureBootstrapContent`: seeds + `ensureSeedMedia({articleSlugs})`.
- `bootstrap/seed-media.ts@1532` `ensureSeedMedia`: uploaduje **tylko** `DAILY_TAROT_SEED_ASSETS` (+ placeholder bloga); dalej discovery istniejących uploadów → media-assets; `ensureZodiacSignImages` (`@1269`) linkuje znaki wyłącznie z kandydatów `findLinkedMediaAssets(['zodiac_profile','horoscope_sign'])` (AICO media-asset ↔ upload file).
- Wniosek: brak plików/rekordów zdjęć znaków ⇒ 0 linków na prodzie.

## Do zapisania po implementacji

- Mechanizm samonaprawy mediów przy starcie API + asercje w smoke teście.
- Decyzje dot. trybu autonomii AICO i monetizacji (patrz decision log).
