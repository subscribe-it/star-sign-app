# Decision Log

## Decision: Domyślna miniatura blogowa przez seed media

Date: 2026-05-06
Agents involved: PO, Virtual User, Designer, Architect, Developer, QA

### Context

Artykuły blogowe mogą nie mieć dedykowanego obrazu, a użytkownik oczekuje kompletnej siatki miniaturek.

### Decision

Dodajemy wersjonowany placeholder blogowy i seedujemy go przez istniejący upload provider Strapi. Następnie AICO `media-asset` typu `blog_article` jest używany jako fallback dla seeded artykułów bez obrazu.

### Alternatives considered

- Tylko frontend fallback bez relacji `article.image`.
- Ręczne dodanie obrazów w panelu Strapi.
- Generowanie obrazów AI dla każdego artykułu.

### Rationale

Seed zachowuje parytet lokalny i produkcyjny oraz działa z R2 bez specjalnego procesu ręcznego.

### Consequences

Placeholder jest rozwiązaniem domyślnym, a dedykowane grafiki nadal powinny go zastępować, gdy pojawią się w Media Library.

### Polish summary

Miniatury bloga mają być kompletne od seedowania, a brak dedykowanego obrazu nie może skutkować pustą kartą.
