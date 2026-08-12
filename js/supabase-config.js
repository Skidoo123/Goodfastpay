// Goodfastpay Platform - Supabase Authentication & Cloud Client Engine

// Supabase Project Credentials
const SUPABASE_URL = "https://btbolekfrcwzzjqhorgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Ym9sZWtmcmN3enpqcWhvcmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU4MDksImV4cCI6MjEwMjA0MTgwOX0.b77fO24vUgDpvRcyqGdX_kdYFAx4JKEUUFKi0Rv2fJc";

// Initialize global client
let supabaseClient = null;
let isSupabaseConfigured = false;

(function initSupabase() {
    try {
        if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
            // Sanitize localStorage if corrupted key was stored
            let storedUrl = localStorage.getItem("goodfastpay_supabase_url");
            let storedKey = localStorage.getItem("goodfastpay_supabase_key");

            if (storedKey && (storedKey.startsWith("your-") || storedKey.length < 50)) {
                localStorage.removeItem("goodfastpay_supabase_key");
                storedKey = null;
            }
            if (storedUrl && storedUrl.includes("your-project-id")) {
                localStorage.removeItem("goodfastpay_supabase_url");
                storedUrl = null;
            }

            const activeUrl = storedUrl || SUPABASE_URL;
            const activeKey = storedKey || SUPABASE_ANON_KEY;

            if (activeUrl && activeKey && !activeUrl.includes("your-project-id") && !activeKey.startsWith("your-")) {
                supabaseClient = supabase.createClient(activeUrl, activeKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                isSupabaseConfigured = true;
                window.supabaseClient = supabaseClient;
                console.log("⚡ Supabase Client connected to:", activeUrl);
            }
        } else {
            console.warn("Supabase CDN script not loaded yet.");
        }
    } catch (err) {
        console.error("Supabase initialization notice:", err);
    }
})();

// Dynamically fetch Vercel Environment variables from /api/config if deployed on Vercel
if (typeof window !== "undefined") {
    fetch('/api/config')
        .then(res => res.ok ? res.json() : null)
        .then(cfg => {
            if (cfg && cfg.supabaseUrl && cfg.supabaseAnonKey && typeof configureSupabaseCredentials === "function") {
                if (cfg.supabaseUrl !== SUPABASE_URL || cfg.supabaseAnonKey !== SUPABASE_ANON_KEY) {
                    configureSupabaseCredentials(cfg.supabaseUrl, cfg.supabaseAnonKey);
                    console.log("⚡ Supabase credentials updated dynamically from Vercel Environment.");
                }
            }
        })
        .catch(() => {
            // Local file or static mode fallback
        });
}

// Listen for incoming OAuth redirects and session state transitions
if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", async () => {
        if (supabaseClient) {
            try {
                // Check if session exists from OAuth redirect
                const { data } = await supabaseClient.auth.getSession();
                if (data && data.session && data.session.user) {
                    const user = data.session.user;
                    const email = user.email;
                    const meta = user.user_metadata || {};
                    syncLocalUserAccount(email, {
                        name: meta.full_name || meta.name || user.email.split("@")[0],
                        phone: meta.phone || ""
                    });
                    setSessionUser(email);
                    
                    // If returning on landing page with OAuth hash/code in URL, clean up URL and update UI or redirect
                    if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") {
                        const authActions = document.getElementById("auth-actions");
                        const unauthActions = document.getElementById("unauth-actions");
                        if (authActions) authActions.style.display = "flex";
                        if (unauthActions) unauthActions.style.display = "none";
                    }
                }

                // Subscribe to auth state changes
                supabaseClient.auth.onAuthStateChange((event, session) => {
                    if (event === 'SIGNED_IN' && session && session.user) {
                        const email = session.user.email;
                        const meta = session.user.user_metadata || {};
                        syncLocalUserAccount(email, {
                            name: meta.full_name || meta.name || email.split("@")[0],
                            phone: meta.phone || ""
                        });
                        setSessionUser(email);
                    } else if (event === 'SIGNED_OUT') {
                        clearSession();
                    }
                });
            } catch (err) {
                console.warn("OAuth session check notice:", err);
            }
        }
    });
}

/**
 * Configure Supabase credentials at runtime
 */
