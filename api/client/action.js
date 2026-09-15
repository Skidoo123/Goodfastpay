import { authenticate } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { applyLedger, LedgerError } from '../_lib/ledger.js';
import { applyCors, fail, ok, readBody, methodGuard } from '../_lib/http.js';
import { money, str, pick, newReferenceId } from '../_lib/validate.js';

/* ---------------- action handlers (server is authority on all amounts) ---------------- */

async function createSubmission(user, payload) {
  // Accept both canonical fields and the legacy nested { sub } shape.
  const src = payload.sub ?? payload;
  const cardType = str(src.cardType ?? src.brand, { name: 'cardType', max: 60 });
  const cardCode = str(src.cardCode ?? src.code, { name: 'cardCode', max: 200 });
  const declaredValue = money(src.declaredValue ?? src.cardValue);
  const currency = src.currency === 'USD' ? 'USD' : 'NGN';

  const { data, error } = await supabaseAdmin()
    .from('submissions')
    .insert({
      user_id: user.id,
      user_email: user.email,
      brand: cardType,
      card_code: cardCode,
      card_value: declaredValue,
      currency,
      status: 'PENDING',
    })
    .select('id, status, created_at')
    .single();

  if (error) throw new Error(error.message);
  // NOTE: no balance movement here. Credit happens ONLY on admin approval.
  return { submission: data };
}

async function requestWithdrawal(user, payload) {
  // Accept both canonical fields and the legacy nested { wd } shape.
  const w = payload.wd ?? payload;
  const amount = money(w.amount);
  if (amount < 500) throw Object.assign(new Error('Minimum withdrawal is 500'), { httpStatus: 400 });
  const fee = 50;
  const total = Math.round((amount + fee) * 100) / 100;

  const bankName = str(w.bankName, { name: 'bankName', max: 80 });
  const accountNumber = str(w.accountNumber, { name: 'accountNumber', max: 20 });
  const accountHolder = (w.accountHolderName ?? w.accountHolder)
    ? str(w.accountHolderName ?? w.accountHolder, { name: 'accountHolderName', max: 120 })
    : null;

  const referenceId = newReferenceId('wd');

  const { data: wd, error: wdErr } = await supabaseAdmin()
    .from('withdrawals')
    .insert({
      id: undefined,
      user_id: user.id,
      user_email: user.email,
      amount: total,
      fee,
      net_payout: amount,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder_name: accountHolder || user.email,
      status: 'PENDING',
    })
    .select('id, status')
    .single();

  if (wdErr) throw new Error(wdErr.message);

  // Hold funds immediately — server decides the amount, not the client.
  try {
    await applyLedger({
      userId: user.id,
      currency: 'NGN',
      direction: 'DEBIT',
      amount: total,
      entryType: 'WITHDRAWAL_HOLD',
      referenceId,
      metadata: { withdrawal_id: wd.id },
    });
  } catch (e) {
    // Roll the request back so the user isn't left with a phantom withdrawal.
    await supabaseAdmin().from('withdrawals').delete().eq('id', wd.id);
    throw e;
  }

  return { withdrawal: wd };
}

async function updateProfile(user, payload) {
  // Strict allowlist. Balances, role, and id are NOT client-writable.
  const allowed = pick(payload.updates ?? payload, ['name', 'phone', 'avatar_url']);
  if (Object.keys(allowed).length === 0) {
    throw Object.assign(new Error('No updatable fields supplied'), { httpStatus: 400 });
  }
  if (allowed.name !== undefined) allowed.name = str(allowed.name, { name: 'name', max: 120 });
  if (allowed.phone !== undefined) allowed.phone = str(allowed.phone, { name: 'phone', max: 32 });

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .update(allowed)
    .eq('id', user.id)
    .select('id, name, phone, avatar_url')
    .single();

  if (error) throw new Error(error.message);
  return { profile: data };
}

async function saveBank(user, payload) {
  const bankData = payload.bankData ?? payload;
  const bankName = str(bankData.bankName, { name: 'bankName', max: 80 });
  const accountNumber = str(bankData.accountNumber, { name: 'accountNumber', max: 20 });
  const holder = str(bankData.accountHolderName ?? bankData.accountHolder ?? user.email, { name: 'accountHolderName', max: 120 });

  const { data, error } = await supabaseAdmin()
    .from('bank_accounts')
    .insert([{
      user_id: user.id,
      user_email: user.email,
      bank_name: bankName,
      account_number: accountNumber,
      account_holder_name: holder,
      is_primary: true,
    }])
    .select();

  if (error) throw new Error(error.message);
  return { bankAccounts: data };
}

async function logSecurityEvent(user, payload, req) {
  const event = str(payload.event, { name: 'event', max: 120 });
  const details = payload.details ? str(payload.details, { name: 'details', max: 500 }) : null;
  // IP + user agent are server-derived, never trusted from the client.
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = fwd || req.socket?.remoteAddress || '127.0.0.1';
  const ua = (req.headers['user-agent'] || 'Web Browser').slice(0, 300);
  const db = supabaseAdmin();

  await db.from('security_logs').insert([{
    user_id: user.id,
    user_email: user.email,
    event,
    ip_address: ip,
    user_agent: ua,
  }]);
  await db.from('audit_trail').insert([{
    operator_email: user.email,
    event,
    details: details || `Device: ${ua} | IP: ${ip}`,
  }]);
  return { logged: true };
}

async function deleteBank(user, payload) {
  const id = payload.bankAccountId ?? payload.id;
  const db = supabaseAdmin();
  // Owner-scoped: delete by id AND user id. RLS lockdown enforces the same.
  let q = db.from('bank_accounts').delete().eq('user_id', user.id);
  q = id ? q.eq('id', id) : q;
  const { error } = await q;
  if (error) throw new Error(error.message);
  return { deleted: true };
}

/* ---------------- router ---------------- */

const HANDLERS = {
  // New canonical names + legacy aliases from the old frontend
  create_submission: createSubmission,
  submit_card: createSubmission,
  request_withdrawal: requestWithdrawal,
  update_profile: updateProfile,
  save_bank: saveBank,
  delete_bank: deleteBank,
  log_security_event: logSecurityEvent,
};

export default async function handler(req, res) {
  applyCors(req, res);
  if (!methodGuard(req, res, ['POST'])) return;

  const auth = await authenticate(req);
  if (!auth.ok) return fail(res, auth.status, auth.code, auth.message);

  let body;
  try { body = readBody(req); }
  catch (e) { return fail(res, 400, 'BAD_JSON', e.message); }

  const action = body?.action;
  const payload = body?.payload ?? {};

  if (typeof action !== 'string' || !HANDLERS[action]) {
    return fail(res, 400, 'UNKNOWN_ACTION', `Unsupported action: ${String(action)}`);
  }

  try {
    const result = await HANDLERS[action](auth.user, payload, req);
    return ok(res, { action, ...result });
  } catch (err) {
    if (err instanceof LedgerError) {
      const status = err.code === 'INSUFFICIENT_FUNDS' ? 409 : 400;
      return fail(res, status, err.code, err.message);
    }
    const status = err.httpStatus || 500;
    if (status >= 500) console.error('[client/action]', action, err);
    return fail(res, status, 'ACTION_FAILED', status >= 500 ? 'Internal error' : err.message);
  }
}
