# AICO Production Deploy Checklist

## Required configuration

- `SERVER_URL` is set to public API origin (for example `https://api.star-sign.pl`).
- `AICO_BACKUP_ENABLED=true` is set in runtime environment.
- `AICO_FULL_AUTONOMY_REQUIRED=true` is set before validating the full production profile.
- `AICO_STRICT_AUDIT_REQUIRED=true` and `AICO_AUDIT_TRAIL_STRICT=true` are set.
- `AICO_ADS_PROVIDER_MODE=controlled`, `AICO_VIDEO_PROVIDER_MODE=replicate`, `AICO_CONTROLLED_LIVE_ENABLED=true`.
  `AICO_ADS_PROVIDER_MODE=live` is allowed only after completing the "Live ads enablement" steps below.
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

## Live ads enablement (Meta Ads + Google Ads)

Switch `AICO_ADS_PROVIDER_MODE` from `controlled` to `live` only in this order:

1. Run the full controlled profile first (`AICO_ADS_PROVIDER_MODE=controlled`, `AICO_CONTROLLED_LIVE_ENABLED=true`) and confirm `production-readiness` returns `GO`.
2. Verify complete live credentials: `AICO_META_ADS_ACCESS_TOKEN`, `AICO_META_AD_ACCOUNT_ID`, `AICO_GOOGLE_ADS_DEVELOPER_TOKEN`, `AICO_GOOGLE_ADS_CLIENT_ID`, `AICO_GOOGLE_ADS_CLIENT_SECRET`, `AICO_GOOGLE_ADS_REFRESH_TOKEN`, `AICO_GOOGLE_ADS_CUSTOMER_ID`. When operating through a Google Ads MCC (manager) account, also set `AICO_GOOGLE_ADS_LOGIN_CUSTOMER_ID` (sent as the `login-customer-id` header).
   - **Provider API versions**: confirm `AICO_META_GRAPH_API_VERSION` (default `v21.0`) and `AICO_GOOGLE_ADS_API_VERSION` (default `v18`) point at versions that are still supported. These MUST be reviewed against the Meta Graph/Marketing API and Google Ads API deprecation schedules before each release; bump them via env (no code change required) when a version is sunset/archived.
3. Set `AICO_ADS_PROVIDER_MODE=live` and run `POST /ai-content-orchestrator/providers/test-readiness` with connectivity for `meta_ads` and `google_ads`. The probe is read-only (`act_<id>?fields=account_status`, `customers:listAccessibleCustomers`) and must record fresh `ready` statuses; without them `production-readiness` keeps live mode a blocker.
4. Confirm autonomy policy caps: global daily ads budget <= 25 PLN, Meta <= 15 PLN, Google <= 10 PLN. The live adapter additionally clamps every provider daily budget to these caps.
5. Activation safety invariants (verify in audit trail after the first live activation):
   - Campaign, ad set/ad group and ad are created with `PAUSED` status; spend can start only after an explicit second activation step un-pauses the campaign.
   - Every provider mutation produces an `ads.provider.*` audit event with the provider campaign id.
   - Budget ledger reservation precedes any provider call; reservation failure blocks the mutation.
   - Re-activating an already-active plan is a no-op (no provider call, no extra ledger reservation).
6. Verify stop-loss controls:
   - `POST /ai-content-orchestrator/ads/campaign-plans/stop-loss` pauses live campaigns at the provider.
   - Spend reconciliation (`reconcileLiveSpend`) reads Meta insights / Google `searchStream` `cost_micros` and pauses plans whose spend reached the daily budget.
7. Rollback: set `AICO_ADS_PROVIDER_MODE=controlled` (or flip the global kill switch) and run the stop-loss sweep to pause all live campaigns.

## Operational readiness

- Social tab has no unresolved `failed`/stale tickets.
- Audit tab returns report and does not show runtime `needs_action` errors.
- Dry-run publish succeeds for all enabled channels in production workflow.
- Provider readiness matrix has no blockers for required providers.
- Growth Ops shows `PROD readiness=GO` and `Live effects=OFF` for the controlled no-spend profile.
- Ads stop-loss is available to the operator and requires `PAUSE_ACTIVE_ADS`.
- Controlled run-now requires `RUN_AICO_CONTROLLED_TICK` and must be used only after target-environment GO.
