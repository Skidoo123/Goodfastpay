#!/usr/bin/env bash
# audit/scripts/full-audit.sh — the one command. Runs every layer that can run
# without prod credentials; DB-gated layers run only when DATABASE_URL is set.
set -euo pipefail
cd "$(dirname "$0")/../.."

echo "═══════════════════════════════════════════════════════════"
echo "  GOODFASTPAY FULL AUDIT  $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "═══════════════════════════════════════════════════════════"; echo
FAIL=0
run() { local name="$1"; shift
  echo "─── $name ───"
  if "$@"; then echo "✓ $name PASSED"; else echo "✗ $name FAILED"; FAIL=1; fi; echo
}

run "Repo audit"     bash audit/scripts/repo-audit.sh
run "Unit + rule tests" npm test --silent
run "JS verify"      npm run verify --silent
if [ -n "${DATABASE_URL:-}" ]; then
  run "Ledger audit"   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit/scripts/ledger-audit.sql
  run "RLS audit"      psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit/scripts/rls-audit.sql
  run "Audit-log audit" psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f audit/scripts/audit-log-audit.sql
else
  echo "─── Ledger/RLS/Audit-log audits ───"; echo "! DATABASE_URL unset — DB layers skipped (run in CI nightly against replica)"; echo
fi
if [ -n "${API_URL:-}" ]; then
  run "Provider audit" bash audit/scripts/provider-audit.sh
else
  echo "─── Provider audit ───"; echo "! API_URL unset — skipped"; echo
fi

echo "═══════════════════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then echo "  FULL AUDIT: PASS"; else echo "  FULL AUDIT: FAIL"; fi
echo "═══════════════════════════════════════════════════════════"
exit $FAIL
