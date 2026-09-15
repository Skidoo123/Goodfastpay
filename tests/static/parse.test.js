// Static tests: every JS file parses; no duplicate top-level functions.
// Rule coverage: BUG-01/02/03 class cannot regress.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { jsFiles } from '../helpers/repo.js';

const files = jsFiles();

test('file inventory is non-empty (guard against walker misconfig)', () => {
  assert.ok(files.length >= 15, `expected >=15 js files, got ${files.length}`);
});

for (const f of files) {
  test(`parses: ${f}`, () => {
    const tmp = join(tmpdir(), `t-${process.pid}-${Buffer.from(f).toString('hex').slice(0, 16)}.mjs`);
    writeFileSync(tmp, readFileSync(f));
    try {
      execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
    } catch (e) {
      const msg = (e.stderr || e.stdout || '').toString().split('\n')[0];
      assert.fail(`${f}: ${msg}`);
    } finally {
      try { unlinkSync(tmp); } catch {}
    }
  });
}

test('no duplicate top-level function declarations', () => {
  const dups = [];
  for (const f of files) {
    const seen = new Map();
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      const m = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(line);
      if (!m) return;
      if (seen.has(m[1])) dups.push(`${f}:${i + 1} dup '${m[1]}' (first line ${seen.get(m[1])})`);
      else seen.set(m[1], i + 1);
    });
  }
  assert.deepEqual(dups, []);
});
