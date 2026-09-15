#!/usr/bin/env bash
# audit/scripts/repo-audit.sh
# Presence + absence checks for THIS repo layout (flat js/api + supabase/migrations).
# Runs on every PR. Fails if anything is out of spec.
set -euo pipefail
cd "$(dirname "$0")/../.."

FAIL=0
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; RESET='\033[0m'
pass() { echo -e "${GREEN}✓${RESET} $1"; }
fail() { echo -e "${RED}✗${RESET} $1"; FAIL=1; }
warn() { echo -e "${YELLOW}!${RESET} $1"; }

echo "═══════════════════════════════════════════════════════"
echo "  GOODFASTPAY REPO AUDIT  $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
echo "═══════════════════════════════════════════════════════"; echo

echo "▶ Section 1: Required files"
required_files=(
  "README.md" "DECISIONS.md" "CONTRIBUTING.md" "SECURITY.md" "CODEOWNERS"
  "CHANGELOG.md" "LICENSE" ".nvmrc"
  ".env.example" ".gitignore" "package.json" "vercel.json"
  "api/config.js" "api/client/action.js" "api/admin/action.js"
  "api/_lib/env.js" "api/_lib/http.js" "api/_lib/auth.js"
  "api/_lib/supabaseAdmin.js" "api/_lib/validate.js" "api/_lib/ledger.js"
  "supabase/migrations/001_lockdown_rls.sql"
  "supabase/migrations/002_ledger_and_atomic.sql"
  "supabase/migrations/003_audit_log.sql"
  "supabase/migrations/004_drop_plaintext_secrets.sql"
  "supabase/complete-supabase-setup.sql"
  "js/safe-dom.js"
  "tests/unit/validate.test.js" "tests/unit/ledger.test.js"
  "tests/static/grep-rules.test.js" "tests/static/action-parity.test.js"
  "tests/helpers/stub-supabaseAdmin.mjs"
  "scripts/scan-syntax.mjs" "scripts/check-secrets.mjs"
  "audit/scripts/full-audit.sh" "audit/AUDIT_LOG.md"
  "audit/config/audit.config.json" "docs/GOOGLE_OAUTH_SETUP.md"
)
for f in "${required_files[@]}"; do
  if [ -e "$f" ]; then pass "exists: $f"; else fail "MISSING: $f"; fi
done; echo

echo "▶ Section 2: Forbidden files"
if git ls-files | grep -qx "example.env"; then fail "example.env is git-tracked"; else pass "example.env untracked"; fi
for f in diagnostic.html admin-support.html js/rate-ticker.js .env .env.local .env.production; do
  if [ -e "$f" ]; then fail "FORBIDDEN FILE PRESENT: $f"; else pass "absent: $f"; fi
done; echo

echo "▶ Section 3: Forbidden FAIL patterns (server code is zero-tolerance)"
fail_pat() { # $1 pattern $2 description $3 path-scope
  local hits; hits=$(grep -rn -e "$1" $3 2>/dev/null | grep -vE "^\s*[^:]+:[0-9]+:\s*(//|--|#|\*)" || true)
  if [ -n "$hits" ]; then fail "FORBIDDEN '$2':"; echo "$hits" | head -10; else pass "absent: $2"; fi
}
fail_pat "SUPABASE_SERVICE_ROLE_KEY[^=]*||" "service-role fallback" "api/"
fail_pat "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\\." "hardcoded JWT in api/" "api/"
fail_pat "newBalance" "client balance in api/" "api/"
fail_pat "[^_a-zA-Z]eval\\(" "eval()" "api/ js/ scripts/"
fail_pat "document\\.write\\s*\\(" "document.write" "js/ api/"
fail_pat "USING (true)" "open RLS in migrations" "supabase/migrations/"
fail_pat "250\\.00" "signup-credit residue" "js/ api/ supabase/"
fail_pat "password123" "backdoor password" "js/ api/"
fail_pat "AdminGoodfastpay2026" "hardcoded admin password" "js/ api/"
fail_pat "password: password" "plaintext password write" "api/"
fail_pat "password: pwd" "plaintext password write" "api/"
echo

echo "▶ Section 4: Required patterns (server authority)"
req_pat() { # $1 pattern $2 desc $3 file
  if grep -q -e "$1" "$3" 2>/dev/null; then pass "present: $2"; else fail "MISSING: $2 (in $3)"; fi
}
req_pat "requireAdmin" "admin JWT+role guard" "api/_lib/auth.js"
req_pat "function authenticate" "JWT authenticate" "api/_lib/auth.js"
req_pat "signInWithOAuth" "OAuth entry point" "js/supabase-config.js"
req_pat "OAUTH_ALLOWED_PROVIDERS" "OAuth provider allowlist" "js/supabase-config.js"
req_pat "apply_ledger_entry" "ledger RPC wrapper" "api/_lib/ledger.js"
req_pat "ALLOWED_ORIGINS" "CORS allowlist" "api/_lib/env.js"
req_pat "function applyLedger" "single ledger path" "api/_lib/ledger.js"
req_pat "create policy" "RLS policies" "supabase/migrations/001_lockdown_rls.sql"
req_pat "deny_ledger_mutation\|deny_mutation" "ledger immutability" "supabase/migrations/002_ledger_and_atomic.sql"
req_pat "service_role" "service-role-only RPC" "supabase/migrations/002_ledger_and_atomic.sql"
echo

echo "▶ Section 5: Frontend↔API action parity"
called=$(grep -rhoE "call(Client|Admin)Api\\('[a-z_]+'" js/*.js 2>/dev/null | grep -oE "'[a-z_]+'" | tr -d "'" | sort -u || true)
served=$(grep -hoE "^\\s+[a-z_]+:" api/client/action.js api/admin/action.js 2>/dev/null | tr -d ' :' | sort -u || true)
parity_ok=1
for a in $called; do
  if ! echo "$served" | grep -qx "$a"; then fail "frontend calls '$a' with no server handler"; parity_ok=0; fi
done
[ $parity_ok -eq 1 ] && pass "every frontend action has a server handler"
echo

echo "▶ Section 6: Duplicate top-level functions"
dups=$(node -e '
const {readFileSync,readdirSync,statSync}=require("node:fs"),{join}=require("node:path");
const files=[];(function w(d){for(const n of readdirSync(d)){if(n==="node_modules"||n===".git"||n.startsWith("."))continue;const p=join(d,n);let s;try{s=statSync(p)}catch{continue}if(s.isDirectory())w(p);else if(/\.m?js$/.test(n))files.push(p)}})(".");
let out="";for(const f of files){const seen=new Map();readFileSync(f,"utf8").split("\n").forEach((l,i)=>{const m=/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(l);if(!m)return;if(seen.has(m[1]))out+=`${f}:${i+1} dup ${m[1]}\n`;else seen.set(m[1],i+1)})}process.stdout.write(out);' || true)
if [ -n "$dups" ]; then fail "duplicate functions:"; echo "$dups"; else pass "no duplicate top-level functions"; fi
echo

echo "▶ Section 7: Tracked env files"
if git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.env\.example' | grep -q .; then
  fail "tracked .env files present"
else
  pass "no .env files tracked"
fi
echo

echo "═══════════════════════════════════════════════════════"
if [ $FAIL -eq 0 ]; then echo -e "${GREEN}REPO AUDIT: PASS${RESET}"; exit 0
else echo -e "${RED}REPO AUDIT: FAIL${RESET}"; exit 1; fi
