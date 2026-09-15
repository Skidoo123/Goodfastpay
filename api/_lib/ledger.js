import { supabaseAdmin } from './supabaseAdmin.js';

export class LedgerError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/**
 * The ONLY sanctioned way to move a balance. Atomic + idempotent server-side
 * via the apply_ledger_entry RPC (see supabase/migrations/002_ledger_and_atomic.sql).
 */
export async function applyLedger({
  userId, currency, direction, amount, entryType, referenceId, metadata = {},
}) {
  const { data, error } = await supabaseAdmin().rpc('apply_ledger_entry', {
    p_user_id: userId,
    p_currency: currency,
    p_direction: direction,
    p_amount: amount,
    p_entry_type: entryType,
    p_reference_id: referenceId,
    p_metadata: metadata,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_FUNDS')) throw new LedgerError('INSUFFICIENT_FUNDS', 'Insufficient balance');
    if (msg.includes('AMOUNT_INVALID')) throw new LedgerError('AMOUNT_INVALID', 'Amount must be positive');
    throw new LedgerError('LEDGER_FAILED', msg || 'Ledger operation failed');
  }
  return data;
}
