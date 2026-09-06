-- ==============================================================================
-- GOODFASTPAY PLATFORM - COMPLETE SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- ==============================================================================
-- This script configures the full database schema, tables, foreign keys,
-- triggers, Row Level Security (RLS) policies, and initial seed data for Supabase.
-- 
-- How to apply:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Go to the "SQL Editor" tab on the left sidebar
-- 3. Click "+ New query", paste this entire script, and click "RUN"
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. SCHEMA MIGRATION SAFEGUARDS (Gracefully update existing tables)
-- ==============================================================================

DO $$ 
BEGIN
    -- Make user_id nullable and add user_email if tables already exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT DEFAULT NULL;
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usd_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (usd_balance >= 0);
        ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usd_pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (usd_pending_balance >= 0);
        ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'submissions') THEN
        ALTER TABLE public.submissions ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS user_email TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'withdrawals') THEN
        ALTER TABLE public.withdrawals ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS user_email TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_accounts') THEN
        ALTER TABLE public.bank_accounts ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS user_email TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        ALTER TABLE public.notifications ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS user_email TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tickets') THEN
        ALTER TABLE public.tickets ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS user_email TEXT;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_logs') THEN
        ALTER TABLE public.security_logs ALTER COLUMN user_id DROP NOT NULL;
        ALTER TABLE public.security_logs ADD COLUMN IF NOT EXISTS user_email TEXT;
    END IF;
END $$;

-- ==============================================================================
-- 3. PUBLIC TABLES DEFINITIONS
-- ==============================================================================

-- 3.1 USER PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BANNED')),
    password TEXT DEFAULT NULL,
    transaction_pin VARCHAR(4) DEFAULT NULL,
    avatar_url TEXT DEFAULT NULL,
    email_verified BOOLEAN DEFAULT TRUE,
    phone_verified BOOLEAN DEFAULT FALSE,
    wallet_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0),
    wallet_pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_pending_balance >= 0),
    usd_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (usd_balance >= 0),
    usd_pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (usd_pending_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 LINKED BANK ACCOUNTS TABLE
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

-- 3.3 GIFT CARD TRADE SUBMISSIONS TABLE (Sell Gift Card)
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

-- 3.4 WITHDRAWAL REQUESTS TABLE (Cash Out to Bank)
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

-- 3.5 INVENTORY / STOCK LEDGER TABLE (Buy Gift Cards)
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

-- 3.6 CENTRAL CURRENCIES REGISTRY
CREATE TABLE IF NOT EXISTS public.currencies (
    code VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 BRAND SPECIFIC EXCHANGE RATES TABLE
CREATE TABLE IF NOT EXISTS public.brand_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    currency_code VARCHAR(10) NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(brand, currency_code)
);

-- 3.8 SUPPORT TICKETS TABLE
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

-- 3.9 TICKET MESSAGES / REALTIME CHAT TABLE
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('USER', 'ADMIN', 'SYSTEM')),
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.11 USER SECURITY & ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    event TEXT NOT NULL,
    ip_address TEXT DEFAULT '127.0.0.1',
    user_agent TEXT DEFAULT 'Web Browser',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12 ADMIN AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_email TEXT NOT NULL,
    event TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 4. INDEXES FOR HIGH-SPEED QUERYING & REALTIME PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_submissions_user_email ON public.submissions(user_email);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_email ON public.withdrawals(user_email);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_email ON public.notifications(user_email, read);

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to allow clean recreation
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles insert" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles update" ON public.profiles;
DROP POLICY IF EXISTS "Public bank accounts all" ON public.bank_accounts;
DROP POLICY IF EXISTS "Public submissions read" ON public.submissions;
DROP POLICY IF EXISTS "Public submissions insert" ON public.submissions;
DROP POLICY IF EXISTS "Public submissions update" ON public.submissions;
DROP POLICY IF EXISTS "Public withdrawals read" ON public.withdrawals;
DROP POLICY IF EXISTS "Public withdrawals insert" ON public.withdrawals;
DROP POLICY IF EXISTS "Public withdrawals update" ON public.withdrawals;
DROP POLICY IF EXISTS "Public inventory read" ON public.inventory;
DROP POLICY IF EXISTS "Public inventory update" ON public.inventory;
DROP POLICY IF EXISTS "Public inventory all" ON public.inventory;
DROP POLICY IF EXISTS "Currencies viewable" ON public.currencies;
DROP POLICY IF EXISTS "Currencies admin all" ON public.currencies;
DROP POLICY IF EXISTS "Brand rates viewable" ON public.brand_rates;
DROP POLICY IF EXISTS "Brand rates admin all" ON public.brand_rates;
DROP POLICY IF EXISTS "Notifications all" ON public.notifications;
DROP POLICY IF EXISTS "Tickets all" ON public.tickets;
DROP POLICY IF EXISTS "Ticket messages all" ON public.ticket_messages;
DROP POLICY IF EXISTS "Audit trail all" ON public.audit_trail;
DROP POLICY IF EXISTS "Security logs all" ON public.security_logs;

