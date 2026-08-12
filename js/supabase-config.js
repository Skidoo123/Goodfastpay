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
            const storedUrl = localStorage.getItem("goodfastpay_supabase_url") || SUPABASE_URL;
            const storedKey = localStorage.getItem("goodfastpay_supabase_key") || SUPABASE_ANON_KEY;

            if (storedUrl && !storedUrl.includes("your-project-id") && storedKey && !storedKey.includes("your-anon-public-key")) {
                supabaseClient = supabase.createClient(storedUrl, storedKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                isSupabaseConfigured = true;
                window.supabaseClient = supabaseClient;
                console.log("⚡ Supabase Client initialized & connected successfully to:", storedUrl);
            } else {
                supabaseClient = supabase.createClient(storedUrl, storedKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                });
                window.supabaseClient = supabaseClient;
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
 */
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
            return { success: false, message: e.message || "Supabase registration failed." };
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
            return { success: false, message: e.message || "Supabase sign in failed." };
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
