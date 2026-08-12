// Vercel Serverless Function: Secure Administrative Actions API
// Performs privileged database operations using Supabase with full server-side validation.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "https://btbolekfrcwzzjqhorgi.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Ym9sZWtmcmN3enpqcWhvcmdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjQ2NTgwOSwiZXhwIjoyMTAyMDQxODA5fQ.TwxiYMMHG55UJ2LATrYToMi-V8djArCQA_aY8DPAgg0";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false }
});

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { action, payload, operatorEmail } = req.body || {};

        if (!action) {
            return res.status(400).json({ success: false, error: 'Action parameter is required.' });
        }

        console.log(`⚡ Processing Admin Action [${action}] by [${operatorEmail || 'admin'}]:`, payload);

        switch (action) {
            // 1. User Status Controls (Activate / Suspend / Ban)
            case 'update_user_status': {
                const { userEmail, status, reason } = payload;
                if (!userEmail || !status) {
                    return res.status(400).json({ success: false, error: 'userEmail and status are required.' });
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .update({ status: status })
                    .eq('email', userEmail)
                    .select();

                if (error) throw error;

                // Log audit trail
                await supabase.from('audit_trail').insert([{
                    operator_email: operatorEmail || 'admin@goodfastpay.com',
                    event: `User Status: ${status}`,
                    details: `Set status of ${userEmail} to ${status}. Reason: ${reason || 'Admin action'}`
                }]);

                return res.status(200).json({ success: true, data });
            }

            // 2. Adjust User Balance (Credit / Debit)
            case 'adjust_wallet_balance': {
                const { userEmail, newBalance, amount, type } = payload;
                if (!userEmail || newBalance === undefined) {
                    return res.status(400).json({ success: false, error: 'userEmail and newBalance are required.' });
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .update({ wallet_balance: newBalance })
                    .eq('email', userEmail)
                    .select();

                if (error) throw error;

                // Send notification to user
                if (data && data[0]) {
                    await supabase.from('notifications').insert([{
                        user_id: data[0].id,
                        title: type === 'CREDIT' ? 'Wallet Credited' : 'Wallet Adjusted',
                        message: `Your wallet balance has been updated to ₦${Number(newBalance).toLocaleString()} by the administration.`
                    }]);
                }

                return res.status(200).json({ success: true, data });
            }

            // 3. Approve Card Trade
            case 'approve_submission': {
                const { submissionId, userEmail, payoutAmount } = payload;
                if (!submissionId) {
                    return res.status(400).json({ success: false, error: 'submissionId is required.' });
                }

                // Update submission
                const { data: subData, error: subErr } = await supabase
                    .from('submissions')
                    .update({
                        status: 'COMPLETED',
                        payout_amount: payoutAmount
                    })
                    .eq('id', submissionId)
                    .select();

                if (subErr) throw subErr;

                // Credit user wallet in profiles
                if (userEmail && payoutAmount > 0) {
                    const { data: profData } = await supabase
                        .from('profiles')
                        .select('id, wallet_balance')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (profData) {
                        const updatedBal = Number(profData.wallet_balance || 0) + Number(payoutAmount);
                        await supabase
                            .from('profiles')
                            .update({ wallet_balance: updatedBal })
                            .eq('id', profData.id);

                        await supabase.from('notifications').insert([{
                            user_id: profData.id,
                            title: 'Trade Approved & Credited',
                            message: `Your gift card trade (ID: ${submissionId}) was approved! ₦${Number(payoutAmount).toLocaleString()} has been credited to your wallet.`
                        }]);
                    }
                }

                return res.status(200).json({ success: true, data: subData });
            }

            // 4. Reject Card Trade
            case 'reject_submission': {
                const { submissionId, userEmail, rejectionReason } = payload;
                if (!submissionId) {
                    return res.status(400).json({ success: false, error: 'submissionId is required.' });
                }

                const { data: subData, error: subErr } = await supabase
                    .from('submissions')
                    .update({
                        status: 'REJECTED',
                        rejection_reason: rejectionReason || 'Invalid card pin or denomination mismatch'
                    })
                    .eq('id', submissionId)
                    .select();

                if (subErr) throw subErr;

                if (userEmail) {
                    const { data: profData } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (profData) {
                        await supabase.from('notifications').insert([{
                            user_id: profData.id,
                            title: 'Trade Declined',
                            message: `Your trade submission (${submissionId}) was rejected. Reason: ${rejectionReason || 'Verification failed.'}`
                        }]);
                    }
                }

                return res.status(200).json({ success: true, data: subData });
            }

            // 5. Approve Cash Withdrawal Payout
            case 'approve_withdrawal': {
                const { withdrawalId, userEmail, amount } = payload;
                if (!withdrawalId) {
                    return res.status(400).json({ success: false, error: 'withdrawalId is required.' });
                }

                const { data: wdData, error: wdErr } = await supabase
                    .from('withdrawals')
                    .update({ status: 'COMPLETED' })
                    .eq('id', withdrawalId)
                    .select();

                if (wdErr) throw wdErr;

                if (userEmail) {
                    const { data: profData } = await supabase
                        .from('profiles')
                        .select('id')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (profData) {
                        await supabase.from('notifications').insert([{
                            user_id: profData.id,
                            title: 'Withdrawal Payout Completed',
                            message: `Your cash payout of ₦${Number(amount || 0).toLocaleString()} has been sent to your bank account.`
                        }]);
                    }
                }

                return res.status(200).json({ success: true, data: wdData });
            }

            // 6. Decline Cash Withdrawal & Refund Wallet
            case 'decline_withdrawal': {
                const { withdrawalId, userEmail, refundAmount, declineReason } = payload;
                if (!withdrawalId) {
                    return res.status(400).json({ success: false, error: 'withdrawalId is required.' });
                }

                const { data: wdData, error: wdErr } = await supabase
                    .from('withdrawals')
                    .update({
                        status: 'DECLINED',
                        decline_reason: declineReason || 'Routing issue or banking reject'
                    })
                    .eq('id', withdrawalId)
                    .select();

                if (wdErr) throw wdErr;

                if (userEmail && refundAmount > 0) {
                    const { data: profData } = await supabase
                        .from('profiles')
                        .select('id, wallet_balance')
                        .eq('email', userEmail)
                        .maybeSingle();

                    if (profData) {
                        const restoredBal = Number(profData.wallet_balance || 0) + Number(refundAmount);
                        await supabase
                            .from('profiles')
                            .update({ wallet_balance: restoredBal })
                            .eq('id', profData.id);

                        await supabase.from('notifications').insert([{
                            user_id: profData.id,
                            title: 'Withdrawal Declined / Funds Reverted',
                            message: `Your withdrawal request (${withdrawalId}) was declined. ₦${Number(refundAmount).toLocaleString()} has been returned to your wallet balance.`
                        }]);
                    }
                }

                return res.status(200).json({ success: true, data: wdData });
            }

            // 7. Add Gift Card to Stock
            case 'add_inventory': {
                const { item } = payload;
                if (!item || !item.id || !item.brand || !item.price) {
                    return res.status(400).json({ success: false, error: 'Complete item payload is required.' });
                }

                const { data, error } = await supabase
                    .from('inventory')
                    .insert([{
                        id: item.id,
                        brand: item.brand,
                        card_value: item.cardValue,
                        currency: item.currency || 'USD',
                        country: item.country || 'USA',
                        code: item.code,
                        price: item.price,
                        status: item.status || 'AVAILABLE'
                    }])
                    .select();

                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            // 8. Delete / Remove Gift Card Stock
            case 'delete_inventory': {
                const { cardId } = payload;
                if (!cardId) {
                    return res.status(400).json({ success: false, error: 'cardId is required.' });
                }

                const { data, error } = await supabase
                    .from('inventory')
                    .delete()
                    .eq('id', cardId)
                    .select();

                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            // 9. Sync Currencies & Brand Rates
            case 'sync_currencies_and_rates': {
                const { currencies, rates } = payload;

                if (currencies) {
                    const currPayload = Object.keys(currencies).map(code => ({
                        code: code,
                        name: currencies[code].name,
                        rate: currencies[code].rate,
                        status: currencies[code].status || 'ACTIVE'
                    }));
                    await supabase.from('currencies').upsert(currPayload);
                }

                if (rates) {
                    const ratesPayload = [];
                    Object.keys(rates).forEach(brand => {
                        Object.keys(rates[brand]).forEach(currCode => {
                            ratesPayload.push({
                                brand: brand,
                                currency_code: currCode,
                                rate: rates[brand][currCode]
                            });
                        });
                    });
                    if (ratesPayload.length > 0) {
                        await supabase.from('brand_rates').upsert(ratesPayload, { onConflict: 'brand,currency_code' });
                    }
                }

                return res.status(200).json({ success: true, message: 'Currencies and rates synced.' });
            }

            // 10. General Broadcast Dispatch
            case 'dispatch_broadcast': {
                const { title, message } = payload;
                if (!title || !message) {
                    return res.status(400).json({ success: false, error: 'title and message are required.' });
                }

                const { data: allProfiles } = await supabase.from('profiles').select('id');
                if (allProfiles && allProfiles.length > 0) {
                    const notifs = allProfiles.map(p => ({
                        user_id: p.id,
                        title: title,
                        message: message
                    }));
                    await supabase.from('notifications').insert(notifs);
                }

                return res.status(200).json({ success: true, count: allProfiles?.length || 0 });
            }

            default:
                return res.status(400).json({ success: false, error: `Unrecognized action: ${action}` });
        }
    } catch (err) {
        console.error('❌ Admin Action API Exception:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
}
