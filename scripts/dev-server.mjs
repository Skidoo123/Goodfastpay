// Local dev server: static files + Vercel-style /api/* mounting (no login needed).
// Usage: node scripts/dev-server.mjs [port]   (defaults to 3000)
// NOTE: without SUPABASE_* env vars, /api/* fail closed (401/500) by design.
import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 3000;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
};

const ROUTES = {
  '/api/config': '../api/config.js',
  '/api/client/action': '../api/client/action.js',
  '/api/admin/action': '../api/admin/action.js',
};

function makeRes(raw) {
  const headers = {};
  return {
    setHeader: (k, v) => { headers[k] = v; },
    status: (code) => ({
      json: (obj) => {
        const body = JSON.stringify(obj);
        raw.writeHead(code, { 'Content-Type': 'application/json', ...headers });
        raw.end(body);
      },
      end: (data) => {
        raw.writeHead(code, headers);
        raw.end(data);
      },
    }),
  };
}

const server = http.createServer(async (rawReq, rawRes) => {
  const url = new URL(rawReq.url, 'http://localhost');
  const route = ROUTES[url.pathname];

  if (route) {
    let body = '';
    for await (const chunk of rawReq) body += chunk;
    let parsed = {};
    if (body) {
      try { parsed = JSON.parse(body); } catch { parsed = {}; }
    }
    const req = {
      method: rawReq.method,
      headers: rawReq.headers,
      body: parsed,
      socket: rawReq.socket,
    };
    try {
      const mod = await import(route + `?t=${Date.now()}`);
      await mod.default(req, makeRes(rawRes));
    } catch (e) {
      console.error(`[api] ${url.pathname}:`, e.message);
      rawRes.writeHead(500, { 'Content-Type': 'application/json' });
      rawRes.end(JSON.stringify({ ok: false, error: { code: 'LOCAL_DEV_ERROR', message: e.message } }));
    }
    return;
  }

  let path = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = join(ROOT, decodeURIComponent(path));
  try {
    if (!file.startsWith(ROOT) || !statSync(file).isFile()) throw new Error('nope');
    rawRes.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    rawRes.end(readFileSync(file));
  } catch {
    rawRes.writeHead(404, { 'Content-Type': 'text/plain' });
    rawRes.end('not found');
  }
});

server.listen(PORT, () => console.log(`Goodfastpay local dev → http://localhost:${PORT}`));
