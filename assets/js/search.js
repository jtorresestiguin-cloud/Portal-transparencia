/**
 * search.js — Buscador del portal.
 *
 * Indexa en el navegador: páginas (título, entradilla y textos), documentos de
 * las páginas, conjuntos de datos, contratos, subvenciones, convenios,
 * normativa, cargos y obligaciones. Expande la consulta con el vocabulario
 * ciudadano de content/sinonimos.json («sueldos» → retribuciones, «alcalde» →
 * cargos…) y devuelve resultados agrupados por tipo con recuento.
 * Sin dependencias ni servidor.
 */
import { t, tr, pick, label } from './i18n.js';
import { esc, icon, fmt, h } from './ui.js';
import * as store from './store.js';

export const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

export const TYPES = {
  pagina: { icon: 'file', label: () => tr('Páginas', 'Pàgines', 'Pages'), one: () => tr('Página', 'Pàgina', 'Page') },
  documento: { icon: 'file', label: () => tr('Documentos', 'Documents', 'Documents'), one: () => tr('Documento', 'Document', 'Document') },
  dato: { icon: 'database', label: () => tr('Datos', 'Dades', 'Data'), one: () => tr('Conjunto de datos', 'Conjunt de dades', 'Dataset') },
  contrato: { icon: 'file', label: () => tr('Contratos', 'Contractes', 'Contracts'), one: () => tr('Contrato', 'Contracte', 'Contract') },
  subvencion: { icon: 'hand', label: () => tr('Subvenciones', 'Subvencions', 'Grants'), one: () => tr('Subvención', 'Subvenció', 'Grant') },
  convenio: { icon: 'link', label: () => tr('Convenios', 'Convenis', 'Agreements'), one: () => tr('Convenio', 'Conveni', 'Agreement') },
  normativa: { icon: 'scale', label: () => tr('Normativa', 'Normativa', 'Regulations'), one: () => tr('Norma', 'Norma', 'Regulation') },
  cargo: { icon: 'users', label: () => tr('Cargos', 'Càrrecs', 'Officials'), one: () => tr('Cargo', 'Càrrec', 'Official') },
  obligacion: { icon: 'check', label: () => tr('Obligaciones legales', 'Obligacions legals', 'Legal obligations'), one: () => tr('Obligación', 'Obligació', 'Obligation') },
};
const ORDER = Object.keys(TYPES);

