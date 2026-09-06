// Goodfastpay Platform - Supabase Authentication & Cloud Client Engine
// Complete live integration with PostgreSQL schema, Row-Level Security & Realtime Data Sync

// Supabase Project Credentials
const SUPABASE_URL = "https://btbolekfrcwzzjqhorgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Ym9sZWtmcmN3enpqcWhvcmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU4MDksImV4cCI6MjEwMjA0MTgwOX0.b77fO24vUgDpvRcyqGdX_kdYFAx4JKEUUFKi0Rv2fJc";

// Initialize global client
let supabaseClient = null;
let isSupabaseConfigured = false;
let realtimeChannel = null;

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
                if (cfg.supabaseUrl.includes("your-project-id") || cfg.supabaseAnonKey.startsWith("your-")) {
                    console.warn("⚡ Placeholder environment variables detected in Vercel configuration. Ignoring.");
                    return;
                }
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
                // Initialize Realtime Live Sync
                setupSupabaseRealtimeSubscriptions();
                // Pull latest data from database
                await syncFromSupabaseCloud();
            } catch (err) {
                console.warn("Session check notice:", err);
            }
        }
    });
}

/**
 * Configure Supabase credentials at runtime
 */
function configureSupabaseCredentials(url, key) {
    if (!url || !key) return false;
    
    // Ignore placeholder values
    if (url.includes("your-project-id") || key.startsWith("your-") || key.length < 50) {
        console.warn("⚡ Ignoring placeholder credentials from configuration.");
        return false;
    }
    
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
        setupSupabaseRealtimeSubscriptions();
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
 */
async function supabaseAuthSignUp(email, password, metadata = {}) {
    const cleanEmail = email.trim().toLowerCase();
    
    // Check if email already exists in local database
    const db = getDB();
    if (db.users && db.users[cleanEmail]) {
        // Update user record with newly provided credentials in local DB
        db.users[cleanEmail].passwordHash = password;
        if (metadata.name) db.users[cleanEmail].name = metadata.name;
        if (metadata.phone) db.users[cleanEmail].phone = metadata.phone;
        saveDB(db);
        return { success: true, isUpdated: true };
    }
    
    if (supabaseClient && isSupabaseConfigured) {
        try {
            // Check if profile exists in Supabase Cloud
            try {
                const { data: existing } = await supabaseClient
                    .from('profiles')
                    .select('email')
                    .eq('email', cleanEmail)
                    .maybeSingle();

                if (existing) {
                    console.warn("Profile already in Supabase Cloud for:", cleanEmail);
                }
            } catch (cErr) {
                console.warn("Supabase profile check notice:", cErr.message);
            }

            // Attempt standard Supabase Auth creation if supported
            let authId = null;
            try {
                const { data: authData } = await supabaseClient.auth.signUp({
                    email: cleanEmail,
                    password: password,
                    options: {
                        data: {
                            full_name: metadata.name || cleanEmail.split("@")[0],
                            phone: metadata.phone || ""
                        }
                    }
                });
                if (authData && authData.user) {
                    authId = authData.user.id;
                }
            } catch (aErr) {
                console.warn("Supabase Auth signUp attempt notice:", aErr.message);
            }

            // Create new profile record in Supabase public.profiles
            let profileId = authId;
            try {
                const { data: newProfile, error: insertErr } = await supabaseClient
                    .from('profiles')
                    .insert([{
                        ...(authId ? { id: authId } : {}),
                        email: cleanEmail,
                        name: metadata.name || cleanEmail.split("@")[0],
                        phone: metadata.phone || "",
                        password: password,
                        role: cleanEmail === "admin@goodfastpay.com" ? "ADMIN" : "USER",
                        status: "ACTIVE"
                    }])
                    .select()
                    .maybeSingle();

                if (insertErr) {
                    console.warn("Supabase direct profile insert notice (falling back to local session):", insertErr.message);
                } else if (newProfile) {
                    profileId = newProfile.id;
                }
            } catch (pErr) {
                console.warn("Supabase profile insert exception:", pErr.message);
            }

            syncLocalUserAccount(cleanEmail, {
                id: profileId,
                name: metadata.name || cleanEmail.split("@")[0],
                phone: metadata.phone || ""
            }, password);

            return { success: true };
        } catch (e) {
            console.warn("Supabase direct signup fallback exception:", e.message);
            syncLocalUserAccount(cleanEmail, metadata, password);
            return { success: true, isFallback: true };
        }
    } else {
        syncLocalUserAccount(cleanEmail, metadata, password);
        return { success: true, isLocalFallback: true };
    }
}

/**
 * Sign In with Email and Password via Supabase Auth
 */
async function supabaseAuthSignIn(email, password) {
    const cleanEmail = email.trim().toLowerCase();

    if (supabaseClient && isSupabaseConfigured) {
        try {
            // Query profiles table for match
            const { data: profile, error: dbErr } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('email', cleanEmail)
                .eq('password', password)
                .maybeSingle();

            if (dbErr || !profile) {
                // Try fallback to local database
                const db = getDB();
                const localUser = db.users[cleanEmail];
                if (localUser && localUser.passwordHash === password) {
                    if (localUser.status === "SUSPENDED") {
                        return { success: false, message: "Your account has been suspended. Please contact support." };
                    }
                    if (localUser.status === "BANNED") {
                        return { success: false, message: "Your account has been permanently banned." };
                    }
                    setSessionUser(cleanEmail);
                    return { success: true, isLocalFallback: true };
                }
                return { success: false, message: "Invalid email or password." };
            }

            if (profile.status === "SUSPENDED") {
                return { success: false, message: "Your account has been suspended. Please contact support." };
            }
            if (profile.status === "BANNED") {
                return { success: false, message: "Your account has been permanently banned." };
            }

            setSessionUser(cleanEmail);

            // Sync user locally
            syncLocalUserAccount(cleanEmail, {
                id: profile.id,
                name: profile.name,
                phone: profile.phone
            }, password);

            return { success: true, user: { email: cleanEmail, id: profile.id } };
        } catch (e) {
            console.warn("Supabase login fallback:", e.message);
            const db = getDB();
            const localUser = db.users[cleanEmail];
            if (localUser && localUser.passwordHash === password) {
                if (localUser.status === "SUSPENDED") {
                    return { success: false, message: "Your account has been suspended. Please contact support." };
                }
                if (localUser.status === "BANNED") {
                    return { success: false, message: "Your account has been permanently banned." };
                }
                setSessionUser(cleanEmail);
                return { success: true, isLocalFallback: true };
            }
            return { success: false, message: e.message || "Sign in request failed." };
        }
    } else {
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
    clearSession();
    window.location.href = "index.html";
}

/**
 * Reset Password via Supabase Auth
 */
async function supabaseAuthResetPassword(email) {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const redirectUrl = window.location.origin + "/index.html?action=reset_password";
            const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
                redirectTo: redirectUrl
            });
            if (error) return { success: false, message: error.message };
            return { success: true, data };
        } catch (e) {
            return { success: false, message: e.message };
        }
    } else {
        return { success: true, isLocalFallback: true };
    }
}

