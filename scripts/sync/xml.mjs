/**
 * Analizador XML mínimo y tolerante (sin dependencias) para feeds Atom/CODICE.
 * Ignora los espacios de nombres: los elementos se identifican por su nombre local.
 */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
export const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
  return ENT[e] ?? m;
});
const local = (n) => n.slice(n.indexOf(':') + 1);

/** @returns {{name:string, qname:string, attrs:Object, children:Array, text:string}} raíz sintética */
export function parseXML(src) {
  const root = { name: '#root', qname: '#root', attrs: {}, children: [], text: '' };
  const stack = [root];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break;
    if (lt > i) { const txt = src.slice(i, lt); if (txt.trim()) stack.at(-1).text += decode(txt); }
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt); i = e === -1 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt); stack.at(-1).text += src.slice(lt + 9, e === -1 ? n : e); i = e === -1 ? n : e + 3; continue; }
    if (src[lt + 1] === '?' || src[lt + 1] === '!') { const e = src.indexOf('>', lt); i = e === -1 ? n : e + 1; continue; }
    // localizar el cierre de la etiqueta respetando comillas
    let j = lt + 1, q = null;
    while (j < n) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
    const raw = src.slice(lt + 1, j);
    i = j + 1;
    if (raw[0] === '/') {
      const name = local(raw.slice(1).trim());
      // cerrar hasta encontrar el elemento (tolerante a XML mal formado)
      for (let k = stack.length - 1; k > 0; k--) if (stack[k].name === name) { stack.length = k; break; }
      continue;
    }
    const selfClose = raw.endsWith('/');
    const body = selfClose ? raw.slice(0, -1) : raw;
    const m = body.match(/^\s*([^\s/>]+)/);
    if (!m) continue;
    const el = { name: local(m[1]), qname: m[1], attrs: {}, children: [], text: '' };
    const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let a;
    while ((a = re.exec(body.slice(m[0].length)))) el.attrs[local(a[1])] = decode(a[3] ?? a[4]);
    stack.at(-1).children.push(el);
    if (!selfClose) stack.push(el);
  }
  return root;
}

/** Primer descendiente directo que siga la ruta de nombres locales "a/b/c". */
export function find(el, path) {
  let cur = el;
  for (const part of path.split('/')) {
    if (!cur) return null;
    cur = cur.children.find((c) => c.name === part) || null;
  }
  return cur;
}
/** Todos los elementos que siguen la ruta (el último segmento puede repetirse). */
export function findAll(el, path) {
  const parts = path.split('/');
  let set = [el];
  for (const part of parts) set = set.flatMap((e) => e.children.filter((c) => c.name === part));
  return set;
}
export const text = (el, path) => { const e = path ? find(el, path) : el; return e ? e.text.trim() : null; };
/** Busca en profundidad el primer elemento con ese nombre local. */
export function deep(el, name) {
  for (const c of el.children) { if (c.name === name) return c; const d = deep(c, name); if (d) return d; }
  return null;
}
