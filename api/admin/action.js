import { requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { applyLedger, LedgerError } from '../_lib/ledger.js';
import { applyCors, fail, ok, readBody, methodGuard } from '../_lib/http.js';
import { money, str, newReferenceId } from '../_lib/validate.js';

/* ---------------- audit ---------------- */

async function audit(actor, action, target, details, req) {
  await supabaseAdmin().from('audit_trail').insert({
    operator_email: actor.email,
    event: action,
    details: `${target ?? ''} ${details ?? ''}`.trim() || null,
  }).then(
    () => {},
    (e) => console.error('[admin/action] audit write failed', e?.message || e),
  );
  void req;
}

/* ---------------- handlers ---------------- */

async function approveSubmission(actor, payload, req) {
  const submissionId = str(payload.submissionId, { name: 'submissionId', max: 64 });
  const payoutAmount = money(payload.payoutAmount);
  const db = supabaseAdmin();

  // Atomic compare-and-set: only PENDING rows transition.
  const { data: sub, error } = await db
    .from('submissions')
    .update({ status: 'COMPLETED', payout_amount: payoutAmount, processed_by: actor.email })
    .eq('id', submissionId).eq('status', 'PENDING')
    .select('id, user_id, user_email')
    .single();

  if (error || !sub) throw Object.assign(new Error('Submission not found or already processed'), { httpStatus: 409 });

  const userId = sub.user_id;
  if (!userId) throw Object.assign(new Error('Submission has no linked user'), { httpStatus: 422 });

  // Single ledger credit — no read-modify-write on profiles.
  await applyLedger({
    userId,
    currency: 'NGN',
    direction: 'CREDIT',
    amount: payoutAmount,
    entryType: 'CARD_SALE_SETTLE',
    referenceId: `submission_settle_${submissionId}`,
    metadata: { submission_id: submissionId, approved_by: actor.email },
  });

  await db.from('notifications').insert([{
    user_id: userId,
    user_email: sub.user_email,
    title: 'Trade Approved & Credited',
    message: `Your gift card trade (${submissionId}) was approved. Funds credited to your wallet.`,
  }]);

  await audit(actor, 'approve_submission', submissionId, `payout ${payoutAmount}`, req);
  return { submission: sub };
}

async function rejectSubmission(actor, payload, req) {
  const submissionId = str(payload.submissionId, { name: 'submissionId', max: 64 });
  const reason = payload.rejectionReason ?? payload.reason
    ? str(payload.rejectionReason ?? payload.reason, { name: 'reason', max: 300 })
    : 'Verification failed';
  const db = supabaseAdmin();

  const { data: sub, error } = await db
    .from('submissions')
    .update({ status: 'REJECTED', rejection_reason: reason, processed_by: actor.email })
    .eq('id', submissionId).eq('status', 'PENDING')
    .select('id, user_id, user_email')
    .single();

  if (error || !sub) throw Object.assign(new Error('Submission not found or already processed'), { httpStatus: 409 });

  if (sub.user_id) {
    await db.from('notifications').insert([{
      user_id: sub.user_id,
      user_email: sub.user_email,
      title: 'Trade Declined',
      message: `Your trade submission (${submissionId}) was rejected. Reason: ${reason}`,
    }]);
  }

  await audit(actor, 'reject_submission', submissionId, reason, req);
  return { submission: sub };
}

async function approveWithdrawal(actor, payload, req) {
  const withdrawalId = str(payload.withdrawalId, { name: 'withdrawalId', max: 64 });
  const db = supabaseAdmin();

  const { data: wd, error } = await db
    .from('withdrawals')
    .update({ status: 'COMPLETED', processed_by: actor.email })
    .eq('id', withdrawalId).eq('status', 'PENDING')
    .select('id, user_id, user_email, amount')
    .single();

  if (error || !wd) throw Object.assign(new Error('Withdrawal not found or already processed'), { httpStatus: 409 });

  if (wd.user_id) {
    await db.from('notifications').insert([{
      user_id: wd.user_id,
      user_email: wd.user_email,
      title: 'Withdrawal Payout Completed',
      message: `Your cash payout has been sent to your bank account.`,
    }]);
  }

  // Funds were held at request time; approval releases to the provider rail.
  await audit(actor, 'approve_withdrawal', withdrawalId, `amount ${wd.amount}`, req);
  return { withdrawal: wd };
}

async function declineWithdrawal(actor, payload, req) {
  const withdrawalId = str(payload.withdrawalId, { name: 'withdrawalId', max: 64 });
  const reason = payload.declineReason ?? payload.reason
    ? str(payload.declineReason ?? payload.reason, { name: 'reason', max: 300 })
    : 'Routing issue or banking reject';
  const db = supabaseAdmin();

  const { data: wd, error } = await db
    .from('withdrawals')
    .update({ status: 'DECLINED', decline_reason: reason, processed_by: actor.email })
    .eq('id', withdrawalId).eq('status', 'PENDING')
    .select('id, user_id, user_email, amount, fee')
    .single();

  if (error || !wd) throw Object.assign(new Error('Withdrawal not found or already processed'), { httpStatus: 409 });

  // Refund in the SAME currency as the hold (NGN) — fixes the USD-as-NGN bug class.
  if (wd.user_id) {
    await applyLedger({
      userId: wd.user_id,
      currency: 'NGN',
      direction: 'CREDIT',
      amount: Number(wd.amount),
      entryType: 'WITHDRAWAL_REFUND',
      referenceId: `refund_${withdrawalId}`,
      metadata: { withdrawal_id: withdrawalId, reason },
    });

    await db.from('notifications').insert([{
      user_id: wd.user_id,
      user_email: wd.user_email,
      title: 'Withdrawal Declined / Funds Reverted',
      message: `Your withdrawal (${withdrawalId}) was declined. Funds returned to your wallet.`,
    }]);
  }

  await audit(actor, 'decline_withdrawal', withdrawalId, reason, req);
  return { withdrawal: wd };
}

async function adjustWalletBalance(actor, payload, req) {
  const targetEmail = str(payload.userEmail, { name: 'userEmail', max: 200 }).toLowerCase();
  const amount = money(payload.amount);
  const direction = payload.type === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  // Same-currency discipline (FIN-03 class): caller states the currency, server moves it.
  const currency = payload.currency === 'USD' ? 'USD' : 'NGN';
  const reason = payload.reason ? str(payload.reason, { name: 'reason', max: 300 }) : 'admin adjustment';

  const { data: profile, error } = await supabaseAdmin()
    .from('profiles').select('id, email').eq('email', targetEmail).single();
  if (error || !profile) throw Object.assign(new Error('User not found'), { httpStatus: 404 });

  const entry = await applyLedger({
    userId: profile.id,
    currency,
    direction,
    amount,
    entryType: 'ADMIN_ADJUSTMENT',
    referenceId: newReferenceId('adj'),
    metadata: { reason, actor: actor.email },
  });

  await audit(actor, 'adjust_wallet_balance', profile.id, `${direction} ${amount} (${reason})`, req);
  return { entry };
}

async function updateUserStatus(actor, payload, req) {
  const userEmail = str(payload.userEmail, { name: 'userEmail', max: 200 }).toLowerCase();
  const status = str(payload.status, { name: 'status', max: 20 });
  if (!['ACTIVE', 'SUSPENDED', 'BANNED'].includes(status)) {
    throw Object.assign(new Error('Invalid status'), { httpStatus: 400 });
  }
  const reason = payload.reason ? str(payload.reason, { name: 'reason', max: 300 }) : 'admin action';

  const { data, error } = await supabaseAdmin()
    .from('profiles').update({ status }).eq('email', userEmail).select('id, email, status');
  if (error) throw new Error(error.message);

  await audit(actor, 'update_user_status', userEmail, `${status}: ${reason}`, req);
  return { profiles: data };
}

async function addInventory(actor, payload, req) {
  const item = payload.item ?? payload;
  const brand = str(item.brand, { name: 'brand', max: 60 });
  const price = money(item.price);
  const db = supabaseAdmin();

  const { data, error } = await db.from('inventory').insert([{
    ...(item.id ? { id: str(item.id, { name: 'id', max: 32 }) } : {}),
    brand,
    card_value: item.cardValue !== undefined ? money(item.cardValue) : null,
    currency: item.currency || 'USD',
    country: item.country || 'USA',
    code: item.code ? str(item.code, { name: 'code', max: 200 }) : null,
    price,
    status: 'AVAILABLE',
  }]).select();

  if (error) throw new Error(error.message);
  await audit(actor, 'add_inventory', null, `${brand} @ ${price}`, req);
  return { inventory: data };
}

async function deleteInventory(actor, payload, req) {
  const cardId = str(payload.cardId, { name: 'cardId', max: 64 });
  const { data, error } = await supabaseAdmin()
    .from('inventory').delete().eq('id', cardId).select();
  if (error) throw new Error(error.message);
  await audit(actor, 'delete_inventory', cardId, null, req);
  return { inventory: data };
}

async function dispatchBroadcast(actor, payload, req) {
  const title = str(payload.title, { name: 'title', max: 120 });
  const message = str(payload.message, { name: 'message', max: 1000 });
  const db = supabaseAdmin();

  const { data: profiles, error } = await db.from('profiles').select('id, email');
  if (error) throw new Error(error.message);

  if (profiles?.length) {
    const notifs = profiles.map((p) => ({ user_id: p.id, user_email: p.email, title, message }));
    const { error: insErr } = await db.from('notifications').insert(notifs);
    if (insErr) throw new Error(insErr.message);
  }

  await audit(actor, 'dispatch_broadcast', null, `${title} → ${profiles?.length || 0} users`, req);
  return { count: profiles?.length || 0 };
}

async function syncCurrenciesAndRates(actor, payload, req) {
  const db = supabaseAdmin();

  if (payload.currencies && typeof payload.currencies === 'object') {
    const rows = Object.entries(payload.currencies).map(([code, c]) => ({
      code: str(code, { name: 'currencyCode', max: 10 }),
      name: str(c.name, { name: 'currencyName', max: 80 }),
      rate: money(c.rate, { min: 0.0001, max: 1000000 }),
      status: c.status || 'ACTIVE',
    }));
    if (rows.length) {
      const { error } = await db.from('currencies').upsert(rows);
      if (error) throw new Error(error.message);
    }
  }

  if (payload.rates && typeof payload.rates === 'object') {
    const rows = [];
    for (const [brand, perCurr] of Object.entries(payload.rates)) {
      if (!perCurr || typeof perCurr !== 'object') continue;
      for (const [curr, rate] of Object.entries(perCurr)) {
        rows.push({
          brand: str(brand, { name: 'brand', max: 60 }),
          currency_code: str(curr, { name: 'currencyCode', max: 10 }),
          rate: money(rate, { min: 0.0001, max: 1000000 }),
        });
      }
    }
    if (rows.length) {
      const { error } = await db.from('brand_rates').upsert(rows, { onConflict: 'brand,currency_code' });
      if (error) throw new Error(error.message);
    }
  }

  await audit(actor, 'sync_currencies_and_rates', null, null, req);
  return { synced: true };
}

/* ---------------- router ---------------- */

const HANDLERS = {
  approve_submission: approveSubmission,
  reject_submission: rejectSubmission,
  approve_withdrawal: approveWithdrawal,
  decline_withdrawal: declineWithdrawal,
  adjust_wallet_balance: adjustWalletBalance,
  update_user_status: updateUserStatus,
  add_inventory: addInventory,
  delete_inventory: deleteInventory,
  dispatch_broadcast: dispatchBroadcast,
  sync_currencies_and_rates: syncCurrenciesAndRates,
};

export default async function handler(req, res) {
  applyCors(req, res);
  if (!methodGuard(req, res, ['POST'])) return;

  const auth = await requireAdmin(req);
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
    if (err instanceof LedgerError) return fail(res, 400, err.code, err.message);
    const status = err.httpStatus || 500;
    if (status >= 500) console.error('[admin/action]', action, err);
    return fail(res, status, 'ACTION_FAILED', status >= 500 ? 'Internal error' : err.message);
  }
}
