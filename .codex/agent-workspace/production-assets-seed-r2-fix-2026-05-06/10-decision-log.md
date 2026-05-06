# Decision Log

## Decision: Seed mediów przez Strapi upload service

Date: 2026-05-06
Agents involved: Product Owner, Virtual User, Designer, Architect, Developer, QA

### Context

Na produkcji treści istnieją, ale pola `image` są puste, ponieważ Strapi nie ma rekordów Media Library i relacji do plików.

### Decision

Dodać bootstrap `ensureSeedMedia`, który używa oficjalnego Strapi upload service do utworzenia rekordów upload i podpięcia ich do kart tarota.

### Alternatives considered

- Ręczne insertowanie rekordów `upload_file`.
- Ręczne mapowanie w panelu admina.
- Montowanie lokalnego wolumenu uploadów.

### Rationale

Upload service zachowuje konfigurację providera R2 i tworzy rekordy zgodne ze Strapi. Bootstrap jest powtarzalny i działa po deployu bez ręcznego klikania.

### Consequences

Pierwszy start po wdrożeniu może wykonać upload 22 małych plików WebP. Kolejne starty użyją istniejących rekordów.

### Polish summary

Media seedujemy tak samo jak robi to Strapi, zamiast dopisywać rekordy ręcznie. Dzięki temu DB, R2 i Content API pozostają spójne.
