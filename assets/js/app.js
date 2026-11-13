/**
 * app.js — Portal público: cabecera institucional, portada con categorías
 * («cajitas»), páginas por bloques con menú lateral, buscador, idioma y tema.
 */
import { t, tr, lang, setLang, setCodelists, pick, label, LANGS } from './i18n.js';
import { h, icon, esc, flushCharts, fmt, meter, statusBadge } from './ui.js';
import * as store from './store.js';
import { renderBlocks, pageHeader } from './page.js';

let CFG, PORTAL;

// ---------------------------------------------------------------- rutas
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const parts = path.split('/').filter(Boolean);
  return { parts, query: new URLSearchParams(qs || '') };
}
const main = () => document.getElementById('main');
let seq = 0;
async function router() {
  const my = ++seq;
  const { parts, query } = parseHash();
  const [route, sub] = parts;
  const view = h('<div class="view"></div>');
  try {
    if (!route) await viewHome(view);
    else if (route === 'categoria') await viewCategory(view, sub);
    else if (route === 'datos' && sub) await viewDataset(view, sub);
    else await viewPage(view, route, query, my);
    if (my !== seq) return;
    main().replaceChildren(view);
    flushCharts();
  } catch (e) {
    console.error(e);
    main().innerHTML = `<div class="container narrow"><h1 id="page-title" tabindex="-1">${t('error_title')}</h1><p>${esc(e.message)}</p><p class="muted">${t('error_hint')}</p></div>`;
  }
  const title = main().querySelector('h1')?.textContent?.trim();
  document.title = `${route && title ? title + ' · ' : ''}${t('portal_name')} · ${pick(CFG.nombre)}`;
  if (window.__rendered) { window.scrollTo({ top: 0 }); document.getElementById('page-title')?.focus({ preventScroll: true }); }
  window.__rendered = true;
  markNav(route === 'categoria' ? sub : route);
  const live = document.getElementById('live'); live.textContent = ''; setTimeout(() => (live.textContent = title || ''), 50);
}

