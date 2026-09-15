export function isEmail(v) {
  return typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export function isUuid(v) {
  return typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function money(v, { min = 0.01, max = 100_000_000 } = {}) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error('AMOUNT_NOT_NUMERIC');
  if (n < min || n > max) throw new Error('AMOUNT_OUT_OF_RANGE');
  return Math.round(n * 100) / 100;
}

export function str(v, { min = 1, max = 500, name = 'field' } = {}) {
  if (typeof v !== 'string') throw new Error(`${name}_NOT_STRING`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw new Error(`${name}_BAD_LENGTH`);
  return s;
}

/** Allowlist object projection — prevents mass-assignment. */
export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj != null && k in obj) out[k] = obj[k];
  return out;
}

export function newReferenceId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
