-- ==============================================================================
-- GOODFASTPAY — COMPLETE SUPABASE SETUP (ONE SCRIPT)
-- ==============================================================================
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor → New query → RUN.
-- Supabase SQL Editor does not support psql meta-commands; this file uses none.
--
-- WHAT IT DOES, IN ORDER:
--   0. Extensions
--   1. Base tables (hardened: NO password/PIN columns, zero balances)
--   2. Ledger + audit + PIN-hash tables
--   3. Indexes
--   4. RLS lockdown  (= migrations/001: drops ALL permissive policies,
--      forces RLS, ownership policies, deny-by-default)
--   5. Ledger RPC + immutability (= migrations/002)
--   6. Auth + email-resolution triggers (cleaned: never self-grants ADMIN)
--   7. Realtime publication
--   8. Seeds — currencies ONLY (no users, no inventory codes, no balances)
--   9. Destructive cleanup (= migrations/004, all IF EXISTS, safe on fresh DB)
--  10. Verification SELECTs — every check must return ZERO rows (except R4 note)
--
-- FRESH PROJECT: run everything top to bottom. Safe as-is.
-- LIVE PROJECT with existing tables/password users:
--   a) Back up first. b) Force password resets BEFORE running section 9.
--   c) Sections 1–8 are idempotent (IF NOT EXISTS / OR REPLACE) and safe to
--      re-run; section 9 drops plaintext credential columns permanently.
--
-- Canonical per-phase files live in supabase/migrations/ (001–004). This file
-- mirrors them. If the two ever disagree, the migrations/ directory wins and
-- this file must be regenerated.
-- ==============================================================================

-- ##########################################################################
-- 0. EXTENSIONS
-- ##########################################################################
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ##########################################################################
-- 1. BASE TABLES (hardened — no credential columns by design)
-- ##########################################################################

-- 1.1 User profiles. Passwords live in Supabase Auth, never here.
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BANNED')),
    avatar_url TEXT DEFAULT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    wallet_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0),
    wallet_pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_pending_balance >= 0),
    usd_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (usd_balance >= 0),
    usd_pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (usd_pending_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.2 Linked bank accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    bank_name TEXT NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_holder_name TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.3 Gift card trade submissions (sell)
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY DEFAULT ('GC-' || floor(1000 + random() * 9000)::text),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    brand TEXT NOT NULL,
    card_value NUMERIC(12, 2) NOT NULL CHECK (card_value > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    card_code TEXT NOT NULL,
    front_image_url TEXT,
    back_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
    payout_amount NUMERIC(15, 2) DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    processed_by TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.4 Withdrawal requests (cash out)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id TEXT PRIMARY KEY DEFAULT ('WD-' || floor(1000 + random() * 9000)::text),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 500),
    fee NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    net_payout NUMERIC(15, 2) NOT NULL CHECK (net_payout >= 0),
    bank_name TEXT NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_holder_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'DECLINED')),
    decline_reason TEXT DEFAULT NULL,
    processed_by TEXT DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.5 Inventory / stock ledger (buy gift cards)
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY DEFAULT ('STK-' || floor(1000 + random() * 9000)::text),
    brand TEXT NOT NULL,
    card_value NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    country VARCHAR(50) NOT NULL DEFAULT 'USA',
    code TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL CHECK (price > 0),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'EXPIRED')),
    purchased_by TEXT DEFAULT NULL,
    purchased_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.6 Central currencies registry
CREATE TABLE IF NOT EXISTS public.currencies (
    code VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 Brand-specific exchange rates
CREATE TABLE IF NOT EXISTS public.brand_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    currency_code VARCHAR(10) NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(brand, currency_code)
);

