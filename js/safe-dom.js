// Safe DOM helpers. Use these instead of innerHTML / document.write / inline onclick.
// - esc(): escape for HTML string interpolation (only when innerHTML is unavoidable)
// - setText(): preferred text write (no HTML parsing at all)
// - el(): build elements without touching innerHTML

const MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };

export function esc(v) {
  return String(v ?? '').replace(/[&<>"'`]/g, (c) => MAP[c]);
}

export function escAttr(v) {
  return esc(v).replace(/\r?\n/g, ' ');
}

export function setText(elm, value) {
  if (!elm) return;
  elm.textContent = value == null ? '' : String(value);
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

/** Minimal allowlist sanitiser for the few places that must render rich text. */
export function sanitizeRich(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html ?? '');
  const ALLOWED = new Set(['B', 'I', 'U', 'EM', 'STRONG', 'P', 'BR', 'UL', 'OL', 'LI', 'A', 'SPAN', 'DIV']);
  const walk = (n) => {
    for (const child of [...n.children]) {
      if (!ALLOWED.has(child.tagName)) { child.replaceWith(document.createTextNode(child.textContent)); continue; }
      for (const attr of [...child.attributes]) {
        const name = attr.name.toLowerCase();
        const isSafeHref = name === 'href' && /^(https?:|mailto:)/i.test(attr.value);
        if (!(name === 'class' || isSafeHref)) child.removeAttribute(attr.name);
      }
      walk(child);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}
