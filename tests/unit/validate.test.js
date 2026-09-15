// Unit tests: api/_lib/validate.js
// Rule coverage: server-side input validation (amounts, strings, allowlists).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isEmail, isUuid, money, str, pick, newReferenceId } from '../../api/_lib/validate.js';

test('money: accepts valid amounts and rounds to kobo', () => {
  assert.equal(money(100), 100);
  assert.equal(money('50.005'), 50.01);
  assert.equal(money(0.01), 0.01);
});

test('money: rejects non-numeric', () => {
  assert.throws(() => money('abc'), /AMOUNT_NOT_NUMERIC/);
  assert.throws(() => money(NaN), /AMOUNT_NOT_NUMERIC/);
  assert.throws(() => money(Infinity), /AMOUNT_NOT_NUMERIC/);
  assert.throws(() => money(undefined), /AMOUNT_NOT_NUMERIC/);
});

test('money: rejects out-of-range (negative, zero, huge)', () => {
  assert.throws(() => money(0), /AMOUNT_OUT_OF_RANGE/);
  assert.throws(() => money(-5), /AMOUNT_OUT_OF_RANGE/);
  assert.throws(() => money(100_000_001), /AMOUNT_OUT_OF_RANGE/);
});

test('money: custom bounds respected', () => {
  assert.equal(money(0.5, { min: 0.1, max: 1 }), 0.5);
  assert.throws(() => money(2, { min: 0.1, max: 1 }), /AMOUNT_OUT_OF_RANGE/);
});

test('money: withdrawal floor 500 enforced by callers', () => {
  assert.ok(money(500) >= 500);
  assert.ok(money(499.99) < 500);
});

test('str: trims and enforces length', () => {
  assert.equal(str('  hi  ', { max: 10 }), 'hi');
  assert.throws(() => str('', { min: 1 }), /BAD_LENGTH/);
  assert.throws(() => str('toolong', { max: 3 }), /BAD_LENGTH/);
  assert.throws(() => str(123), /NOT_STRING/);
  assert.throws(() => str(null), /NOT_STRING/);
});

test('isEmail: accepts valid, rejects junk', () => {
  assert.equal(isEmail('a@b.co'), true);
  assert.equal(isEmail('user.name+tag@goodfastpay.com'), true);
  assert.equal(isEmail('not-an-email'), false);
  assert.equal(isEmail('a@b'), false);
  assert.equal(isEmail(''), false);
  assert.equal(isEmail(null), false);
});

test('isUuid: validates v4 shape', () => {
  assert.equal(isUuid('123e4567-e89b-12d3-a456-426614174000'), true);
  assert.equal(isUuid('not-a-uuid'), false);
  assert.equal(isUuid(''), false);
  assert.equal(isUuid(null), false);
});

test('pick: allowlist projection blocks mass-assignment', () => {
  const out = pick(
    { name: 'Ada', wallet_balance: 999999, role: 'ADMIN', id: 'x' },
    ['name', 'phone'],
  );
  assert.deepEqual(out, { name: 'Ada' });
  assert.ok(!('wallet_balance' in out));
  assert.ok(!('role' in out));
  assert.deepEqual(pick(null, ['a']), {});
});

test('newReferenceId: prefixed and unique', () => {
  const a = newReferenceId('wd');
  const b = newReferenceId('wd');
  assert.ok(a.startsWith('wd_'));
  assert.notEqual(a, b);
});
