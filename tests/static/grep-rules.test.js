// Static tests: forbidden patterns stay absent (the doc's deletion checklist as tests).
// Rule coverage: VULN-01/03/06/07/08 + FIN-02 remnants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, jsFiles } from '../helpers/repo.js';

function eachFile(dirs, exts, cb) {
  (function w(dir) {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === '.git' || n.startsWith('.')) continue;
      const p = join(dir, n);
      let s;
      try { s = statSync(p); } catch { continue; }
      if (s.isDirectory()) { w(p); continue; }
      if (exts.some((e) => n.endsWith(e))) cb(p);
    }
  })(join(ROOT, dirs));
}

function hitsIn(dirs, exts, predicate) {
  const out = [];
  eachFile(dirs, exts, (p) => {
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('check-secrets: allow')) return;
      if (predicate(line)) out.push(`${p}:${i + 1}`);
    });
  });
  return out;
}

const srcHits = (re) => [
  ...hitsIn('js', ['.js'], (l) => re.test(l)),
  ...hitsIn('api', ['.js'], (l) => re.test(l)),
];

test('no hardcoded JWTs in server code', () => {
  assert.deepEqual(
    hitsIn('api', ['.js'], (l) => /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\./.test(l)),
    [],
  );
});

test('no service-role fallbacks in server code', () => {
  assert.deepEqual(
    hitsIn('api', ['.js'], (l) => /SUPABASE_SERVICE_ROLE_KEY[^=]*\|\|/.test(l)),
    [],
  );
});

test('no backdoor literals anywhere in source', () => {
  // check-secrets: allow — the three regexes below are test data asserting absence
  assert.deepEqual(srcHits(/AdminGoodfastpay2026/), []); // check-secrets: allow
  assert.deepEqual(srcHits(/password123/), []); // check-secrets: allow
  assert.deepEqual(srcHits(/['"]1234['"]/), []); // check-secrets: allow
});

test('no client-supplied balances in server code', () => {
  assert.deepEqual(hitsIn('api', ['.js'], (l) => /newBalance/.test(l)), []);
});

test('no eval / document.write sinks', () => {
  const bad = [];
  for (const f of jsFiles()) {
    if (f.endsWith('safe-dom.js')) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/[^_a-zA-Z]eval\s*\(/.test(line)) bad.push(`${f}:${i + 1} eval`);
      if (/document\.write\s*\(/.test(line)) bad.push(`${f}:${i + 1} document.write`);
    });
  }
  assert.deepEqual(bad, []);
});

test('no signup-credit residue (250.00)', () => {
  const bad = [];
  for (const f of jsFiles()) {
    if (f.includes('/tests/') || f.includes('/scripts/')) continue;
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (line.includes('250.00')) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(
    [...bad, ...hitsIn('api', ['.js'], (l) => l.includes('250.00'))],
    [],
  );
});

test('no open RLS in migration files (code lines only, comments excluded)', () => {
  // Intentional public rate-read policies (reference data by design — see V3).
  const ALLOWED = new Set([
    'currencies_public_read', 'brand_rates_public_read', 'rates_public_read',
  ]);
  const bad = [];
  eachFile('supabase', ['.sql'], (p) => {
    let currentPolicy = null;
    readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
      if (line.trim().startsWith('--')) return;
      const m = /CREATE POLICY (\w+)/.exec(line);
      if (m) currentPolicy = m[1];
      if (line.includes('USING (true)') && !ALLOWED.has(currentPolicy)) {
        bad.push(`${p}:${i + 1} (policy ${currentPolicy})`);
      }
    });
  });
  assert.deepEqual(bad, []);
});
