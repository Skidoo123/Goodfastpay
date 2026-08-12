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
-- 2. PUBLIC TABLES DEFINITIONS
-- ==============================================================================

-- 2.1 USER PROFILES TABLE (Linked with Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    phone TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'BANNED')),
    transaction_pin VARCHAR(4) DEFAULT NULL, -- 4-digit security PIN
    avatar_url TEXT DEFAULT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    wallet_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_balance >= 0),
    wallet_pending_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (wallet_pending_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 LINKED BANK ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.bank_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    bank_name TEXT NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_holder_name TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.3 GIFT CARD TRADE SUBMISSIONS TABLE (Sell Gift Card)
CREATE TABLE IF NOT EXISTS public.submissions (
    id TEXT PRIMARY KEY DEFAULT ('GC-' || floor(1000 + random() * 9000)::text),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    brand TEXT NOT NULL,
    card_value NUMERIC(12, 2) NOT NULL CHECK (card_value > 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    card_code TEXT NOT NULL,
    front_image_url TEXT,
    back_image_url TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
    payout_amount NUMERIC(15, 2) DEFAULT NULL,
    rejection_reason TEXT DEFAULT NULL,
    processed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.4 WITHDRAWAL REQUESTS TABLE (Cash Out to Bank)
CREATE TABLE IF NOT EXISTS public.withdrawals (
    id TEXT PRIMARY KEY DEFAULT ('WD-' || floor(1000 + random() * 9000)::text),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 500),
    fee NUMERIC(10, 2) NOT NULL DEFAULT 50.00,
    net_payout NUMERIC(15, 2) NOT NULL CHECK (net_payout >= 0),
    bank_name TEXT NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_holder_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'DECLINED')),
    decline_reason TEXT DEFAULT NULL,
    processed_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.5 INVENTORY / STOCK LEDGER TABLE (Buy Gift Cards)
CREATE TABLE IF NOT EXISTS public.inventory (
    id TEXT PRIMARY KEY DEFAULT ('STK-' || floor(1000 + random() * 9000)::text),
    brand TEXT NOT NULL,
    card_value NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    country VARCHAR(50) NOT NULL DEFAULT 'USA',
    code TEXT NOT NULL,
    price NUMERIC(15, 2) NOT NULL CHECK (price > 0),
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'SOLD', 'RESERVED', 'EXPIRED')),
    purchased_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    purchased_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.6 CENTRAL CURRENCIES REGISTRY
