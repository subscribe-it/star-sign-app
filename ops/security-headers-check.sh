#!/usr/bin/env sh
set -eu

SECURITY_HEADER_URLS="${SECURITY_HEADER_URLS:-}"

append_security_header_url() {
  url="$1"

  if [ -n "$SECURITY_HEADER_URLS" ]; then
    SECURITY_HEADER_URLS="${SECURITY_HEADER_URLS},${url}"
  else
    SECURITY_HEADER_URLS="$url"
  fi
}

if [ -z "$SECURITY_HEADER_URLS" ]; then
  if [ -n "${FRONTEND_BASE_URL:-}" ]; then
    append_security_header_url "$FRONTEND_BASE_URL"
  fi
  if [ -n "${API_BASE_URL:-}" ]; then
    append_security_header_url "${API_BASE_URL%/}/health/ready"
  fi
fi

if [ -z "$SECURITY_HEADER_URLS" ]; then
  echo "Set SECURITY_HEADER_URLS or FRONTEND_BASE_URL/API_BASE_URL." >&2
  exit 2
fi

headers_file="$(mktemp)"
body_file="$(mktemp)"
cleanup() {
  rm -f "$headers_file" "$body_file"
}
trap cleanup EXIT

latest_header_value() {
  header_name="$1"
  grep -i "^${header_name}:" "$headers_file" | tail -n 1 | cut -d ':' -f 2- | tr -d '\r' | sed 's/^[[:space:]]*//'
}

require_header_contains() {
  url="$1"
  header_name="$2"
  expected="$3"
  value="$(latest_header_value "$header_name" | tr '[:upper:]' '[:lower:]')"
  expected_lower="$(printf '%s' "$expected" | tr '[:upper:]' '[:lower:]')"

  if [ -z "$value" ]; then
    echo "FAIL $url: missing header $header_name" >&2
    exit 1
  fi

  case "$value" in
    *"$expected_lower"*) ;;
    *)
      echo "FAIL $url: header $header_name does not contain '$expected'" >&2
      echo "Actual: $value" >&2
      exit 1
      ;;
  esac
}

check_url() {
  url="$1"

  case "$url" in
    https://*) ;;
    *)
      echo "FAIL $url: security header check requires an HTTPS URL" >&2
      exit 1
      ;;
  esac

  status="$(curl -gksS -D "$headers_file" -o "$body_file" -w '%{http_code}' "$url")"
  case "$status" in
    2* | 3*) ;;
    *)
      echo "FAIL $url: expected 2xx/3xx status, got $status" >&2
      cat "$body_file" >&2
      exit 1
      ;;
  esac

  require_header_contains "$url" "strict-transport-security" "max-age="
  require_header_contains "$url" "strict-transport-security" "includesubdomains"
  require_header_contains "$url" "x-content-type-options" "nosniff"
  require_header_contains "$url" "x-frame-options" "deny"
  require_header_contains "$url" "referrer-policy" "strict-origin-when-cross-origin"
  require_header_contains "$url" "permissions-policy" "camera=()"
  require_header_contains "$url" "permissions-policy" "microphone=()"
  require_header_contains "$url" "permissions-policy" "geolocation=()"
  require_header_contains "$url" "content-security-policy" "frame-ancestors 'none'"
  require_header_contains "$url" "content-security-policy" "base-uri 'self'"
  require_header_contains "$url" "content-security-policy" "object-src 'none'"

  echo "OK   security headers $url"
}

printf '%s\n' "$SECURITY_HEADER_URLS" | tr ',' '\n' | while IFS= read -r raw_url; do
  url="$(printf '%s' "$raw_url" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  [ -n "$url" ] || continue
  check_url "$url"
done
