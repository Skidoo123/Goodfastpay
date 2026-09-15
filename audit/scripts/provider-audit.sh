#!/usr/bin/env bash
# audit/scripts/provider-audit.sh
# No provider health endpoints exist yet (Phase 6). Until then: check that
# our own surfaces answer and that configured provider hosts resolve.
set -euo pipefail
API_URL="${API_URL:-https://goodfastpay.com}"

echo "▶ Own surfaces"
for p in "/api/config"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$API_URL$p" || echo "000")
  echo "  $p -> HTTP $code"
done
echo
echo "▶ Provider DNS reachability (keyless, informational)"
for h in api.paystack.co api.flutterwave.com api.dojah.io; do
  if getent hosts "$h" >/dev/null 2>&1; then echo "  ✓ $h resolves"; else echo "  ! $h does not resolve"; fi
done
echo
echo "NOTE: per-endpoint provider health (/health/provider/*) lands in Phase 6."
