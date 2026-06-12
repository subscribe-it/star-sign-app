# AICO Preflight Audit Runbook

## Decisions

- `GO`: controlled production profile can be promoted, assuming the target environment and deploy gate used real secrets and DB state.
- `GO_WITH_WARNINGS`: release is blocked for full autonomy. Treat it as not production-ready.
- `NO_GO`: release must not be promoted.

## Release gate

Run the staging/production predeploy gate with the real env file:

```bash
COMPOSE_FILE=ops/portainer/star-sign-production-stack.yml \
COMPOSE_ENV_FILE=.env \
PREDEPLOY_SCOPE=staging \
RUN_ENV_GUARD=true \
RUN_DOMAIN_AUDITS=true \
RUN_AICO_POST_SEED_PREFLIGHT=true \
RUN_SECURITY_HEADERS=true \
FRONTEND_BASE_URL=https://star-sign.pl \
API_BASE_URL=https://api.star-sign.pl/api \
npm run ops:predeploy:local
```

The gate runs `api:aico-post-seed-preflight`, which includes strict audit, provider readiness, social connection preflight, provider modes and `production-readiness`. The preflight must return `passed`; warnings are not enough for full autonomy.

## Manual audit (Admin UI)

Manual UI checks are secondary evidence:

1. Open plugin tab `Audit`.
2. Run `Run Strict`.
3. Confirm `Decision: GO`.
4. Open Growth Ops / Production readiness.
5. Confirm `PROD readiness=GO`, provider readiness has no blockers, and `Live effects=OFF` for the controlled no-spend profile.

## Deployment policy

Do not enable autonomous production workflows unless the predeploy AICO post-seed preflight and Admin UI readiness both show `GO` on the target environment. `GO_WITH_WARNINGS` remains a release blocker for full autonomy.

## API reference

- Soft: `GET /ai-content-orchestrator/audit/preflight`
- Strict: `POST /ai-content-orchestrator/audit/preflight` with body `{ "strict": true }`
- Production readiness: `GET /ai-content-orchestrator/autonomy/production-readiness`
- Provider preflight: `POST /ai-content-orchestrator/providers/test-readiness`

## Typical blockers and fixes

- `config.server-url` fail:
  - Set `SERVER_URL` to public API origin and restart API.
- `social.credentials` fail:
  - Complete missing tokens/IDs in workflow social configuration.
- `social.connectivity` fail:
  - Re-authorize social app credentials and rerun `Test Connection`.
- `providers.required-ready` fail:
  - Run Provider preflight and fix missing credentials/scopes for required providers.
- `autonomy.production-readiness` fail:
  - Inspect blockers in Growth Ops and rerun post-seed preflight after fixing env, provider status or policy.
- `dr.backup` warning/fail policy:
  - Set `AICO_BACKUP_ENABLED=true` after backup/DR verification.
