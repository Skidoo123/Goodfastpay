import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env.js';

let _client = null;

/**
 * Service-role client. Bypasses RLS — NEVER expose, NEVER return its output raw.
 * Lazy so a missing env var fails at request time with a clear error, not at import.
 */
export function supabaseAdmin() {
  if (_client) return _client;
  _client = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return _client;
}