function configureSupabaseCredentials(url, key) {
    if (!url || !key) return false;
    localStorage.setItem("goodfastpay_supabase_url", url);
    localStorage.setItem("goodfastpay_supabase_key", key);
    if (typeof supabase !== "undefined") {
        supabaseClient = supabase.createClient(url, key, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
        isSupabaseConfigured = true;
        return true;
    }
    return false;
}

// -------------------------------------------------------------
// AUTHENTICATION API METHODS
// -------------------------------------------------------------

/**
 * Sign In with OAuth Provider (Google, GitHub, Apple, etc.)
 */
async function supabaseAuthSignInWithOAuth(provider = "google") {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const redirectUrl = window.location.origin + window.location.pathname;
            const { data, error } = await supabaseClient.auth.signInWithOAuth({
                provider: provider,
                options: {
                    redirectTo: redirectUrl,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'consent',
                    }
                }
            });

            if (error) {
                return { success: false, message: error.message };
            }

            return { success: true, data };
        } catch (e) {
            return { success: false, message: e.message || `OAuth authentication with ${provider} failed.` };
        }
    } else {
        // Demonstration preview fallback
        const simulatedEmail = `${provider}.trader@goodfastpay.com`;
        syncLocalUserAccount(simulatedEmail, {
            name: `${provider.charAt(0).toUpperCase() + provider.slice(1)} Trader`,
            phone: "+234 800 000 0000"
        }, "oauth_user");
        setSessionUser(simulatedEmail);
        showToast(`Signed in with ${provider.toUpperCase()} (Demo Mode)`, "success");
        setTimeout(() => {
            window.location.href = "portal.html";
        }, 1000);
        return { success: true, isLocalFallback: true };
    }
}

/**
 * Sign Up with Email and Password via Supabase Auth
async function supabaseAuthSignUp(email, password, metadata = {}) {
    const cleanEmail = email.trim().toLowerCase();
    
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email: cleanEmail,
                password: password,
                options: {
                    data: {
                        full_name: metadata.name || "",
                        phone: metadata.phone || "",
                        role: "USER"
                    }
                }
            });

            if (error) {
                console.warn("Supabase auth signup notice:", error.message);
                // If error is network or rate-limit related, fallback seamlessly
                if (error.message.includes("Failed to fetch") || error.message.includes("rate") || error.message.includes("network")) {
                    syncLocalUserAccount(cleanEmail, metadata, password);
                    return { success: true, requireEmailConfirm: false, isLocalFallback: true };
                }
                return { success: false, message: error.message };
            }

            // Sync with local application store for instant app state
            syncLocalUserAccount(cleanEmail, metadata, password);

            return { 
                success: true, 
                user: data.user, 
                session: data.session, 
                requireEmailConfirm: !data.session 
            };
        } catch (e) {
            console.warn("Supabase registration network fallback:", e.message);
            syncLocalUserAccount(cleanEmail, metadata, password);
            return { success: true, requireEmailConfirm: false, isLocalFallback: true };
        }
    } else {
        // Local simulation fallback
        syncLocalUserAccount(cleanEmail, metadata, password);
        return { success: true, requireEmailConfirm: false, isLocalFallback: true };
    }
}

/**
 * Sign In with Email and Password via Supabase Auth
 */
async function supabaseAuthSignIn(email, password) {
    const cleanEmail = email.trim().toLowerCase();

    if (supabaseClient && isSupabaseConfigured) {
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: cleanEmail,
                password: password
            });

            if (error) {
                console.warn("Supabase sign in notice:", error.message);
                // Check if user exists locally
                const db = getDB();
                const localUser = db.users[cleanEmail];
                if (localUser && localUser.passwordHash === password) {
                    setSessionUser(cleanEmail);
                    return { success: true, isLocalFallback: true };
                }
                return { success: false, message: error.message };
            }

            // Update session locally
            setSessionUser(cleanEmail);

            // Sync user object locally if missing
            const db = getDB();
            if (!db.users[cleanEmail] && data.user) {
                const metadata = data.user.user_metadata || {};
                syncLocalUserAccount(cleanEmail, {
                    name: metadata.full_name || cleanEmail.split("@")[0],
                    phone: metadata.phone || ""
                }, password);
            }

            return { success: true, user: data.user, session: data.session };
        } catch (e) {
            console.warn("Supabase sign in network fallback:", e.message);
            const db = getDB();
            const localUser = db.users[cleanEmail];
            if (localUser && localUser.passwordHash === password) {
                setSessionUser(cleanEmail);
                return { success: true, isLocalFallback: true };
            }
            return { success: false, message: e.message || "Sign in request failed." };
        }
    } else {
        // Fallback to local DB check
        const db = getDB();
        const user = db.users[cleanEmail];
        if (!user || user.passwordHash !== password) {
            return { success: false, message: "Incorrect email address or password combination." };
        }
        if (user.status === "SUSPENDED") {
            return { success: false, message: "Your account has been suspended. Please contact support." };
        }
        if (user.status === "BANNED") {
            return { success: false, message: "Your account has been permanently banned." };
        }

        setSessionUser(cleanEmail);
        return { success: true, isLocalFallback: true };
    }
}

