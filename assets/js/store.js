/**
 * store.js — Acceso a configuración, estructura, páginas y datos.
 * Lo comparten el portal público y el editor visual (admin/), que puede
 * inyectar versiones modificadas en memoria con setOverride() para previsualizar.
 */
import { pick, label } from './i18n.js';

const BASE = new URL('../../', import.meta.url).href; // raíz del portal
const cache = new Map();
const overrides = new Map();

export const url = (path) => new URL(path, BASE).href;
export function setOverride(path, obj) { overrides.set(path, obj); }
export function clearOverride(path) { overrides.delete(path); }
export function getOverride(path) { return overrides.get(path); }

export async function getJSON(path) {
  if (overrides.has(path)) return overrides.get(path);
  if (!cache.has(path)) {
    cache.set(path, fetch(url(path), { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json();
    }).catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}
export const config = () => getJSON('config/entidad.json');
export const portal = () => getJSON('content/portal.json');
export const meta = () => getJSON('data/metadata/datasets.json');
export const page = (id) => getJSON(`content/paginas/${id}.json`);
export const dataset = (id) => getJSON(`data/${id}.json`);
export const rows = async (id) => (await dataset(id)).datos || [];
export const syncStatus = () => getJSON('data/sync/estado.json').catch(() => null);
export async function dsMeta(id) { return (await meta()).conjuntos.find((d) => d.id === id); }
export async function field(dsId, name) { return (await dsMeta(dsId))?.campos.find((c) => c.nombre === name); }

/** Lista plana de páginas con su categoría, en el orden del portal. */
export async function allPages() {
  const p = await portal();
  return p.categorias.flatMap((c) => c.paginas.map((id) => ({ id, categoria: c })));
}
export async function categoryOf(pageId) { return (await allPages()).find((x) => x.id === pageId)?.categoria || null; }

// ---------------------------------------------------------------------------
// Filtros declarativos: "campo=valor;otro!=x;importe>=1000"
// ---------------------------------------------------------------------------
const OPS = ['!=', '>=', '<=', '=', '>', '<'];
function coerce(v) {
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v !== '' && !Number.isNaN(Number(v))) return Number(v);
  return v;
}
export function parseFilter(expr) {
  if (!expr) return [];
  return String(expr).split(';').map((p) => p.trim()).filter(Boolean).map((p) => {
    const op = OPS.find((o) => p.includes(o));
    if (!op) return null;
    const [k, ...v] = p.split(op);
    return { k: k.trim(), op, v: coerce(v.join(op).trim()) };
  }).filter(Boolean);
}
export function applyFilter(data, expr) {
  const conds = parseFilter(expr);
  if (!conds.length) return data;
  return data.filter((r) => conds.every(({ k, op, v }) => {
    let x = r[k];
    if (typeof v === 'number' && typeof x === 'string' && x !== '' && !Number.isNaN(Number(x))) x = Number(x);
    switch (op) {
      case '=': return x === v || String(x) === String(v);
      case '!=': return !(x === v || String(x) === String(v));
      case '>=': return x >= v; case '<=': return x <= v; case '>': return x > v; case '<': return x < v;
      default: return true;
    }
  }));
}

/** Clave de agrupación: "campo", "campo:anio", "campo:mes". */
export function groupKey(spec) {
  const [f, mod] = String(spec).split(':');
  if (mod === 'anio') return (r) => (r[f] ? String(r[f]).slice(0, 4) : null);
  if (mod === 'mes') return (r) => (r[f] ? String(r[f]).slice(0, 7) : null);
  return (r) => (r[f] === null || r[f] === undefined ? null : String(r[f]));
}
export function aggregate(data, op, campo) {
  const vals = campo ? data.map((r) => r[campo]).filter((v) => typeof v === 'number') : [];
  switch (op) {
    case 'contar': return data.length;
    case 'sumar': return vals.reduce((a, b) => a + b, 0);
    case 'media': return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    case 'max': return vals.length ? Math.max(...vals) : 0;
    case 'min': return vals.length ? Math.min(...vals) : 0;
    case 'ultimo': return data.length ? data[data.length - 1][campo] ?? data[0][campo] : null;
    default: return data.length;
  }
}
/** Etiqueta legible de un valor, usando la lista de códigos del campo si la tiene. */
export function valueLabel(fieldMeta, v) {
  if (v === null || v === undefined || v === '') return '—';
  if (fieldMeta?.lista) {
    const lists = fieldMeta.lista.split('|');
    for (const l of lists) { const lb = label(l, v); if (lb !== String(v)) return lb; }
  }
  return String(v);
}
export { pick };