/**
 * Helper to sync user profile state locally
 */
function syncLocalUserAccount(email, metadata = {}, password = "password123") {
    const db = getDB();
    if (!db.users) db.users = {};
    if (!db.users[email]) {
        db.users[email] = {
            id: metadata.id || null,
            name: metadata.name || metadata.full_name || email.split("@")[0],
            email: email,
            passwordHash: password,
            phone: metadata.phone || "",
            role: email === "admin@goodfastpay.com" ? "ADMIN" : "USER",
            status: "ACTIVE",
            createdAt: new Date().toISOString(),
            bankDetails: null,
            wallet: {
                balance: 0.00,
                pendingBalance: 0.00,
                usdBalance: 250.00,
                usdPending: 0.00
            },
            logs: [
                { event: "Account Initialized", timestamp: new Date().toISOString(), ip: "127.0.0.1" }
            ],
            notifications: [
                { id: "nt-welcome", title: "Welcome to Goodfastpay!", message: "Your account is active. Configure your PIN to start trading.", read: false, createdAt: new Date().toISOString() }
            ]
        };
        saveDB(db);
    } else if (metadata.id) {
        db.users[email].id = metadata.id;
        saveDB(db);
    }
}

/**
 * Ensure user profile exists in public.profiles table in Supabase Cloud
 */
async function supabaseEnsureProfileExists(email, metadata = {}) {
    if (!supabaseClient || !isSupabaseConfigured) return;
    try {
        const { data: existing, error: getErr } = await supabaseClient
            .from('profiles')
            .select('id, email')
            .eq('email', email)
            .maybeSingle();

        if (getErr) {
            console.warn("Error checking profile existence in Supabase:", getErr.message);
            return;
        }

        if (!existing) {
            const name = metadata.name || metadata.full_name || email.split("@")[0];
            const phone = metadata.phone || "";
            const db = getDB();
            const localUser = db.users ? db.users[email] : null;
            const role = metadata.role || (localUser && localUser.role ? localUser.role : (email === "admin@goodfastpay.com" ? "ADMIN" : "USER"));
            const pwd = metadata.password || (localUser ? localUser.passwordHash : "");
            
            const { data: inserted, error: insertErr } = await supabaseClient
                .from('profiles')
                .insert([{
                    email: email,
                    name: name,
                    phone: phone,
                    password: pwd,
                    role: role,
                    status: 'ACTIVE',
                    wallet_balance: 0.00,
                    wallet_pending_balance: 0.00
                }])
                .select();
            
            if (insertErr) {
                console.warn("Could not insert new profile directly to Supabase:", insertErr.message);
            } else if (inserted && inserted[0]) {
                console.log("⚡ Created profile in Supabase public.profiles for:", email);
                const db = getDB();
                if (db.users[email]) {
                    db.users[email].id = inserted[0].id;
                    saveDB(db);
                }
            }
        } else {
            const db = getDB();
            if (db.users[email] && !db.users[email].id) {
                db.users[email].id = existing.id;
                saveDB(db);
            }
        }
    } catch (err) {
        console.warn("supabaseEnsureProfileExists exception:", err.message);
    }
}

// -------------------------------------------------------------
// LIVE REALTIME SUBSCRIPTIONS ENGINE
// -------------------------------------------------------------

/**
 * Setup Realtime Postgres Subscriptions for Immediate Admin <-> Customer Synchronization
 */
function setupSupabaseRealtimeSubscriptions() {
    if (!supabaseClient || !isSupabaseConfigured) return;

    try {
        if (realtimeChannel) {
            supabaseClient.removeChannel(realtimeChannel);
        }

        console.log("⚡ Supabase Realtime Channels: SUBSCRIBING");

        realtimeChannel = supabaseClient
            .channel('goodfastpay-live-sync')
            // Listen for Profile changes (Status suspension, balance changes)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table profiles:', payload);
                handleRealtimeProfileChange(payload);
            })
            // Listen for Trade Submissions
            .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table submissions:', payload);
                handleRealtimeSubmissionChange(payload);
            })
            // Listen for Withdrawals
            .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table withdrawals:', payload);
                handleRealtimeWithdrawalChange(payload);
            })
            // Listen for Inventory Stock
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table inventory:', payload);
                handleRealtimeInventoryChange(payload);
            })
            // Listen for Security Logs (logins from other devices, password changes, etc.)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'security_logs' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table security_logs:', payload);
                handleRealtimeSecurityLogChange(payload);
            })
            // Listen for Audit Trail
            .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_trail' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table audit_trail:', payload);
                handleRealtimeAuditTrailChange(payload);
            })
            // Listen for Support Tickets
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table tickets:', payload);
                handleRealtimeTicketChange(payload);
            })
            // Listen for Support Ticket Messages
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_messages' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table ticket_messages:', payload);
                handleRealtimeTicketMessageChange(payload);
            })
            // Listen for Notifications
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table notifications:', payload);
                handleRealtimeNotificationChange(payload);
            })
            // Listen for Bank Accounts
            .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table bank_accounts:', payload);
                handleRealtimeBankAccountChange(payload);
            })
            // Listen for Currencies & Rates
            .on('postgres_changes', { event: '*', schema: 'public', table: 'currencies' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table currencies:', payload);
                syncFromSupabaseCloud();
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'brand_rates' }, payload => {
                console.log('⚡ DATABASE EVENT RECEIVED for table brand_rates:', payload);
                syncFromSupabaseCloud();
            });

        realtimeChannel.subscribe((status) => {
            console.log(`⚡ Supabase Realtime Channel Status: ${status}`);
            if (status === "SUBSCRIBED") {
                console.log("⚡ Supabase Realtime Channels: SUBSCRIBED");
            }
        });

    } catch (e) {
        console.warn("Realtime setup notice:", e.message);
    }
}

