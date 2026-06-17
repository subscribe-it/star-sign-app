#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env.example}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PREDEPLOY_SCOPE="${PREDEPLOY_SCOPE:-local}"
RUN_FRONTEND_FULL="${RUN_FRONTEND_FULL:-false}"
RUN_E2E="${RUN_E2E:-false}"
RUN_DOMAIN_AUDITS="${RUN_DOMAIN_AUDITS:-auto}"
RUN_ENV_GUARD="${RUN_ENV_GUARD:-auto}"
RUN_AICO_OPENROUTER_SMOKE="${RUN_AICO_OPENROUTER_SMOKE:-auto}"
RUN_AICO_POST_SEED_PREFLIGHT="${RUN_AICO_POST_SEED_PREFLIGHT:-auto}"
RUN_SECURITY_HEADERS="${RUN_SECURITY_HEADERS:-auto}"
API_AUDIT_LEVEL="${API_AUDIT_LEVEL:-critical}"

case "$PREDEPLOY_SCOPE" in
  local | staging | production) ;;
  *)
    echo "PREDEPLOY_SCOPE must be local, staging, or production." >&2
    exit 2
    ;;
esac

if [ "$PREDEPLOY_SCOPE" != "local" ] && [ "$COMPOSE_ENV_FILE" = ".env.example" ]; then
  echo "COMPOSE_ENV_FILE must point to the real staging/production env file when PREDEPLOY_SCOPE=${PREDEPLOY_SCOPE}." >&2
  exit 2
fi

is_true() {
  case "${1:-}" in
    1 | true | TRUE | yes | YES | on | ON) return 0 ;;
    *) return 1 ;;
  esac
}

should_run_required_check() {
  mode="$1"

  case "$mode" in
    true) return 0 ;;
    false) return 1 ;;
    auto)
      [ "$PREDEPLOY_SCOPE" != "local" ]
      return
      ;;
    *)
      echo "Expected true, false, or auto, got: $mode" >&2
      exit 2
      ;;
  esac
}

run() {
  label="$1"
  shift

  echo
  echo "==> $label"
  "$@"
}

skip() {
  echo
  echo "==> SKIP $1"
}

if should_run_required_check "$RUN_SECURITY_HEADERS" && [ "$PREDEPLOY_SCOPE" != "local" ]; then
  : "${FRONTEND_BASE_URL:?FRONTEND_BASE_URL is required for staging/production security header checks}"
  : "${API_BASE_URL:?API_BASE_URL is required for staging/production security header checks}"
fi

run_security_headers() {
  SECURITY_HEADER_URLS="${FRONTEND_BASE_URL},${API_BASE_URL}" sh ops/security-headers-check.sh
}

run_env_guard() {
  PRODUCTION_ENV_FILE="$COMPOSE_ENV_FILE" sh ops/production-env-check.sh
}

resolve_compose_env_file() {
  case "$COMPOSE_ENV_FILE" in
    /*) printf '%s\n' "$COMPOSE_ENV_FILE" ;;
    *) printf '%s\n' "$ROOT_DIR/$COMPOSE_ENV_FILE" ;;
  esac
}

run_aico_post_seed_preflight() {
  AICO_PREFLIGHT_ENV_FILE="$(resolve_compose_env_file)" \
    npm exec -- nx run api:aico-post-seed-preflight --outputStyle=static
}

run_aico_openrouter_smoke() {
  AICO_SMOKE_ENV_FILE="$(resolve_compose_env_file)" \
    npm exec -- nx run api:aico-openrouter-smoke --outputStyle=static
}

run "npm ci dry-run" npm ci --dry-run
run "apps/api npm ci dry-run" npm --prefix apps/api ci --dry-run
run "nx sync check" npm exec -- nx sync:check
if should_run_required_check "$RUN_ENV_GUARD"; then
  run "production env guard (${COMPOSE_ENV_FILE})" run_env_guard
else
  skip "production env guard; set RUN_ENV_GUARD=true or PREDEPLOY_SCOPE=staging"
fi
run "root production npm audit high gate" npm audit --omit=dev --audit-level=high
run "api production npm audit ${API_AUDIT_LEVEL} gate" npm --prefix apps/api audit --omit=dev --audit-level="$API_AUDIT_LEVEL"
run "docker compose config (${COMPOSE_FILE}, ${COMPOSE_ENV_FILE})" docker compose -f "$COMPOSE_FILE" --env-file "$COMPOSE_ENV_FILE" config --quiet
run "workspace typecheck" npm exec -- nx run-many -t typecheck --projects=frontend,api,cart,@org/types,frontend-e2e --outputStyle=static
run "workspace lint" npm exec -- nx run-many -t lint --projects=frontend,api,cart,@org/types,frontend-e2e,ai-content-orchestrator --outputStyle=static
run "api tests" npm exec -- nx run api:test --outputStyle=static
run "cart tests" npm exec -- nx run cart:test --outputStyle=static
run "aico plugin checks" npm exec -- nx run-many --targets=test:unit,test:ts:back,test:ts:front,verify --projects=ai-content-orchestrator --outputStyle=static
run "api production build" npm exec -- nx run api:build --outputStyle=static

if is_true "$RUN_FRONTEND_FULL"; then
  run "frontend tests with coverage" npm exec -- nx run frontend:test --configuration=coverage --outputStyle=static
  run "frontend production build" npm exec -- nx run frontend:build:production --outputStyle=static
else
  skip "frontend full test/build; set RUN_FRONTEND_FULL=true for release candidate validation"
fi

if should_run_required_check "$RUN_DOMAIN_AUDITS"; then
  run "premium content audit" npm exec -- nx run api:premium-content-audit --outputStyle=static
  run "AICO contract audit" npm exec -- nx run api:aico-contract-audit --outputStyle=static
else
  skip "domain DB audits; set RUN_DOMAIN_AUDITS=true or PREDEPLOY_SCOPE=staging"
fi

if should_run_required_check "$RUN_AICO_OPENROUTER_SMOKE"; then
  run "AICO OpenRouter smoke" run_aico_openrouter_smoke
else
  skip "AICO OpenRouter smoke; set RUN_AICO_OPENROUTER_SMOKE=true or PREDEPLOY_SCOPE=staging"
fi

if should_run_required_check "$RUN_AICO_POST_SEED_PREFLIGHT"; then
  run "AICO post-seed preflight" run_aico_post_seed_preflight
else
  skip "AICO post-seed preflight; set RUN_AICO_POST_SEED_PREFLIGHT=true or PREDEPLOY_SCOPE=staging"
fi

if should_run_required_check "$RUN_SECURITY_HEADERS"; then
  run "security headers" run_security_headers
else
  skip "security headers; set RUN_SECURITY_HEADERS=true or PREDEPLOY_SCOPE=staging"
fi

if is_true "$RUN_E2E"; then
  run "frontend e2e" npm exec -- nx run frontend-e2e:e2e --outputStyle=static
else
  skip "frontend e2e; set RUN_E2E=true for release candidate validation"
fi

run "diff whitespace check" git diff --check

echo
echo "Predeploy check completed for scope: ${PREDEPLOY_SCOPE}"
