// Static tests: migrations contain what the architecture requires.
// Rule coverage: RLS lockdown, ledger immutability, audit trail, secret removal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/repo.js';

test('complete-supabase-setup.sql exists and mirrors migrations/', () => {
  const full = readFileSync(join(ROOT, 'supabase/complete-supabase-setup.sql'), 'utf8');
  assert.ok(full.includes('supabase/migrations/'), 'references canonical migrations');
  for (const name of [
    'profiles_select_own', 'submissions_admin_update', 'bank_accounts_own',
    'ledger_select_own', 'audit_admin_read', 'apply_ledger_entry',
    'deny_ledger_mutation', 'handle_new_user', 'resolve_user_id_from_email',
  ]) {
    assert.ok(full.includes(name), `setup script contains ${name}`);
  }
  // No seeded users, balances, or live-looking codes (marker on literal line below)
  assert.ok(!full.includes('password123'), 'no seed credentials'); // check-secrets: allow — test data asserting absence
  assert.ok(!full.includes('5000000.00'), 'no seeded balances');
});

const m1 = readFileSync(join(ROOT, 'supabase/migrations/001_lockdown_rls.sql'), 'utf8');
const m2 = readFileSync(join(ROOT, 'supabase/migrations/002_ledger_and_atomic.sql'), 'utf8');
const m3 = readFileSync(join(ROOT, 'supabase/migrations/003_audit_log.sql'), 'utf8');
const m4 = readFileSync(join(ROOT, 'supabase/migrations/004_drop_plaintext_secrets.sql'), 'utf8');

test('001: drops permissive policies and forces RLS everywhere', () => {
  assert.ok(m1.includes('drop policy'), 'drops existing policies');
  assert.ok(m1.includes('force row level security'), 'forces RLS');
  assert.ok(m1.includes('revoke all on all tables'), 'revokes blanket grants');
  const policies = (m1.match(/create policy /g) || []).length;
  assert.ok(policies >= 15, `expected >=15 policies, got ${policies}`);
});

test('001: no open USING(true) outside comments', () => {
  const lines = m1.split('\n').filter((l) => !l.trim().startsWith('--'));
  assert.ok(!lines.some((l) => l.includes('USING (true)')), 'no permissive policy');
});

test('001: profiles update pins role and balances (anti self-promotion)', () => {
  assert.ok(m1.includes('profiles_update_own'), 'update policy exists');
  assert.ok(m1.includes('wallet_balance = (select wallet_balance'), 'balance pinned');
});

test('002: append-only ledger with idempotent atomic RPC', () => {
  assert.ok(m2.includes('ledger_no_update') || m2.includes('deny_ledger_mutation'), 'immutability trigger');
  assert.ok(m2.includes('apply_ledger_entry'), 'RPC defined');
  assert.ok(m2.includes('reference_id = p_reference_id'), 'idempotency lookup');
  assert.ok(m2.includes('INSUFFICIENT_FUNDS'), 'overdraft guard');
  assert.ok(m2.includes('revoke all on function'), 'RPC revoked from public roles');
  assert.ok(m2.includes('grant execute') && m2.includes('service_role'), 'RPC granted to service_role only');
  assert.ok(m2.includes('ledger_idempotency_idx'), 'idempotency unique index');
});

test('003: audit log is admin-read, service-write only', () => {
  assert.ok(m3.includes('admin_audit_log'), 'table defined');
  assert.ok(m3.includes('audit_admin_read'), 'read policy');
  const writes = (m3.match(/for (insert|update|delete)/g) || []).length;
  assert.equal(writes, 0, 'no RLS write policies');
});

test('004: drops plaintext credential columns', () => {
  for (const col of ['password', 'password_hash', 'transaction_pin', 'pin']) {
    assert.ok(m4.includes(`drop column if exists ${col}`), `drops ${col}`);
  }
});
