# Test plan

## Testy wymagane

- Policy evaluator: kill switch, budget cap, missing provider, daily limits.
- Autopilot dry-run: deterministyczne kroki i brak live effects.
- Ads agent: cap 25 PLN/day i podzial Meta/Google.
- Generation jobs: retry/cancel/status.
- Typecheck server pluginu.

## Komendy

- `rtk npm exec nx run ai-content-orchestrator:test:unit --outputStyle=static`
- `rtk npm exec nx run ai-content-orchestrator:test:ts:back --outputStyle=static`
- `rtk npm exec nx run api:test --outputStyle=static`

## Polish summary

Najwazniejsze jest udowodnienie, ze autopilot nie wykonuje live skutkow w dry-run i respektuje limity.
