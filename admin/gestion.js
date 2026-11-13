/**
 * gestion.js — Capa de gestión de la transparencia del editor.
 *
 * - Inicio de gestión: estado del portal, obligaciones (calculadas), fuentes automáticas,
 *   cambios pendientes, avisos que necesitan atención y primeros pasos.
 * - Comprobación previa a la publicación: esquemas, traducciones, enlaces internos,
 *   documentos, configuración de bloques, contraste de colores y fuentes.
 * - Resumen de cambios (antes/después) por fichero.
 * - Historial de publicaciones (GitHub) y recuperación de versiones anteriores.
 * - Importación y exportación CSV con validación.
 * - Contraste WCAG de los colores corporativos.
 *
 * Recibe el contexto del editor (ctx) para no depender de su estado interno.
 */
import { pick, label } from '../assets/js/i18n.js';
import { h, esc, icon, fmt, modal, download } from '../assets/js/ui.js';
import * as store from '../assets/js/store.js';
import { BLOCKS } from '../assets/js/blocks/index.js';
import * as C from '../assets/js/compliance.js';

const LANGS = ['es', 'va', 'en'];
const isI18n = (o) => o && typeof o === 'object' && !Array.isArray(o) && 'es' in o && Object.keys(o).every((k) => LANGS.includes(k));
const PERIOD_DIAS = { WEEKLY: 10, MONTHLY: 45, QUARTERLY: 105, ANNUAL: 380, CONT: null };
const todayIso = () => new Date().toISOString().slice(0, 10);
const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(`${String(d).slice(0, 10)}T00:00:00Z`)) / 864e5) : null);

// ============================================================================ contraste WCAG
function lum(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim()); if (!m) return null;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a, b = '#ffffff') {
  const la = lum(a), lb = lum(b); if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
/** Valoración de un color de marca sobre blanco. */
export function colorReport(hex, rol) {
  const r = contrast(hex);
  if (r === null) return { nivel: 'error', ratio: null, texto: 'Color no válido (usa el formato #RRGGBB).' };
  const n = fmt.dec(r, 2);
  if (rol === 'principal') {
    if (r >= 7) return { nivel: 'ok', ratio: r, texto: `Contraste ${n}:1 sobre blanco · AAA para texto normal` };
    if (r >= 4.5) return { nivel: 'ok', ratio: r, texto: `Contraste ${n}:1 sobre blanco · AA para texto normal y AAA para texto grande` };
    if (r >= 3) return { nivel: 'error', ratio: r, texto: `Contraste ${n}:1: insuficiente para botones y enlaces (mínimo 4,5:1). Elige un tono más oscuro.` };
    return { nivel: 'error', ratio: r, texto: `Contraste ${n}:1: no cumple WCAG. Elige un tono más oscuro.` };
  }
  if (r >= 4.5) return { nivel: 'ok', ratio: r, texto: `Contraste ${n}:1 sobre blanco · apto también para texto` };
  if (r >= 3) return { nivel: 'aviso', ratio: r, texto: `Contraste ${n}:1 · solo para elementos gráficos y texto grande; no usar en texto pequeño sobre blanco` };
  return { nivel: 'aviso', ratio: r, texto: `Contraste ${n}:1 · solo decorativo (no usar para texto ni para indicar estados)` };
}
export function colorBox(cfg) {
  const row = (rol, nombre) => { const hex = cfg.colores?.[rol]; const r = colorReport(hex, rol); return `<li class="ed-chk ed-chk-${r.nivel}"><span class="ed-swatch" style="background:${esc(hex)}"></span><span><strong>${nombre}</strong> <code>${esc(hex)}</code><br>${checkIcon(r.nivel)} ${esc(r.texto)}</span></li>`; };
  return `<ul class="ed-checklist">${row('principal', 'Color principal')}${row('secundario', 'Color secundario')}</ul>`;
}
const checkIcon = (n) => (n === 'ok' ? '<span class="ed-ico ok" aria-hidden="true">✓</span>' : n === 'aviso' ? '<span class="ed-ico warn" aria-hidden="true">⚠</span>' : '<span class="ed-ico err" aria-hidden="true">✗</span>');

// ============================================================================ utilidades de contenido
/** Recorre un objeto y llama a fn(valor, ruta) en cada nodo. */
function walk(o, fn, path = []) {
  fn(o, path);
  if (Array.isArray(o)) o.forEach((x, i) => walk(x, fn, [...path, i]));
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, fn, [...path, k]);
}
/** Traducciones que faltan en un fichero: [{ruta, faltan:['va','en'], texto}] */
export function missingTranslations(obj, langs = LANGS) {
  const out = [];
  walk(obj, (v, path) => { if (isI18n(v) && String(v.es || '').trim()) { const f = langs.filter((l) => l !== 'es' && !String(v[l] || '').trim()); if (f.length) out.push({ ruta: path, faltan: f, texto: v.es }); } });
  return out;
}
/** Ruta legible: bloques[2].items[0].titulo → «Bloque 3 (Documentos) › elemento 1 › titulo». */
function humanPath(file, obj, path) {
  const parts = [];
  for (let i = 0; i < path.length; i++) {
    const k = path[i];
    if (k === 'bloques' && typeof path[i + 1] === 'number') { const b = obj.bloques?.[path[i + 1]]; parts.push(`Bloque ${path[i + 1] + 1} (${pick(BLOCKS[b?.tipo]?.nombre) || b?.tipo || '?'})`); i++; continue; }
    if (k === 'datos' && typeof path[i + 1] === 'number') { const r = obj.datos?.[path[i + 1]]; parts.push(`Registro ${r?.id || path[i + 1] + 1}`); i++; continue; }
    if (k === 'categorias' && typeof path[i + 1] === 'number') { parts.push(`Categoría «${pick(obj.categorias?.[path[i + 1]]?.titulo) || path[i + 1] + 1}»`); i++; continue; }
    if (typeof k === 'number') { parts.push(`elemento ${k + 1}`); continue; }
    if (LANGS.includes(k)) { parts.push(k.toUpperCase()); continue; }
    parts.push(k);
  }
  return parts.join(' › ');
}
export const fileLabel = async (path, obj) => {
  if (path.startsWith('content/paginas/')) return `Página «${pick(obj?.titulo) || path.split('/').pop().replace('.json', '')}»`;
  if (path === 'content/portal.json') return 'Portada, menú y categorías';
  if (path === 'config/entidad.json') return 'Configuración de la entidad';
  if (path.startsWith('data/')) { const id = path.slice(5).replace('.json', ''); const d = await store.dsMeta(id).catch(() => null); return `Datos «${pick(d?.titulo) || id}»`; }
  return path;
};

