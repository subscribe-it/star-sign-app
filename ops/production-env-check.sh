#!/usr/bin/env sh
set -eu

ENV_FILE="${PRODUCTION_ENV_FILE:-${COMPOSE_ENV_FILE:-.env}}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Production env file not found: $ENV_FILE" >&2
  exit 2
fi

failures=0

fail() {
  key="$1"
  message="$2"
  echo "FAIL $key: $message" >&2
  failures=$((failures + 1))
}

get_env() {
  key="$1"
  awk -v key="$key" '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      line=$0
      sub(/^[[:space:]]*/, "", line)
      split(line, parts, "=")
      current=parts[1]
      sub(/[[:space:]]*$/, "", current)
      if (current == key) {
        value=line
        sub(/^[^=]*=/, "", value)
        sub(/^[[:space:]]*/, "", value)
        sub(/[[:space:]]*$/, "", value)
        if ((value ~ /^".*"$/) || (value ~ /^'\''.*'\''$/)) {
          value=substr(value, 2, length(value) - 2)
        }
        print value
      }
    }
  ' "$ENV_FILE" | tail -n 1
}

is_true() {
  case "$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

has_placeholder() {
  value="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
  case "$value" in
    "" | replace_me* | changeme | change_me | your_* | example*) return 0 ;;
    *replace_me* | *changeme* | *change_me* | *your_*) return 0 ;;
    *) return 1 ;;
  esac
}

has_localhost() {
  printf '%s' "${1:-}" | grep -Eiq 'localhost|127\.0\.0\.1|0\.0\.0\.0'
}

require_value() {
  key="$1"
  value="$(get_env "$key")"
  if has_placeholder "$value"; then
    fail "$key" "missing value or placeholder"
  fi
}

require_secret() {
  key="$1"
  min_length="${2:-16}"
  value="$(get_env "$key")"
  if has_placeholder "$value"; then
    fail "$key" "missing production-grade secret"
    return
  fi
  if [ "${#value}" -lt "$min_length" ]; then
    fail "$key" "secret is too short"
  fi
}

require_https_url() {
  key="$1"
  value="$(get_env "$key")"

  if has_placeholder "$value"; then
    fail "$key" "missing HTTPS URL or placeholder"
    return
  fi

  case "$value" in
    https://*) ;;
    *) fail "$key" "must use HTTPS" ;;
  esac

  if has_localhost "$value"; then
    fail "$key" "must not point to localhost"
  fi
}

require_false() {
  key="$1"
  value="$(get_env "$key")"
  if is_true "$value"; then
    fail "$key" "must be false in production"
  fi
}

require_true() {
  key="$1"
  value="$(get_env "$key")"
  if ! is_true "$value"; then
    fail "$key" "must be true for this production mode"
  fi
}

require_not_value() {
  key="$1"
  forbidden="$2"
  value="$(printf '%s' "$(get_env "$key")" | tr '[:upper:]' '[:lower:]')"
  if [ "$value" = "$forbidden" ]; then
    fail "$key" "must not be $forbidden in this release"
  fi
}

require_any_value() {
  first_key="$1"
  second_key="$2"
  first_value="$(get_env "$first_key")"
  second_value="$(get_env "$second_key")"
  if has_placeholder "$first_value" && has_placeholder "$second_value"; then
    fail "$first_key/$second_key" "at least one production value is required"
  fi
}

scan_placeholders() {
  placeholder_keys="$(awk -F= '
    /^[[:space:]]*#/ { next }
    /^[[:space:]]*$/ { next }
    {
      key=$1
      value=$0
      sub(/^[[:space:]]*/, "", key)
      sub(/[[:space:]]*$/, "", key)
      sub(/^[^=]*=/, "", value)
      lowered=tolower(value)
      if (value != "" && lowered ~ /(replace_me|changeme|change_me|your_)/) {
        print key
      }
      if (lowered ~ /sk_test_|pk_test_|whsec_test/) {
        print key
      }
    }
  ' "$ENV_FILE" | sort -u)"

  for key in $placeholder_keys; do
    [ -n "$key" ] || continue
    fail "$key" "contains a placeholder or test secret"
  done
}

scan_placeholders

if [ "$(get_env NODE_ENV)" != "production" ]; then
  fail "NODE_ENV" "must be production"
fi

require_https_url "FRONTEND_URL"
require_https_url "API_PUBLIC_URL"
require_https_url "SERVER_URL"

cors_origin="$(get_env CORS_ORIGIN)"
if has_placeholder "$cors_origin"; then
  fail "CORS_ORIGIN" "must contain at least one production origin"
elif has_localhost "$cors_origin"; then
  fail "CORS_ORIGIN" "must not include localhost"
fi

app_keys="$(get_env APP_KEYS)"
app_key_count="$(printf '%s\n' "$app_keys" | tr ',' '\n' | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')"
if [ "$app_key_count" -lt 4 ]; then
  fail "APP_KEYS" "must contain at least four secrets"
