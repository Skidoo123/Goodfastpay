// Static tests: frontend↔API action parity + config allowlist agreement.
// Rule coverage: no dead server calls, no unhandled client actions.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/repo.js';

function definedHandlers(apiFile) {
  const src = readFileSync(join(ROOT, apiFile), 'utf8');
  const inHandlers = src.slice(src.indexOf('const HANDLERS'));
  return [...inHandlers.matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]);
}

function calledActions() {
  const out = new Set();
  for (const f of readdirSync(join(ROOT, 'js'))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(join(ROOT, 'js', f), 'utf8');
    for (const m of src.matchAll(/call(?:Client|Admin)Api\('([a-z_]+)'/g)) out.add(m[1]);
  }
  return [...out];
}

test('every frontend-called action has a server handler', () => {
  const served = new Set([
    ...definedHandlers('api/client/action.js'),
    ...definedHandlers('api/admin/action.js'),
  ]);
  const missing = calledActions().filter((a) => !served.has(a));
  assert.deepEqual(missing, []);
});

test('server actions are registered in audit.config.json', () => {
  const cfg = JSON.parse(readFileSync(join(ROOT, 'audit/config/audit.config.json'), 'utf8'));
  const served = new Set([
    ...definedHandlers('api/client/action.js'),
    ...definedHandlers('api/admin/action.js'),
  ]);
  const listed = new Set([...cfg.server_actions.client, ...cfg.server_actions.admin]);
  const unlisted = [...served].filter((a) => !listed.has(a));
  assert.deepEqual(unlisted, []);
});
