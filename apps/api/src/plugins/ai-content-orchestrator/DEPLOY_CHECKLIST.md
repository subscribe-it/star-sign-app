# AICO Production Deploy Checklist

## Required configuration

- `SERVER_URL` is set to public API origin (for example `https://api.star-sign.pl`).
- `AICO_BACKUP_ENABLED=true` is set in runtime environment.
- `AICO_FULL_AUTONOMY_REQUIRED=true` is set before validating the full production profile.
- `AICO_STRICT_AUDIT_REQUIRED=true` and `AICO_AUDIT_TRAIL_STRICT=true` are set.
- `AICO_ADS_PROVIDER_MODE=controlled`, `AICO_VIDEO_PROVIDER_MODE=replicate`, `AICO_CONTROLLED_LIVE_ENABLED=true`.
- `AICO_ADMIN_RUN_NOW_ENABLED=true` only after the operator accepts the controlled live run-now boundary.
- Social credentials are complete for every enabled workflow:
  - Facebook: `fb_page_id` + page token
  - Instagram: `ig_user_id` + token
  - X: `x_api_key` + `x_api_secret` + `x_access_token` + `x_access_token_secret`
- Required provider credentials are present for OpenRouter, Replicate, GA4, Meta Ads and Google Ads.

## Access and RBAC

- Plugin actions are registered in Strapi Admin (`manage-social`, `run-audit`, `view-runs`, `manage-workflows`, `test-provider-readiness`, `activate-ads`, `pause-ads`, `manage-autonomy`).
- Release operator role can call:
  - `POST /ai-content-orchestrator/audit/preflight`
  - `POST /ai-content-orchestrator/social/test-connection`
  - `POST /ai-content-orchestrator/social/dry-run`
  - `POST /ai-content-orchestrator/providers/test-readiness`
  - `GET /ai-content-orchestrator/autonomy/production-readiness`
  - `POST /ai-content-orchestrator/ads/campaign-plans/stop-loss`

## Pipeline gates

- CI passes:
  - `api:test`
  - `api:typecheck`
  - `api:build`
  - `ai-content-orchestrator:test:ts:back`
  - `ai-content-orchestrator:test:ts:front`
  - `ai-content-orchestrator:test:unit`
  - `ai-content-orchestrator:verify`
- Predeploy is run with the real env file and AICO gate enabled:
  - `RUN_ENV_GUARD=true`
  - `RUN_DOMAIN_AUDITS=true`
  - `RUN_AICO_POST_SEED_PREFLIGHT=true`
  - `RUN_SECURITY_HEADERS=true`
- `api:aico-post-seed-preflight` returns `passed`.
- `production-readiness` returns `GO`. `GO_WITH_WARNINGS` is not sufficient for full autonomy.

## Operational readiness

- Social tab has no unresolved `failed`/stale tickets.
- Audit tab returns report and does not show runtime `needs_action` errors.
- Dry-run publish succeeds for all enabled channels in production workflow.
- Provider readiness matrix has no blockers for required providers.
- Growth Ops shows `PROD readiness=GO` and `Live effects=OFF` for the controlled no-spend profile.
- Ads stop-loss is available to the operator and requires `PAUSE_ACTIVE_ADS`.
- Controlled run-now requires `RUN_AICO_CONTROLLED_TICK` and must be used only after target-environment GO.