fi

require_secret "API_TOKEN_SALT"
require_secret "ADMIN_JWT_SECRET"
require_secret "TRANSFER_TOKEN_SALT"
require_secret "JWT_SECRET"
require_secret "ENCRYPTION_KEY" 32

database_client="$(get_env DATABASE_CLIENT)"
if [ "$database_client" = "sqlite" ] || has_placeholder "$database_client"; then
  fail "DATABASE_CLIENT" "must be postgres or mysql in production"
fi
require_value "DATABASE_HOST"
require_value "DATABASE_NAME"
require_value "DATABASE_USERNAME"
require_secret "DATABASE_PASSWORD"
require_secret "POSTGRES_PASSWORD"

rate_limit_enabled="$(get_env RATE_LIMIT_ENABLED)"
if ! is_true "$rate_limit_enabled"; then
  fail "RATE_LIMIT_ENABLED" "must stay enabled"
fi
require_secret "REDIS_PASSWORD"

http_cache_enabled="$(get_env HTTP_CACHE_ENABLED)"
if is_true "$http_cache_enabled"; then
  require_secret "REDIS_PASSWORD"
fi

ga4_id="$(get_env GA4_MEASUREMENT_ID)"
if has_placeholder "$ga4_id"; then
  fail "GA4_MEASUREMENT_ID" "must be a real GA4 measurement ID"
else
  case "$ga4_id" in
    G-*) ;;
    *) fail "GA4_MEASUREMENT_ID" "must start with G-" ;;
  esac
  case "$(printf '%s' "$ga4_id" | tr '[:upper:]' '[:lower:]')" in
    g-xxxx* | g-test*) fail "GA4_MEASUREMENT_ID" "must not be a placeholder ID" ;;
  esac
fi

if is_true "$(get_env TURNSTILE_ENABLED)"; then
  require_value "TURNSTILE_SITE_KEY"
  require_secret "TURNSTILE_SECRET_KEY"
fi
require_false "TURNSTILE_FAIL_OPEN"

if is_true "$(get_env R2_UPLOAD_ENABLED)"; then
  require_value "R2_ACCESS_KEY_ID"
  require_secret "R2_SECRET_ACCESS_KEY"
  require_https_url "R2_S3_ENDPOINT"
  require_value "R2_BUCKET"
  require_https_url "R2_PUBLIC_BASE_URL"
fi

if is_true "$(get_env STRIPE_REQUIRED)"; then
  stripe_key="$(get_env STRIPE_SECRET_KEY)"
  case "$stripe_key" in
    sk_live_*) ;;
    *) fail "STRIPE_SECRET_KEY" "must be a live Stripe secret key when STRIPE_REQUIRED=true" ;;
  esac

  webhook_secret="$(get_env STRIPE_WEBHOOK_SECRET)"
  case "$webhook_secret" in
    whsec_*) ;;
    *) fail "STRIPE_WEBHOOK_SECRET" "must be a Stripe webhook secret when STRIPE_REQUIRED=true" ;;
  esac

  monthly_price="$(get_env STRIPE_PREMIUM_MONTHLY_PRICE_ID)"
  annual_price="$(get_env STRIPE_PREMIUM_ANNUAL_PRICE_ID)"
  case "$monthly_price" in
    price_*) ;;
    *) fail "STRIPE_PREMIUM_MONTHLY_PRICE_ID" "must be a Stripe price ID when STRIPE_REQUIRED=true" ;;
  esac
  case "$annual_price" in
    price_*) ;;
    *) fail "STRIPE_PREMIUM_ANNUAL_PRICE_ID" "must be a Stripe price ID when STRIPE_REQUIRED=true" ;;
  esac
fi

if is_true "$(get_env AICO_ENABLE_WORKFLOWS)"; then
  require_secret "AICO_OPENROUTER_TOKEN"
  require_secret "AICO_AUDIT_IP_HASH_SALT" 16
  require_false "AICO_RUNTIME_LOCKS_DISABLED"
  require_false "AICO_SOCIAL_CONTENT_SAFETY_DISABLED"
  require_not_value "AICO_ADS_PROVIDER_MODE" "live"
  require_not_value "AICO_VIDEO_PROVIDER_MODE" "live"
fi
require_false "AICO_ALLOW_MISSING_TOKEN"

if is_true "$(get_env AICO_STRICT_AUDIT_REQUIRED)"; then
  require_true "AICO_AUDIT_TRAIL_STRICT"
fi

