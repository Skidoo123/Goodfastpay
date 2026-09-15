#!/usr/bin/env bash
# audit/scripts/security-audit.sh — deps, SAST, full-history secret scan.
set -euo pipefail
cd "$(dirname "$0")/../.."
FAIL=0
echo "▶ Dependency vulnerabilities (npm audit, production)"
if npm audit --omit=dev --audit-level=high 2>&1 | tail -5; then :; else FAIL=1; fi
echo
echo "▶ SAST (Semgrep, if installed)"
if command -v semgrep &>/dev/null; then
  semgrep --config=p/owasp-top-ten --error api js scripts || FAIL=1
else
  echo "! semgrep not installed — run: pip install semgrep"
fi
echo
echo "▶ Secret scan (FULL git history — counts only, never prints values)"
if command -v gitleaks &>/dev/null; then
  if gitleaks detect --redact -v 2>&1 | tail -3 | grep -qi "leaks found"; then
    echo "✗ secrets found in history — rotation + filter-repo required (Phase -1)"
    FAIL=1
  else
    echo "✓ no secrets in history"
  fi
else
  echo "! gitleaks not installed — secrets-in-history check skipped (see Phase -1)"
fi
exit $FAIL
