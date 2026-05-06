# Decision Log

## Decision: Seed używa zmapowanych assets bez workflow AI

Date: 2026-05-06
Agents involved: Product Owner, Architect, Developer, QA

### Context

Obrazy są w bucketcie lub Media Library, ale content startowy ich nie pokazuje, jeśli relacje Strapi nie są podpięte.

### Decision

Bootstrap seedów podłącza lokalne assety tarota oraz istniejące AICO media assets dla znaków zodiaku i artykułów. Nie wykonuje generowania AI.

### Alternatives considered

- Uruchomić AICO workflow do wygenerowania braków.
- Ręcznie przypinać obrazy w panelu Strapi.

### Rationale

Deterministyczny seed jest powtarzalny lokalnie i produkcyjnie oraz nie zależy od tokenów providerów.

### Consequences

Jeżeli asset nie jest zmapowany w AICO media catalog, seed go nie wymyśli. Trzeba wtedy zmapować plik albo dodać manifest assetów.

### Polish summary

Seed ma wykorzystywać istniejące mapowania mediów, a nie generować nowe treści lub obrazy przez AI.

## Decision: Auto-discovery uploadów znaków zodiaku

Date: 2026-05-06
Agents involved: Product Owner, Virtual User, Designer, Architect, Developer, QA

### Context

Strona `/znaki/baran` ma pokazywać zdjęcia w elementach profilu, ale frontend dostaje obraz tylko wtedy, gdy `zodiac-sign.image` jest wypełnione. Same pliki w bucket albo Media Library bez relacji Strapi nie wystarczają.

### Decision

`ensureSeedMedia` tworzy brakujące mapowania AICO z istniejących rekordów `plugin::upload.file`, jeżeli nazwa pliku pozwala rozpoznać cel contentowy i znak. Obsługiwane są między innymi nazwy `zodiac-baran-profile-01.webp`, `znak-baran.webp`, `baran.webp` i `aries.webp`.

### Alternatives considered

Ręczne przypinanie obrazów w panelu Strapi oraz generowanie nowych obrazów przez AICO.

### Rationale

Automapowanie jest deterministyczne, działa offline, nie wymaga provider calls i wykorzystuje już dodane assety.

### Consequences

Jeśli lokalna baza nie ma rekordu uploadu dla znaku, seed nie ma czego podpiąć. Bucket bez rekordu `plugin::upload.file` nadal nie wystarczy.

### Polish summary

Seed sam podłączy istniejące zdjęcia znaków, ale muszą istnieć jako rekordy Media Library w Strapi.