if is_true "$(get_env AICO_FULL_AUTONOMY_REQUIRED)"; then
  require_true "AICO_ENABLE_WORKFLOWS"
  require_true "AICO_AUDIT_TRAIL_STRICT"
  require_true "AICO_STRICT_AUDIT_REQUIRED"
  require_true "AICO_AUTO_PUBLISH_ENABLED"
  require_true "AICO_STRATEGY_AUTOPILOT_ENABLED"
  require_true "AICO_STRATEGY_AUTO_APPROVE_PLAN"
  require_true "AICO_MEDIA_GEN_REQUIRED"
  require_true "AICO_SOCIAL_PUBLISH_REQUIRED"
  require_true "AICO_CONTROLLED_LIVE_ENABLED"
  require_true "AICO_ADMIN_RUN_NOW_ENABLED"
  require_value "AICO_ADS_PROVIDER_MODE"
  if [ "$(get_env AICO_ADS_PROVIDER_MODE)" != "controlled" ]; then
    fail "AICO_ADS_PROVIDER_MODE" "must be controlled when full autonomy is required"
  fi
  require_true "AICO_ADS_TARGET_URL_PREFLIGHT_REQUIRED"
  require_value "AICO_VIDEO_PROVIDER_MODE"
  if [ "$(get_env AICO_VIDEO_PROVIDER_MODE)" != "replicate" ]; then
    fail "AICO_VIDEO_PROVIDER_MODE" "must be replicate when full autonomy is required"
  fi
  require_value "GA4_PROPERTY_ID"

  ga4_access_token="$(get_env AICO_GA4_ACCESS_TOKEN)"
  ga4_service_account_json="$(get_env GA4_SERVICE_ACCOUNT_JSON)"
  google_application_credentials="$(get_env GOOGLE_APPLICATION_CREDENTIALS)"
  if has_placeholder "$ga4_access_token" &&
    has_placeholder "$ga4_service_account_json" &&
    has_placeholder "$google_application_credentials"; then
    fail "GA4_CREDENTIALS" "set AICO_GA4_ACCESS_TOKEN, GA4_SERVICE_ACCOUNT_JSON, or GOOGLE_APPLICATION_CREDENTIALS when full autonomy is required"
  fi
fi

if [ "$(get_env AICO_VIDEO_PROVIDER_MODE)" = "replicate" ]; then
  require_value "AICO_VIDEO_GEN_MODEL"
  video_token="$(get_env AICO_VIDEO_GEN_TOKEN)"
  replicate_token="$(get_env REPLICATE_API_TOKEN)"
  if has_placeholder "$video_token" && has_placeholder "$replicate_token"; then
    fail "AICO_VIDEO_GEN_TOKEN" "set AICO_VIDEO_GEN_TOKEN or REPLICATE_API_TOKEN when AICO_VIDEO_PROVIDER_MODE=replicate"
  fi
fi

if [ "$(get_env AICO_ADS_PROVIDER_MODE)" = "controlled" ]; then
  require_secret "AICO_META_ADS_ACCESS_TOKEN"
  require_value "AICO_META_AD_ACCOUNT_ID"
  require_secret "AICO_GOOGLE_ADS_DEVELOPER_TOKEN"
  require_value "AICO_GOOGLE_ADS_CLIENT_ID"
  require_secret "AICO_GOOGLE_ADS_CLIENT_SECRET"
  require_secret "AICO_GOOGLE_ADS_REFRESH_TOKEN"
  require_value "AICO_GOOGLE_ADS_CUSTOMER_ID"
fi

if is_true "$(get_env AICO_MEDIA_GEN_REQUIRED)"; then
  require_secret "AICO_IMAGE_GEN_TOKEN"
  require_value "AICO_IMAGE_GEN_MODEL"
fi

if is_true "$(get_env AICO_SOCIAL_PUBLISH_REQUIRED)"; then
  require_https_url "AICO_PUBLIC_FRONTEND_URL"
  require_https_url "AICO_SOCIAL_DEFAULT_IMAGE_URL"
  require_value "AICO_FACEBOOK_PAGE_ID"
  require_secret "AICO_FACEBOOK_ACCESS_TOKEN"
  require_value "AICO_INSTAGRAM_USER_ID"
  require_secret "AICO_INSTAGRAM_ACCESS_TOKEN"
  require_value "AICO_X_API_KEY"
  require_secret "AICO_X_API_SECRET"
  require_secret "AICO_X_ACCESS_TOKEN"
  require_secret "AICO_X_ACCESS_TOKEN_SECRET"
fi

if is_true "$(get_env SENTRY_REQUIRED)"; then
  require_value "SENTRY_DSN"
fi

if is_true "$(get_env BUGSINK_REQUIRED)"; then
  require_secret "BUGSINK_SECRET_KEY" 32
  require_secret "BUGSINK_POSTGRES_PASSWORD"
fi
require_false "ALLOW_PRODUCTION_SEED"
require_false "STRAPI_DOCUMENTATION_ENABLED"

if [ "$failures" -gt 0 ]; then
  echo "Production env check failed with $failures issue(s)." >&2
  exit 1
fi

echo "OK   production env file: $ENV_FILE"
