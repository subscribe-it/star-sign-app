# Designer analysis

## Zakres UX

Aktualny inkrement dotyczy glownie backend preflightu i raportow CLI/API, bez zmian w widoku Growth Ops.

## Zasady dla raportu

- Statusy musza byc konkretne: `pass`, `warn`, `fail`.
- Komunikaty musza mowic operatorowi, co jest bezpieczne, co wymaga sekretow, a co jest opcjonalne.
- Raport nie moze ujawniac tokenow, raw payloadow ani danych wrazliwych.
- Read-only social preflight powinien jawnie komunikowac `liveEffects=false`.

## Stany

- Pass: required providerzy sa ready, tryby sa zgodne, social connection preflight jest zielony.
- Warn: tryb non-full albo opcjonalna degradacja.
- Fail: wymagany provider zablokowany, brak konfiguracji, strict audit/production readiness NO-GO.

## Wniosek po polsku

Najwazniejszy UX tego inkrementu to wiarygodny raport operacyjny: mniej szumu, brak sekretow, jasne powody blokady.
