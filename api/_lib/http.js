import { allowedOrigins } from './env.js';

export function applyCors(req, res) {
  const origin = req.headers.origin || '';
  const list = allowedOrigins();
  if (origin && list.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function ok(res, payload = {}) {
  res.status(200).json({ ok: true, ...payload });
}

export function fail(res, status, code, message) {
  res.status(status).json({ ok: false, error: { code, message } });
}

export function readBody(req) {
  const b = req.body;
  if (b == null) return {};
  if (typeof b === 'string') {
    try { return JSON.parse(b); } catch { throw new Error('Malformed JSON body'); }
  }
  return b;
}

export function methodGuard(req, res, allowed = ['POST']) {
  if (req.method === 'OPTIONS') { res.status(204).end(); return false; }
  if (!allowed.includes(req.method)) {
    res.setHeader('Allow', allowed.join(', '));
    fail(res, 405, 'METHOD_NOT_ALLOWED', `Use ${allowed.join('/')}`);
    return false;
  }
  return true;
}