-- 1.8 Support tickets
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY DEFAULT ('TKT-' || floor(10000 + random() * 90000)::text),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'PENDING', 'RESOLVED', 'CLOSED')),
    description TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    assigned_to TEXT DEFAULT 'Support Team',
    user_unread BOOLEAN NOT NULL DEFAULT FALSE,
    admin_unread BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.9 Ticket messages
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('USER', 'ADMIN', 'SYSTEM')),
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.10 Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.11 Security & activity logs
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    ip_address TEXT DEFAULT '127.0.0.1',
    user_agent TEXT DEFAULT 'Web Browser',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.12 Legacy admin audit trail (kept for history; new writes go to admin_audit_log)
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_email TEXT NOT NULL,
    event TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.13 Public rate snapshots (backing table for the public-read policy)
CREATE TABLE IF NOT EXISTS public.rate_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ##########################################################################
-- 2. LEDGER + AUDIT + PIN-HASH TABLES
-- ##########################################################################

-- 2.1 Immutable ledger. Balances are projections over these rows, never columns.
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    currency TEXT NOT NULL CHECK (currency IN ('NGN', 'USD')),
    direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(18, 2) NOT NULL CHECK (amount > 0),
    entry_type TEXT NOT NULL,
    reference_id TEXT NOT NULL,
    balance_after NUMERIC(18, 2) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_idempotency_idx
    ON public.ledger_entries (user_id, entry_type, reference_id);
CREATE INDEX IF NOT EXISTS ledger_user_created_idx
    ON public.ledger_entries (user_id, created_at DESC);

-- 2.2 Admin audit log (append-only, service-role writes)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_id UUID REFERENCES auth.users(id),
    actor_email TEXT,
    action TEXT NOT NULL,
    target TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS admin_audit_actor_idx
    ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_action_idx
    ON public.admin_audit_log (action, created_at DESC);

-- 2.3 Server-verified PIN hashes (hash only — never plaintext, never browser-read)
CREATE TABLE IF NOT EXISTS public.user_pins (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ##########################################################################
-- 3. INDEXES
-- ##########################################################################
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_submissions_user_email ON public.submissions(user_email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_email ON public.withdrawals(user_email);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON public.notifications(user_email, read);

-- ##########################################################################
-- 4. RLS LOCKDOWN (= migrations/001)
-- Kills every permissive policy; ownership RLS; deny-by-default.
-- ##########################################################################

-- 4.0 Drop EVERY existing policy in public (including legacy USING(true) ones)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT schemaname, tablename, policyname
             FROM pg_policies WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                       r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- 4.1 Force RLS on every table
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
        EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.tablename);
    END LOOP;
END $$;

-- 4.2 Revoke blanket grants (policies below grant back scoped access)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 4.3 Admin helper
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM public.profiles
                   WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN'));
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 4.4 profiles
CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_admin());
CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id
        AND role           = (SELECT role           FROM public.profiles WHERE id = auth.uid())
        AND wallet_balance = (SELECT wallet_balance FROM public.profiles WHERE id = auth.uid())
        AND usd_balance    = (SELECT usd_balance    FROM public.profiles WHERE id = auth.uid())
    );
CREATE POLICY profiles_admin_all ON public.profiles
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4.5 submissions / withdrawals
CREATE POLICY submissions_select_own ON public.submissions
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY submissions_insert_own ON public.submissions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY submissions_admin_update ON public.submissions
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY withdrawals_select_own ON public.withdrawals
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY withdrawals_insert_own ON public.withdrawals
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY withdrawals_admin_update ON public.withdrawals
    FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4.6 bank_accounts (strictly private)
CREATE POLICY bank_accounts_own ON public.bank_accounts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4.7 inventory
CREATE POLICY inventory_public_read ON public.inventory
    FOR SELECT TO anon, authenticated USING (status = 'AVAILABLE');
CREATE POLICY inventory_admin_all ON public.inventory
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4.8 tickets + messages
CREATE POLICY tickets_own ON public.tickets
    FOR ALL TO authenticated
    USING (auth.uid() = user_id OR public.is_admin())
    WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY ticket_msgs_own ON public.ticket_messages
    FOR ALL TO authenticated
    USING (public.is_admin() OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()))
    WITH CHECK (public.is_admin() OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_messages.ticket_id AND t.user_id = auth.uid()));