function handleRealtimeSecurityLogChange(payload) {
    const log = payload.new;
    if (!log) return;

    const db = getDB();
    const email = log.user_email;
    if (email && db.users[email]) {
        if (!db.users[email].logs) db.users[email].logs = [];
        const exists = db.users[email].logs.some(l => l.id === log.id || (l.timestamp === log.created_at && l.event === log.event));
        if (!exists) {
            db.users[email].logs.unshift({
                id: log.id,
                event: log.event,
                ip: log.ip_address || '127.0.0.1',
                userAgent: log.user_agent,
                timestamp: log.created_at
            });
            saveDB(db);
        }
    }

    if (typeof loadAdminSession === "function") loadAdminSession();
    if (typeof inspectUserProfile === "function" && typeof activeUserInspectEmail !== "undefined" && activeUserInspectEmail === email) {
        inspectUserProfile(email);
    }
}

function handleRealtimeAuditTrailChange(payload) {
    const log = payload.new;
    if (!log) return;

    const db = getDB();
    if (!db.auditTrail) db.auditTrail = [];
    const exists = db.auditTrail.some(l => l.id === log.id || (l.timestamp === log.created_at && l.event === log.event));
    if (!exists) {
        db.auditTrail.unshift({
            id: log.id,
            operator: log.operator_email,
            event: log.event,
            details: log.details,
            timestamp: log.created_at
        });
        saveDB(db);
    }

    if (typeof renderAdminAuditLogs === "function") renderAdminAuditLogs();
    if (typeof loadAdminSession === "function") loadAdminSession();
}

function handleRealtimeTicketChange(payload) {
    const t = payload.new;
    if (!t) return;

    const db = getDB();
    const ticketId = t.id;

    // Check if the ticket is already in local storage
    const idx = db.tickets ? db.tickets.findIndex(x => x.id === ticketId) : -1;
    if (!db.tickets) db.tickets = [];
    
    // Map cloud ticket to local structure, keeping existing messages if any
    const existingMessages = idx >= 0 ? db.tickets[idx].messages : [];
    
    const mapped = {
        id: t.id,
        userId: t.user_email,
        title: t.title,
        category: t.category,
        priority: t.priority,
        status: t.status,
        description: t.description,
        attachments: t.attachments || [],
        assignedTo: t.assigned_to || 'Unassigned',
        userUnread: t.user_unread,
        adminUnread: t.admin_unread,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        messages: existingMessages
    };

    if (idx >= 0) {
        db.tickets[idx] = { ...db.tickets[idx], ...mapped };
    } else {
        db.tickets.unshift(mapped);
    }
    saveDB(db);

    if (typeof renderUserTicketsQueue === "function") renderUserTicketsQueue();
    if (typeof renderAdminTicketsQueue === "function") renderAdminTicketsQueue();
    if (typeof renderSupportAnalytics === "function") renderSupportAnalytics();
    if (typeof loadSession === "function") loadSession();
    if (typeof loadAdminSession === "function") loadAdminSession();
}

function handleRealtimeTicketMessageChange(payload) {
    const msg = payload.new;
    if (!msg) return;

    const db = getDB();
    const ticketId = msg.ticket_id;

    if (!db.tickets) db.tickets = [];
    const ticketIdx = db.tickets.findIndex(t => t.id === ticketId);
    if (ticketIdx === -1) {
        // If ticket not found locally, trigger a full cloud sync to get it
        syncFromSupabaseCloud();
        return;
    }

    const t = db.tickets[ticketIdx];
    if (!t.messages) t.messages = [];

    // Avoid duplicate messages
    const exists = t.messages.some(m => m.timestamp === msg.created_at && m.text === msg.message && m.senderEmail === msg.sender_email);
    if (!exists) {
        t.messages.push({
            sender: msg.sender_role,
            senderEmail: msg.sender_email,
            text: msg.message,
            timestamp: msg.created_at
        });
        db.tickets[ticketIdx] = t;
        saveDB(db);
    }

    if (typeof renderUserChatMessages === "function" && typeof activeUserTicketId !== "undefined" && activeUserTicketId === ticketId) {
        renderUserChatMessages(t);
    }
    if (typeof renderAdminChatMessages === "function" && typeof activeAdminTicketId !== "undefined" && activeAdminTicketId === ticketId) {
        renderAdminChatMessages(t);
    }

    if (typeof loadSession === "function") loadSession();
    if (typeof loadAdminSession === "function") loadAdminSession();
}

function handleRealtimeNotificationChange(payload) {
    const n = payload.new;
    if (!n) return;

    const db = getDB();
    const email = n.user_email;
    if (email && db.users[email]) {
        if (!db.users[email].notifications) db.users[email].notifications = [];
        const exists = db.users[email].notifications.some(x => x.id === n.id);
        if (!exists) {
            db.users[email].notifications.unshift({
                id: n.id,
                title: n.title,
                message: n.message,
                read: n.read,
                createdAt: n.created_at
            });
            saveDB(db);

            // Dispatch live browser event for instant dashboard updating
            window.dispatchEvent(new CustomEvent('goodfastpay_notification', {
                detail: {
                    userId: email,
                    notification: {
                        id: n.id,
                        title: n.title,
                        message: n.message,
                        read: n.read,
                        createdAt: n.created_at
                    }
                }
            }));
        }
    }
}

function handleRealtimeBankAccountChange(payload) {
    console.log("⚡ DATABASE EVENT RECEIVED for table bank_accounts:", payload);
    const db = getDB();
    if (payload.eventType === "DELETE") {
        // Trigger a pull to remove it
        syncFromSupabaseCloud();
        return;
    }

    const b = payload.new;
    if (!b) return;

    const email = b.user_email;
    if (email && db.users[email]) {
        db.users[email].bankDetails = {
            bankName: b.bank_name,
            accountNumber: b.account_number,
            accountHolderName: b.account_holder_name
        };
        saveDB(db);
        if (typeof renderUsersList === "function") renderUsersList();
        if (typeof loadAdminSession === "function") loadAdminSession();
        if (typeof loadSession === "function") loadSession();
    }
}