// ============================================================================ diferencias
function flatten(o, pre = '', out = {}) {
  if (o && typeof o === 'object') { const ks = Object.keys(o); if (!ks.length) out[pre] = Array.isArray(o) ? '[]' : '{}'; for (const k of ks) flatten(o[k], pre ? `${pre}.${k}` : k, out); }
  else out[pre] = o;
  return out;
}
const short = (v) => { const s = v === undefined ? '∅' : v === null ? '—' : String(v); return s.length > 80 ? `${s.slice(0, 77)}…` : s; };
/** Resumen y detalle de cambios de un fichero. */
export function describeChange(path, before, after) {
  const res = { resumen: [], detalle: [] };
  if (before === null || before === undefined) { res.resumen.push(path.startsWith('content/paginas/') ? 'Página nueva' : 'Fichero nuevo'); return res; }
  if (path.startsWith('content/paginas/')) {
    if (JSON.stringify(before.titulo) !== JSON.stringify(after.titulo)) res.resumen.push('título actualizado');
    if (JSON.stringify(before.intro) !== JSON.stringify(after.intro)) res.resumen.push('entradilla actualizada');
    if (JSON.stringify(before.responsable) !== JSON.stringify(after.responsable)) res.resumen.push('responsable actualizado');
    const b = (before.bloques || []).map((x) => JSON.stringify(x)), a = (after.bloques || []).map((x) => JSON.stringify(x));
    const bs = new Map(); b.forEach((x) => bs.set(x, (bs.get(x) || 0) + 1));
    let same = 0; a.forEach((x) => { if (bs.get(x)) { bs.set(x, bs.get(x) - 1); same++; } });
    const changed = Math.min(a.length, b.length) - same, added = Math.max(0, a.length - b.length), removed = Math.max(0, b.length - a.length);
    if (changed > 0) res.resumen.push(`${changed} bloque${changed > 1 ? 's' : ''} modificado${changed > 1 ? 's' : ''}`);
    if (added) res.resumen.push(`${added} bloque${added > 1 ? 's' : ''} añadido${added > 1 ? 's' : ''}`);
    if (removed) res.resumen.push(`${removed} bloque${removed > 1 ? 's' : ''} eliminado${removed > 1 ? 's' : ''}`);
    if (!changed && !added && !removed && b.join() !== a.join()) res.resumen.push('bloques reordenados');
  } else if (path.startsWith('data/') && Array.isArray(after.datos)) {
    const key = (r, i) => r.id ?? `#${i}`;
    const bm = new Map(before.datos.map((r, i) => [key(r, i), JSON.stringify(r)])), am = new Map(after.datos.map((r, i) => [key(r, i), JSON.stringify(r)]));
    let add = 0, del = 0, mod = 0;
    for (const [k, v] of am) { if (!bm.has(k)) add++; else if (bm.get(k) !== v) mod++; }
    for (const k of bm.keys()) if (!am.has(k)) del++;
    if (add) res.resumen.push(`${add} registro${add > 1 ? 's' : ''} nuevo${add > 1 ? 's' : ''}`);
    if (mod) res.resumen.push(`${mod} registro${mod > 1 ? 's' : ''} modificado${mod > 1 ? 's' : ''}`);
    if (del) res.resumen.push(`${del} registro${del > 1 ? 's' : ''} eliminado${del > 1 ? 's' : ''}`);
  } else if (path === 'content/portal.json') {
    if (JSON.stringify(before.portada) !== JSON.stringify(after.portada)) res.resumen.push('portada');
    if (JSON.stringify(before.menu) !== JSON.stringify(after.menu)) res.resumen.push('menú principal');
    if (JSON.stringify(before.categorias) !== JSON.stringify(after.categorias)) res.resumen.push('categorías');
  } else {
    const ks = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    if (ks.length) res.resumen.push(`cambia: ${ks.join(', ')}`);
  }
  const fb = flatten(before), fa = flatten(after);
  const keys = [...new Set([...Object.keys(fb), ...Object.keys(fa)])].filter((k) => fb[k] !== fa[k] && k !== 'actualizado' && k !== 'generado');
  for (const k of keys.slice(0, 40)) {
    const path_ = k.split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : x));
    res.detalle.push({ ruta: humanPath(path, after?.[path_[0]] !== undefined ? after : before, path_), antes: short(fb[k]), despues: short(fa[k]) });
  }
  if (keys.length > 40) res.detalle.push({ ruta: `… y ${keys.length - 40} cambios más`, antes: '', despues: '' });
  if (!res.resumen.length) res.resumen.push(keys.length ? 'cambios menores' : 'sin cambios');
  return res;
}

// ============================================================================ comprobaciones previas
const okType = (c, v) => {
  if (v === null || v === undefined || v === '') return true;
  switch (c.tipo) {
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'integer': return Number.isInteger(v);
    case 'boolean': return typeof v === 'boolean';
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
    case 'yearmonth': return /^\d{4}-\d{2}$/.test(v);
    default: return true;
  }
};
/** Valida un registro contra el esquema del conjunto: lista de errores en texto. */
export function validateRecord(ds, r, codelists) {
  const errs = [];
  for (const c of ds.campos) {
    const v = r[c.nombre];
    if (!okType(c, v)) errs.push(`«${c.descripcion}»: valor no válido (${short(v)})`);
    else if (c.lista && v !== null && v !== undefined && v !== '') {
      const ok = c.lista.split('|').some((l) => codelists[l] && String(v) in codelists[l]);
      if (!ok) errs.push(`«${c.descripcion}»: «${short(v)}» no está en la lista de valores`);
    }
    if (c.formato === 'uri' && v && v !== '#' && !/^(https?:\/\/|mailto:|\.{0,2}\/|[a-z0-9_-]+\/)/i.test(v)) errs.push(`«${c.descripcion}»: no parece una dirección web`);
  }
  return errs;
}

