// Static tests: Google/external OAuth hardening.
// Rule coverage: no local session minting, provider allowlist, verified-email gate.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../helpers/repo.js';

const SRC = readFileSync(join(ROOT, 'js/supabase-config.js'), 'utf8');
const INDEX = readFileSync(join(ROOT, 'index.html'), 'utf8');

function oauthFn() {
  const start = SRC.indexOf('async function supabaseAuthSignInWithOAuth');
  assert.ok(start !== -1, 'OAuth function exists');
  const nextFn = SRC.indexOf('\nasync function ', start + 10);
  const nextPlain = SRC.indexOf('\nfunction ', start + 10);
  const endCandidates = [nextFn, nextPlain].filter((i) => i !== -1);
  return SRC.slice(start, Math.min(...endCandidates));
}

test('OAuth providers are allowlisted', () => {
  assert.ok(SRC.includes('OAUTH_ALLOWED_PROVIDERS'), 'allowlist constant exists');
  for (const p of ['google', 'github', 'apple']) {
    assert.ok(SRC.includes(`'${p}'`), `allowlist includes ${p}`);
  }
  const fn = oauthFn();
  assert.ok(fn.includes('OAUTH_ALLOWED_PROVIDERS.includes(provider)'), 'provider checked');
});

test('OAuth never mints local sessions (no demo fallback)', () => {
  const fn = oauthFn();
  assert.ok(!fn.includes('syncLocalUserAccount'), 'no local account creation in OAuth');
  assert.ok(!fn.includes('setSessionUser'), 'no local session in OAuth');
  assert.ok(!fn.includes('isLocalFallback'), 'no fallback flag in OAuth');
  assert.ok(!fn.includes('.trader@goodfastpay.com'), 'no fake trader emails');
});

test('OAuth requires configured Supabase, fails closed otherwise', () => {
  const fn = oauthFn();
  assert.ok(fn.includes('isSupabaseConfigured'), 'checks configuration');
  assert.ok(
    fn.includes('Supabase is not configured') || fn.includes('success: false'),
    'returns failure when unconfigured',
  );
});

test('OAuth uses redirect flow with consent (Google)', () => {
  const fn = oauthFn();
  assert.ok(fn.includes('signInWithOAuth'), 'uses Supabase OAuth (PKCE)');
  assert.ok(fn.includes('redirectTo'), 'sets redirect target');
  assert.ok(fn.includes("prompt"), 'requests consent screen');
});

test('callback gate requires confirmed email', () => {
  assert.ok(SRC.includes('email_confirmed_at'), 'checks email confirmation');
  assert.ok(SRC.includes('auth.signOut()'), 'drops unconfirmed sessions');
});

test('index.html wires Google button to the hardened function', () => {
  assert.ok(
    INDEX.includes(`supabaseAuthSignInWithOAuth('google')`),
    'Google button calls supabaseAuthSignInWithOAuth',
  );
});