/**
 * Sign Out via Supabase Auth
 */
async function supabaseAuthSignOut() {
    try {
        if (supabaseClient && isSupabaseConfigured) {
            await supabaseClient.auth.signOut();
        }
    } catch (e) {
        console.warn("Supabase signout warning:", e);
    }
    clearSession();
    window.location.href = "index.html";
}

/**
 * Request Password Reset Email via Supabase
 */
async function supabaseAuthResetPassword(email) {
    const cleanEmail = email.trim().toLowerCase();
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const { data, error } = await supabaseClient.auth.resetPasswordForEmail(cleanEmail, {
                redirectTo: window.location.origin + '/index.html?reset=true'
            });
            if (error) return { success: false, message: error.message };
            return { success: true };
        } catch (e) {
            return { success: false, message: e.message };
        }
    }
    return { success: true, isLocalFallback: true };
}

/**
 * Helper to ensure local database contains the user record
 */
function syncLocalUserAccount(email, metadata, passwordHash = "") {
    const db = getDB();
    if (!db.users[email]) {
        db.users[email] = {
            name: metadata.name || email.split("@")[0],
            email: email,
            passwordHash: passwordHash,
            transactionPin: null, // Initialized as unconfigured until set by user
            phone: metadata.phone || "",
            role: email === "admin@goodfastpay.com" ? "ADMIN" : "USER",
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
            bankDetails: null,
            wallet: {
                balance: 0.00,
                pendingBalance: 0.00
            },
            logs: [
                { event: "Account Created via Supabase Auth", timestamp: new Date().toISOString(), ip: "system" }
            ],
            notifications: [
                { 
                    id: "nt-" + Math.floor(Math.random() * 100000), 
                    title: "Welcome to Goodfastpay!", 
                    message: "Your account is secured and active. Add your bank details to get started.", 
                    read: false, 
                    createdAt: new Date().toISOString() 
                }
            ]
        };
        db.auditTrail.unshift({
            operator: "supabase_auth",
            event: "User Registered",
            timestamp: new Date().toISOString(),
            details: `Account registered for ${email}`
        });
        saveDB(db);
    }
}

// ==============================================================================
// SUPABASE CLOUD DATABASE SYNC & REALTIME ENGINE
// ==============================================================================

/**
 * Fetch all platform tables from Supabase Cloud Database and synchronize locally
 */
