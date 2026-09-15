// Unit tests: api/_lib/ledger.js (supabaseAdmin stubbed — no network, no keys).
// Rule coverage: single ledger path, RPC param mapping, error mapping.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { applyLedger, LedgerError } from '../../api/_lib/ledger.js';
import { rpcCalls, __setResult, __reset } from '../helpers/stub-supabaseAdmin.mjs';

beforeEach(() => __reset());

test('applyLedger: calls apply_ledger_entry with mapped params', async () => {
  await applyLedger({
    userId: 'u-1', currency: 'NGN', direction: 'DEBIT', amount: 50000,
    entryType: 'WITHDRAWAL_HOLD', referenceId: 'wd_1', metadata: { w: 1 },
  });
  assert.equal(rpcCalls.length, 1);
  assert.deepEqual(rpcCalls[0], {
    fn: 'apply_ledger_entry',
    params: {
      p_user_id: 'u-1',
      p_currency: 'NGN',
      p_direction: 'DEBIT',
      p_amount: 50000,
      p_entry_type: 'WITHDRAWAL_HOLD',
      p_reference_id: 'wd_1',
      p_metadata: { w: 1 },
    },
  });
});

test('applyLedger: defaults metadata to {}', async () => {
  await applyLedger({
    userId: 'u-1', currency: 'USD', direction: 'CREDIT', amount: 5,
    entryType: 'ADMIN_ADJUSTMENT', referenceId: 'adj_1',
  });
  assert.deepEqual(rpcCalls[0].params.p_metadata, {});
});

test('applyLedger: maps INSUFFICIENT_FUNDS to LedgerError 409-class', async () => {
  __setResult({ data: null, error: { message: 'INSUFFICIENT_FUNDS_OR_UNKNOWN_USER' } });
  await assert.rejects(
    applyLedger({ userId: 'u', currency: 'NGN', direction: 'DEBIT', amount: 1, entryType: 'T', referenceId: 'r' }),
    (e) => e instanceof LedgerError && e.code === 'INSUFFICIENT_FUNDS',
  );
});

test('applyLedger: maps AMOUNT_INVALID', async () => {
  __setResult({ data: null, error: { message: 'AMOUNT_INVALID' } });
  await assert.rejects(
    applyLedger({ userId: 'u', currency: 'NGN', direction: 'CREDIT', amount: 0, entryType: 'T', referenceId: 'r' }),
    (e) => e instanceof LedgerError && e.code === 'AMOUNT_INVALID',
  );
});

test('applyLedger: unknown RPC failure becomes LEDGER_FAILED (no leak)', async () => {
  __setResult({ data: null, error: { message: 'connection reset by peer' } });
  await assert.rejects(
    applyLedger({ userId: 'u', currency: 'NGN', direction: 'CREDIT', amount: 1, entryType: 'T', referenceId: 'r' }),
    (e) => e instanceof LedgerError && e.code === 'LEDGER_FAILED',
  );
});

test('applyLedger: returns entry on success', async () => {
  __setResult({ data: { id: 42, balance_after: '500.00' }, error: null });
  const out = await applyLedger({
    userId: 'u', currency: 'NGN', direction: 'CREDIT', amount: 500,
    entryType: 'T', referenceId: 'r',
  });
  assert.equal(out.id, 42);
});