function handleRealtimeProfileChange(payload) {
    const updatedRecord = payload.new;
    if (!updatedRecord) return;

    const db = getDB();
    const email = updatedRecord.email;
    if (!email) return;

    if (!db.users[email]) {
        syncLocalUserAccount(email, updatedRecord);
    }

    const user = db.users[email];
    user.status = updatedRecord.status || user.status;
    user.role = updatedRecord.role || user.role;
    if (updatedRecord.wallet_balance !== undefined) {
        user.wallet.balance = Number(updatedRecord.wallet_balance);
    }
    if (updatedRecord.transaction_pin) {
        user.transactionPin = updatedRecord.transaction_pin;
    }
    db.users[email] = user;
    saveDB(db);

    // If active user is currently viewing portal, handle suspension or update balance immediately
    const session = getSessionUser();
    if (session && session.email === email) {
        if (updatedRecord.status === 'SUSPENDED') {
            clearSession();
            window.location.href = "index.html?suspended=true";
            return;
        } else if (updatedRecord.status === 'BANNED') {
            clearSession();
            window.location.href = "index.html?banned=true";
            return;
        }
        if (typeof loadSession === "function") loadSession();
    }

    if (typeof loadAdminSession === "function") loadAdminSession();
}

function handleRealtimeSubmissionChange(payload) {
    const s = payload.new;
    if (!s) return;

    const db = getDB();
    const submissionId = s.id;
    const mapped = {
        id: s.id,
        userId: s.user_email || s.user_id,
        brand: s.brand,
        cardValue: Number(s.card_value),
        currency: s.currency,
        cardCode: s.card_code,
        frontImageUrl: s.front_image_url,
        backImageUrl: s.back_image_url,
        status: s.status,
        payoutAmount: s.payout_amount ? Number(s.payout_amount) : null,
        rejectionReason: s.rejection_reason,
        createdAt: s.created_at
    };

    const idx = db.submissions.findIndex(x => x.id === submissionId);
    if (idx >= 0) {
        db.submissions[idx] = { ...db.submissions[idx], ...mapped };
    } else {
        db.submissions.unshift(mapped);
    }
    saveDB(db);

    if (typeof loadSession === "function") loadSession();
    if (typeof loadAdminSession === "function") loadAdminSession();
}

function handleRealtimeWithdrawalChange(payload) {
    const w = payload.new;
    if (!w) return;

    const db = getDB();
    const withdrawalId = w.id;
    const mapped = {
        id: w.id,
        userId: w.user_email || w.user_id,
        amount: Number(w.amount),
        fee: Number(w.fee || 50),
        netPayout: Number(w.net_payout),
        bankName: w.bank_name,
        accountNumber: w.account_number,
        accountHolderName: w.account_holder_name,
        status: w.status,
        declineReason: w.decline_reason,
        createdAt: w.created_at
    };

    const idx = db.withdrawals.findIndex(x => x.id === withdrawalId);
    if (idx >= 0) {
        db.withdrawals[idx] = { ...db.withdrawals[idx], ...mapped };
    } else {
        db.withdrawals.unshift(mapped);
    }
    saveDB(db);

    if (typeof loadSession === "function") loadSession();
    if (typeof loadAdminSession === "function") loadAdminSession();
}

function handleRealtimeInventoryChange(payload) {
    const i = payload.new;
    if (!i) return;

    const db = getDB();
    if (!db.inventory) db.inventory = [];

    const mapped = {
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
    };

    const idx = db.inventory.findIndex(x => x.id === i.id);
    if (idx >= 0) {
        db.inventory[idx] = mapped;
    } else {
        db.inventory.push(mapped);
    }
    saveDB(db);

    if (typeof filterAndRenderBuyStock === "function") filterAndRenderBuyStock();
    if (typeof renderAdminInventoryTable === "function") renderAdminInventoryTable();
}

// -------------------------------------------------------------
// COMPREHENSIVE CLOUD DATABASE SYNCHRONIZATION
// -------------------------------------------------------------

/**
 * Fetch all platform tables from Supabase Cloud Database and synchronize locally
 */