async function syncFromSupabaseCloud() {
    if (!supabaseClient || !isSupabaseConfigured) {
        console.log("ℹ️ Supabase not configured or in offline mode. Reading from local database.");
        return false;
    }

    try {
        console.log("🔄 Synchronizing with Supabase Cloud Database...");
        const db = getDB();
        let updated = false;

        // 1. Fetch Currencies
        try {
            const { data: currenciesData, error: currErr } = await supabaseClient
                .from('currencies')
                .select('*');
            if (!currErr && currenciesData && currenciesData.length > 0) {
                currenciesData.forEach(c => {
                    db.currencies[c.code] = {
                        name: c.name,
                        rate: Number(c.rate),
                        status: c.status || 'ACTIVE'
                    };
                });
                updated = true;
            }
        } catch (e) {
            console.warn("Currencies sync notice:", e.message);
        }

        // 2. Fetch Brand Specific Rates
        try {
            const { data: ratesData, error: ratesErr } = await supabaseClient
                .from('brand_rates')
                .select('*');
            if (!ratesErr && ratesData && ratesData.length > 0) {
                if (!db.settings.rates) db.settings.rates = {};
                ratesData.forEach(r => {
                    if (!db.settings.rates[r.brand]) db.settings.rates[r.brand] = {};
                    db.settings.rates[r.brand][r.currency_code] = Number(r.rate);
                });
                updated = true;
            }
        } catch (e) {
            console.warn("Rates sync notice:", e.message);
        }

        // 3. Fetch Available Inventory
        try {
            const { data: invData, error: invErr } = await supabaseClient
                .from('inventory')
                .select('*');
            if (!invErr && invData && invData.length > 0) {
                db.inventory = invData.map(i => ({
                    id: i.id,
                    brand: i.brand,
                    cardValue: Number(i.card_value),
                    currency: i.currency,
                    country: i.country || 'USA',
                    code: i.code,
                    price: Number(i.price),
                    status: i.status,
                    purchasedBy: i.purchased_by,
                    purchasedAt: i.purchased_at,
                    createdAt: i.created_at
                }));
                updated = true;
            }
        } catch (e) {
            console.warn("Inventory sync notice:", e.message);
        }

        // 4. Fetch User Data if signed in
        if (typeof currentUser !== "undefined" && currentUser && currentUser.email) {
            try {
                // Fetch Profile from Supabase
                const { data: profile, error: profErr } = await supabaseClient
                    .from('profiles')
                    .select('*')
                    .eq('email', currentUser.email)
                    .maybeSingle();

                if (!profErr && profile) {
                    if (!db.users[currentUser.email]) {
                        syncLocalUserAccount(currentUser.email, profile);
                    }
                    const user = db.users[currentUser.email];
                    user.name = profile.name || user.name;
                    user.phone = profile.phone || user.phone;
                    user.role = profile.role || user.role;
                    user.status = profile.status || user.status;
                    if (profile.transaction_pin) {
                        user.transactionPin = profile.transaction_pin;
                    }
                    if (profile.wallet_balance !== undefined && profile.wallet_balance !== null) {
                        user.wallet.balance = Number(profile.wallet_balance);
                    }
                    if (profile.wallet_pending_balance !== undefined && profile.wallet_pending_balance !== null) {
                        user.wallet.pendingBalance = Number(profile.wallet_pending_balance);
                    }
                    db.users[currentUser.email] = user;
                    updated = true;
                }

                // Fetch Linked Bank Accounts
                const { data: banks, error: bankErr } = await supabaseClient
                    .from('bank_accounts')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!bankErr && banks && banks.length > 0) {
                    const primaryBank = banks.find(b => b.is_primary) || banks[0];
                    if (primaryBank) {
                        db.users[currentUser.email].bankDetails = {
                            bankName: primaryBank.bank_name,
                            accountNumber: primaryBank.account_number,
                            accountHolderName: primaryBank.account_holder_name
                        };
                        updated = true;
                    }
                }

                // Fetch Submissions (trades)
                const { data: subs, error: subsErr } = await supabaseClient
                    .from('submissions')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!subsErr && subs) {
                    const mappedSubs = subs.map(s => ({
                        id: s.id,
                        user: currentUser.email,
                        brand: s.brand,
                        cardValue: Number(s.card_value),
                        currency: s.currency,
                        code: s.card_code,
                        frontImage: s.front_image_url,
                        backImage: s.back_image_url,
                        status: s.status,
                        payout: s.payout_amount ? Number(s.payout_amount) : 0,
                        rejectionReason: s.rejection_reason,
                        timestamp: s.created_at
                    }));
                    
                    // Merge cloud submissions
                    mappedSubs.forEach(cloudSub => {
                        const idx = db.submissions.findIndex(x => x.id === cloudSub.id);
                        if (idx >= 0) db.submissions[idx] = cloudSub;
                        else db.submissions.unshift(cloudSub);
                    });
                    updated = true;
                }

                // Fetch Withdrawals
                const { data: wds, error: wdErr } = await supabaseClient
                    .from('withdrawals')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!wdErr && wds) {
                    const mappedWds = wds.map(w => ({
                        id: w.id,
                        user: currentUser.email,
                        amount: Number(w.amount),
                        fee: Number(w.fee || 50),
                        netPayout: Number(w.net_payout),
                        bankName: w.bank_name,
                        accountNumber: w.account_number,
                        accountHolder: w.account_holder_name,
                        status: w.status,
                        declineReason: w.decline_reason,
                        timestamp: w.created_at
                    }));

                    mappedWds.forEach(cloudWd => {
                        const idx = db.withdrawals.findIndex(x => x.id === cloudWd.id);
                        if (idx >= 0) db.withdrawals[idx] = cloudWd;
                        else db.withdrawals.unshift(cloudWd);
                    });
                    updated = true;
                }

                // Fetch Notifications
                const { data: notifs, error: notifErr } = await supabaseClient
                    .from('notifications')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!notifErr && notifs) {
                    db.users[currentUser.email].notifications = notifs.map(n => ({
                        id: n.id,
                        title: n.title,
                        message: n.message,
                        read: n.read,
                        createdAt: n.created_at
                    }));
                    updated = true;
                }

                // Fetch Support Tickets
                const { data: ticketsData, error: tktErr } = await supabaseClient
                    .from('tickets')
                    .select('*, ticket_messages(*)')
                    .order('created_at', { ascending: false });

                if (!tktErr && ticketsData) {
                    db.tickets = ticketsData.map(t => ({
                        id: t.id,
                        userId: currentUser.email,
                        title: t.title,
                        category: t.category,
                        priority: t.priority,
                        status: t.status,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        description: t.description,
                        attachments: t.attachments || [],
                        assignedTo: t.assigned_to,
                        messages: (t.ticket_messages || []).map(m => ({
                            sender: m.sender_role,
                            senderEmail: m.sender_email,
                            text: m.message,
                            timestamp: m.created_at
                        })),
                        userUnread: t.user_unread,
                        adminUnread: t.admin_unread
                    }));
                    updated = true;
                }

            } catch (userErr) {
                console.warn("User data sync notice:", userErr.message);
            }
        }

        if (updated) {
            saveDB(db);
            console.log("✅ Supabase Cloud Database synced successfully with local state.");
            if (typeof loadSession === "function") loadSession();
            if (typeof renderAllAdminViews === "function") renderAllAdminViews();
        }
        return true;
    } catch (err) {
        console.error("Cloud database sync error:", err);
        return false;
    }
}

