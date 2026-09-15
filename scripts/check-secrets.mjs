// CI guard: secrets + dangerous sinks.
// Run: node scripts/check-secrets.mjs
// Severity: FAIL = must fix (blocks). WARN = legacy debt, tracked, does not block.
// Reports file:line + pattern name only — never prints the matched value.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

// Patterns that FAIL the build anywhere they appear.
const FAIL_PATTERNS = [
  { name: 'service-role key reference with fallback', re: /SUPABASE_SERVICE_ROLE_KEY[^=]*\|\|/ },
  { name: 'hardcoded Supabase JWT in server code', re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./, only: /^api\// },
  { name: 'client-supplied balance write in server code', re: /newBalance/, only: /^api\// },
  { name: 'eval sink', re: /\beval\s*\(/ },
  { name: 'document.write sink', re: /document\.write\s*\(/ },
];

// Patterns that WARN (legacy frontend debt, mid-migration to server authority).
const WARN_PATTERNS = [
  { name: 'hardcoded Supabase JWT (legacy frontend)', re: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./ },
  { name: 'hardcoded project URL (legacy frontend)', re: /btbolekfrcwzzjqhorgi\.supabase\.co/ },
  { name: 'backdoor password literal', re: /password123/ },
  { name: "backdoor pin literal '1234'", re: /['"]1234['"]/ },
  { name: 'admin email in client auth logic', re: /admin@goodfastpay\.com/ },
  { name: 'plaintext password column write', re: /password:\s*(password|pwd|regPw)/ },
  { name: 'client balance mirror (legacy cloud-sync)', re: /wallet_balance:\s*newBalance|usd_balance:\s*newBalance/ },
];

const SKIP_DIRS = new Set(['node_modules', '.git', '.vercel', '.turbo']);
const EXTENSIONS = ['.js', '.mjs', '.html', '.sql', '.json'];

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || name.startsWith('.env.')) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { walk(p); continue; }
    if (name === 'check-secrets.mjs' || name === 'scan-syntax.mjs') continue;
    if (EXTENSIONS.some((e) => name.endsWith(e))) files.push(p);
  }
})('.');

let failed = false;
let warned = 0;

// example.env must not be TRACKED (working-tree copy is fine for local dev).
try {
  const tracked = execFileSync('git', ['ls-files', 'example.env'], { encoding: 'utf8' }).trim();
  if (tracked) {
    console.error('FAIL example.env is git-tracked — run: git rm --cached example.env');
    failed = true;
  }
} catch {}

const norm = (p) => p.replace(/\\/g, '/');
for (const f of files) {
  let src;
  try { src = readFileSync(f, 'utf8'); } catch { continue; }
  src.split('\n').forEach((line, i) => {
    if (line.includes('check-secrets: allow')) return; // explicit, reviewed exception
    for (const { name, re, only } of FAIL_PATTERNS) {
      if (only && !only.test(norm(f))) continue;
      if (re.test(line)) { console.error(`FAIL ${f}:${i + 1} [${name}]`); failed = true; break; }
    }
    if (!failed || true) {
      for (const { name, re } of WARN_PATTERNS) {
        if (re.test(line)) { console.error(`WARN ${f}:${i + 1} [${name}]`); warned++; break; }
      }
    }
  });
}

if (failed) {
  console.error('\ncheck-secrets: FAIL');
  process.exit(1);
} else {
  console.log(`check-secrets: OK (${files.length} files, ${warned} legacy warnings)`);
}
