// supabase-config.js – local stub (Supabase removed)
// Export dummy client and helper functions to keep other modules working.
export const supabaseClient = null;
export const getSupabaseClient = async () => null;
export const ensureSupabaseReady = async () => true;
export const setupSupabaseRealtimeSubscriptions = () => {};
export const syncFromSupabaseCloud = () => {};
export const loadUserPreferences = () => {};
export const syncLocalUserAccount = () => {};
export const setSessionUser = (email) => { localStorage.setItem('sessionUser', email); };
export const getDB = () => ({ users: {} });