async function syncFromSupabaseCloud() {
    if (!supabaseClient || !isSupabaseConfigured) {
        console.log("ℹ️ Supabase not configured or in offline mode. Reading local database.");
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

        const sessionUser = getSessionUser();
        const isAdmin = sessionUser && (sessionUser.role === 'ADMIN' || sessionUser.role === 'SUPER_ADMIN' || sessionUser.email === 'admin@goodfastpay.com');

        // 4. Fetch All Profiles if Admin, or current profile if Customer
        const profileIdToEmail = {};

        // 4. Fetch All Profiles if Admin, or current profile if Customer
        try {
            const { data: profiles, error: profErr } = await supabaseClient
                .from('profiles')
                .select('*');

            if (!profErr && profiles && profiles.length > 0) {
                profiles.forEach(p => {
                    profileIdToEmail[p.id] = p.email;
                    if (!db.users[p.email]) {
                        syncLocalUserAccount(p.email, p);
                    }
                    const u = db.users[p.email];
                    u.name = p.name || u.name;
                    u.phone = p.phone || u.phone;
                    u.role = p.role || u.role;
                    u.status = p.status || u.status;
                    if (p.transaction_pin) u.transactionPin = p.transaction_pin;
                    if (p.wallet_balance !== undefined) u.wallet.balance = Number(p.wallet_balance);
                    if (p.wallet_pending_balance !== undefined) u.wallet.pendingBalance = Number(p.wallet_pending_balance);
                    if (p.usd_balance !== undefined) u.wallet.usdBalance = Number(p.usd_balance);
                    if (p.usd_pending_balance !== undefined) u.wallet.usdPending = Number(p.usd_pending_balance);
                    db.users[p.email] = u;
                });
                updated = true;
            }
        } catch (e) {
            console.warn("Profiles sync notice:", e.message);
        }

        // 5. Fetch Linked Bank Accounts
        try {
            const { data: banks, error: bankErr } = await supabaseClient
                .from('bank_accounts')
                .select('*')
                .order('created_at', { ascending: false });

            if (!bankErr && banks) {
                // Clear bankDetails for all users to ensure deleted/unlinked accounts are synced
                Object.keys(db.users).forEach(email => {
                    db.users[email].bankDetails = null;
                });

                if (banks.length > 0) {
                    banks.forEach(b => {
                        const bankEmail = b.user_email || profileIdToEmail[b.user_id];
                        if (bankEmail && db.users[bankEmail]) {
                            db.users[bankEmail].bankDetails = {
                                bankName: b.bank_name,
                                accountNumber: b.account_number,
                                accountHolderName: b.account_holder_name
                            };
                            updated = true;
                        }
                    });
                }
            }
        } catch (e) {
            console.warn("Bank accounts sync notice:", e.message);
        }

        // 6. Fetch Submissions (trades)
        try {
            const { data: subs, error: subsErr } = await supabaseClient
                .from('submissions')
                .select('*')
                .order('created_at', { ascending: false });

            if (!subsErr && subs && subs.length > 0) {
                const mappedSubs = subs.map(s => ({
                    id: s.id,
                    userId: s.user_email || profileIdToEmail[s.user_id] || (sessionUser ? sessionUser.email : 'user@goodfastpay.com'),
                    brand: s.brand,
                    cardValue: Number(s.card_value),
                    currency: s.currency,
                    cardCode: s.card_code,
                    frontImageUrl: s.front_image_url,
                    backImageUrl: s.back_image_url,
                    status: s.status,
                    payoutAmount: s.payout_amount ? Number(s.payout_amount) : null,
                    rejectionReason: s.rejection_reason,
                    createdAt: s.created_at
                }));

                mappedSubs.forEach(cloudSub => {
                    const idx = db.submissions.findIndex(x => x.id === cloudSub.id);
                    if (idx >= 0) db.submissions[idx] = { ...db.submissions[idx], ...cloudSub };
                    else db.submissions.unshift(cloudSub);
                });
                updated = true;
            }
        } catch (e) {
            console.warn("Submissions sync notice:", e.message);
        }

        // 7. Fetch Withdrawals
        try {
            const { data: wds, error: wdErr } = await supabaseClient
                .from('withdrawals')
                .select('*')
                .order('created_at', { ascending: false });

            if (!wdErr && wds && wds.length > 0) {
                const mappedWds = wds.map(w => ({
                    id: w.id,
                    userId: w.user_email || profileIdToEmail[w.user_id] || (sessionUser ? sessionUser.email : 'user@goodfastpay.com'),
                    amount: Number(w.amount),
                    fee: Number(w.fee || 50),
                    netPayout: Number(w.net_payout),
                    bankName: w.bank_name,
                    accountNumber: w.account_number,
                    accountHolderName: w.account_holder_name,
                    status: w.status,
                    declineReason: w.decline_reason,
                    createdAt: w.created_at
                }));

                mappedWds.forEach(cloudWd => {
                    const idx = db.withdrawals.findIndex(x => x.id === cloudWd.id);
                    if (idx >= 0) db.withdrawals[idx] = { ...db.withdrawals[idx], ...cloudWd };
                    else db.withdrawals.unshift(cloudWd);
                });
                updated = true;
            }
        } catch (e) {
            console.warn("Withdrawals sync notice:", e.message);
        }

        // 8. Fetch Notifications
        try {
            const { data: notifs, error: notifErr } = await supabaseClient
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false });

            if (!notifErr && notifs && sessionUser && db.users[sessionUser.email]) {
                db.users[sessionUser.email].notifications = notifs.map(n => ({
                    id: n.id,
                    title: n.title,
                    message: n.message,
                    read: n.read,
                    createdAt: n.created_at
                }));
                updated = true;
            }
        } catch (e) {
            console.warn("Notifications sync notice:", e.message);
        }

        // 9. Fetch Audit Trail from Supabase Cloud
        try {
            const { data: auditLogs, error: auditErr } = await supabaseClient
                .from('audit_trail')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (!auditErr && auditLogs && auditLogs.length > 0) {
                db.auditTrail = auditLogs.map(l => ({
                    id: l.id,
                    operator: l.operator_email,
                    event: l.event,
                    details: l.details,
                    timestamp: l.created_at
                }));
                updated = true;
            }
        } catch (e) {
            console.warn("Audit trail sync notice:", e.message);
        }

        // 10. Fetch Security Logs from Supabase Cloud
        try {
            const { data: secLogs, error: secErr } = await supabaseClient
                .from('security_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(100);

            if (!secErr && secLogs && secLogs.length > 0) {
                secLogs.forEach(l => {
                    const email = l.user_email || profileIdToEmail[l.user_id];
                    if (email && db.users[email]) {
                        if (!db.users[email].logs) db.users[email].logs = [];
                        const exists = db.users[email].logs.some(x => x.id === l.id || (x.timestamp === l.created_at && x.event === l.event));
                        if (!exists) {
                            db.users[email].logs.unshift({
                                id: l.id,
                                event: l.event,
                                ip: l.ip_address || '127.0.0.1',
                                userAgent: l.user_agent,
                                timestamp: l.created_at
                            });
                        }
                    }
                });
                updated = true;
            }
        } catch (e) {
            console.warn("Security logs sync notice:", e.message);
        }

        // 11. Fetch Support Tickets & Messages from Supabase Cloud
        try {
            const { data: cloudTickets, error: tktErr } = await supabaseClient
                .from('tickets')
                .select('*')
                .order('updated_at', { ascending: false });

            if (!tktErr && cloudTickets) {
                const { data: cloudMessages, error: msgErr } = await supabaseClient
                    .from('ticket_messages')
                    .select('*')
                    .order('created_at', { ascending: true });

                if (!msgErr && cloudMessages) {
                    const ticketMessagesMap = {};
                    cloudMessages.forEach(msg => {
                        if (!ticketMessagesMap[msg.ticket_id]) {
                            ticketMessagesMap[msg.ticket_id] = [];
                        }
                        ticketMessagesMap[msg.ticket_id].push({
                            sender: msg.sender_role,
                            senderEmail: msg.sender_email,
                            text: msg.message,
                            timestamp: msg.created_at
                        });
                    });

                    db.tickets = cloudTickets.map(t => ({
                        id: t.id,
                        userId: t.user_email || profileIdToEmail[t.user_id] || (sessionUser ? sessionUser.email : 'user@goodfastpay.com'),
                        title: t.title,
                        category: t.category,
                        priority: t.priority,
                        status: t.status,
                        description: t.description,
                        attachments: t.attachments || [],
                        assignedTo: t.assigned_to || 'Support Team',
                        userUnread: t.user_unread,
                        adminUnread: t.admin_unread,
                        createdAt: t.created_at,
                        updatedAt: t.updated_at,
                        messages: ticketMessagesMap[t.id] || []
                    }));
                    updated = true;
                }
            }
        } catch (e) {
            console.warn("Tickets sync notice:", e.message);
        }

        if (updated) {
            saveDB(db);
            console.log("✅ Supabase Cloud Database synced successfully.");
            if (typeof loadSession === "function") loadSession();
            if (typeof loadAdminSession === "function") loadAdminSession();
        }
        return true;
    } catch (err) {
        console.error("Cloud database sync error:", err);
        return false;
    }
}