/**
 * Push a new trade submission to Supabase Cloud Database
 */
async function supabasePushSubmission(sub) {
    if (!supabaseClient || !isSupabaseConfigured) return;
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        await supabaseClient.from('submissions').insert([{
            id: sub.id,
            user_id: userId,
            brand: sub.brand,
            card_value: sub.cardValue,
            currency: sub.currency,
            card_code: sub.code,
            front_image_url: sub.frontImage || null,
            back_image_url: sub.backImage || null,
            status: sub.status || 'PENDING',
            payout_amount: sub.payout || 0
        }]);
    } catch (e) {
        console.warn("Could not push submission to Supabase:", e.message);
    }
}

/**
 * Push a new cash withdrawal request to Supabase Cloud Database
 */
async function supabasePushWithdrawal(wd) {
    if (!supabaseClient || !isSupabaseConfigured) return;
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        await supabaseClient.from('withdrawals').insert([{
            id: wd.id,
            user_id: userId,
            amount: wd.amount,
            fee: wd.fee || 50,
            net_payout: wd.netPayout,
            bank_name: wd.bankName,
            account_number: wd.accountNumber,
            account_holder_name: wd.accountHolder,
            status: wd.status || 'PENDING'
        }]);
    } catch (e) {
        console.warn("Could not push withdrawal to Supabase:", e.message);
    }
}

/**
 * Push linked bank account to Supabase Cloud Database
 */
async function supabasePushBankAccount(bankData) {
    if (!supabaseClient || !isSupabaseConfigured) return;
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        // Upsert primary bank account
        await supabaseClient.from('bank_accounts').insert([{
            user_id: userId,
            bank_name: bankData.bankName,
            account_number: bankData.accountNumber,
            account_holder_name: bankData.accountHolderName,
            is_primary: true
        }]);
    } catch (e) {
        console.warn("Could not push bank to Supabase:", e.message);
    }
}

/**
 * Update user profile (Name, Phone, Transaction PIN) in Supabase Cloud
 */
async function supabaseUpdateProfile(updates) {
    if (!supabaseClient || !isSupabaseConfigured) return;
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const userId = sessionData?.session?.user?.id;
        if (!userId) return;

        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.transactionPin !== undefined) payload.transaction_pin = updates.transactionPin;
        if (updates.wallet !== undefined && updates.wallet.balance !== undefined) {
            payload.wallet_balance = updates.wallet.balance;
        }

        await supabaseClient
            .from('profiles')
            .update(payload)
            .eq('id', userId);
    } catch (e) {
        console.warn("Could not update profile in Supabase:", e.message);
    }
}

// Auto-trigger cloud sync on portal/admin load
if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
        setTimeout(syncFromSupabaseCloud, 800);
    });
}

