#!/usr/bin/env sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:1337/api}"
FRONTEND_BASE_URL="${FRONTEND_BASE_URL:-http://localhost:4200}"

check() {
  name="$1"
  url="$2"
  expected="${3:-200}"

  status="$(curl -gksS -o /tmp/star-sign-smoke.json -w '%{http_code}' "$url")"
  if [ "$status" != "$expected" ]; then
    echo "FAIL $name: expected $expected, got $status"
    cat /tmp/star-sign-smoke.json
    exit 1
  fi
  echo "OK   $name"
}

check "api health" "$API_BASE_URL/health/ready"
check "public app settings" "$API_BASE_URL/app-settings/public"
if grep -Eiq 'STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|STRIPE_.*PRICE_ID|sk_live_|sk_test_|whsec_|secretKey|webhookSecret|priceId' /tmp/star-sign-smoke.json; then
  echo "FAIL public app settings: response contains a secret-looking field or value"
  cat /tmp/star-sign-smoke.json
  exit 1
fi
echo "OK   public app settings redaction"
check "zodiac signs" "$API_BASE_URL/zodiac-signs?sort=id:asc"
# Regression guard: zodiac profiles must have linked hero images.
curl -gksS -o /tmp/star-sign-smoke-zodiac.json \
  "$API_BASE_URL/zodiac-signs?populate=image&sort=id:asc&pagination[pageSize]=100"
zodiac_total="$(node -e '
  const fs = require("fs");
  try { console.log((JSON.parse(fs.readFileSync("/tmp/star-sign-smoke-zodiac.json","utf8")).data ?? []).length); }
  catch { console.log("0"); }' 2>/dev/null || echo 0)"
zodiac_with_images="$(node -e '
  const fs = require("fs");
  try {
    const data = JSON.parse(fs.readFileSync("/tmp/star-sign-smoke-zodiac.json","utf8")).data ?? [];
    console.log(data.filter((s) => s && s.image).length);
  } catch { console.log("0"); }' 2>/dev/null || echo 0)"
if [ "$zodiac_with_images" -lt 10 ]; then
  echo "FAIL zodiac images: expected >=10 signs with image, got $zodiac_with_images/$zodiac_total"
  cat /tmp/star-sign-smoke-zodiac.json
  exit 1
fi
echo "OK   zodiac images ($zodiac_with_images/$zodiac_total)"
check "articles" "$API_BASE_URL/articles?sort=publishedAt:desc&pagination[limit]=20&populate=category"
check "numerology" "$API_BASE_URL/numerology-profiles?filters[number][\$eq]=3&pagination[limit]=1"
check "daily tarot" "$API_BASE_URL/daily-tarot/today"
shop_status="$(curl -gksS -o /tmp/star-sign-smoke.json -w '%{http_code}' "$API_BASE_URL/products?populate=*")"
if [ "$shop_status" != "403" ] && [ "$shop_status" != "404" ]; then
  echo "FAIL shop disabled: expected 403 or 404, got $shop_status"
  cat /tmp/star-sign-smoke.json
  exit 1
fi
echo "OK   shop disabled"
check "frontend health" "$FRONTEND_BASE_URL/healthz"
check "frontend home" "$FRONTEND_BASE_URL/"
check "frontend sitemap" "$FRONTEND_BASE_URL/sitemap.xml"
# Regression guard: SSR must render route content, not the CSR fallback shell.
# The zodiac profile page is data-driven, so a rendered page contains the sign
# name; the empty-shell fallback (~31 kB identical for every URL) does not.
ssr_route_html="$(curl -gksS "$FRONTEND_BASE_URL/znaki/baran")"
if ! printf '%s' "$ssr_route_html" | grep -q "Baran"; then
  echo "FAIL frontend SSR: /znaki/baran HTML does not contain route content (CSR fallback?)"
  printf '%s\n' "$ssr_route_html" | head -c 500
  exit 1
fi
echo "OK   frontend SSR renders route content"