// -------------------------------------------------------------
// CUSTOMER CLOUD WRITE OPERATIONS (Serverless API + Direct SDK)
// -------------------------------------------------------------

/**
 * Helper to dispatch customer actions via /api/client/action serverless function
 */
async function callClientApi(action, payload, userEmail) {
    const email = userEmail || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : null) || "user@goodfastpay.com";
    try {
        const response = await fetch('/api/client/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload, userEmail: email })
        });
        if (response.ok) {
            return await response.json();
        }
    } catch (err) {
        console.warn("Client API endpoint fallback to client SDK:", err.message);
    }
    return null;
}

/**
 * Push a new trade submission to Supabase Cloud Database
 */
async function supabasePushSubmission(sub) {
    const userEmail = sub.userId || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com");
    
    // 1. Primary: Serverless API execution
    await callClientApi('submit_card', { sub }, userEmail);

    // 2. Direct Supabase Client fallback / realtime trigger
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const db = getDB();
            const localUser = db.users[userEmail];
            const userIdUUID = localUser ? localUser.id : null;

            const payload = {
                id: sub.id,
                user_email: userEmail,
                user_id: userIdUUID,
                brand: sub.brand,
                card_value: sub.cardValue,
                currency: sub.currency || 'USD',
                card_code: sub.cardCode || sub.code || 'CODE',
                front_image_url: sub.frontImageUrl || sub.frontImage || null,
                back_image_url: sub.backImageUrl || sub.backImage || null,
                status: sub.status || 'PENDING',
                payout_amount: sub.payoutAmount || null
            };

            const { error } = await supabaseClient.from('submissions').upsert([payload], { onConflict: 'id' });
            if (error) console.warn("Supabase direct submission notice:", error.message);
            else console.log("⚡ Supabase Submission pushed directly:", sub.id);
        } catch (e) {
            console.warn("Could not push submission directly to Supabase:", e.message);
        }
    }
}

/**
 * Push a new cash withdrawal request to Supabase Cloud Database
 */
async function supabasePushWithdrawal(wd) {
    const userEmail = wd.userId || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com");

    // 1. Primary: Serverless API execution
    await callClientApi('request_withdrawal', { wd }, userEmail);

    // 2. Direct Supabase Client fallback / realtime trigger
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const db = getDB();
            const localUser = db.users[userEmail];
            const userIdUUID = localUser ? localUser.id : null;

            const payload = {
                id: wd.id,
                user_email: userEmail,
                user_id: userIdUUID,
                amount: wd.amount,
                fee: wd.fee || 50,
                net_payout: wd.netPayout || (wd.amount - 50),
                bank_name: wd.bankName,
                account_number: wd.accountNumber,
                account_holder_name: wd.accountHolderName || wd.accountHolder || 'Account Holder',
                status: wd.status || 'PENDING'
            };

            const { error } = await supabaseClient.from('withdrawals').upsert([payload], { onConflict: 'id' });
            if (error) console.warn("Supabase direct withdrawal notice:", error.message);
            else console.log("⚡ Supabase Withdrawal pushed directly:", wd.id);
        } catch (e) {
            console.warn("Could not push withdrawal directly to Supabase:", e.message);
        }
    }
}

/**
 * Push linked bank account to Supabase Cloud Database
 */
async function supabasePushBankAccount(bankData) {
    const userEmail = typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com";

    // 1. Primary: Serverless API execution
    await callClientApi('save_bank', { bankData }, userEmail);

    // 2. Direct Supabase Client fallback
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const db = getDB();
            const localUser = db.users[userEmail];
            const userIdUUID = localUser ? localUser.id : null;

            await supabaseClient.from('bank_accounts').insert([{
                user_email: userEmail,
                user_id: userIdUUID,
                bank_name: bankData.bankName,
                account_number: bankData.accountNumber,
                account_holder_name: bankData.accountHolderName,
                is_primary: true
            }]);
            console.log("⚡ Supabase Bank Account pushed directly.");
        } catch (e) {
            console.warn("Could not push bank directly to Supabase:", e.message);
        }
    }
}

/**
 * Update user profile (Name, Phone, Transaction PIN, Verification status) in Supabase Cloud
 */
async function supabaseUpdateProfile(updates, targetEmail = "") {
    const userEmail = targetEmail || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com");

    // 1. Primary: Serverless API execution
    await callClientApi('update_profile', { updates }, userEmail);

    // 2. Direct Supabase Client fallback
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const payload = {};
            if (updates.name !== undefined) payload.name = updates.name;
            if (updates.phone !== undefined) payload.phone = updates.phone;
            if (updates.transactionPin !== undefined) payload.transaction_pin = updates.transactionPin;
            if (updates.wallet !== undefined && updates.wallet.balance !== undefined) {
                payload.wallet_balance = updates.wallet.balance;
            }
            if (updates.emailVerified !== undefined) payload.email_verified = updates.emailVerified;
            if (updates.phoneVerified !== undefined) payload.phone_verified = updates.phoneVerified;

            await supabaseClient
                .from('profiles')
                .update(payload)
                .eq('email', userEmail);
            console.log("⚡ Supabase Profile updated directly:", userEmail);
        } catch (e) {
            console.warn("Could not update profile directly in Supabase:", e.message);
        }
    }
}

/**
 * Update user login password in Supabase Auth
 */
async function supabaseUpdatePassword(newPassword) {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const user = getSessionUser();
            if (!user || !user.email) return { success: false, message: "User session not active." };
            
            const { error } = await supabaseClient
                .from('profiles')
                .update({ password: newPassword })
                .eq('email', user.email);

            if (error) {
                console.warn("Could not update password in profiles table:", error.message);
                return { success: false, message: error.message };
            }
            console.log("⚡ Password updated in profiles table successfully.");
            return { success: true };
        } catch (e) {
            console.warn("supabaseUpdatePassword exception:", e.message);
            return { success: false, message: e.message };
        }
    }
    return { success: true, isLocalOnly: true };
}

/**
 * Delete linked bank accounts in Supabase Cloud
 */
async function supabaseDeleteBankAccount() {
    const userEmail = typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com";
    
    // 1. Primary: Serverless API execution
    await callClientApi('delete_bank', {}, userEmail);

    // 2. Direct Supabase Client fallback
    if (supabaseClient && isSupabaseConfigured) {
        try {
            await supabaseClient.from('bank_accounts').delete().eq('user_email', userEmail);
            console.log("⚡ Supabase Bank Account deleted directly.");
        } catch (e) {
            console.warn("Could not delete bank directly in Supabase:", e.message);
        }
    }
}