/**
 * Ejecuta las comprobaciones sobre los ficheros modificados.
 * @returns {Promise<{grupos: object[], errores: number, avisos: number}>}
 */
export async function runChecks(ctx, files) {
  const { W } = ctx;
  const meta = await store.meta();
  const codelists = await store.getJSON('data/codelists.json');
  const cfg = W('config/entidad.json');
  const portal = W('content/portal.json');
  const known = new Set([...portal.categorias.flatMap((c) => c.paginas), 'accesibilidad', 'sobre-los-datos', 'buscar', 'indice', 'datos-abiertos', 'derecho-acceso']);
  const pageExists = async (id) => known.has(id) || ctx.S.work.has(`content/paginas/${id}.json`) || (await store.page(id).then(() => true).catch(() => false));
  const G = (id, titulo) => ({ id, titulo, items: [] });
  const g = { esquema: G('esquema', 'Datos válidos y conformes al esquema'), enlaces: G('enlaces', 'Enlaces internos y estructura'), bloques: G('bloques', 'Configuración de los componentes de datos'), trad: G('trad', 'Traducciones'), docs: G('docs', 'Documentos y archivos'), color: G('color', 'Contraste de color (WCAG 2.2 AA)'), fuentes: G('fuentes', 'Fuentes de datos') };
  const add = (grp, nivel, texto, accion) => g[grp].items.push({ nivel, texto, accion });

  for (const f of files) {
    const obj = W(f); if (!obj) continue;
    const name = await fileLabel(f, obj);
    // traducciones
    const mt = missingTranslations(obj, cfg.idiomas || LANGS);
    if (mt.length) add('trad', 'aviso', `${name}: ${mt.length} texto${mt.length > 1 ? 's' : ''} sin traducir (${[...new Set(mt.flatMap((m) => m.faltan))].map((l) => l.toUpperCase()).join(', ')}) · p. ej. «${short(mt[0].texto)}» en ${humanPath(f, obj, mt[0].ruta)}`, { tipo: 'abrir', ruta: f });
    // datos
    if (f.startsWith('data/') && Array.isArray(obj.datos) && f !== 'data/codelists.json') {
      const ds = meta.conjuntos.find((d) => `data/${d.id}.json` === f);
      if (ds) {
        let n = 0; const ej = [];
        const ids = new Map();
        obj.datos.forEach((r, i) => {
          const e = validateRecord(ds, r, codelists); if (e.length) { n++; if (ej.length < 3) ej.push(`registro ${r.id || i + 1}: ${e[0]}`); }
          if (r.id !== undefined && r.id !== null) { if (ids.has(r.id)) { n++; if (ej.length < 3) ej.push(`identificador repetido «${r.id}»`); } ids.set(r.id, i); }
        });
        if (n) add('esquema', 'error', `${name}: ${n} registro${n > 1 ? 's' : ''} con errores · ${ej.join(' · ')}`, { tipo: 'abrir', ruta: f });
        if (obj.ejemplo && cfg.datos_de_ejemplo === false) add('fuentes', 'aviso', `${name} todavía contiene datos de ejemplo y el aviso de datos de ejemplo está desactivado.`, { tipo: 'abrir', ruta: f });
      }
    }
    // páginas
    if (f.startsWith('content/paginas/')) {
      if (!pick(obj.titulo)) add('enlaces', 'error', `${name}: la página no tiene título.`, { tipo: 'abrir', ruta: f });
      if (!pick(obj.responsable)) add('enlaces', 'aviso', `${name}: no indica el responsable de la información.`, { tipo: 'abrir', ruta: f });
      for (const [i, b] of (obj.bloques || []).entries()) {
        const def = BLOCKS[b.tipo];
        const where = `${name} › bloque ${i + 1} (${pick(def?.nombre) || b.tipo})`;
        if (!def) { add('bloques', 'error', `${where}: componente desconocido.`, { tipo: 'abrir', ruta: f }); continue; }
        await checkProps(def.props, b, where, add, meta, f);
        if (b.tipo === 'documentos') (b.items || []).forEach((d, j) => {
          if (!d.url) add('docs', 'error', `${where} › documento ${j + 1} «${short(pick(d.titulo))}»: falta el enlace.`, { tipo: 'abrir', ruta: f });
          else if (!d.fecha) add('docs', 'aviso', `${where} › documento ${j + 1} «${short(pick(d.titulo))}»: sin fecha.`, { tipo: 'abrir', ruta: f });
        });
      }
      for (const id of internalLinks(obj)) if (!(await pageExists(id))) add('enlaces', 'error', `${name}: enlace a una página que no existe (#/${id}).`, { tipo: 'abrir', ruta: f });
    }
    if (f === 'content/portal.json') {
      for (const c of obj.categorias) for (const p of c.paginas) if (!(await pageExists(p))) add('enlaces', 'error', `Categoría «${pick(c.titulo)}»: incluye la página «${p}», que no existe.`);
      for (const q of [...(obj.portada?.preguntas || []), ...(obj.menu || []), ...(obj.portada?.datos_destacados || [])]) if (q.pagina && !(await pageExists(q.pagina))) add('enlaces', 'error', `Portada: «${short(pick(q.texto || q.etiqueta))}» enlaza a una página que no existe (${q.pagina}).`);
      for (const it of [...(obj.portada?.datos_destacados || []), ...obj.categorias.flatMap((c) => c.cifras || [])]) await checkProps(CIFRA_PROPS, it, `Cifra «${short(pick(it.etiqueta))}»`, add, meta, f);
    }
    if (f === 'config/entidad.json') {
      for (const rol of ['principal', 'secundario']) { const r = colorReport(obj.colores?.[rol], rol); if (r.nivel !== 'ok') add('color', r.nivel, `Color ${rol}: ${r.texto}`, { tipo: 'entidad' }); }
      const P = obj.fuentes?.placsp, B = obj.fuentes?.bdns;
      if (P?.activo && !(P.identificadores_organo || []).length && !(P.nombres_organo || []).length) add('fuentes', 'aviso', 'Plataforma de Contratación activa sin identificadores del órgano: la sincronización no traerá contratos.', { tipo: 'entidad' });
      if (B?.activo && !(B.organos || []).length && !B.nombre_organo) add('fuentes', 'aviso', 'BDNS activa sin órgano concedente: la sincronización no traerá subvenciones.', { tipo: 'entidad' });
    }
  }
  // Archivos enlazados (archivos/…): deben existir en el portal o estar subidos en esta sesión
  const refs = new Set();
  for (const f of files) walk(W(f), (v) => { if (typeof v === 'string' && /^archivos\//.test(v)) refs.add(v); });
  for (const r of refs) {
    if (ctx.S.uploads.has(r)) continue;
    const ok = await fetch(store.url(r), { method: 'HEAD' }).then((x) => x.ok).catch(() => false);
    if (!ok) add('docs', 'error', `Se enlaza el archivo «${r}», que no existe en el portal ni se ha subido. Vuelve a subirlo.`);
  }
  for (const [p, u] of ctx.S.uploads) {
    if (!refs.has(p)) add('docs', 'aviso', `El archivo subido «${u.name}» no se usa en ningún contenido modificado: se publicará igualmente en ${p}.`);
    if (u.size > 10e6) add('docs', 'aviso', `«${u.name}» ocupa ${fmt.dec(u.size / 1e6, 1)} MB: conviene reducirlo para facilitar la descarga.`);
  }
  const sync = await store.syncStatus();
  for (const [k, s] of Object.entries(sync?.fuentes || {})) if (s.estado === 'error') add('fuentes', 'aviso', `La última sincronización con ${k.toUpperCase()} falló: ${s.mensaje || 'sin detalle'}.`, { tipo: 'sync' });
  const grupos = Object.values(g).map((x) => ({ ...x, nivel: x.items.some((i) => i.nivel === 'error') ? 'error' : x.items.length ? 'aviso' : 'ok' }));
  return { grupos, errores: grupos.flatMap((x) => x.items).filter((i) => i.nivel === 'error').length, avisos: grupos.flatMap((x) => x.items).filter((i) => i.nivel === 'aviso').length };
}
const CIFRA_PROPS = [{ clave: 'conjunto', tipo: 'conjunto' }, { clave: 'campo', tipo: 'campo' }, { clave: 'filtro', tipo: 'filtro' }];
async function checkProps(props, obj, where, add, meta, f) {
  const conj = obj.conjunto;
  const ds = conj ? meta.conjuntos.find((d) => d.id === conj) : null;
  for (const p of props || []) {
    const v = obj[p.clave];
    if (p.tipo === 'conjunto' && v && !ds) add('bloques', 'error', `${where}: el conjunto de datos «${v}» no existe.`, { tipo: 'abrir', ruta: f });
    if (!ds) continue;
    const has = (n) => ds.campos.some((c) => c.nombre === String(n).split(':')[0]);
    if (p.tipo === 'campo' && v && !has(v)) add('bloques', 'error', `${where}: el campo «${v}» no existe en ${pick(ds.titulo)}.`, { tipo: 'abrir', ruta: f });
    if (p.tipo === 'campos' && Array.isArray(v)) v.filter((x) => !has(x)).forEach((x) => add('bloques', 'error', `${where}: el campo «${x}» no existe en ${pick(ds.titulo)}.`, { tipo: 'abrir', ruta: f }));
    if (p.tipo === 'filtro' && v) store.parseFilter(v).filter((c) => !has(c.k)).forEach((c) => add('bloques', 'error', `${where}: el filtro usa el campo «${c.k}», que no existe.`, { tipo: 'abrir', ruta: f }));
    if (p.tipo === 'lista' && Array.isArray(v)) for (const [j, it] of v.entries()) await checkProps(p.campos, { conjunto: conj, ...it }, `${where} › elemento ${j + 1}`, add, meta, f);
  }
}
function internalLinks(obj) {
  const ids = new Set();
  walk(obj, (v, path) => {
    if (typeof v === 'string') for (const m of v.matchAll(/\(#\/([a-z0-9-]+)\)/g)) ids.add(m[1]);
    if (path.at(-1) === 'pagina' && typeof v === 'string' && v && !path.includes('bloques')) ids.add(v);
    if (path.at(-1) === 'url' && typeof v === 'string' && /^#\/[a-z0-9-]+$/.test(v)) ids.add(v.slice(2));
  });
  ['categoria', 'datos', 'buscar', 'agenda'].forEach((x) => ids.delete(x));
  return [...ids];
}

/** HTML del resultado de las comprobaciones. */
export function checksHtml(res) {
  return `<ul class="ed-checklist">${res.grupos.map((gr) => `<li class="ed-chk ed-chk-${gr.nivel}">${checkIcon(gr.nivel)}<div><strong>${esc(gr.titulo)}</strong>${gr.items.length ? ` <span class="ed-hint">(${gr.items.length})</span><details${gr.nivel === 'error' ? ' open' : ''}><summary>Ver detalle</summary><ul>${gr.items.map((i) => `<li>${checkIcon(i.nivel)} ${esc(i.texto)}${i.accion ? ` <button type="button" class="link-btn ed-goto" data-accion='${esc(JSON.stringify(i.accion))}'>Corregir</button>` : ''}</li>`).join('')}</ul></details>` : ''}</div></li>`).join('')}</ul>`;
}

// ============================================================================ inicio de gestión
export async function dashboard(ctx) {
  const { S, W } = ctx;
  const main = document.getElementById('ed-main');
  main.innerHTML = '<p class="ed-hint">Cargando el estado del portal…</p>';
  const [meta, sync] = await Promise.all([store.meta(), store.syncStatus()]);
  const cfg = W('config/entidad.json'), portal = W('content/portal.json');
  const pageIds = [...new Set([...portal.categorias.flatMap((c) => c.paginas), 'accesibilidad', 'sobre-los-datos'])];
  const pages = await Promise.all(pageIds.map(async (id) => [id, await ctx.load(`content/paginas/${id}.json`).catch(() => null)]));
  const envs = await Promise.all(meta.conjuntos.map(async (d) => [d, await ctx.load(`data/${d.id}.json`).catch(() => null)]));
  const ev = await C.evaluate(await store.rows('obligaciones'));
  const sc = C.score(ev);
  const records = envs.reduce((a, [, e]) => a + (e?.datos?.length || 0), 0);

  // Avisos que necesitan atención
  const att = [];
  const A = (prio, texto, detalle, accion) => att.push({ prio, texto, detalle, accion });
  ev.filter((o) => ['desactualizada', 'pendiente', 'parcial'].includes(o.estado_calc)).forEach((o) => A(o.estado_calc === 'pendiente' ? 1 : 2, o.titulo, o.estado_calc === 'desactualizada' ? `Obligación pendiente de actualizar · última evidencia ${o.evidencia ? `${fmt.date(o.evidencia)} (hace ${daysSince(o.evidencia)} días)` : 'desconocida'} · ${label('periodicidad', o.periodicidad)}` : `${label('estado_obligacion', o.estado_calc)}${o.motivo ? ` · ${C.motivoTexto(o, (es) => es, fmt.date)}` : ''}`, o.conjunto ? { tipo: 'datos', id: o.conjunto } : o.pagina ? { tipo: 'pagina', id: o.pagina } : null));
  for (const [d, e] of envs) {
    if (!e) continue;
    const per = PERIOD_DIAS[d.periodicidad];
    const auto = ['placsp', 'bdns'].includes(d.fuente.tipo);
    const age = daysSince(e.actualizado || (auto ? e.generado : null));
    if (!auto && per && age !== null && age > per) A(2, `${pick(d.titulo)}`, `Datos actualizados hace ${age} días (periodicidad ${String(d.periodicidad).toLowerCase()})`, { tipo: 'datos', id: d.id });
    if (!auto && per && !e.actualizado && !e.ejemplo) A(3, `${pick(d.titulo)}`, 'Sin fecha de actualización registrada', { tipo: 'datos', id: d.id });
    if (e.ejemplo) A(3, `${pick(d.titulo)}`, 'Contiene datos de ejemplo: sustitúyelos por los reales', { tipo: 'datos', id: d.id });
  }
  for (const [id, pg] of pages) {
    if (!pg) { A(1, id, 'La página está en el menú pero no existe', null); continue; }
    const mt = missingTranslations({ titulo: pg.titulo, intro: pg.intro, responsable: pg.responsable }, cfg.idiomas || LANGS);
    if (mt.length) A(3, pick(pg.titulo), `Falta ${[...new Set(mt.flatMap((m) => m.faltan))].map((l) => ({ va: 'valenciano', en: 'inglés' })[l] || l).join(' e ')} en el título o la entradilla`, { tipo: 'pagina', id });
    if (!pick(pg.responsable)) A(3, pick(pg.titulo), 'No indica el responsable de la información', { tipo: 'pagina', id });
    const nodate = (pg.bloques || []).filter((b) => b.tipo === 'documentos').flatMap((b) => b.items || []).filter((d) => !d.fecha).length;
    if (nodate) A(3, pick(pg.titulo), `${nodate} documento${nodate > 1 ? 's' : ''} sin fecha`, { tipo: 'pagina', id });
  }
  for (const rol of ['principal', 'secundario']) { const r = colorReport(cfg.colores?.[rol], rol); if (r.nivel === 'error') A(1, `Color ${rol}`, r.texto, { tipo: 'entidad' }); }
  att.sort((a, b) => a.prio - b.prio);

  const dirtyMissing = [...S.dirty].reduce((a, f) => a + (W(f) ? missingTranslations(W(f), cfg.idiomas || LANGS).length : 0), 0);
  const src = (k, n) => { const s = sync?.fuentes?.[k]; const st = s?.estado || 'pendiente'; return `<li>${checkIcon(st === 'ok' ? 'ok' : st === 'error' ? 'error' : 'aviso')} <strong>${n}</strong> <span class="ed-hint">${s?.fecha ? fmt.date(String(s.fecha).slice(0, 10)) : 'sin ejecuciones'}${s?.registros !== undefined ? ` · ${fmt.int(s.registros)} registros` : ''}${st === 'error' && s?.mensaje ? ` · ${esc(s.mensaje)}` : ''}</span></li>`; };
  const actBtn = (a) => (a ? ` <button type="button" class="link-btn" data-go='${esc(JSON.stringify(a))}'>Abrir</button>` : '');
  const steps = [
    [cfg.nif && cfg.nif !== 'P0000000X', 'Datos de la entidad (nombre, NIF, DIR3, escudo)', { tipo: 'entidad' }],
    [(cfg.fuentes?.placsp?.identificadores_organo || []).length > 0, 'Identificadores del órgano en la Plataforma de Contratación', { tipo: 'entidad' }],
    [(cfg.fuentes?.bdns?.organos || []).length > 0 || !!cfg.fuentes?.bdns?.nombre_organo, 'Órgano concedente en la BDNS', { tipo: 'entidad' }],
    [!envs.some(([, e]) => e?.ejemplo), 'Sustituir los datos de ejemplo por los reales', null],
    [cfg.datos_de_ejemplo === false, 'Quitar el aviso de datos de ejemplo', { tipo: 'entidad' }],
    [!!ctx.ghSettings().token, 'Conectar con GitHub para publicar', { tipo: 'publicar' }],
  ];
  const done = steps.filter((s) => s[0]).length;
  main.innerHTML = `<div class="ed-dash">
    <header class="ed-dash-head"><div><h1>Portal de Transparencia</h1><p class="ed-hint">${esc(pick(cfg.nombre))} · ${pageIds.length} páginas · ${meta.conjuntos.length} conjuntos de datos · ${fmt.int(records)} registros</p></div>
      <div class="ed-dash-actions"><button type="button" class="btn-ghost" data-go='{"tipo":"preview"}'>${icon('eye', 16)} Vista previa</button><button type="button" class="btn" data-go='{"tipo":"publicar"}'>Revisar y publicar</button></div></header>
    <div class="ed-dash-grid">
      <section class="ed-card ed-kpi-card"><h2>Estado del portal</h2>
        <p class="ed-big">${fmt.dec(sc.total, 0)} %<span>índice de cumplimiento</span></p>
        <ul class="ed-statlist"><li><span class="ed-dot ok"></span>${sc.counts.publicado} obligaciones al día</li><li><span class="ed-dot warn"></span>${sc.counts.desactualizada} pendientes de actualizar</li><li><span class="ed-dot warn"></span>${sc.counts.parcial} incompletas</li><li><span class="ed-dot err"></span>${sc.counts.pendiente} pendientes de publicar</li></ul>
        <p class="ed-hint">Calculado con la fecha de la última actualización de cada página y conjunto y la periodicidad exigida.</p></section>
      <section class="ed-card"><h2>Pendiente de publicación</h2>
        <p class="ed-big">${S.dirty.size + S.uploads.size}<span>cambio${S.dirty.size + S.uploads.size === 1 ? '' : 's'} (${S.dirty.size} fichero${S.dirty.size === 1 ? '' : 's'}${S.uploads.size ? ` y ${S.uploads.size} archivo${S.uploads.size === 1 ? '' : 's'} subido${S.uploads.size === 1 ? '' : 's'}` : ''})</span></p>
        <ul class="ed-statlist"><li>${dirtyMissing ? `<span class="ed-dot warn"></span>${dirtyMissing} texto${dirtyMissing > 1 ? 's' : ''} sin traducir` : '<span class="ed-dot ok"></span>Traducciones completas'}</li></ul>
        ${S.dirty.size + S.uploads.size ? '<button type="button" class="btn-ghost" data-go=\'{"tipo":"publicar"}\'>Revisar cambios</button>' : '<p class="ed-hint">No hay cambios sin publicar.</p>'}</section>
      <section class="ed-card"><h2>Fuentes automáticas</h2><ul class="ed-srclist">${src('placsp', 'Plataforma de Contratación')}${src('bdns', 'BDNS (subvenciones)')}</ul>
        <button type="button" class="btn-ghost" data-go='{"tipo":"sync"}'>Ver sincronización</button></section>
    </div>
    <section class="ed-card"><h2>Necesitan atención <span class="ed-hint">(${att.length})</span></h2>
      ${att.length ? `<ul class="ed-attention">${att.slice(0, 12).map((a) => `<li class="prio-${a.prio}"><span class="ed-dot ${a.prio === 1 ? 'err' : 'warn'}"></span><div><strong>${esc(a.texto)}</strong><span class="ed-hint">${esc(a.detalle)}</span></div>${actBtn(a.accion)}</li>`).join('')}</ul>
      ${att.length > 12 ? `<details><summary>Ver ${att.length - 12} más</summary><ul class="ed-attention">${att.slice(12).map((a) => `<li class="prio-${a.prio}"><span class="ed-dot ${a.prio === 1 ? 'err' : 'warn'}"></span><div><strong>${esc(a.texto)}</strong><span class="ed-hint">${esc(a.detalle)}</span></div>${actBtn(a.accion)}</li>`).join('')}</ul></details>` : ''}` : '<p>Todo al día. 🎉</p>'}</section>
    <div class="ed-dash-grid two">
      <section class="ed-card"><h2>Primeros pasos <span class="ed-hint">(${done} de ${steps.length})</span></h2>
        <ul class="ed-steps">${steps.map(([ok, txt, a]) => `<li class="${ok ? 'done' : ''}">${checkIcon(ok ? 'ok' : 'aviso')} ${esc(txt)}${ok ? '' : actBtn(a)}</li>`).join('')}</ul>
        <p class="ed-hint">Guía completa: docs/GUIA-EDITOR.md del repositorio.</p></section>
      <section class="ed-card"><h2>Historial de publicaciones</h2><div id="ed-history"><p class="ed-hint">Consulta las últimas publicaciones y recupera la versión anterior de cualquier página o conjunto de datos.</p><button type="button" class="btn-ghost" id="ed-hist-load">Cargar historial</button></div></section>
    </div></div>`;
  main.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => ctx.go(JSON.parse(b.dataset.go))));
  main.querySelector('#ed-hist-load').addEventListener('click', () => history(ctx, main.querySelector('#ed-history')));
  document.getElementById('ed-props').innerHTML = `<h2>${icon('info', 18)} Cómo usar el editor</h2>
    <ol class="ed-help"><li><strong>Páginas</strong>: compón cada página con bloques arrastrándolos desde el panel derecho.</li><li><strong>Datos</strong>: da de alta y modifica registros (altos cargos, agenda…) o impórtalos desde CSV.</li><li><strong>Revisar y publicar</strong>: comprueba los cambios, la vista previa y las validaciones antes de publicar o enviar a revisión.</li></ol>
    <p class="ed-hint">El <strong>modo sencillo</strong> oculta los detalles técnicos (nombres de campo, filtros). Cámbialo arriba a «Avanzado» si los necesitas.</p>`;
}

// ============================================================================ historial
async function history(ctx, host) {
  const gh = ctx.ghSettings();
  if (!gh.repo) { host.innerHTML = '<p class="ed-hint">Configura el repositorio en «Publicar».</p>'; return; }
  host.innerHTML = '<p class="ed-hint">Cargando…</p>';
  const api = (p) => (gh.token ? ctx.ghApi(gh, p) : fetch(`https://api.github.com${p}`, { headers: { Accept: 'application/vnd.github+json' } }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`)))));
  try {
    const lists = await Promise.all(['content', 'data', 'config'].map((p) => api(`/repos/${gh.repo}/commits?sha=${encodeURIComponent(gh.branch)}&path=${p}&per_page=12`).catch(() => [])));
    const seen = new Set();
    const commits = lists.flat().filter((c) => !seen.has(c.sha) && seen.add(c.sha)).sort((a, b) => b.commit.author.date.localeCompare(a.commit.author.date)).slice(0, 15);
    host.innerHTML = `<ul class="ed-hist">${commits.map((c) => `<li><div><strong>${esc(c.commit.message.split('\n')[0])}</strong><span class="ed-hint">${fmt.date(c.commit.author.date.slice(0, 10))} ${c.commit.author.date.slice(11, 16)} · ${esc(c.commit.author.name)} · <a href="${esc(c.html_url)}" target="_blank" rel="noopener">${c.sha.slice(0, 7)}</a></span></div><button type="button" class="link-btn" data-sha="${c.sha}">Ver cambios</button><div class="ed-hist-files" hidden></div></li>`).join('')}</ul>`;
    host.querySelectorAll('[data-sha]').forEach((b) => b.addEventListener('click', async () => {
      const box = b.nextElementSibling; box.hidden = !box.hidden; if (box.dataset.loaded) return;
      box.textContent = 'Cargando…';
      const c = await api(`/repos/${gh.repo}/commits/${b.dataset.sha}`);
      const parent = c.parents[0]?.sha;
      const files = c.files.filter((f) => /^(content|data|config)\//.test(f.filename) && f.filename.endsWith('.json') && !/^data\/(csv|sync)\/|catalog/.test(f.filename));
      box.dataset.loaded = '1';
      box.innerHTML = files.length ? `<ul>${files.map((f) => `<li><code>${esc(f.filename)}</code> <span class="ed-hint">${f.status === 'added' ? 'nuevo' : f.status === 'removed' ? 'eliminado' : `+${f.additions} −${f.deletions}`}</span>${parent && f.status !== 'added' ? ` <button type="button" class="link-btn" data-restore="${esc(f.filename)}" data-ref="${parent}">Recuperar la versión anterior</button>` : ''}</li>`).join('')}</ul><p class="ed-hint">«Recuperar» carga la versión anterior a esta publicación como borrador: podrás revisarla y publicarla.</p>` : '<p class="ed-hint">Sin cambios de contenido.</p>';
      box.querySelectorAll('[data-restore]').forEach((r) => r.addEventListener('click', async () => {
        try {
          const f = await api(`/repos/${gh.repo}/contents/${r.dataset.restore}?ref=${r.dataset.ref}`);
          const text = new TextDecoder().decode(Uint8Array.from(atob(f.content.replace(/\n/g, '')), (ch) => ch.charCodeAt(0)));
          await ctx.restore(r.dataset.restore, JSON.parse(text));
          ctx.toast('Versión anterior cargada como borrador. Revísala y publícala.');
        } catch (e) { ctx.toast(`No se pudo recuperar: ${e.message}`, 5000); }
      }));
    }));
  } catch (e) { host.innerHTML = `<p class="ed-hint">No se pudo cargar el historial (${esc(e.message)}). Si el repositorio es privado, conecta antes GitHub en «Publicar».</p>`; }
}

// ============================================================================ CSV
/** Analiza CSV (delimitador , ; o tabulador; comillas dobles). */
export function parseCSV(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/)[0] || '';
  const delim = [';', '\t', ','].map((d) => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; continue; }
    if (ch === '"') q = true;
    else if (ch === delim) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
/** Convierte un texto de celda al tipo del campo; devuelve [valor, error]. */
function castCell(c, raw, codelists) {
  const s = String(raw ?? '').trim();
  if (s === '') return [null, null];
  switch (c.tipo) {
    case 'number': case 'integer': {
      const t = s.replace(/[€\s]/g, '');
      const n = Number(/,\d{1,2}$/.test(t) || (t.includes(',') && t.includes('.') && t.lastIndexOf(',') > t.lastIndexOf('.')) ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, ''));
      if (!Number.isFinite(n) || (c.tipo === 'integer' && !Number.isInteger(n))) return [s, 'número no válido'];
      return [n, null];
    }
    case 'boolean': { const v = norm(s); if (['si', 'true', '1', 'yes', 's'].includes(v)) return [true, null]; if (['no', 'false', '0', 'n'].includes(v)) return [false, null]; return [s, 'use Sí/No']; }
    case 'date': { let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return [`${m[1]}-${m[2]}-${m[3]}`, null]; m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s); if (m) return [`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, null]; return [s, 'fecha no válida (AAAA-MM-DD o DD/MM/AAAA)']; }
    default:
      if (c.lista) {
        const lists = c.lista.split('|');
        for (const l of lists) { const cl = codelists[l] || {}; if (s in cl) return [s, null]; const hit = Object.entries(cl).find(([, v]) => Object.values(v).some((x) => norm(x) === norm(s))); if (hit) return [hit[0], null]; }
        return [s, 'valor fuera de la lista'];
      }
      return [s, null];
  }
}
/** Diálogo de importación CSV con vista previa y validación. */
export async function importCSV(ctx, ds, path) {
  const codelists = await store.getJSON('data/codelists.json');
  const dlg = modal(`Importar CSV · ${pick(ds.titulo)}`, `<p>La primera fila debe contener los nombres de las columnas (el nombre del campo o su descripción). Desde Excel: <em>Guardar como → CSV UTF-8</em>.</p>
    <p><input type="file" id="csv-file" accept=".csv,.tsv,.txt,text/csv"></p><div id="csv-prev"></div>`);
  dlg.querySelector('#csv-file').addEventListener('change', async (e) => {
    const file = e.target.files[0]; if (!file) return;
    const rows = parseCSV(await file.text());
    const prev = dlg.querySelector('#csv-prev');
    if (rows.length < 2) { prev.innerHTML = '<p class="ed-chk-error">El fichero no tiene filas de datos.</p>'; return; }
    const head = rows[0];
    const map = head.map((hd) => ds.campos.find((c) => norm(c.nombre) === norm(hd) || norm(c.descripcion) === norm(hd)) || null);
    const unknown = head.filter((_, i) => !map[i]);
    const recs = rows.slice(1).map((r, ri) => {
      const rec = {}, errs = [];
      map.forEach((c, i) => { if (!c) return; const [v, err] = castCell(c, r[i], codelists); rec[c.nombre] = v; if (err) errs.push(`${c.descripcion}: ${err}`); });
      ds.campos.forEach((c) => { if (!(c.nombre in rec)) rec[c.nombre] = c.nombre === 'fuente' ? 'manual' : null; });
      if (ds.campos.some((c) => c.nombre === 'id') && !rec.id) rec.id = `${ds.id.slice(0, 3).toUpperCase()}-${Date.now().toString(36)}-${ri}`;
      if ('fuente' in rec && !rec.fuente) rec.fuente = 'manual';
      return { rec, errs };
    });
    const bad = recs.filter((r) => r.errs.length).length;
    const cols = ds.campos.filter((c) => map.includes(c)).slice(0, 6);
    prev.innerHTML = `<ul class="ed-checklist">
        <li class="ed-chk ed-chk-${map.some(Boolean) ? 'ok' : 'error'}">${checkIcon(map.some(Boolean) ? 'ok' : 'error')} ${map.filter(Boolean).length} columnas reconocidas${unknown.length ? ` · se ignorarán: ${unknown.map(esc).join(', ')}` : ''}</li>
        <li class="ed-chk ed-chk-${bad ? 'aviso' : 'ok'}">${checkIcon(bad ? 'aviso' : 'ok')} ${recs.length} filas · ${bad ? `${bad} con errores (se pueden importar y corregir después, o corregir el fichero)` : 'todas válidas'}</li></ul>
      <div class="ed-grid-wrap" style="max-height:260px"><table class="ed-grid"><thead><tr><th>#</th>${cols.map((c) => `<th>${esc(c.descripcion)}</th>`).join('')}<th>Validación</th></tr></thead><tbody>${recs.slice(0, 50).map((r, i) => `<tr><td>${i + 1}</td>${cols.map((c) => `<td>${esc(r.rec[c.nombre] ?? '—')}</td>`).join('')}<td>${r.errs.length ? `<span class="ed-chk-error">${esc(r.errs.join(' · '))}</span>` : '✓'}</td></tr>`).join('')}</tbody></table></div>
      ${recs.length > 50 ? `<p class="ed-hint">Se muestran 50 de ${recs.length} filas.</p>` : ''}
      <div class="modal-actions"><button type="button" class="btn" data-mode="add"${map.some(Boolean) ? '' : ' disabled'}>Añadir ${recs.length} registros</button><button type="button" class="btn-ghost" data-mode="replace"${map.some(Boolean) ? '' : ' disabled'}>Sustituir todos los registros</button>${bad ? `<button type="button" class="btn-ghost" data-mode="valid">Añadir solo las ${recs.length - bad} válidas</button>` : ''}</div>`;
    prev.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', () => {
      const mode = b.dataset.mode;
      if (mode === 'replace' && !confirm(`Se sustituirán los ${ctx.W(path).datos.length} registros actuales por ${recs.length}. ¿Continuar?`)) return;
      const list = (mode === 'valid' ? recs.filter((r) => !r.errs.length) : recs).map((r) => r.rec);
      ctx.change(path, (env) => { env.datos = mode === 'replace' ? list : [...list, ...env.datos]; });
      dlg.close(); ctx.toast(`${list.length} registros importados como borrador`); ctx.go({ tipo: 'datos', id: ds.id });
    }));
  });
}
export function exportCSV(ds, rows) {
  const cols = ds.campos.map((c) => c.nombre);
  const q = (v) => { const s = v === null || v === undefined ? '' : String(v); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  download(`${ds.id}.csv`, `﻿${cols.join(';')}\n${rows.map((r) => cols.map((c) => q(r[c])).join(';')).join('\n')}\n`, 'text/csv');
}

// ============================================================================ vista previa por dispositivo
export function preview(ctx, route = '') {
  window.__edPreview = () => Object.fromEntries([...ctx.S.dirty].map((p) => [p, ctx.W(p)]));
  window.__edAssets = () => Object.fromEntries([...ctx.S.uploads.keys()].map((p) => [p, store.asset(p)]));
  const sizes = { escritorio: 1280, tableta: 768, movil: 375 };
  const dlg = modal('Vista previa con los cambios sin publicar', `<div class="ed-prev-bar" role="group" aria-label="Dispositivo">${Object.entries(sizes).map(([k, w], i) => `<button type="button" class="btn-ghost" data-w="${w}" aria-pressed="${i === 0}">${{ escritorio: 'Escritorio', tableta: 'Tableta', movil: 'Móvil' }[k]} · ${w}px</button>`).join('')}
      <label class="ed-prev-theme"><input type="checkbox" id="pv-dark"> Modo oscuro</label><span class="ed-hint">${ctx.S.dirty.size} fichero(s) con cambios aplicados</span></div>
    <div class="ed-prev-stage"><iframe title="Vista previa del portal" src="../index.html#/${esc(route)}" style="width:1280px"></iframe></div>`);
  dlg.classList.add('ed-prev-dlg');
  const fr = dlg.querySelector('iframe');
  dlg.querySelectorAll('[data-w]').forEach((b) => b.addEventListener('click', () => { fr.style.width = `${b.dataset.w}px`; dlg.querySelectorAll('[data-w]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }));
  dlg.querySelector('#pv-dark').addEventListener('change', (e) => { try { fr.contentDocument.documentElement.dataset.theme = e.target.checked ? 'dark' : 'light'; } catch { /* */ } });
  return dlg;
}

export { todayIso };
