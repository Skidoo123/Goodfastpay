import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readdirSync, statSync } from 'node:fs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function listFiles(exts = ['.js', '.mjs']) {
  const out = [];
  (function walk(dir) {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.git' || name.startsWith('.')) continue;
      const p = join(dir, name);
      let st;
      try { st = statSync(p); } catch { continue; }
      if (st.isDirectory()) walk(p);
      else if (exts.some((e) => name.endsWith(e))) out.push(p);
    }
  })(ROOT);
  return out;
}

export function jsFiles() {
  return listFiles(['.js', '.mjs']);
}