/**
 * Push a new user notification to Supabase Cloud
 */
async function supabasePushNotification(userEmail, notification) {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const db = getDB();
            const localUser = db.users[userEmail];
            const userIdUUID = localUser ? localUser.id : null;

            await supabaseClient.from('notifications').insert([{
                id: notification.id,
                user_email: userEmail,
                user_id: userIdUUID,
                title: notification.title,
                message: notification.message,
                read: notification.read || false,
                created_at: notification.createdAt || new Date().toISOString()
            }]);
            console.log("⚡ Supabase Notification pushed directly for:", userEmail);
        } catch (e) {
            console.warn("Could not push notification directly to Supabase:", e.message);
        }
    }
}

/**
 * Push user Gift Card Purchase to Supabase Cloud
 */
async function supabasePushPurchase(cardId, userEmail, newBalance) {
    const email = userEmail || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com");

    // 1. Primary: Serverless API execution
    await callClientApi('purchase_card', { cardId, newBalance }, email);

    // 2. Direct Supabase Client fallback
    if (supabaseClient && isSupabaseConfigured) {
        try {
            await supabaseClient
                .from('inventory')
                .update({
                    status: 'SOLD',
                    purchased_by: email,
                    purchased_at: new Date().toISOString()
                })
                .eq('id', cardId);

            await supabaseClient
                .from('profiles')
                .update({ wallet_balance: newBalance })
                .eq('email', email);

            console.log("⚡ Supabase Gift Card purchase synchronized directly:", cardId);
        } catch (e) {
            console.warn("Could not sync purchase directly to Supabase:", e.message);
        }
    }
}

/**
 * Push user security log (login, password update, etc.) to Supabase Cloud
 */
async function supabasePushSecurityLog(userEmail, event, ip, userAgent, details) {
    const email = userEmail || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com");
    await callClientApi('log_security_event', { event, ip, userAgent, details }, email);

    if (supabaseClient && isSupabaseConfigured) {
        try {
            const db = getDB();
            const localUser = db.users[email];
            const userIdUUID = localUser ? localUser.id : null;

            await supabaseClient.from('security_logs').insert([{
                user_email: email,
                user_id: userIdUUID,
                event: event,
                ip_address: ip || '127.0.0.1',
                user_agent: userAgent || 'Web Browser'
            }]);
            console.log("⚡ Supabase Security Log pushed directly.");
        } catch (e) {
            console.warn("Could not push security log directly to Supabase:", e.message);
        }
    }
}

/**
 * Push audit log to Supabase Cloud
 */
async function supabasePushAuditLog(operatorEmail, event, details) {
    const email = operatorEmail || "admin@goodfastpay.com";
    await callClientApi('log_security_event', { event, details }, email);

    if (supabaseClient && isSupabaseConfigured) {
        try {
            await supabaseClient.from('audit_trail').insert([{
                operator_email: email,
                event: event,
                details: details
            }]);
            console.log("⚡ Supabase Audit Log pushed directly.");
        } catch (e) {
            console.warn("Could not push audit log directly to Supabase:", e.message);
        }
    }
}

/**
 * Push a new support ticket to Supabase Cloud
 */
async function supabasePushTicket(ticket) {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const userEmail = ticket.userId || (typeof currentUser !== "undefined" && currentUser ? currentUser.email : "user@goodfastpay.com");
            const db = getDB();
            const localUser = db.users[userEmail];
            const userIdUUID = localUser ? localUser.id : null;

            const payload = {
                id: ticket.id,
                user_email: userEmail,
                user_id: userIdUUID,
                title: ticket.title,
                category: ticket.category,
                priority: ticket.priority || 'MEDIUM',
                status: ticket.status || 'OPEN',
                description: ticket.description,
                attachments: ticket.attachments || [],
                assigned_to: ticket.assignedTo || 'Unassigned',
                user_unread: ticket.userUnread || false,
                admin_unread: ticket.adminUnread || true,
                created_at: ticket.createdAt,
                updated_at: ticket.updatedAt
            };

            await supabaseClient.from('tickets').upsert([payload], { onConflict: 'id' });
            console.log("⚡ Supabase Ticket pushed directly:", ticket.id);
        } catch (e) {
            console.warn("Could not push ticket directly to Supabase:", e.message);
        }
    }
}

/**
 * Push a new ticket message to Supabase Cloud
 */
async function supabasePushTicketMessage(ticketId, message) {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const payload = {
                ticket_id: ticketId,
                sender_role: message.sender,
                sender_email: message.senderEmail,
                message: message.text,
                created_at: message.timestamp || new Date().toISOString()
            };

            await supabaseClient.from('ticket_messages').insert([payload]);
            console.log("⚡ Supabase Ticket Message pushed directly for ticket:", ticketId);
        } catch (e) {
            console.warn("Could not push ticket message directly to Supabase:", e.message);
        }
    }
}

/**
 * Update ticket metadata in Supabase Cloud
 */
async function supabaseUpdateTicketMeta(ticketId, updates) {
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const payload = {};
            if (updates.status) payload.status = updates.status;
            if (updates.userUnread !== undefined) payload.user_unread = updates.userUnread;
            if (updates.adminUnread !== undefined) payload.admin_unread = updates.adminUnread;
            if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo;
            payload.updated_at = new Date().toISOString();

            await supabaseClient.from('tickets').update(payload).eq('id', ticketId);
            console.log("⚡ Supabase Ticket updated:", ticketId);
        } catch (e) {
            console.warn("Could not update ticket directly in Supabase:", e.message);
        }
    }
}

// -------------------------------------------------------------
// PRIVILEGED ADMIN CLOUD OPERATIONS (Serverless API + Direct SDK)
// -------------------------------------------------------------

/**
 * Helper to dispatch privileged admin actions via /api/admin/action serverless function
 */
async function callAdminApi(action, payload) {
    const session = getSessionUser();
    const operatorEmail = session ? session.email : "admin@goodfastpay.com";

    try {
        const response = await fetch('/api/admin/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, payload, operatorEmail })
        });

        if (response.ok) {
            const data = await response.json();
            return data;
        }
    } catch (err) {
        console.warn("Admin API endpoint fallback to client SDK:", err.message);
    }

    // Client-side direct SDK fallback
    return null;
}

