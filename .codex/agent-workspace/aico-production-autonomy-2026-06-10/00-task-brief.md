# AICO production autonomy - task brief

Data: 2026-06-10

## Cel

Kontynuowac implementacje AI Content Orchestrator tak, aby system realnie wspieral produkcyjna autonomie: planowanie tresci, generowanie, publikacje w aplikacji, dystrybucje social oraz kontrolowane bramki GO/NO-GO.

## Klasyfikacja

Duzy task, ale aktualny inkrement jest sredni i wasko zdefiniowany: poprawa post-seed/preflight oraz provider readiness dla produkcyjnej autonomii.

## Zakres tego inkrementu

- Naprawic `aico-post-seed-preflight`, aby tryby `AICO_ADS_PROVIDER_MODE=controlled` i `AICO_VIDEO_PROVIDER_MODE=replicate` byly oceniane zgodnie z production readiness.
- Ograniczyc provider readiness w full autonomy do providerow wymaganych przez runtime i `AICO_SOCIAL_CHANNELS`, zamiast blokowac przez opcjonalne TikTok/YouTube/OpenAI.
- Dodac automatyczny read-only social connection preflight w post-seed flow, aby FB/IG/X mogly odswiezyc `provider-status` przed raportem GO/NO-GO.
- Dodac testy helperow i uruchomic targety Nx dla AICO/API.

## Poza zakresem aktualnego inkrementu

- Wpisywanie sekretow produkcyjnych.
- Wykonywanie realnych publikacji social.
- Wlaczanie live ads spend.
- Deklarowanie pelnego produkcyjnego GO bez runtime preflightu na docelowym srodowisku.