// ---------------------------------------------------------------- cabecera / pie
function applyTheme() {
  const r = document.documentElement.style;
  if (CFG.colores?.principal) r.setProperty('--brand', CFG.colores.principal);
  if (CFG.colores?.secundario) r.setProperty('--accent', CFG.colores.secundario);
}
function renderChrome() {
  document.documentElement.lang = lang() === 'va' ? 'ca-ES-valencia' : lang();
  document.querySelector('.skip-link').textContent = t('skip');
  document.getElementById('topbar').innerHTML = `<div class="container topbar-row">
      <span class="topbar-name">${esc(pick(CFG.nombre))}</span>
      <nav class="topbar-links" aria-label="${esc(tr('Enlaces institucionales', 'Enllaços institucionals', 'Institutional links'))}">
        <a href="${esc(CFG.web)}" rel="noopener">${tr('Web municipal', 'Web municipal', 'Council website')}</a>
        <a href="${esc(CFG.sede_electronica)}" rel="noopener">${tr('Sede electrónica', 'Seu electrònica', 'e-Office')}</a>
      </nav>
      <div class="lang-switch" role="group" aria-label="${esc(t('language'))}">${(CFG.idiomas || LANGS).map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === lang()}" title="${t('lang_' + l)}">${{ es: 'Castellano', va: 'Valencià', en: 'English' }[l]}</button>`).join('')}</div>
    </div>`;
  document.getElementById('brand').innerHTML = `<img src="${esc(CFG.escudo)}" alt="" class="escudo" width="52" height="64"><span class="brand-text"><span class="brand-portal">${t('portal_name')}</span><span class="brand-name">${esc(pick(CFG.nombre))}</span></span>`;
  document.getElementById('brand').setAttribute('aria-label', `${t('home')} · ${t('portal_name')}`);
  document.getElementById('search-open').innerHTML = `${icon('search', 18)}<span>${t('search')}</span><kbd>/</kbd>`;
  document.getElementById('theme-toggle').setAttribute('aria-label', t('toggle_theme'));
  document.getElementById('nav-toggle').innerHTML = `${icon('layout', 18)}<span>${t('categories')}</span>`;
  document.getElementById('demo-banner').hidden = !CFG.datos_de_ejemplo;
  document.getElementById('demo-banner').innerHTML = `${icon('info', 16)} <span>${t('demo_banner')}</span> <a href="#/accesibilidad">${t('demo_more')}</a>`;
  document.getElementById('mainnav').innerHTML = `<ul class="container mainnav-list">
    <li><a href="#/" data-nav="">${icon('home', 16)}<span>${t('home')}</span></a></li>
    ${PORTAL.categorias.map((c) => `<li><a href="#/categoria/${c.id}" data-nav="${c.id}">${esc(pick(c.titulo))}</a></li>`).join('')}</ul>`;
  document.getElementById('site-footer').innerHTML = `<div class="container footer-grid">
    <div class="footer-ent"><img src="${esc(CFG.escudo)}" alt="" width="40" height="49"><div><p class="footer-brand">${esc(pick(CFG.nombre))}</p>
      <p class="muted small">${esc(CFG.direccion)} · ${esc(CFG.telefono)}<br><a href="mailto:${esc(CFG.email_transparencia)}">${esc(CFG.email_transparencia)}</a> · NIF ${esc(CFG.nif)} · DIR3 ${esc(CFG.dir3)}</p>
      <p class="muted small">${tr('Información publicada conforme a la Ley 19/2013 y a la', 'Informació publicada d’acord amb la Llei 19/2013 i la', 'Published under Law 19/2013 and')} <a href="${esc(CFG.normativa_autonomica?.eli || '#')}">${esc(pick(CFG.normativa_autonomica))}</a>. ${t('footer_license')} <a href="${esc(CFG.licencia_datos)}" rel="license">CC BY 4.0</a>.</p></div></div>
    <div><p class="footer-h">${t('footer_interop')}</p><ul class="footer-links">
      <li><a href="data/catalog.jsonld">DCAT-AP (JSON-LD)</a></li><li><a href="data/catalog.rdf">DCAT-AP-ES (RDF/XML)</a></li><li><a href="datapackage.json">Data Package</a></li><li><a href="api/openapi.json">OpenAPI 3.1</a></li><li><a href="feed.xml">${t('feed')}</a></li></ul></div>
    <div><p class="footer-h">${t('footer_portal')}</p><ul class="footer-links">
      <li><a href="#/indice">${tr('Índice de transparencia', 'Índex de transparència', 'Transparency index')}</a></li><li><a href="#/derecho-acceso">${tr('Derecho de acceso', 'Dret d’accés', 'Right of access')}</a></li>
      <li><a href="#/accesibilidad">${tr('Accesibilidad y aviso legal', 'Accessibilitat i avís legal', 'Accessibility & legal')}</a></li><li><a href="admin/">${icon('edit', 14)} ${t('editor')}</a></li></ul></div></div>`;
}
function markNav(id) {
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === (id || '') ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
  document.body.classList.remove('nav-open');
}
async function sidebar(currentCat, currentPage) {
  const titles = Object.fromEntries(await Promise.all(PORTAL.categorias.flatMap((c) => c.paginas).map(async (id) => [id, pick((await store.page(id)).titulo)])));
  return `<nav class="sidebar" aria-label="${esc(t('categories'))}"><ul>${PORTAL.categorias.map((c) => `<li class="${c.id === currentCat ? 'open' : ''}">
    <a href="#/categoria/${c.id}" class="side-cat"${c.id === currentCat && !currentPage ? ' aria-current="page"' : ''}>${icon(c.icono, 18)}<span>${esc(pick(c.titulo))}</span></a>
    ${c.id === currentCat ? `<ul>${c.paginas.map((p) => `<li><a href="#/${p}"${p === currentPage ? ' aria-current="page"' : ''}>${esc(titles[p])}</a></li>`).join('')}</ul>` : ''}</li>`).join('')}</ul></nav>`;
}

// ---------------------------------------------------------------- vistas
async function viewHome(view) {
  const [obl, contratos, subv] = await Promise.all([store.rows('obligaciones'), store.rows('contratos'), store.rows('subvenciones')]);
  const { score } = await import('./blocks/avanzados.js');
  const sc = score(obl);
  const counts = Object.fromEntries(PORTAL.categorias.map((c) => [c.id, obl.filter((o) => c.paginas.includes(o.pagina))]));
  const dest = await Promise.all((PORTAL.portada.destacados || []).map(async (id) => ({ id, pg: await store.page(id) })));
  const news = [
    ...contratos.filter((c) => c.fecha_adjudicacion).slice(0, 5).map((c) => ({ d: c.fecha_adjudicacion, k: tr('Contrato', 'Contracte', 'Contract'), ti: c.objeto, m: `${c.adjudicatario || ''}${c.importe_adjudicacion_sin_iva ? ' · ' + fmt.eur(c.importe_adjudicacion_sin_iva) : ''}`, href: `#/contratos?q=${encodeURIComponent(c.id)}` })),
    ...subv.slice(0, 3).map((s) => ({ d: s.fecha_concesion, k: tr('Subvención', 'Subvenció', 'Grant'), ti: s.convocatoria, m: `${s.beneficiario} · ${fmt.eur(s.importe)}`, href: `#/subvenciones?q=${encodeURIComponent(s.id)}` })),
  ].sort((a, b) => b.d.localeCompare(a.d)).slice(0, 6);
  view.innerHTML = `
    <section class="hero"><div class="container">
      <h1 id="page-title" tabindex="-1">${esc(pick(PORTAL.portada.titulo))}</h1>
      <p class="lead">${esc(pick(PORTAL.portada.intro))}</p>
      <button type="button" class="hero-search" data-search>${icon('search', 20)}<span>${t('search_placeholder')}</span><kbd>/</kbd></button>
      <ul class="hero-chips">${dest.map(({ id, pg }) => `<li><a href="#/${id}">${icon(pg.icono || 'chevron', 16)} ${esc(pick(pg.titulo))}</a></li>`).join('')}</ul>
    </div></section>
    <div class="container">
      <h2 class="section-title">${tr('Información por categorías', 'Informació per categories', 'Information by category')}</h2>
      <ul class="tile-grid">${PORTAL.categorias.map((c) => { const o = counts[c.id]; const pct = o.length ? (o.reduce((a, x) => a + ({ publicado: 1, parcial: 0.5 }[x.estado] || 0), 0) / o.length) * 100 : null; return `<li><a class="tile" href="#/categoria/${c.id}">
        <span class="tile-icon">${icon(c.icono, 30)}</span><span class="tile-title">${esc(pick(c.titulo))}</span><span class="tile-text">${esc(pick(c.descripcion))}</span>
        ${pct !== null ? `<span class="tile-meter"><span>${o.length} ${tr('obligaciones', 'obligacions', 'obligations')} · ${fmt.dec(pct, 0)} %</span>${meter(pct)}</span>` : `<span class="tile-meter muted small">${c.paginas.length} ${t('pages')}</span>`}</a></li>`; }).join('')}</ul>
      <div class="home-row">
        <section class="card"><div class="card-head"><h2 class="block-title">${tr('Últimas publicaciones', 'Últimes publicacions', 'Latest updates')}</h2><a href="feed.xml" class="small">${icon('rss', 14)} Atom</a></div>
          <ol class="news-list">${news.map((n) => `<li><a href="${n.href}"><time datetime="${n.d}">${fmt.date(n.d)}</time><span class="news-kind">${n.k}</span><span class="news-title">${esc(n.ti)}</span><span class="news-meta">${esc(n.m)}</span></a></li>`).join('')}</ol></section>
        <a class="card score-card" href="#/indice"><span class="block-title">${tr('Índice de transparencia', 'Índex de transparència', 'Transparency index')}</span>
          <span class="score-ring big" style="--p:${sc.total}"><span>${fmt.dec(sc.total, 0)}<small>%</small></span></span>
          <span class="muted small">${sc.counts.publicado} ${label('estado_obligacion', 'publicado').toLowerCase()} · ${sc.counts.parcial} ${label('estado_obligacion', 'parcial').toLowerCase()} · ${sc.counts.pendiente} ${label('estado_obligacion', 'pendiente').toLowerCase()}</span>
          <span class="link-btn">${tr('Ver la autoevaluación', 'Veure l’autoavaluació', 'See the self-assessment')} →</span></a>
      </div>
      <section class="card open-strip">${icon('database', 28)}<div><h2 class="block-title">${tr('Datos abiertos e interoperables', 'Dades obertes i interoperables', 'Open, interoperable data')}</h2>
        <p>${tr('Contratos sincronizados con la Plataforma de Contratación, subvenciones con la BDNS y catálogo federable con datos.gob.es. Descarga todo en CSV o JSON.', 'Contractes sincronitzats amb la Plataforma de Contractació, subvencions amb la BDNS i catàleg federable amb datos.gob.es. Descarrega-ho tot en CSV o JSON.', 'Contracts synced with the Procurement Platform, grants with BDNS, and a catalogue harvestable by datos.gob.es. Download everything as CSV or JSON.')}</p></div>
        <a class="btn" href="#/datos-abiertos">${tr('Ir a datos abiertos', 'Anar a dades obertes', 'Go to open data')} →</a></section>
    </div>`;
  view.querySelector('[data-search]').addEventListener('click', openSearch);
}
async function viewCategory(view, id) {
  const c = PORTAL.categorias.find((x) => x.id === id);
  if (!c) return notFound(view);
  const pages = await Promise.all(c.paginas.map(async (p) => ({ id: p, pg: await store.page(p) })));
  const obl = (await store.rows('obligaciones')).filter((o) => c.paginas.includes(o.pagina));
  view.innerHTML = `<div class="container with-sidebar">${await sidebar(c.id, null)}<div class="content">
    ${pageHeader({ titulo: c.titulo, intro: c.descripcion }, [['#/', t('home')], [null, pick(c.titulo)]])}
    <ul class="tile-grid compact">${pages.map(({ id: pid, pg }) => `<li><a class="tile" href="#/${pid}"><span class="tile-icon">${icon(pg.icono || 'file', 26)}</span><span class="tile-title">${esc(pick(pg.titulo))}</span><span class="tile-text">${esc(pick(pg.intro))}</span><span class="tile-more">${t('see')} →</span></a></li>`).join('')}</ul>
    ${obl.length ? `<section class="card"><h2 class="block-title">${icon('check', 18)} ${tr('Obligaciones de esta categoría', 'Obligacions d’aquesta categoria', 'Obligations in this category')}</h2><ul class="obl-list">${obl.map((o) => `<li>${statusBadge(o.estado)}<a class="obl-title" href="#/${o.pagina}">${esc(o.titulo)}</a><span class="muted small">${esc(o.norma)}, ${esc(o.articulo)}</span></li>`).join('')}</ul></section>` : ''}
  </div></div>`;
}
async function viewPage(view, id, query, my) {
  let pg;
  try { pg = await store.page(id); } catch { return notFound(view); }
  const cat = await store.categoryOf(id);
  view.innerHTML = `<div class="container with-sidebar">${await sidebar(cat?.id, id)}<div class="content">${pageHeader(pg, [['#/', t('home')], ...(cat ? [[`#/categoria/${cat.id}`, pick(cat.titulo)]] : []), [null, pick(pg.titulo)]])}</div></div>`;
  await renderBlocks(view.querySelector('.content'), pg, { query });
}
async function viewDataset(view, id) {
  const { datasetDetail } = await import('./blocks/avanzados.js');
  view.innerHTML = `<div class="container with-sidebar">${await sidebar('datos', 'datos-abiertos')}<div class="content"></div></div>`;
  await datasetDetail(view.querySelector('.content'), id);
}
function notFound(view) {
  view.innerHTML = `<div class="container narrow"><h1 id="page-title" tabindex="-1">${t('not_found')}</h1><p><a href="#/">${t('back_home')}</a></p></div>`;
}