let index = null, indexLang = null;
/** Construye (una vez por idioma) el índice. */
export async function buildIndex() {
  const lang = document.documentElement.lang;
  if (index && indexLang === lang) return index;
  const [portal, m, syn, ct, sb, cv, nr, cg, obl] = await Promise.all([
    store.portal(), store.meta(), store.getJSON('content/sinonimos.json').catch(() => ({ grupos: [] })),
    store.rows('contratos'), store.rows('subvenciones'), store.rows('convenios'), store.rows('normativa'), store.rows('cargos'), store.rows('obligaciones'),
  ]);
  const items = [];
  const add = (tipo, o) => { const n = norm(`${o.title} ${o.text || ''}`); items.push({ tipo, ...o, _n: n, _w: ` ${n} `, _t: norm(o.title) }); };
  const pageIds = [...new Set([...portal.categorias.flatMap((c) => c.paginas), 'accesibilidad', 'sobre-los-datos'])];
  const pages = (await Promise.all(pageIds.map((id) => store.page(id).then((pg) => [id, pg]).catch(() => null)))).filter(Boolean);
  const catOf = Object.fromEntries(portal.categorias.flatMap((c) => c.paginas.map((p) => [p, c])));
  for (const [id, pg] of pages) {
    const texts = (pg.bloques || []).flatMap((b) => [pick(b.titulo), pick(b.contenido), ...(b.items || []).map((i) => `${pick(i.titulo)} ${pick(i.texto)}`)]).join(' ');
    add('pagina', { title: pick(pg.titulo), text: `${pick(pg.intro)} ${catOf[id] ? pick(catOf[id].titulo) : ''} ${texts}`, meta: catOf[id] ? pick(catOf[id].titulo) : '', href: `#/${id}`, icon: pg.icono || 'file' });
    for (const b of pg.bloques || []) if (b.tipo === 'documentos') for (const d of b.items || []) {
      add('documento', { title: pick(d.titulo), text: `${pick(b.titulo)} ${pick(pg.titulo)} ${pick(d.tipo) || ''}`, meta: [pick(pg.titulo), d.fecha ? fmt.date(d.fecha) : '', d.formato].filter(Boolean).join(' · '), href: `#/${id}`, url: d.url, date: d.fecha });
    }
  }
  portal.categorias.forEach((c) => add('pagina', { title: pick(c.titulo), text: pick(c.descripcion), meta: tr('Tema', 'Tema', 'Topic'), href: `#/categoria/${c.id}`, icon: c.icono }));
  m.conjuntos.forEach((d) => add('dato', { title: pick(d.titulo), text: `${pick(d.descripcion)} ${d.palabras_clave.join(' ')} ${d.fuente.nombre}`, meta: `${t('source')}: ${d.fuente.nombre}`, href: `#/datos/${d.id}` }));
  ct.forEach((c) => add('contrato', { title: c.objeto, text: `${c.adjudicatario || ''} ${c.adjudicatario_nif || ''} ${c.expediente || ''} ${c.id} ${label('procedimiento', c.procedimiento)} ${label('tipo_contrato', c.tipo)}`, meta: [c.adjudicatario, c.importe_adjudicacion_sin_iva ? fmt.eur(c.importe_adjudicacion_sin_iva) : '', c.fecha_adjudicacion ? fmt.date(c.fecha_adjudicacion) : ''].filter(Boolean).join(' · '), href: `#/contratos?q=${encodeURIComponent(c.id)}`, date: c.fecha_adjudicacion }));
  sb.forEach((s) => add('subvencion', { title: s.beneficiario, text: `${s.convocatoria} ${s.beneficiario_nif || ''} ${label('finalidad_subvencion', s.finalidad)}`, meta: [s.convocatoria, fmt.eur(s.importe), fmt.date(s.fecha_concesion)].join(' · '), href: `#/subvenciones?q=${encodeURIComponent(s.beneficiario)}`, date: s.fecha_concesion }));
  cv.forEach((c) => add('convenio', { title: c.objeto, text: `${c.partes} ${label('tipo_parte', c.tipo_parte)}`, meta: [c.partes, fmt.date(c.fecha_firma)].join(' · '), href: `#/convenios?q=${encodeURIComponent(c.objeto)}`, date: c.fecha_firma }));
  nr.forEach((n) => add('normativa', { title: n.titulo, text: `${label('tipo_norma', n.tipo)} ${n.boletin}`, meta: [label('tipo_norma', n.tipo), n.boletin, fmt.date(n.fecha_aprobacion)].join(' · '), href: `#/normativa?q=${encodeURIComponent(n.titulo)}`, date: n.fecha_aprobacion }));
  cg.forEach((c) => add('cargo', { title: c.nombre, text: `${c.cargo} ${c.areas} ${c.grupo_politico} ${label('tipo_cargo', c.tipo_cargo)} ${label('dedicacion', c.dedicacion)}`, meta: [c.cargo, c.retribucion_anual ? `${fmt.eur(c.retribucion_anual)} ${tr('al año', "a l'any", 'per year')}` : ''].filter(Boolean).join(' · '), href: '#/cargos' }));
  obl.forEach((o) => add('obligacion', { title: o.titulo, text: `${o.norma} ${o.articulo}`, meta: `${o.norma}, ${o.articulo}`, href: `#/${o.pagina}` }));
  const groups = (syn.grupos || []).map((g) => ({ ...g, terms: g.terminos.map(norm) }));
  const pageTitles = Object.fromEntries(pages.map(([id, pg]) => [id, pick(pg.titulo)]));
  index = { items, groups, pageTitles };
  indexLang = lang;
  return index;
}

/** Expande cada palabra con sus sinónimos. Devuelve [[alternativas…], …] y el grupo de destino más relevante. */
function expand(q, groups) {
  const nq = norm(q);
  const tokens = nq.split(' ').filter((x) => x.length > 1);
  let best = null;
  // coincidencias de frases completas (p. ej. «deuda viva», «pago a proveedores»)
  for (const g of groups) if (g.terms.some((term) => term.includes(' ') && nq.includes(term))) best ||= g;
  const alts = tokens.map((tok) => {
    const set = new Set([tok]);
    for (const g of groups) if (g.terms.some((term) => term === tok || (tok.length >= 4 && (term.startsWith(tok) || tok.startsWith(term))))) { g.terms.forEach((x) => set.add(x)); best ||= g; }
    return [...set];
  });
  return { tokens, alts, best };
}

/**
 * @returns {{q:string, total:number, groups:{tipo:string,count:number,items:object[]}[], best:object|null, terms:string[]}}
 */
