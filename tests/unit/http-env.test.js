// Unit tests: api/_lib/http.js + env.js
// Rule coverage: CORS allowlist, method guards, body parsing, error shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCors, ok, fail, readBody, methodGuard } from '../../api/_lib/http.js';
import { requireEnv, optionalEnv, allowedOrigins } from '../../api/_lib/env.js';

function mockRes() {
  const headers = {};
  return {
    headers,
    statusCode: null,
    payload: null,
    ended: false,
    setHeader(k, v) { headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(p) { this.payload = p; return this; },
    end() { this.ended = true; },
  };
}

test('methodGuard: allows POST, short-circuits OPTIONS', () => {
  const res = mockRes();
  assert.equal(methodGuard({ method: 'POST', headers: {} }, res), true);
  const res2 = mockRes();
  assert.equal(methodGuard({ method: 'OPTIONS', headers: {} }, res2), false);
  assert.equal(res2.statusCode, 204);
});

test('methodGuard: rejects GET with 405 + Allow header', () => {
  const res = mockRes();
  assert.equal(methodGuard({ method: 'GET', headers: {} }, res), false);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'POST');
  assert.equal(res.payload.ok, false);
});

test('readBody: object passthrough, string parse, malformed throws', () => {
  assert.deepEqual(readBody({ body: { a: 1 } }), { a: 1 });
  assert.deepEqual(readBody({ body: '{"a":1}' }), { a: 1 });
  assert.deepEqual(readBody({}), {});
  assert.throws(() => readBody({ body: '{oops' }), /Malformed JSON/);
});

test('ok/fail: envelope shape', () => {
  const r1 = mockRes();
  ok(r1, { action: 'x' });
  assert.equal(r1.statusCode, 200);
  assert.deepEqual(r1.payload, { ok: true, action: 'x' });

  const r2 = mockRes();
  fail(r2, 403, 'FORBIDDEN', 'nope');
  assert.equal(r2.statusCode, 403);
  assert.deepEqual(r2.payload, { ok: false, error: { code: 'FORBIDDEN', message: 'nope' } });
});

test('applyCors: allowlisted origin echoed, others not, wildcard never', () => {
  process.env.ALLOWED_ORIGINS = 'https://goodfastpay.com, https://www.goodfastpay.com';
  const good = mockRes();
  applyCors({ headers: { origin: 'https://goodfastpay.com' } }, good);
  assert.equal(good.headers['Access-Control-Allow-Origin'], 'https://goodfastpay.com');

  const evil = mockRes();
  applyCors({ headers: { origin: 'https://evil.com' } }, evil);
  assert.ok(!('Access-Control-Allow-Origin' in evil.headers));
  assert.notEqual(evil.headers['Access-Control-Allow-Origin'], '*');
  delete process.env.ALLOWED_ORIGINS;
});

test('requireEnv: returns value, throws when missing/blank', () => {
  process.env.GFP_TEST_VAR = 'yes';
  assert.equal(requireEnv('GFP_TEST_VAR'), 'yes');
  delete process.env.GFP_TEST_VAR;
  assert.throws(() => requireEnv('GFP_TEST_VAR'), /Missing required environment variable/);
  process.env.GFP_TEST_VAR = '   ';
  assert.throws(() => requireEnv('GFP_TEST_VAR'), /Missing required/);
  delete process.env.GFP_TEST_VAR;
});

test('optionalEnv + allowedOrigins parsing', () => {
  assert.equal(optionalEnv('GFP_NOPE', 'fb'), 'fb');
  process.env.ALLOWED_ORIGINS = ' https://a.com,,https://b.com ';
  assert.deepEqual(allowedOrigins(), ['https://a.com', 'https://b.com']);
  delete process.env.ALLOWED_ORIGINS;
  assert.deepEqual(allowedOrigins(), []);
});
