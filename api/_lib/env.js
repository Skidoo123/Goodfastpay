export function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return v;
}

export function optionalEnv(name, fallback = '') {
  return process.env[name] ?? fallback;
}

export function allowedOrigins() {
  return optionalEnv('ALLOWED_ORIGINS', '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