export async function search(q, { tipo = null } = {}) {
  const idx = await buildIndex();
  const { tokens, alts, best } = expand(q, idx.groups);
  if (!tokens.length) return { q, total: 0, groups: [], best: null, terms: [] };
  const scored = [];
  for (const it of idx.items) {
    let score = 0, ok = true;
    for (let i = 0; i < alts.length; i++) {
      const exact = it._n.includes(tokens[i]);
      // los sinónimos solo cuentan como palabra completa («nomina» no debe encontrar «nominativa»)
      const alt = exact || alts[i].some((a) => a !== tokens[i] && it._w.includes(` ${a} `));
      if (!alt) { ok = false; break; }
      score += (exact ? 3 : 1) + (it._t.includes(tokens[i]) ? 4 : 0);
    }
    if (ok) scored.push([score + (it.tipo === 'pagina' ? 3 : 0) + (it.tipo === 'obligacion' ? -2 : 0), it]);
  }
  scored.sort((a, b) => b[0] - a[0] || String(b[1].date || '').localeCompare(String(a[1].date || '')));
  const groups = ORDER.map((tp) => ({ tipo: tp, items: scored.filter(([, it]) => it.tipo === tp).map(([, it]) => it) })).map((g) => ({ ...g, count: g.items.length })).filter((g) => g.count);
  const filtered = tipo ? groups.filter((g) => g.tipo === tipo) : groups;
  const bestBet = best?.destino ? { href: `#/${best.destino}`, title: idx.pageTitles[best.destino] || best.destino } : null;
  return { q, total: groups.reduce((s, g) => s + g.count, 0), groups: filtered, allGroups: groups, best: bestBet, terms: [...new Set(alts.flat())] };
}

/** Resalta los términos buscados (texto escapado). */
export function highlight(text, terms) {
  const src = String(text ?? '');
  if (!terms?.length) return esc(src);
  const n = src.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const marks = new Array(src.length).fill(false);
  for (const term of terms) {
    if (term.length < 2) continue;
    let i = n.indexOf(term);
    while (i !== -1) { for (let k = i; k < i + term.length && k < src.length; k++) marks[k] = true; i = n.indexOf(term, i + term.length); }
  }
  let out = '', open = false;
  for (let i = 0; i < src.length; i++) {
    if (marks[i] && !open) { out += '<mark>'; open = true; }
    if (!marks[i] && open) { out += '</mark>'; open = false; }
    out += esc(src[i]);
  }
  return out + (open ? '</mark>' : '');
}

// ---------------------------------------------------------------- búsquedas recientes
const RKEY = 'busquedas-recientes';
export function recent() { try { return JSON.parse(localStorage.getItem(RKEY) || '[]'); } catch { return []; } }
export function remember(q) {
  const v = String(q || '').trim();
  if (v.length < 2) return;
  try { localStorage.setItem(RKEY, JSON.stringify([v, ...recent().filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 6))); } catch { /* sin almacenamiento */ }
}

// ---------------------------------------------------------------- caja de búsqueda con autocompletado
let boxSeq = 0;
/**
 * Caja de búsqueda accesible (patrón combobox de ARIA 1.2) con sugerencias.
 * @param {HTMLElement} host
 * @param {{size?:'sm'|'lg', value?:string, autofocus?:boolean, popular?:{texto:string, href:string}[]}} o
 */
