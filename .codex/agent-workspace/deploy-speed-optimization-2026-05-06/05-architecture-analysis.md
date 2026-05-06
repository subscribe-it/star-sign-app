# Architecture Analysis

## Obserwacje

- Workflow `deploy-production.yml` buduje API i frontend w `release-gate`, a potem Dockerfile ponownie wykonuje `ai-content-orchestrator:build`, `api:build` i `frontend:build`.
- Dockerfile ma jeden wspólny stage `builder`, który zawsze buduje AICO, API i frontend, nawet gdy budowany jest tylko target `api-runtime` albo tylko `frontend-runtime`.
- `docker/build-push-action` nie ma `cache-from` ani `cache-to`, więc BuildKit nie utrwala cache między runami GitHub Actions.
- Post-deploy job instaluje też zależności `apps/api`, chociaż smoke, headers i frontend E2E ich nie potrzebują.
- `DEPLOY_WAIT_SECONDS` to stały sleep. Przy szybkim rolloutcie tracimy czas, przy wolnym sleep może być za krótki.
- Nx ma cache lokalny, ale workflow nie przywraca `.nx/cache` ani nie używa Nx Cloud.

## Rekomendowana architektura optymalizacji

1. Dodać BuildKit cache do buildów Docker przez `cache-from: type=gha` i `cache-to: type=gha,mode=max`.
2. Rozdzielić Dockerfile na stage `api-builder` i `frontend-builder`, żeby obraz API nie budował frontendu, a obraz frontendu nie budował API.
3. Równolegle budować obrazy API i frontend jako dwa joby po release gate.
4. Zastąpić statyczny sleep pollingiem `/healthz` i `/api/health/ready`.
5. Dla branch/PR używać `nx affected`, a pełny gate zostawić dla `main`.
6. Dodać `.nx/cache` przez `actions/cache` albo lepiej Nx Cloud, jeśli akceptujemy zewnętrzny cache.

## Konkluzja

Największy techniczny dług w pipeline to podwójny build i brak cache BuildKit. To można poprawić bez zmiany runtime stacka Portainera.
