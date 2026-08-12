// Vercel Serverless Function: Client Trade & Withdrawal Sync API
// Ensures customer submissions, withdrawals, and bank accounts are reliably committed to Supabase.

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
        const { action, payload, userEmail } = req.body || {};

        if (!action) {
            return res.status(400).json({ success: false, error: 'Action parameter is required.' });
        }

        const cleanEmail = (userEmail || 'user@goodfastpay.com').trim().toLowerCase();

        // Ensure user profile exists in public.profiles
        const { data: existingUser } = await supabase
            .from('profiles')
            .select('id, email, wallet_balance')
            .eq('email', cleanEmail)
            .maybeSingle();

        let profileId = existingUser?.id;

        if (!profileId) {
            const { data: newProfile, error: profErr } = await supabase
                .from('profiles')
                .upsert([{
                    email: cleanEmail,
                    name: cleanEmail.split('@')[0],
                    role: cleanEmail === 'admin@goodfastpay.com' ? 'ADMIN' : 'USER',
                    status: 'ACTIVE'
                }], { onConflict: 'email' })
                .select();
            if (newProfile && newProfile[0]) {
                profileId = newProfile[0].id;
            }
        }

        switch (action) {
            case 'submit_card': {
                const { sub } = payload;
                if (!sub || !sub.id || !sub.brand || !sub.cardValue) {
                    return res.status(400).json({ success: false, error: 'Complete submission data is required.' });
                }

                const subRow = {
                    id: sub.id,
                    user_email: cleanEmail,
                    user_id: profileId || null,
                    brand: sub.brand,
                    card_value: sub.cardValue,
                    currency: sub.currency || 'USD',
                    card_code: sub.cardCode || sub.code || 'CODE',
                    front_image_url: sub.frontImageUrl || sub.frontImage || null,
                    back_image_url: sub.backImageUrl || sub.backImage || null,
                    status: sub.status || 'PENDING',
                    payout_amount: sub.payoutAmount || null
                };

                const { data, error } = await supabase
                    .from('submissions')
                    .upsert([subRow], { onConflict: 'id' })
                    .select();

                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            case 'request_withdrawal': {
                const { wd } = payload;
                if (!wd || !wd.id || !wd.amount) {
                    return res.status(400).json({ success: false, error: 'Complete withdrawal data is required.' });
                }

                const wdRow = {
                    id: wd.id,
                    user_email: cleanEmail,
                    user_id: profileId || null,
                    amount: wd.amount,
                    fee: wd.fee || 50,
                    net_payout: wd.netPayout || (wd.amount - 50),
                    bank_name: wd.bankName,
                    account_number: wd.accountNumber,
                    account_holder_name: wd.accountHolderName || wd.accountHolder || 'Customer',
                    status: wd.status || 'PENDING'
                };

                const { data, error } = await supabase
                    .from('withdrawals')
                    .upsert([wdRow], { onConflict: 'id' })
                    .select();

                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            case 'purchase_card': {
                const { cardId, newBalance } = payload;
                if (!cardId) {
                    return res.status(400).json({ success: false, error: 'cardId is required.' });
                }

                // Mark inventory as SOLD
                await supabase
                    .from('inventory')
                    .update({
                        status: 'SOLD',
                        purchased_by: cleanEmail,
                        purchased_at: new Date().toISOString()
                    })
                    .eq('id', cardId);

                // Update user wallet balance
                if (newBalance !== undefined) {
                    await supabase
                        .from('profiles')
                        .update({ wallet_balance: newBalance })
                        .eq('email', cleanEmail);
                }

                return res.status(200).json({ success: true });
            }

            case 'save_bank': {
                const { bankData } = payload;
                if (!bankData || !bankData.bankName || !bankData.accountNumber) {
                    return res.status(400).json({ success: false, error: 'bankData is required.' });
                }

                const { data, error } = await supabase
                    .from('bank_accounts')
                    .insert([{
                        user_email: cleanEmail,
                        user_id: profileId || null,
                        bank_name: bankData.bankName,
                        account_number: bankData.accountNumber,
                        account_holder_name: bankData.accountHolderName,
                        is_primary: true
                    }])
                    .select();

                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            case 'update_profile': {
                const { updates } = payload;
                const updatePayload = {};
                if (updates.name !== undefined) updatePayload.name = updates.name;
                if (updates.phone !== undefined) updatePayload.phone = updates.phone;
                if (updates.transactionPin !== undefined) updatePayload.transaction_pin = updates.transactionPin;
                if (updates.wallet && updates.wallet.balance !== undefined) {
                    updatePayload.wallet_balance = updates.wallet.balance;
                }

                const { data, error } = await supabase
                    .from('profiles')
                    .update(updatePayload)
                    .eq('email', cleanEmail)
                    .select();

                if (error) throw error;
                return res.status(200).json({ success: true, data });
            }

            case 'log_security_event': {
                const { event, ip, userAgent, details } = payload;
                if (!event) {
                    return res.status(400).json({ success: false, error: 'Event name is required.' });
                }

                const clientIp = ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
                const clientUa = userAgent || req.headers['user-agent'] || 'Web Browser';

                // Insert into public.security_logs
                await supabase.from('security_logs').insert([{
                    user_id: profileId || null,
                    user_email: cleanEmail,
                    event: event,
                    ip_address: clientIp,
                    user_agent: clientUa
                }]);

                // Insert into public.audit_trail
                await supabase.from('audit_trail').insert([{
                    operator_email: cleanEmail,
                    event: event,
                    details: details || `Device: ${clientUa} | IP: ${clientIp}`
                }]);

                return res.status(200).json({ success: true });
            }

            default:
                return res.status(400).json({ success: false, error: `Unrecognized action: ${action}` });
        }
    } catch (err) {
        console.error('❌ Client Action API Exception:', err);
        return res.status(500).json({ success: false, error: err.message || 'Internal Server Error' });
    }
}
