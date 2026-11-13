/**
 * page.js — Pinta una página a partir de su definición en bloques.
 * Lo usan el portal público y la vista previa del editor.
 */
import { pick } from './i18n.js';
import { esc } from './ui.js';
import { renderBlock, loadAdvanced, BLOCKS } from './blocks/index.js';

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
  const els = (pg.bloques || []).map((b, i) => {
    const el = document.createElement('div');
    grid.appendChild(el);
    return [el, b, i];
  });
  await Promise.all(els.map(async ([el, b, i]) => {
    await renderBlock(el, b, ctxB);
    if (b.tipo === 'grafico' && b.ancho !== 'completo') el.classList.add('span-half');
    ctx.onBlock?.(el, b, i);
  }));
  return grid;
}

export function pageHeader(pg, crumbs = []) {
  return `<header class="page-head-inline">
    ${crumbs.length ? `<nav class="breadcrumb" aria-label="Breadcrumb">${crumbs.map(([href, txt]) => (href ? `<a href="${href}">${esc(txt)}</a>` : `<span aria-current="page">${esc(txt)}</span>`)).join(' › ')}</nav>` : ''}
    <h1 id="page-title" tabindex="-1">${esc(pick(pg.titulo))}</h1>
    ${pick(pg.intro) ? `<p class="lead">${esc(pick(pg.intro))}</p>` : ''}
  </header>`;
}