CREATE TABLE IF NOT EXISTS public.currencies (
    code VARCHAR(10) PRIMARY KEY,
    name TEXT NOT NULL,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.7 BRAND SPECIFIC EXCHANGE RATES TABLE
CREATE TABLE IF NOT EXISTS public.brand_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    currency_code VARCHAR(10) NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
    rate NUMERIC(12, 2) NOT NULL CHECK (rate >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(brand, currency_code)
);

-- 2.8 SUPPORT TICKETS TABLE
CREATE TABLE IF NOT EXISTS public.tickets (
    id TEXT PRIMARY KEY DEFAULT ('TKT-' || floor(10000 + random() * 90000)::text),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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

-- 2.9 TICKET MESSAGES / REALTIME CHAT TABLE
CREATE TABLE IF NOT EXISTS public.ticket_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL CHECK (sender_role IN ('USER', 'ADMIN', 'SYSTEM')),
    sender_email TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.10 NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.11 USER SECURITY & ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    ip_address TEXT DEFAULT '127.0.0.1',
    user_agent TEXT DEFAULT 'Web Browser',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.12 ADMIN AUDIT TRAIL TABLE
CREATE TABLE IF NOT EXISTS public.audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operator_email TEXT NOT NULL,
    event TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- 3. INDEXES FOR HIGH-SPEED QUERYING & LOOKUPS
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON public.submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON public.submissions(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON public.inventory(status);
CREATE INDEX IF NOT EXISTS idx_inventory_brand ON public.inventory(brand);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id ON public.tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON public.ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_security_logs_user_id ON public.security_logs(user_id);

-- ==============================================================================
-- 4. AUTOMATED TRIGGERS & FUNCTIONS
-- ==============================================================================

-- 4.1 Auto-update updated_at timestamp function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_bank_accounts_updated_at ON public.bank_accounts;
CREATE TRIGGER tr_bank_accounts_updated_at BEFORE UPDATE ON public.bank_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_submissions_updated_at ON public.submissions;
CREATE TRIGGER tr_submissions_updated_at BEFORE UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER tr_withdrawals_updated_at BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS tr_tickets_updated_at ON public.tickets;
CREATE TRIGGER tr_tickets_updated_at BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4.2 Auto-create profile upon Supabase auth.users Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, phone, role, status)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'phone', ''),
        CASE WHEN NEW.email = 'admin@goodfastpay.com' THEN 'ADMIN' ELSE 'USER' END,
        'ACTIVE'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Add Welcome Notification
    INSERT INTO public.notifications (user_id, title, message)
    VALUES (
        NEW.id,
        'Welcome to Goodfastpay!',
        'Your trading account is active. Set your 4-digit Transaction PIN and link your bank account to begin.'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

-- Enable RLS on all tables
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

-- Helper function: Check if current authenticated user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role IN ('ADMIN', 'SUPER_ADMIN')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5.1 PROFILES POLICIES
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- 5.2 BANK ACCOUNTS POLICIES
CREATE POLICY "Users can manage their own bank accounts" ON public.bank_accounts
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- 5.3 SUBMISSIONS POLICIES
CREATE POLICY "Users can view their own submissions" ON public.submissions
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create submissions" ON public.submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update submissions" ON public.submissions
    FOR UPDATE USING (public.is_admin());

-- 5.4 WITHDRAWALS POLICIES
CREATE POLICY "Users can view their own withdrawals" ON public.withdrawals
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create withdrawal requests" ON public.withdrawals
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update withdrawals" ON public.withdrawals
    FOR UPDATE USING (public.is_admin());

-- 5.5 INVENTORY POLICIES
CREATE POLICY "Anyone can view available gift card stock" ON public.inventory
    FOR SELECT USING (status = 'AVAILABLE' OR auth.uid() = purchased_by OR public.is_admin());

CREATE POLICY "Users can purchase inventory" ON public.inventory
    FOR UPDATE USING (auth.uid() IS NOT NULL OR public.is_admin());

CREATE POLICY "Admins can manage inventory" ON public.inventory
    FOR ALL USING (public.is_admin());

-- 5.6 CURRENCIES & RATES POLICIES (Public read, Admin write)
CREATE POLICY "Currencies are viewable by everyone" ON public.currencies
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage currencies" ON public.currencies
    FOR ALL USING (public.is_admin());

CREATE POLICY "Rates are viewable by everyone" ON public.brand_rates
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage rates" ON public.brand_rates
    FOR ALL USING (public.is_admin());

-- 5.7 TICKETS & MESSAGES POLICIES
CREATE POLICY "Users can view their own tickets" ON public.tickets
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can create support tickets" ON public.tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users and admins can update tickets" ON public.tickets
    FOR UPDATE USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Ticket messages access policy" ON public.ticket_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tickets t 
            WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.is_admin())
        )
    );

-- 5.8 NOTIFICATIONS POLICIES
CREATE POLICY "Users can manage their own notifications" ON public.notifications
    FOR ALL USING (auth.uid() = user_id OR public.is_admin());

-- 5.9 SECURITY LOGS & AUDIT TRAIL POLICIES
CREATE POLICY "Users can view their own security logs" ON public.security_logs
    FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "System and users can insert security logs" ON public.security_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can view audit trail" ON public.audit_trail
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can insert audit trail" ON public.audit_trail
    FOR INSERT WITH CHECK (public.is_admin());

-- ==============================================================================
-- 6. INITIAL SEED DATA (Currencies & Standard Default Inventory)
-- ==============================================================================

-- 6.1 Seed Base Currencies
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

-- 6.2 Seed Default Gift Card Inventory Stock
INSERT INTO public.inventory (id, brand, card_value, currency, country, code, price, status) VALUES
    ('STK-9001', 'Apple/iTunes', 50.00, 'USD', 'USA', 'APPL-BUY-9021-9981', 60000.00, 'AVAILABLE'),
    ('STK-9002', 'Amazon', 100.00, 'EUR', 'Europe (EUR)', 'AMZN-BUY-4081-3091', 120000.00, 'AVAILABLE'),
    ('STK-9003', 'Steam', 50.00, 'USD', 'USA', 'STEM-BUY-1022-7744', 65000.00, 'AVAILABLE'),
    ('STK-9004', 'Google Play', 25.00, 'USD', 'USA', 'GOPL-BUY-1033-2882', 28000.00, 'AVAILABLE')
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 7. ENABLE REALTIME BROADCASTING ON RELEVANT TABLES
-- ==============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.withdrawals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
