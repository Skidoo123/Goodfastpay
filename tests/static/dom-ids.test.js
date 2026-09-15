// Static tests: critical DOM IDs resolve; all inline handlers defined.
// Rule coverage: BUG-05 class (ID mismatch) + undefined-handler ReferenceErrors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/repo.js';

const HTML = ['index.html', 'portal.html', 'admin.html'].map((f) =>
  readFileSync(join(ROOT, f), 'utf8'),
);

function htmlIds() {
  const ids = new Set();
  for (const src of HTML) {
    for (const m of src.matchAll(/id="([^"]+)"/g)) ids.add(m[1]);
  }
  return ids;
}

test('sell flow IDs exist in portal.html', () => {
  const ids = htmlIds();
  for (const id of [
    'sell-brand', 'sell-currency', 'sell-value', 'sell-code',
    'sell-img-front', 'sell-img-back', 'card-submission-form',
  ]) {
    assert.ok(ids.has(id), `missing #${id} in portal.html`);
  }
});

test('bank form IDs exist in portal.html', () => {
  const ids = htmlIds();
  for (const id of ['modal-bank-name', 'bank-account-number', 'bank-account-holder']) {
    assert.ok(ids.has(id), `missing #${id} in portal.html`);
  }
});

test('ocr-scanner references only sell-* IDs (no card-* ghosts)', () => {
  const src = readFileSync(join(ROOT, 'js/ocr-scanner.js'), 'utf8');
  for (const ghost of ['card-brand', 'card-currency', 'card-value', 'card-code']) {
    assert.ok(
      !src.includes(`getElementById("${ghost}")`),
      `ocr-scanner still references #${ghost}`,
    );
  }
});

test('every inline handler resolves to a definition (js or inline HTML)', () => {
  const handlers = new Set();
  const pages = [...HTML, readFileSync(join(ROOT, 'js/portal.js'), 'utf8'),
    readFileSync(join(ROOT, 'js/admin.js'), 'utf8'),
    readFileSync(join(ROOT, 'js/app.js'), 'utf8')];
  for (const src of pages) {
    for (const m of src.matchAll(/on(?:click|submit|change|input|focus|blur|keyup|keydown)="([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
      handlers.add(m[1]);
    }
  }
  const defined = new Set();
  for (const f of readdirSync(join(ROOT, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(ROOT, 'js', f), 'utf8');
    for (const m of src.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/gm)) defined.add(m[1]);
  }
  for (const src of HTML) {
    for (const m of src.matchAll(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) defined.add(m[1]);
  }
  const missing = [...handlers].filter((h) => h !== 'if' && !defined.has(h));
  assert.deepEqual(missing, []);
});