-- Helper to check if current user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'ADMIN'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissive Policies to allow client-side database auth
CREATE POLICY "Public profiles read" ON public.profiles FOR ALL USING (true);
CREATE POLICY "Public bank accounts all" ON public.bank_accounts FOR ALL USING (true);
CREATE POLICY "Public submissions all" ON public.submissions FOR ALL USING (true);
CREATE POLICY "Public withdrawals all" ON public.withdrawals FOR ALL USING (true);
CREATE POLICY "Public inventory all" ON public.inventory FOR ALL USING (true);
CREATE POLICY "Currencies admin all" ON public.currencies FOR ALL USING (true);
CREATE POLICY "Brand rates admin all" ON public.brand_rates FOR ALL USING (true);
CREATE POLICY "Notifications all" ON public.notifications FOR ALL USING (true);
CREATE POLICY "Tickets all" ON public.tickets FOR ALL USING (true);
CREATE POLICY "Ticket messages all" ON public.ticket_messages FOR ALL USING (true);
CREATE POLICY "Audit trail all" ON public.audit_trail FOR ALL USING (true);
CREATE POLICY "Security logs all" ON public.security_logs FOR ALL USING (true);

-- ==============================================================================
-- 6. INITIAL SEED DATA
-- ==============================================================================

-- 6.1 Seed Initial Profiles
INSERT INTO public.profiles (id, email, name, role, status, wallet_balance, transaction_pin, password) VALUES
    (gen_random_uuid(), 'admin@goodfastpay.com', 'System Administrator', 'ADMIN', 'ACTIVE', 5000000.00, '1234', 'password123'),
    (gen_random_uuid(), 'user@goodfastpay.com', 'Demo Customer', 'USER', 'ACTIVE', 25400.00, '0000', 'password123')
ON CONFLICT (email) DO UPDATE SET 
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    password = COALESCE(profiles.password, EXCLUDED.password);

-- 6.2 Seed Base Currencies
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

-- 6.3 Seed Default Gift Card Inventory Stock
INSERT INTO public.inventory (id, brand, card_value, currency, country, code, price, status) VALUES
    ('STK-9001', 'Apple/iTunes', 50.00, 'USD', 'USA', 'APPL-BUY-9021-9981', 60000.00, 'AVAILABLE'),
    ('STK-9002', 'Amazon', 100.00, 'EUR', 'Europe (EUR)', 'AMZN-BUY-4081-3091', 120000.00, 'AVAILABLE'),
    ('STK-9003', 'Steam', 50.00, 'USD', 'USA', 'STEM-BUY-1022-7744', 65000.00, 'AVAILABLE'),
    ('STK-9004', 'Google Play', 25.00, 'USD', 'USA', 'GOPL-BUY-1033-2882', 28000.00, 'AVAILABLE')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 7. ENABLE REALTIME BROADCASTING ON ALL TABLES
-- ==============================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.currencies;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.brand_rates;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_logs;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.audit_trail;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ==============================================================================
-- 8. AUTOMATIC PROFILE AND FOREIGN KEY SYNCHRONIZATION TRIGGERS
-- ==============================================================================

-- 8.1 Trigger to automatically create a profile in public.profiles when a new user signs up via auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role, status, wallet_balance, created_at)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        CASE WHEN NEW.email = 'admin@goodfastpay.com' THEN 'ADMIN' ELSE COALESCE(NEW.raw_user_meta_data->>'role', 'USER') END,
        'ACTIVE',
        0.00,
        COALESCE(NEW.created_at, NOW())
    )
    ON CONFLICT (email) DO UPDATE SET
        id = EXCLUDED.id,
        role = EXCLUDED.role,
        name = COALESCE(public.profiles.name, EXCLUDED.name);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 8.2 Trigger to automatically resolve user_id matching user_email on insert or update
CREATE OR REPLACE FUNCTION public.resolve_user_id_from_email()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.user_id IS NULL AND NEW.user_email IS NOT NULL THEN
        SELECT id INTO NEW.user_id FROM public.profiles WHERE email = NEW.user_email;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers for all tables containing user_id and user_email
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