// ---------------------------------------------------------------- buscador
let index = null;
async function buildIndex() {
  if (index) return index;
  const [m, obl, ct, sb, cg] = await Promise.all([store.meta(), store.rows('obligaciones'), store.rows('contratos'), store.rows('subvenciones'), store.rows('cargos')]);
  const items = [];
  for (const c of PORTAL.categorias) {
    items.push({ type: t('type_category'), title: pick(c.titulo), text: pick(c.descripcion), href: `#/categoria/${c.id}`, icon: c.icono });
    for (const p of c.paginas) { const pg = await store.page(p); items.push({ type: t('type_page'), title: pick(pg.titulo), text: pick(pg.intro), href: `#/${p}`, icon: pg.icono || 'file' }); }
  }
  m.conjuntos.forEach((d) => items.push({ type: t('type_dataset'), title: pick(d.titulo), text: pick(d.descripcion) + ' ' + d.palabras_clave.join(' '), href: `#/datos/${d.id}`, icon: 'database' }));
  obl.forEach((o) => items.push({ type: t('type_obligation'), title: o.titulo, text: `${o.norma} ${o.articulo}`, href: `#/${o.pagina}`, icon: 'check' }));
  ct.forEach((c) => items.push({ type: tr('Contrato', 'Contracte', 'Contract'), title: c.objeto, text: `${c.adjudicatario} ${c.adjudicatario_nif} ${c.id} ${c.expediente}`, meta: c.importe_adjudicacion_sin_iva ? fmt.eur(c.importe_adjudicacion_sin_iva) : '', href: `#/contratos?q=${encodeURIComponent(c.id)}`, icon: 'file' }));
  sb.forEach((s) => items.push({ type: tr('Subvención', 'Subvenció', 'Grant'), title: s.beneficiario, text: `${s.convocatoria} ${s.id}`, meta: fmt.eur(s.importe), href: `#/subvenciones?q=${encodeURIComponent(s.beneficiario)}`, icon: 'hand' }));
  cg.forEach((c) => items.push({ type: tr('Cargo', 'Càrrec', 'Official'), title: c.nombre, text: `${c.cargo} ${c.areas}`, href: '#/cargos', icon: 'users' }));
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  items.forEach((d) => (d._n = norm(`${d.title} ${d.text}`)));
  index = { items, norm };
  return index;
}
function openSearch() {
  const dlg = h(`<dialog class="modal search-modal" aria-label="${esc(t('search'))}"><form method="dialog" class="search-form" role="search">${icon('search', 20)}
    <label for="gq" class="sr-only">${t('search_placeholder')}</label><input id="gq" type="search" autocomplete="off" placeholder="${esc(t('search_placeholder'))}" aria-controls="sres" aria-describedby="shint"><kbd>Esc</kbd></form>
    <p id="shint" class="sr-only">${t('search_hint')}</p><ul id="sres" class="search-results" role="listbox" aria-label="${esc(t('search_results'))}"></ul></dialog>`);
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  const input = dlg.querySelector('input'), list = dlg.querySelector('#sres');
  let active = -1;
  const draw = async () => {
    const { items, norm } = await buildIndex();
    const q = norm(input.value.trim());
    if (q.length < 2) { list.innerHTML = `<li class="search-empty">${t('search_suggest')}</li>`; return; }
    const terms = q.split(/\s+/);
    const res = items.filter((d) => terms.every((x) => d._n.includes(x))).slice(0, 40);
    active = res.length ? 0 : -1;
    list.innerHTML = res.length ? res.map((r, i) => `<li role="option" id="sr-${i}" aria-selected="${i === 0}"><a href="${r.href}">${icon(r.icon, 18)}<span class="sr-main"><span class="sr-title">${esc(r.title)}</span><span class="sr-meta">${esc(r.type)}${r.meta ? ' · ' + esc(r.meta) : ''}</span></span></a></li>`).join('') : `<li class="search-empty">${t('no_results')}</li>`;
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    const its = [...list.querySelectorAll('[role="option"]')];
    if (!its.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); active = (active + (e.key === 'ArrowDown' ? 1 : -1) + its.length) % its.length; its.forEach((x, i) => x.setAttribute('aria-selected', String(i === active))); its[active].scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', its[active].id); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); location.hash = its[active].querySelector('a').getAttribute('href'); dlg.close(); }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) dlg.close(); });
  draw(); input.focus();
}

// ---------------------------------------------------------------- arranque
async function init() {
  [CFG, PORTAL] = await Promise.all([store.config(), store.portal()]);
  setCodelists(await store.getJSON('data/codelists.json'));
  let l = new URLSearchParams(location.search).get('lang');
  if (!l) { try { l = localStorage.getItem('lang'); } catch { /* */ } }
  setLang(LANGS.includes(l) ? l : CFG.idioma_por_defecto || 'es');
  applyTheme();
  renderChrome();
  try { const th = localStorage.getItem('theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* */ }
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', document.documentElement.dataset.theme); } catch { /* */ }
  });
  document.getElementById('topbar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]'); if (!b) return;
    setLang(b.dataset.lang); try { localStorage.setItem('lang', b.dataset.lang); } catch { /* */ }
    index = null; renderChrome(); router();
  });
  document.getElementById('nav-toggle').addEventListener('click', (e) => { const o = document.body.classList.toggle('nav-open'); e.currentTarget.setAttribute('aria-expanded', String(o)); });
  document.getElementById('search-open').addEventListener('click', openSearch);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); openSearch(); }
  });
  window.addEventListener('hashchange', router);
  router();
}
init();
