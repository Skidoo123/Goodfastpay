// Unit tests: api/_lib/auth.js pre-client paths (no network).
// Rule coverage: missing/invalid bearer handling without touching providers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authenticate, requireAdmin } from '../../api/_lib/auth.js';

test('authenticate: missing token → 401 AUTH_MISSING', async () => {
  const r = await authenticate({ headers: {} });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
  assert.equal(r.code, 'AUTH_MISSING');
});

test('authenticate: non-Bearer header ignored → 401', async () => {
  const r = await authenticate({ headers: { authorization: 'Basic abc' } });
  assert.equal(r.ok, false);
  assert.equal(r.code, 'AUTH_MISSING');
});

test('requireAdmin: missing token → 401 (never reaches role lookup)', async () => {
  const r = await requireAdmin({ headers: {} });
  assert.equal(r.ok, false);
  assert.equal(r.status, 401);
});