export function searchBox(host, o = {}) {
  const id = `sb-${++boxSeq}`;
  const form = h(`<form class="searchbox searchbox-${o.size || 'sm'}" role="search" action="#/buscar">
      <label for="${id}" class="sr-only">${esc(t('search_placeholder'))}</label>
      <span class="searchbox-icon" aria-hidden="true">${icon('search', o.size === 'lg' ? 22 : 18)}</span>
      <input id="${id}" type="search" name="q" autocomplete="off" spellcheck="false" value="${esc(o.value || '')}" placeholder="${esc(o.size === 'lg' ? tr('¿Qué información buscas?', 'Quina informació busques?', 'What are you looking for?') : t('search_placeholder'))}"
        role="combobox" aria-expanded="false" aria-controls="${id}-list" aria-autocomplete="list">
      <button type="submit" class="searchbox-btn">${o.size === 'lg' ? esc(t('search')) : `${icon('search', 16)}<span class="sr-only">${esc(t('search'))}</span>`}</button>
      <div class="searchbox-pop" id="${id}-pop" hidden><ul id="${id}-list" role="listbox" aria-label="${esc(t('search_results'))}"></ul></div>
    </form>`);
  host.replaceChildren(form);
  const input = form.querySelector('input'), pop = form.querySelector('.searchbox-pop'), list = form.querySelector('ul');
  let opts = [], active = -1, seq = 0;
  const go = (href, q) => { if (q) remember(q); close(); location.hash = href; };
  const close = () => { pop.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
  const setActive = (i) => {
    active = i;
    [...list.querySelectorAll('[role="option"]')].forEach((el, k) => el.setAttribute('aria-selected', String(k === i)));
    if (i >= 0) { input.setAttribute('aria-activedescendant', `${id}-o${i}`); list.querySelector(`#${id}-o${i}`)?.scrollIntoView({ block: 'nearest' }); } else input.removeAttribute('aria-activedescendant');
  };
  const render = async () => {
    const my = ++seq;
    const q = input.value.trim();
    let html = '';
    opts = [];
    if (q.length < 2) {
      const rec = recent();
      if (rec.length) {
        html += `<li class="sb-head" role="presentation">${tr('Búsquedas recientes', 'Cerques recents', 'Recent searches')}</li>`;
        rec.forEach((r) => { opts.push({ href: `#/buscar?q=${encodeURIComponent(r)}`, q: r }); html += `<li role="option" id="${id}-o${opts.length - 1}" aria-selected="false" class="sb-opt">${icon('sync', 15)}<span>${esc(r)}</span></li>`; });
      }
      if (o.popular?.length) {
        html += `<li class="sb-head" role="presentation">${tr('Lo más consultado', 'El més consultat', 'Most viewed')}</li>`;
        o.popular.forEach((p) => { opts.push({ href: p.href }); html += `<li role="option" id="${id}-o${opts.length - 1}" aria-selected="false" class="sb-opt">${icon('chevron', 15)}<span>${esc(p.texto)}</span></li>`; });
      }
    } else {
      const res = await search(q);
      if (my !== seq) return;
      if (res.best) { opts.push({ href: res.best.href, q }); html += `<li role="option" id="${id}-o0" aria-selected="false" class="sb-opt sb-best">${icon('chevron', 15)}<span><strong>${esc(res.best.title)}</strong><small>${tr('Página recomendada', 'Pàgina recomanada', 'Suggested page')}</small></span></li>`; }
      for (const g of res.groups.slice(0, 4)) {
        html += `<li class="sb-head" role="presentation">${esc(TYPES[g.tipo].label())} <span class="sb-count">${fmt.int(g.count)}</span></li>`;
        g.items.slice(0, g.tipo === 'pagina' ? 3 : 2).forEach((it) => { opts.push({ href: it.href, q }); html += `<li role="option" id="${id}-o${opts.length - 1}" aria-selected="false" class="sb-opt">${icon(TYPES[it.tipo].icon, 15)}<span>${highlight(it.title, res.terms)}${it.meta ? `<small>${esc(it.meta)}</small>` : ''}</span></li>`; });
      }
      opts.push({ href: `#/buscar?q=${encodeURIComponent(q)}`, q });
      html += `<li role="option" id="${id}-o${opts.length - 1}" aria-selected="false" class="sb-opt sb-all">${icon('search', 15)}<span>${res.total ? tr(`Ver los ${fmt.int(res.total)} resultados de «${esc(q)}»`, `Veure els ${fmt.int(res.total)} resultats de «${esc(q)}»`, `See all ${fmt.int(res.total)} results for “${esc(q)}”`) : tr(`Buscar «${esc(q)}»`, `Cercar «${esc(q)}»`, `Search “${esc(q)}”`)}</span></li>`;
    }
    list.innerHTML = html;
    if (!opts.length) return close();
    pop.hidden = false; input.setAttribute('aria-expanded', 'true'); setActive(-1);
  };
  let deb;
  input.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(render, 120); });
  input.addEventListener('focus', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && opts.length) { e.preventDefault(); if (pop.hidden) render(); setActive((active + 1) % opts.length); }
    else if (e.key === 'ArrowUp' && opts.length) { e.preventDefault(); setActive((active - 1 + opts.length) % opts.length); }
    else if (e.key === 'Escape') { if (!pop.hidden) { e.preventDefault(); close(); } }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(opts[active].href, opts[active].q); }
  });
  list.addEventListener('mousedown', (e) => e.preventDefault());
  list.addEventListener('click', (e) => { const li = e.target.closest('[role="option"]'); if (li) { const i = Number(li.id.split('-o').pop()); go(opts[i].href, opts[i].q); } });
  input.addEventListener('blur', () => setTimeout(close, 120));
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) go(`#/buscar?q=${encodeURIComponent(q)}`, q); else input.focus(); });
  if (o.autofocus) setTimeout(() => input.focus(), 0);
  return input;
}
