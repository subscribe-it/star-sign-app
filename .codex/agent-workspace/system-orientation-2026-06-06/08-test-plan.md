# QA / Test Engineer Agent

## Strategia walidacji dla przyszlych zmian

- Frontend: `npm exec nx run frontend:test` oraz przy istotnych zmianach `--configuration=coverage`.
- Frontend typecheck/build: `npm exec nx run frontend:typecheck`, `npm exec nx run frontend:build`.
- API: `npm exec nx run api:test`, `api:typecheck`, `api:build`.
- E2E: `npm exec nx run frontend-e2e:e2e`, a dla produkcyjnych zmian rowniez smoke z `ops/smoke.sh`.
- Operacje: `npm run ops:predeploy:local`, `npm run ops:env`, `npm run ops:headers`, zalezenie od zakresu.

## Obszary wysokiego ryzyka

- Maintenance mode i dozwolone sciezki.
- Shop/premium/checkout przy roznych kombinacjach flag.
- Newsletter i maile Brevo/Mailpit.
- R2/media i seedy produkcyjne.
- AICO autopublish/preflight.
- Security headers, rate limit, HTTP cache i Redis.

## Evidence expectations

- Dla UI: Playwright lub screenshot/render evidence, nie tylko kompilacja.
- Dla backendu: testy Vitest i log/command output.
- Dla produkcji: smoke na realnych URL-ach i jawny status `GO/NO-GO`.

## Polish summary

Walidacja musi byc dobierana do ryzyka. Dla zmian produkcyjnych sam lokalny build nie wystarcza; potrzebne sa bramki ops, smoke i oddzielenie statusu uslugi od faktycznej poprawnosci flow.
