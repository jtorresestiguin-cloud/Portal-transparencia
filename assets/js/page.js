/**
 * page.js — Pinta una página a partir de su definición en bloques, con su
 * cabecera (migas, título, explicación) y la banda de procedencia del dato
 * (actualización, fuente, responsable y descargas). Lo usan el portal y el editor.
 */
import { t, tr, pick } from './i18n.js';
import { esc, icon, fmt } from './ui.js';
import * as store from './store.js';
import { renderBlock, loadAdvanced, BLOCKS } from './blocks/index.js';

/** Conjuntos de datos que alimentan cada componente avanzado. */
const ADVANCED_DATASETS = { presupuesto: ['presupuesto'], contratacion: ['contratos'], indice: ['obligaciones'], acceso: ['solicitudes-acceso'], fuentes: [], catalogo: [] };

export function datasetsOf(pg) {
  const ids = new Set();
  for (const b of pg.bloques || []) {
    if (b.tipo === 'indicadores' || b.tipo === 'fuente') continue;
    if (b.conjunto) ids.add(b.conjunto);
    if (b.tipo === 'personas') ids.add(b.conjunto || 'cargos');
    (b.items || []).forEach((it) => it.conjunto && ids.add(it.conjunto));
    (ADVANCED_DATASETS[b.tipo] || []).forEach((d) => ids.add(d));
  }
  return [...ids];
}

/** Calcula los metadatos visibles de una página. */
export async function pageMeta(pg) {
  const ids = datasetsOf(pg);
  const metas = (await Promise.all(ids.map(async (id) => {
    const [m, env] = await Promise.all([store.dsMeta(id), store.dataset(id).catch(() => ({}))]);
    return m ? { id, m, env } : null;
  }))).filter(Boolean);
  const dates = [pg.actualizado, ...metas.map((x) => x.env.actualizado || x.env.generado)].filter(Boolean).sort();
  const sources = [...new Map(metas.map((x) => [x.m.fuente.nombre, x.m.fuente])).values()];
  return {
    updated: dates.at(-1) || null,
    sources,
    responsable: pick(pg.responsable) || (metas[0] ? pick(metas[0].m.responsable) : ''),
    datasets: metas,
    sample: metas.some((x) => x.env.ejemplo),
  };
}

export function metaBand(meta) {
  if (!meta.updated && !meta.sources.length && !meta.responsable) return '';
  const src = meta.sources.map((s) => (s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.nombre)}</a>` : esc(s.nombre))).join(' · ');
  return `<div class="meta-band" role="group" aria-label="${esc(tr('Información sobre estos datos', 'Informació sobre aquestes dades', 'About this information'))}">
    <dl class="meta-list">
      ${meta.updated ? `<div><dt>${icon('clock', 16)}${t('updated')}</dt><dd><time datetime="${meta.updated}">${fmt.full(meta.updated)}</time></dd></div>` : ''}
      ${src ? `<div><dt>${icon('database', 16)}${t('source')}</dt><dd>${src}</dd></div>` : ''}
      ${meta.responsable ? `<div><dt>${icon('users', 16)}${tr('Responsable', 'Responsable', 'Responsible')}</dt><dd>${esc(meta.responsable)}</dd></div>` : ''}
    </dl>
    ${meta.sample ? `<span class="badge badge-warning">${icon('alert', 14)}${tr('Datos de ejemplo', 'Dades d’exemple', 'Sample data')}</span>` : ''}
    ${meta.datasets.length ? `<details class="downloads"><summary class="btn-ghost btn-sm">${icon('download', 16)}${tr('Descargar datos', 'Descarregar dades', 'Download data')}</summary>
      <ul class="downloads-menu">${meta.datasets.map(({ id, m }) => `<li><span>${esc(pick(m.titulo))}</span><span class="dl-links"><a href="data/csv/${id}.csv" download>CSV</a><a href="data/${id}.json">JSON</a><a href="#/datos/${id}">${tr('Ficha', 'Fitxa', 'Details')}</a></span></li>`).join('')}
      <li class="dl-more"><a href="#/sobre-los-datos">${tr('Sobre los datos: procedencia y metodología', 'Sobre les dades: procedència i metodologia', 'About the data: sources and method')} →</a></li></ul></details>` : ''}
  </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {{id:string, titulo:object, intro:object, bloques:object[]}} pg
 * @param {{query?:URLSearchParams, editing?:boolean, onBlock?:(el,block,i)=>void}} ctx
 */
export async function renderBlocks(container, pg, ctx = {}) {
  if ((pg.bloques || []).some((b) => !BLOCKS[b.tipo])) await loadAdvanced();
  const grid = document.createElement('div');
  grid.className = 'blocks';
  container.appendChild(grid);
  const ctxB = { ...ctx, pageId: pg.id, flush: ctx.flush || (() => {}) };
  const els = (pg.bloques || []).map((b, i) => { const el = document.createElement('div'); grid.appendChild(el); return [el, b, i]; });
  await Promise.all(els.map(async ([el, b, i]) => {
    await renderBlock(el, b, { ...ctxB, blockIndex: i });
    if (b.tipo === 'grafico' && b.ancho !== 'completo') el.classList.add('span-half');
    ctx.onBlock?.(el, b, i);
  }));
  return grid;
}

export function pageHeader(pg, crumbs = [], extra = '') {
  return `<header class="page-header">
    ${crumbs.length ? `<nav class="breadcrumb" aria-label="${esc(tr('Estás aquí', 'Estàs ací', 'You are here'))}"><ol>${crumbs.map(([href, txt]) => `<li>${href ? `<a href="${href}">${esc(txt)}</a>` : `<span aria-current="page">${esc(txt)}</span>`}</li>`).join('')}</ol></nav>` : ''}
    <h1 id="page-title" tabindex="-1">${esc(pick(pg.titulo))}</h1>
    ${pick(pg.intro) ? `<p class="lead">${esc(pick(pg.intro))}</p>` : ''}
    ${extra}
  </header>`;
}

/** Llamada a la acción para solicitar información. */
export function askCta(compact = false) {
  return `<aside class="ask-cta${compact ? ' compact' : ''}" aria-label="${esc(tr('Solicitar información', 'Sol·licitar informació', 'Request information'))}">
    <div><p class="ask-title">${tr('¿No encuentras lo que buscas?', 'No trobes el que busques?', 'Can’t find what you’re looking for?')}</p>
    <p>${tr('Puedes pedir cualquier información pública. Es gratuito y no hace falta justificar el motivo.', 'Pots demanar qualsevol informació pública. És gratuït i no cal justificar el motiu.', 'You can ask for any public information. It is free and you don’t need to give a reason.')}</p></div>
    <a class="btn" href="#/derecho-acceso">${tr('Solicitar información pública', 'Sol·licitar informació pública', 'Request public information')} ${icon('arrow', 16)}</a>
  </aside>`;
}