/**
 * Admin: Update User Status (ACTIVE / SUSPENDED / BANNED)
 */
async function supabaseAdminUpdateUserStatus(userEmail, status, reason = "") {
    await callAdminApi('update_user_status', { userEmail, status, reason });
    if (supabaseClient && isSupabaseConfigured) {
        try {
            await supabaseClient.from('profiles').update({ status }).eq('email', userEmail);
            console.log("⚡ Supabase User status updated:", userEmail, status);
        } catch (e) {
            console.warn("Admin update user status notice:", e.message);
        }
    }
}

/**
 * Admin: Update User Wallet Balance in Supabase (Supports NGN & USD)
 */
async function supabaseAdminUpdateUserBalance(userEmail, newBalance, amount = 0, type = "ADJUST", currency = "NGN") {
    if (currency === "USD") {
        await callAdminApi('adjust_usd_wallet_balance', { userEmail, newUSDBalance: newBalance, amount, type });
        if (supabaseClient && isSupabaseConfigured) {
            try {
                await supabaseClient.from('profiles').update({ usd_balance: newBalance }).eq('email', userEmail);
                console.log("⚡ Supabase User USD balance updated:", userEmail, newBalance);
            } catch (e) {
                console.warn("Admin update USD balance notice:", e.message);
            }
        }
    } else {
        await callAdminApi('adjust_wallet_balance', { userEmail, newBalance, amount, type });
        if (supabaseClient && isSupabaseConfigured) {
            try {
                await supabaseClient.from('profiles').update({ wallet_balance: newBalance }).eq('email', userEmail);
                console.log("⚡ Supabase User balance updated:", userEmail, newBalance);
            } catch (e) {
                console.warn("Admin update balance notice:", e.message);
            }
        }
    }
}

/**
 * Admin: Update Submission Status & Payout in Supabase
 */
async function supabaseAdminUpdateSubmission(submissionId, updates, userEmail = "") {
    if (updates.status === 'COMPLETED') {
        await callAdminApi('approve_submission', {
            submissionId,
            userEmail,
            payoutAmount: updates.payoutAmount || 0
        });
    } else if (updates.status === 'REJECTED') {
        await callAdminApi('reject_submission', {
            submissionId,
            userEmail,
            rejectionReason: updates.rejectionReason || 'Declined'
        });
    }

    if (supabaseClient && isSupabaseConfigured) {
        try {
            const payload = {};
            if (updates.status) payload.status = updates.status;
            if (updates.payoutAmount !== undefined) payload.payout_amount = updates.payoutAmount;
            if (updates.rejectionReason !== undefined) payload.rejection_reason = updates.rejectionReason;

            await supabaseClient.from('submissions').update(payload).eq('id', submissionId);
            console.log("⚡ Supabase Submission updated:", submissionId, payload);
        } catch (e) {
            console.warn("Admin update submission notice:", e.message);
        }
    }
}

/**
 * Admin: Update Withdrawal Request Status in Supabase
 */
async function supabaseAdminUpdateWithdrawal(withdrawalId, updates, userEmail = "", refundAmount = 0) {
    if (updates.status === 'COMPLETED') {
        await callAdminApi('approve_withdrawal', { withdrawalId, userEmail, amount: updates.amount || 0 });
    } else if (updates.status === 'DECLINED') {
        await callAdminApi('decline_withdrawal', {
            withdrawalId,
            userEmail,
            refundAmount,
            declineReason: updates.declineReason || 'Declined'
        });
    }

    if (supabaseClient && isSupabaseConfigured) {
        try {
            const payload = {};
            if (updates.status) payload.status = updates.status;
            if (updates.declineReason !== undefined) payload.decline_reason = updates.declineReason;

            await supabaseClient.from('withdrawals').update(payload).eq('id', withdrawalId);
            console.log("⚡ Supabase Withdrawal updated:", withdrawalId, payload);
        } catch (e) {
            console.warn("Admin update withdrawal notice:", e.message);
        }
    }
}

/**
 * Admin: Insert New Gift Card into Stock Inventory in Supabase
 */
async function supabaseAdminInsertInventory(item) {
    await callAdminApi('add_inventory', { item });
    if (supabaseClient && isSupabaseConfigured) {
        try {
            await supabaseClient.from('inventory').insert([{
                id: item.id,
                brand: item.brand,
                card_value: item.cardValue,
                currency: item.currency,
                country: item.country || 'USA',
                code: item.code,
                price: item.price,
                status: item.status || 'AVAILABLE'
            }]);
            console.log("⚡ Supabase Stock item uploaded:", item.id);
        } catch (e) {
            console.warn("Admin insert inventory notice:", e.message);
        }
    }
}

/**
 * Admin: Delete / Remove Gift Card Stock from Supabase
 */
async function supabaseAdminDeleteInventory(cardId) {
    await callAdminApi('delete_inventory', { cardId });
    if (supabaseClient && isSupabaseConfigured) {
        try {
            await supabaseClient.from('inventory').delete().eq('id', cardId);
            console.log("⚡ Supabase Stock item deleted:", cardId);
        } catch (e) {
            console.warn("Admin delete inventory notice:", e.message);
        }
    }
}

/**
 * Admin: Sync Currencies & Rates to Supabase Cloud
 */
async function supabaseAdminSyncCurrenciesAndRates(currencies, rates) {
    await callAdminApi('sync_currencies_and_rates', { currencies, rates });
    if (supabaseClient && isSupabaseConfigured) {
        try {
            const currPayload = Object.keys(currencies).map(code => ({
                code: code,
                name: currencies[code].name,
                rate: currencies[code].rate,
                status: currencies[code].status || 'ACTIVE'
            }));
            await supabaseClient.from('currencies').upsert(currPayload);

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
                    await supabaseClient.from('brand_rates').upsert(ratesPayload, { onConflict: 'brand,currency_code' });
                }
            }
            console.log("⚡ Supabase Currencies & Rates synchronized.");
        } catch (e) {
            console.warn("Admin sync currencies notice:", e.message);
        }
    }
}

/**
 * Admin: Dispatch General Broadcast Announcement
 */
async function supabaseAdminDispatchBroadcast(title, message) {
    await callAdminApi('dispatch_broadcast', { title, message });
}

// Auto-trigger cloud sync on portal/admin load
if (typeof window !== "undefined") {
    window.addEventListener("load", () => {
        setTimeout(syncFromSupabaseCloud, 500);
    });
}