-- 4.9 notifications
CREATE POLICY notifications_select_own ON public.notifications
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY notifications_update_own ON public.notifications
    FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4.10 currencies / brand_rates / rate_snapshots (public read, admin write)
CREATE POLICY currencies_public_read ON public.currencies
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY currencies_admin_all ON public.currencies
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY brand_rates_public_read ON public.brand_rates
    FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY brand_rates_admin_all ON public.brand_rates
    FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY rates_public_read ON public.rate_snapshots
    FOR SELECT TO anon, authenticated USING (true);

-- 4.11 ledger: read-only for owner/admin. NO write policies = append-only.
CREATE POLICY ledger_select_own ON public.ledger_entries
    FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- 4.12 audit log: admin read. NO write policies = service-role only.
CREATE POLICY audit_admin_read ON public.admin_audit_log
    FOR SELECT TO authenticated USING (public.is_admin());

-- NOTE: security_logs, audit_trail, user_pins keep forced RLS with NO policy
-- (deny-all for anon/authenticated; service_role only). Intentional.

-- ##########################################################################
-- 5. LEDGER RPC + IMMUTABILITY (= migrations/002)
-- The ONLY sanctioned way balances move.
-- ##########################################################################

CREATE OR REPLACE FUNCTION public.deny_ledger_mutation() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'LEDGER_APPEND_ONLY: % on ledger_entries is forbidden', TG_OP;
END $$;

DROP TRIGGER IF EXISTS ledger_no_update ON public.ledger_entries;
CREATE TRIGGER ledger_no_update BEFORE UPDATE OR DELETE ON public.ledger_entries
    FOR EACH ROW EXECUTE FUNCTION public.deny_ledger_mutation();

CREATE OR REPLACE FUNCTION public.apply_ledger_entry(
    p_user_id      UUID,
    p_currency     TEXT,
    p_direction    TEXT,
    p_amount       NUMERIC,
    p_entry_type   TEXT,
    p_reference_id TEXT,
    p_metadata     JSONB DEFAULT '{}'::jsonb
) RETURNS public.ledger_entries
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_delta   NUMERIC(18, 2);
    v_row     public.ledger_entries;
    v_balance NUMERIC(18, 2);
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'AMOUNT_INVALID' USING errcode = '22023';
    END IF;
    IF p_currency NOT IN ('NGN', 'USD') THEN
        RAISE EXCEPTION 'CURRENCY_INVALID' USING errcode = '22023';
    END IF;
    IF p_direction NOT IN ('CREDIT', 'DEBIT') THEN
        RAISE EXCEPTION 'DIRECTION_INVALID' USING errcode = '22023';
    END IF;

    -- Idempotency: same (user, type, reference) returns the original entry.
    SELECT * INTO v_row FROM public.ledger_entries
     WHERE user_id = p_user_id
       AND entry_type = p_entry_type
       AND reference_id = p_reference_id;
    IF FOUND THEN
        RETURN v_row;
    END IF;

    v_delta := CASE WHEN p_direction = 'CREDIT' THEN p_amount ELSE -p_amount END;

    -- Single-statement, overdraft-safe update. Row lock held to commit.
    IF p_currency = 'NGN' THEN
        UPDATE public.profiles
           SET wallet_balance = wallet_balance + v_delta,
               updated_at = NOW()
         WHERE id = p_user_id
           AND wallet_balance + v_delta >= 0
        RETURNING wallet_balance INTO v_balance;
    ELSE
        UPDATE public.profiles
           SET usd_balance = usd_balance + v_delta,
               updated_at = NOW()
         WHERE id = p_user_id
           AND usd_balance + v_delta >= 0
        RETURNING usd_balance INTO v_balance;
    END IF;

    IF v_balance IS NULL THEN
        RAISE EXCEPTION 'INSUFFICIENT_FUNDS_OR_UNKNOWN_USER' USING errcode = 'P0001';
    END IF;

    INSERT INTO public.ledger_entries
        (user_id, currency, direction, amount, entry_type, reference_id, balance_after, metadata)
    VALUES
        (p_user_id, p_currency, p_direction, p_amount, p_entry_type, p_reference_id,
         v_balance, COALESCE(p_metadata, '{}'::jsonb))
    RETURNING * INTO v_row;
    RETURN v_row;
