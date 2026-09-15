// CI guard: real parse via node --check (ESM-aware) + duplicate top-level functions.
// Run: node scripts/scan-syntax.mjs
import { readFileSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
    const p = join(dir, name);
    let st;
    try { st = statSync(p); } catch { continue; }
    if (st.isDirectory()) { walk(p); continue; }
    if (name.endsWith('.js') || name.endsWith('.mjs')) files.push(p);
  }
})('.');

let failed = false;

// 1. Duplicate top-level function declarations (Parse-level, catches BUG-01 class)
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  const seen = new Map();
  lines.forEach((line, i) => {
    const m = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(line);
    if (!m) return;
    if (seen.has(m[1])) {
      console.error(`DUPLICATE ${f}:${i + 1} function '${m[1]}' (first at line ${seen.get(m[1])})`);
      failed = true;
    } else seen.set(m[1], i + 1);
  });
}

// 2. Ground-truth parse: copy to temp .mjs and run node --check (handles import/export)
for (const f of files) {
  const tmp = join(tmpdir(), `syntax-check-${process.pid}-${files.indexOf(f)}.mjs`);
  try {
    writeFileSync(tmp, readFileSync(f));
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || '').toString().split('\n')[0];
    console.error(`PARSE ${f}: ${msg}`);
    failed = true;
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

if (failed) {
  console.error('\nscan-syntax: FAIL');
  process.exit(1);
} else {
  console.log(`scan-syntax: OK (${files.length} files)`);
}
