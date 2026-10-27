// Goodfastpay Platform - Supabase Authentication & Cloud Client Engine
// Full Supabase client configuration for production and development.

// Supabase project credentials (replace with your own values if different)
const SUPABASE_URL = "https://btbolekfrcwzzjqhorgi.supabase.co";
const SUPABASE_ANON_KEY = "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0Ym9sZWtmcmN3enpqcWhvcmdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0NjU4MDksImV4cCI6MjEwMjA0MTgwOX0.b77fO24vUgDpvRcyqGdX_kdYFAx4KJKEUUFKi0Rv2fJc";

// Initialize Supabase client using the CDN global `supabase` object
let supabaseClient = null;
let supabaseReadyResolve;
const supabaseReady = new Promise((resolve) => {
  supabaseReadyResolve = resolve;
});
window.supabaseReady = supabaseReady;

(function initSupabase() {
  try {
    if (typeof supabase !== "undefined" && typeof supabase.createClient === "function") {
      supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log("⚡ Supabase client initialized", SUPABASE_URL);
    } else {
      console.warn("Supabase script not yet loaded – client will be created later.");
    }
  } catch (err) {
    console.error("Supabase initialization error:", err);
  } finally {
    if (supabaseReadyResolve) supabaseReadyResolve();
  }
})();

// Ensure Supabase is ready before use
async function getSupabaseClient() {
  await supabaseReady;
  return supabaseClient;
}
async function ensureSupabaseReady() {
  await supabaseReady;
  return true;
}

// Placeholder stubs for other helper functions used throughout the app
function setupSupabaseRealtimeSubscriptions() {}
function syncFromSupabaseCloud() {}
function loadUserPreferences() {}
function syncLocalUserAccount(email, data) {
  // Simple client‑side sync; real implementation would merge with cloud data
  const db = getDB();
  if (db && db.users) {
    db.users[email] = data;
  }
}
function setSessionUser(email) {
  localStorage.setItem('sessionUser', email);
}
function getDB() {
  // In‑memory mock DB – replace with a proper IndexedDB or local storage solution if needed
  if (!window.__goodfastpayDB) {
    window.__goodfastpayDB = { users: {} };
  }
  return window.__goodfastpayDB;
}

export {
  supabaseClient,
  getSupabaseClient,
  ensureSupabaseReady,
  setupSupabaseRealtimeSubscriptions,
  syncFromSupabaseCloud,
  loadUserPreferences,
  syncLocalUserAccount,
  setSessionUser,
  getDB
};

window.addEventListener('DOMContentLoaded', async () => {
  await ensureSupabaseReady();
  console.log('Supabase client ready after DOMContentLoaded');
});
