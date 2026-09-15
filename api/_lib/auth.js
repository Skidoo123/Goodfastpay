import { createClient } from '@supabase/supabase-js';
import { requireEnv } from './env.js';
import { supabaseAdmin } from './supabaseAdmin.js';

let _authClient = null;
function authClient() {
  if (_authClient) return _authClient;
  _authClient = createClient(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_ANON_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return _authClient;
}

function bearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

/** Verifies a Supabase JWT. Returns { ok, user } or { ok:false, status, code, message }. */
export async function authenticate(req) {
  const token = bearer(req);
  if (!token) {
    return { ok: false, status: 401, code: 'AUTH_MISSING', message: 'Authorization bearer token required' };
  }
  const { data, error } = await authClient().auth.getUser(token);
  if (error || !data?.user) {
    return { ok: false, status: 401, code: 'AUTH_INVALID', message: 'Invalid or expired token' };
  }
  return { ok: true, user: data.user };
}

/** authenticate() + server-side role lookup. Never trust a client-supplied role. */
export async function requireAdmin(req) {
  const a = await authenticate(req);
  if (!a.ok) return a;

  const { data, error } = await supabaseAdmin()
    .from('profiles')
    .select('role')
    .eq('id', a.user.id)
    .single();

  if (error) {
    return { ok: false, status: 500, code: 'ROLE_LOOKUP_FAILED', message: 'Could not verify role' };
  }
  if (data?.role !== 'ADMIN' && data?.role !== 'SUPER_ADMIN') {
    return { ok: false, status: 403, code: 'FORBIDDEN', message: 'Admin role required' };
  }
  return { ok: true, user: a.user, role: data.role };
}