END $$;

REVOKE ALL ON FUNCTION public.apply_ledger_entry(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_ledger_entry(UUID, TEXT, TEXT, NUMERIC, TEXT, TEXT, JSONB)
    TO service_role;

-- ##########################################################################
-- 6. AUTH + EMAIL-RESOLUTION TRIGGERS (cleaned: never self-grants ADMIN)
-- ##########################################################################

-- 6.1 Auto-create profile on Supabase Auth signup. Role is ALWAYS USER here;
-- grant the first admin via manual audited SQL:
--   UPDATE public.profiles SET role = 'ADMIN' WHERE email = 'you@goodfastpay.com';
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, status, wallet_balance, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name',
                 split_part(NEW.email, '@', 1)),
        'USER',
        'ACTIVE',
        0.00,
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (email) DO UPDATE SET
        id = EXCLUDED.id,
        -- role intentionally untouched: never demote/promote on re-signup
        name = COALESCE(public.profiles.name, EXCLUDED.name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6.2 Resolve user_id from user_email on insert/update
CREATE OR REPLACE FUNCTION public.resolve_user_id_from_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL AND NEW.user_email IS NOT NULL THEN
        SELECT id INTO NEW.user_id FROM public.profiles WHERE email = NEW.user_email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_resolve_submissions_user_id ON public.submissions;
CREATE TRIGGER tr_resolve_submissions_user_id
    BEFORE INSERT OR UPDATE ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.resolve_user_id_from_email();

DROP TRIGGER IF EXISTS tr_resolve_withdrawals_user_id ON public.withdrawals;
CREATE TRIGGER tr_resolve_withdrawals_user_id
    BEFORE INSERT OR UPDATE ON public.withdrawals
    FOR EACH ROW EXECUTE FUNCTION public.resolve_user_id_from_email();

DROP TRIGGER IF EXISTS tr_resolve_bank_accounts_user_id ON public.bank_accounts;
CREATE TRIGGER tr_resolve_bank_accounts_user_id
    BEFORE INSERT OR UPDATE ON public.bank_accounts
    FOR EACH ROW EXECUTE FUNCTION public.resolve_user_id_from_email();

DROP TRIGGER IF EXISTS tr_resolve_tickets_user_id ON public.tickets;
CREATE TRIGGER tr_resolve_tickets_user_id
    BEFORE INSERT OR UPDATE ON public.tickets
    FOR EACH ROW EXECUTE FUNCTION public.resolve_user_id_from_email();

DROP TRIGGER IF EXISTS tr_resolve_notifications_user_id ON public.notifications;
CREATE TRIGGER tr_resolve_notifications_user_id
    BEFORE INSERT OR UPDATE ON public.notifications
    FOR EACH ROW EXECUTE FUNCTION public.resolve_user_id_from_email();

DROP TRIGGER IF EXISTS tr_resolve_security_logs_user_id ON public.security_logs;
CREATE TRIGGER tr_resolve_security_logs_user_id
    BEFORE INSERT OR UPDATE ON public.security_logs
    FOR EACH ROW EXECUTE FUNCTION public.resolve_user_id_from_email();

-- ##########################################################################
-- 7. REALTIME
-- ##########################################################################
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.currencies;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_rates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ##########################################################################
-- 8. SEEDS — currencies ONLY. No users, no inventory codes, no balances.
-- (Old seeds carried live-looking card codes and cash balances. Never again.)
-- ##########################################################################
INSERT INTO public.currencies (code, name, rate, status) VALUES
    ('USD', 'United States Dollar', 1200.00, 'ACTIVE'),
    ('EUR', 'Euro', 1100.00, 'ACTIVE'),
    ('GBP', 'British Pound Sterling', 1500.00, 'ACTIVE'),
    ('CAD', 'Canadian Dollar', 900.00, 'ACTIVE'),
    ('AUD', 'Australian Dollar', 820.00, 'ACTIVE'),
    ('CHF', 'Swiss Franc', 1380.00, 'ACTIVE'),
    ('SGD', 'Singapore Dollar', 1000.00, 'ACTIVE'),
    ('NZD', 'New Zealand Dollar', 850.00, 'ACTIVE'),
    ('AED', 'UAE Dirham', 380.00, 'ACTIVE'),
    ('SAR', 'Saudi Riyal', 370.00, 'ACTIVE'),
    ('ZAR', 'South African Rand', 80.00, 'ACTIVE'),
    ('CNY', 'Chinese Yuan', 190.00, 'ACTIVE'),
    ('HKD', 'Hong Kong Dollar', 180.00, 'ACTIVE'),
    ('JPY', 'Japanese Yen', 10.00, 'ACTIVE'),
    ('INR', 'Indian Rupee', 18.00, 'ACTIVE'),
    ('NGN', 'Nigerian Naira', 1.00, 'ACTIVE')
ON CONFLICT (code) DO UPDATE SET rate = EXCLUDED.rate;

-- ##########################################################################
-- 9. DESTRUCTIVE CLEANUP (= migrations/004). All IF EXISTS: safe on fresh DB.
-- LIVE DB WARNING: these drop plaintext credential columns permanently.
-- Run forced password resets BEFORE this section on a live project.
-- ##########################################################################
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS password_hash;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS transaction_pin;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin;

-- ##########################################################################
-- 10. VERIFICATION — every query below must return ZERO rows, except V4
-- which must list ONLY intentional deny-all tables
-- (ledger_entries, admin_audit_log, user_pins, security_logs, audit_trail).
-- ##########################################################################

-- V1: tables with RLS disabled → zero rows
SELECT 'V1 RLS disabled (must be zero rows)' AS check, schemaname, tablename
FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;

-- V2: tables with RLS enabled but not forced → zero rows
SELECT 'V2 RLS not forced (must be zero rows)' AS check, schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true AND forcerowsecurity = false;

-- V3: permissive USING(true) policies → zero rows outside the 3 intentional
-- public rate-read policies (currencies/brand_rates/rate_snapshots are
-- reference data by design; everything else must be ownership-scoped)
SELECT 'V3 permissive policy (must be zero rows)' AS check, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public' AND qual = 'true'
  AND policyname NOT IN ('currencies_public_read', 'brand_rates_public_read', 'rates_public_read');

-- V4: deny-all tables (review: must ALL be intentional)
SELECT 'V4 deny-all table (review list)' AS check, t.tablename
FROM pg_tables t
WHERE t.schemaname = 'public' AND t.rowsecurity = true
  AND NOT EXISTS (SELECT 1 FROM pg_policies p
                  WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename);

-- V5: plaintext credential columns must not exist → zero rows
SELECT 'V5 credential column survives (must be zero rows)' AS check,
       table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('password', 'password_hash', 'transaction_pin', 'pin')
  AND table_name = 'profiles';

-- V6: negative balances → zero rows
SELECT 'V6 negative balance (must be zero rows)' AS check, id, email
FROM profiles WHERE wallet_balance < 0 OR usd_balance < 0;

-- V7: seeded money (any nonzero balance with no users expected on fresh DB) — review
SELECT 'V7 nonzero balance (review: must be zero rows on fresh DB)' AS check, id, email,
       wallet_balance, usd_balance
FROM profiles WHERE wallet_balance > 0 OR usd_balance > 0;

-- END OF SCRIPT. If V1–V3, V5–V6 are empty and V4 lists only the five
-- intentional tables, the database matches the hardened spec.
