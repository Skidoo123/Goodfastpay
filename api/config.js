import { optionalEnv } from './_lib/env.js';
import { applyCors, fail, methodGuard } from './_lib/http.js';

// Returns PUBLIC configuration only. Never secrets, never fallbacks with real values.
export default function handler(req, res) {
  applyCors(req, res);
  if (!methodGuard(req, res, ['GET'])) return;

  const url = optionalEnv('PUBLIC_SUPABASE_URL');
  const anonKey = optionalEnv('PUBLIC_SUPABASE_ANON_KEY');

  if (!url || !anonKey) {
    return fail(res, 500, 'CONFIG_MISSING', 'Supabase public config not provisioned');
  }

  // Cacheable at the edge; these values are public by design.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  res.status(200).json({ supabaseUrl: url, supabaseAnonKey: anonKey });
}
