/**
 * app.js — Portal público.
 *  - Cabecera compacta: escudo, buscador, idioma, tema y menú «Temas».
 *  - Portada orientada a tareas: buscador, preguntas frecuentes, datos destacados,
 *    temas, últimas actualizaciones y solicitud de información.
 *  - Categorías con cifras clave y navegación contextual.
 *  - Páginas por bloques con banda de procedencia del dato.
 *  - Búsqueda con página de resultados agrupados (#/buscar?q=…).
 */
import { t, tr, lang, setLang, setCodelists, pick, LANGS } from './i18n.js';
import { h, icon, esc, flushCharts, fmt, emptyState } from './ui.js';
import * as store from './store.js';
import { renderBlocks, pageHeader, pageMeta, metaBand, askCta } from './page.js';
import { FORMATS } from './blocks/index.js';
import { searchBox, search, highlight, remember, TYPES } from './search.js';

let CFG, PORTAL;
document.documentElement.dataset.app = 'ok'; // los módulos se han cargado (lo comprueba index.html)

const LANG_NAMES = { es: 'Castellano', va: 'Valencià', en: 'English' };

// ---------------------------------------------------------------- rutas
export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), query: new URLSearchParams(qs || '') };
}
const main = () => document.getElementById('main');
const skeleton = () => `<div class="container skeleton" aria-hidden="true"><div class="sk sk-crumb"></div><div class="sk sk-title"></div><div class="sk sk-line"></div><div class="sk sk-line short"></div><div class="sk-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div></div>`;
let seq = 0;
async function router() {
  const my = ++seq;
  const { parts, query } = parseHash();
  const [route, sub] = parts;
  closeMenu();
  const slow = setTimeout(() => { if (my === seq) { main().innerHTML = skeleton(); main().setAttribute('aria-busy', 'true'); } }, 150);
  const view = h('<div class="view"></div>');
  try {
    if (!route) await viewHome(view);
    else if (route === 'categoria') await viewCategory(view, sub);
    else if (route === 'buscar') await viewSearch(view, query);
    else if (route === 'datos' && sub) await viewDataset(view, sub);
    else await viewPage(view, route, query);
    if (my !== seq) return;
    main().replaceChildren(view);
    flushCharts();
  } catch (e) {
    console.error(e);
    if (my !== seq) return;
    main().replaceChildren(errorView(e));
  } finally {
    clearTimeout(slow);
    main().removeAttribute('aria-busy');
  }
  const title = main().querySelector('h1')?.textContent?.trim();
  document.title = `${route && title ? title + ' · ' : ''}${t('portal_name')} · ${pick(CFG.nombre)}`;
  const desc = main().querySelector('.lead')?.textContent?.trim() || pick(PORTAL.portada.intro);
  document.querySelector('meta[name="description"]')?.setAttribute('content', desc);
  if (window.__rendered && !(route === 'buscar')) { window.scrollTo({ top: 0 }); document.getElementById('page-title')?.focus({ preventScroll: true }); }
  window.__rendered = true;
  markNav(route === 'categoria' ? `categoria/${sub}` : route);
  const live = document.getElementById('live'); live.textContent = ''; setTimeout(() => (live.textContent = title || ''), 50);
}
function errorView(e) {
  const el = h(`<div class="container narrow"><h1 id="page-title" tabindex="-1">${tr('No hemos podido cargar esta página', 'No hem pogut carregar aquesta pàgina', 'We couldn’t load this page')}</h1>
    <p class="lead">${tr('Puede ser un problema temporal de conexión. Prueba de nuevo en unos segundos.', 'Pot ser un problema temporal de connexió. Prova de nou en uns segons.', 'It may be a temporary connection problem. Please try again in a few seconds.')}</p>
    <p class="actions"><button type="button" class="btn" data-retry>${tr('Reintentar', 'Tornar a provar', 'Try again')}</button> <a class="btn-ghost" href="#/">${t('back_home')}</a></p>
    <details class="tech"><summary>${tr('Información técnica', 'Informació tècnica', 'Technical details')}</summary><code>${esc(e.message)}</code><p class="muted small">${t('error_hint')}</p></details></div>`);
  el.querySelector('[data-retry]').addEventListener('click', router);
  return el;
}

// ---------------------------------------------------------------- cabecera, menú y pie
function applyTheme() {
  const r = document.documentElement.style;
  if (CFG.colores?.principal) r.setProperty('--brand', CFG.colores.principal);
  if (CFG.colores?.secundario) r.setProperty('--accent', CFG.colores.secundario);
}
const popular = () => (PORTAL.portada.preguntas || []).slice(0, 5).map((q) => ({ texto: pick(q.texto), href: `#/${q.pagina}` }));
async function renderChrome() {
  document.documentElement.lang = lang() === 'va' ? 'ca-ES-valencia' : lang();
  document.querySelector('.skip-link').textContent = t('skip');
  const banner = document.getElementById('demo-banner');
  banner.hidden = !CFG.datos_de_ejemplo;
  banner.innerHTML = `<div class="container">${icon('info', 16)} <span class="demo-long">${t('demo_banner')}</span><span class="demo-short">${tr('Prototipo con datos de ejemplo.', 'Prototip amb dades d’exemple.', 'Prototype with sample data.')}</span> <a href="#/sobre-los-datos">${t('demo_more')}</a></div>`;
  document.getElementById('brand').innerHTML = `<img src="${esc(CFG.escudo)}" alt="" class="escudo" width="40" height="49"><span class="brand-text"><span class="brand-portal">${tr('Transparencia', 'Transparència', 'Transparency')}</span><span class="brand-name">${esc(pick(CFG.nombre))}</span></span>`;
  document.getElementById('brand').setAttribute('aria-label', `${t('portal_name')} · ${pick(CFG.nombre)} · ${t('home')}`);
  searchBox(document.getElementById('header-search'), { size: 'sm', popular: popular() });
  document.getElementById('search-link').innerHTML = `${icon('search', 20)}<span class="sr-only">${t('search')}</span>`;
  document.getElementById('lang-switch').innerHTML = `<label for="lang-select" class="sr-only">${t('language')}</label>${icon('globe', 16)}<select id="lang-select" data-lang-select>${(CFG.idiomas || LANGS).map((l) => `<option value="${l}" lang="${l === 'va' ? 'ca' : l}"${l === lang() ? ' selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}</select>`;
  document.getElementById('theme-toggle').setAttribute('aria-label', t('toggle_theme'));
  document.getElementById('menu-toggle').innerHTML = `${icon('menu', 20)}<span>${t('menu')}</span>`;
  const menu = PORTAL.menu || [];
  document.getElementById('mainnav').innerHTML = `<div class="container mainnav-row"><ul class="mainnav-list">
      <li><button type="button" class="nav-topics" aria-expanded="false" aria-controls="menu-panel">${icon('layout', 16)}${tr('Temas', 'Temes', 'Topics')}${icon('down', 14)}</button></li>
      ${menu.map((m) => `<li><a href="#/${m.pagina}" data-nav="${m.pagina}">${esc(pick(m.texto))}</a></li>`).join('')}
      <li><a href="#/datos-abiertos" data-nav="datos-abiertos">${tr('Datos abiertos', 'Dades obertes', 'Open data')}</a></li></ul>
    <a class="btn btn-sm nav-cta" href="#/derecho-acceso" data-nav="derecho-acceso">${tr('Solicitar información', 'Sol·licitar informació', 'Request information')}</a></div>`;
  document.getElementById('menu-panel').innerHTML = `<div class="container menu-inner">
      <div class="menu-mobile-extra"><label class="control menu-lang"><span>${t('language')}</span><select data-lang-select>${(CFG.idiomas || LANGS).map((l) => `<option value="${l}" lang="${l === 'va' ? 'ca' : l}"${l === lang() ? ' selected' : ''}>${LANG_NAMES[l]}</option>`).join('')}</select></label><a class="btn" href="#/derecho-acceso">${tr('Solicitar información', 'Sol·licitar informació', 'Request information')}</a>
        <ul class="menu-quick">${menu.map((m) => `<li><a href="#/${m.pagina}">${esc(pick(m.texto))}</a></li>`).join('')}</ul></div>
      <p class="menu-title">${tr('Todos los temas', 'Tots els temes', 'All topics')}</p>
      <ul class="menu-grid">${PORTAL.categorias.map((c) => `<li><a class="menu-cat" href="#/categoria/${c.id}">${icon(c.icono, 18)}<span>${esc(pick(c.titulo))}</span></a></li>`).join('')}</ul>
      <p class="menu-links"><a href="${esc(CFG.sede_electronica)}" rel="noopener">${tr('Sede electrónica', 'Seu electrònica', 'e-Office')} ${icon('external', 14)}</a> <a href="${esc(CFG.web)}" rel="noopener">${tr('Web municipal', 'Web municipal', 'Council website')} ${icon('external', 14)}</a></p></div>`;
  const ent = esc(pick(CFG.nombre));
  document.getElementById('site-footer').innerHTML = `<div class="container footer-grid">
    <div class="footer-ent"><img src="${esc(CFG.escudo)}" alt="" width="36" height="44"><div><p class="footer-brand">${ent}</p>
      <p class="small">${esc(CFG.direccion)}<br>${esc(CFG.telefono)} · <a href="mailto:${esc(CFG.email_transparencia)}">${esc(CFG.email_transparencia)}</a></p>
      <p class="small muted">NIF ${esc(CFG.nif)} · DIR3 ${esc(CFG.dir3)}</p></div></div>
    <nav aria-label="${esc(tr('Transparencia', 'Transparència', 'Transparency'))}"><p class="footer-h">${tr('Transparencia', 'Transparència', 'Transparency')}</p><ul class="footer-links">
      <li><a href="#/derecho-acceso">${tr('Solicitar información pública', 'Sol·licitar informació pública', 'Request public information')}</a></li>
      <li><a href="#/sobre-los-datos">${tr('Sobre los datos', 'Sobre les dades', 'About the data')}</a></li>
      <li><a href="#/indice">${tr('Índice de cumplimiento', 'Índex de compliment', 'Compliance index')}</a></li>
      <li><a href="${esc(CFG.sede_electronica)}" rel="noopener">${tr('Sede electrónica', 'Seu electrònica', 'e-Office')}</a></li>
      <li><a href="${esc(CFG.web)}" rel="noopener">${tr('Web municipal', 'Web municipal', 'Council website')}</a></li></ul></nav>
    <nav aria-label="${esc(t('footer_interop'))}"><p class="footer-h">${tr('Datos abiertos y API', 'Dades obertes i API', 'Open data & API')}</p><ul class="footer-links">
      <li><a href="#/datos-abiertos">${tr('Catálogo de datos', 'Catàleg de dades', 'Data catalogue')}</a></li><li><a href="data/catalog.jsonld">DCAT-AP</a> · <a href="data/catalog.rdf">DCAT-AP-ES</a></li>
      <li><a href="api/openapi.json">OpenAPI</a> · <a href="datapackage.json">Data Package</a></li><li><a href="feed.xml">${t('feed')}</a></li></ul></nav>
    </div>
    <div class="container footer-bottom"><p class="small">${tr('Información publicada conforme a la Ley 19/2013 y a la', 'Informació publicada d’acord amb la Llei 19/2013 i la', 'Published under Law 19/2013 and')} <a href="${esc(CFG.normativa_autonomica?.eli || '#')}">${esc(pick(CFG.normativa_autonomica))}</a>. ${t('footer_license')} <a href="${esc(CFG.licencia_datos)}" rel="license">CC BY 4.0</a>.</p>
    <p class="small"><a href="#/accesibilidad">${tr('Accesibilidad y aviso legal', 'Accessibilitat i avís legal', 'Accessibility & legal')}</a></p></div>`;
}
function markNav(id) {
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === (id || '') ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}
function openMenu(trigger) {
  const panel = document.getElementById('menu-panel');
  panel.hidden = false;
  document.querySelectorAll('[aria-controls="menu-panel"]').forEach((b) => b.setAttribute('aria-expanded', 'true'));
  document.body.classList.add('menu-open');
  panel.querySelector('a')?.focus();
  panel._trigger = trigger;
}
function closeMenu(restore = false) {
  const panel = document.getElementById('menu-panel');
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  document.querySelectorAll('[aria-controls="menu-panel"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  document.body.classList.remove('menu-open');
  if (restore) panel._trigger?.focus();
}

// ---------------------------------------------------------------- utilidades de vista
async function figure(it) {
  const [rowsAll, m, env] = await Promise.all([store.rows(it.conjunto), store.dsMeta(it.conjunto), store.dataset(it.conjunto)]);
  const data = store.applyFilter(rowsAll, it.filtro);
  const v = store.aggregate(data, it.operacion, it.campo);
  return { value: v === null ? '—' : (FORMATS[it.formato] || FORMATS.entero)(v), label: pick(it.etiqueta), source: m?.fuente.nombre, date: env.actualizado || env.generado, sample: env.ejemplo, href: it.pagina ? `#/${it.pagina}` : null };
}
function figureHtml(f) {
  const tag = f.href ? 'a' : 'div';
  return `<${tag} class="stat"${f.href ? ` href="${f.href}"` : ''}><span class="stat-value">${esc(f.value)}</span><span class="stat-label">${esc(f.label)}</span>
    <span class="stat-meta">${esc(f.source || '')}${f.date ? ` · ${fmt.date(String(f.date).slice(0, 10))}` : ''}${f.sample ? ` · ${tr('ejemplo', 'exemple', 'sample')}` : ''}</span></${tag}>`;
}
async function categoryNav(cat, currentPage) {
  const pages = await Promise.all(cat.paginas.map(async (p) => [p, pick((await store.page(p)).titulo)]));
  return `<nav class="local-nav" aria-label="${esc(tr('En esta sección', 'En aquesta secció', 'In this section'))}">
    <div class="local-nav-box"><div class="local-nav-head"><span class="local-nav-kicker">${tr('En esta sección', 'En aquesta secció', 'In this section')}</span><a href="#/categoria/${cat.id}" class="local-nav-cat"${!currentPage ? ' aria-current="page"' : ''}>${icon(cat.icono, 18)}${esc(pick(cat.titulo))}</a></div>
    <ul>${pages.map(([p, title]) => `<li><a href="#/${p}"${p === currentPage ? ' aria-current="page"' : ''}>${esc(title)}</a></li>`).join('')}</ul></div>
    <a class="local-nav-all" href="#/" data-open-topics>${icon('layout', 16)}${tr('Ver todos los temas', 'Veure tots els temes', 'See all topics')}</a></nav>`;
}
function bindLocalNav(view) {
  view.querySelector('[data-open-topics]')?.addEventListener('click', (e) => { e.preventDefault(); openMenu(e.currentTarget); });
}

// ---------------------------------------------------------------- portada
async function viewHome(view) {
  const index = await fetch(store.url('api/v1/index.json')).then((r) => r.json()).catch(() => ({ conjuntos: [] }));
  const meta = await store.meta();
  const preguntas = PORTAL.portada.preguntas || [];
  const updates = index.conjuntos.filter((d) => d.actualizado).sort((a, b) => String(b.actualizado).localeCompare(String(a.actualizado))).slice(0, 6)
    .map((d) => ({ ...d, pagina: meta.conjuntos.find((m) => m.id === d.id)?.pagina }));
  view.innerHTML = `
    <section class="home-hero"><div class="container">
      <h1 id="page-title" tabindex="-1">${esc(pick(PORTAL.portada.titulo))}</h1>
      <p class="home-intro">${esc(pick(PORTAL.portada.intro))}</p>
      <div class="home-search"></div>
      <p class="home-chips"><span class="sr-only">${tr('Accesos rápidos', 'Accessos ràpids', 'Quick links')}:</span>${(PORTAL.menu || []).map((m) => `<a href="#/${m.pagina}">${esc(pick(m.texto))}</a>`).join('<span aria-hidden="true">·</span>')}</p>
    </div></section>
    <div class="container home-body">
      <section class="home-section" aria-labelledby="h-faq"><h2 id="h-faq" class="section-title">${tr('Lo más consultado', 'El més consultat', 'Most viewed')}</h2>
        <ul class="faq-list">${preguntas.map((q) => `<li><a href="#/${q.pagina}">${icon('question', 20)}<span>${esc(pick(q.texto))}</span>${icon('arrow', 18)}</a></li>`).join('')}</ul></section>
      <section class="home-section" aria-labelledby="h-topics"><h2 id="h-topics" class="section-title">${tr('Explora por temas', 'Explora per temes', 'Explore by topic')}</h2>
        <ul class="topic-list">${PORTAL.categorias.map((c) => `<li><a class="topic" href="#/categoria/${c.id}"><span class="topic-icon">${icon(c.icono, 22)}</span><span class="topic-body"><span class="topic-title">${esc(pick(c.titulo))}</span><span class="topic-desc">${esc(pick(c.descripcion))}</span></span><span class="topic-count">${c.paginas.length} ${c.paginas.length === 1 ? tr('contenido', 'contingut', 'item') : tr('contenidos', 'continguts', 'items')}${icon('chevron', 16)}</span></a></li>`).join('')}</ul></section>
      <section class="home-section" aria-labelledby="h-data"><div class="section-head"><h2 id="h-data" class="section-title">${tr('En cifras', 'En xifres', 'In figures')}</h2><a href="#/sobre-los-datos" class="section-link">${tr('Cómo se calculan', 'Com es calculen', 'How they are calculated')}</a></div>
        <div class="stat-row" data-figures aria-busy="true">${(PORTAL.portada.datos_destacados || []).map(() => '<div class="stat sk"></div>').join('')}</div></section>
      ${askCta(true)}
    </div>
    <section class="home-deep" aria-labelledby="h-deep"><div class="container">
      <h2 id="h-deep" class="deep-kicker">${tr('Para profundizar', 'Per a aprofundir', 'Go deeper')}</h2>
      <div class="deep-grid">
        <section class="deep-card" aria-labelledby="h-explore-data"><h3 id="h-explore-data">${icon('database', 20)}${tr('Explorar los datos', 'Explorar les dades', 'Explore the data')}</h3>
          <p class="deep-desc">${tr('Para periodistas, investigadores y reutilizadores: conjuntos completos, descargas y API.', 'Per a periodistes, investigadors i reutilitzadors: conjunts complets, descàrregues i API.', 'For journalists, researchers and re-users: full datasets, downloads and API.')}</p>
          <p class="deep-sub">${tr('Últimas actualizaciones', 'Últimes actualitzacions', 'Latest updates')}</p>
          <ul class="update-list">${updates.slice(0, 4).map((u) => `<li><a href="#/${u.pagina || 'datos/' + u.id}"><span class="update-title">${esc(pick(u.titulo))}</span><span class="update-meta">${fmt.int(u.registros)} ${t('records')} · ${u.fuente === 'placsp' || u.fuente === 'bdns' ? tr('actualización automática', 'actualització automàtica', 'automatic update') : tr('actualización manual', 'actualització manual', 'manual update')}</span></a><time datetime="${u.actualizado}">${fmt.date(u.actualizado)}</time></li>`).join('')}</ul>
          <p class="deep-links"><a href="#/datos-abiertos">${tr('Catálogo de datos', 'Catàleg de dades', 'Data catalogue')}</a><a href="api/openapi.json">API</a><a href="feed.xml">${icon('rss', 14)} Atom</a></p></section>
        <section class="deep-card" aria-labelledby="h-method"><h3 id="h-method">${icon('check', 20)}${tr('Cumplimiento y metodología', 'Compliment i metodologia', 'Compliance and method')}</h3>
          <p class="deep-desc">${tr('Qué obliga a publicar la ley, si está al día y de dónde sale cada dato.', 'Què obliga a publicar la llei, si està al dia i d’on ix cada dada.', 'What the law requires, whether it is up to date and where each figure comes from.')}</p>
          <a class="deep-score" href="#/indice" data-score><span class="deep-score-n">—</span><span>${tr('Índice de cumplimiento', 'Índex de compliment', 'Compliance index')}</span></a>
          <p class="deep-links"><a href="#/indice">${tr('Obligaciones legales', 'Obligacions legals', 'Legal obligations')}</a><a href="#/sobre-los-datos">${tr('Fuentes y actualización', 'Fonts i actualització', 'Sources and updates')}</a><a href="data/catalog.jsonld">DCAT-AP</a><a href="#/contratos">OCDS</a></p></section>
      </div></div></section>`;
  searchBox(view.querySelector('.home-search'), { size: 'lg', popular: popular() });
  import('./compliance.js').then(async (C) => { const sc = C.score(await C.obligaciones()); const el = view.querySelector('[data-score] .deep-score-n'); if (el) el.textContent = `${fmt.dec(sc.total, 0)} %`; }).catch(() => {});
  // cifras después de pintar (no bloquean la portada)
  Promise.all((PORTAL.portada.datos_destacados || []).map((it) => figure(it).catch(() => null))).then((fs) => {
    const row = view.querySelector('[data-figures]');
    if (!row) return;
    row.innerHTML = fs.filter(Boolean).map(figureHtml).join('');
    row.removeAttribute('aria-busy');
  });
}

// ---------------------------------------------------------------- categoría
async function viewCategory(view, id) {
  const c = PORTAL.categorias.find((x) => x.id === id);
  if (!c) return notFound(view);
  const pages = await Promise.all(c.paginas.map(async (p) => { const pg = await store.page(p); const meta = await pageMeta(pg); return { id: p, pg, meta }; }));
  const { obligaciones } = await import('./compliance.js');
  const obl = (await obligaciones(c.paginas)).filter((o) => o.estado_calc !== 'no_aplica');
  const ok = obl.filter((o) => o.estado_calc === 'publicado').length;
  view.innerHTML = `<div class="container layout-sidebar">${await categoryNav(c, null)}<div class="content">
    ${pageHeader({ titulo: c.titulo, intro: c.descripcion }, [['#/', t('home')], [null, pick(c.titulo)]])}
    ${c.cifras?.length ? `<section aria-labelledby="h-kf"><h2 id="h-kf" class="section-title">${tr('Cifras clave', 'Xifres clau', 'Key figures')}</h2><div class="stat-row" data-figures></div></section>` : ''}
    <section aria-labelledby="h-explore"><h2 id="h-explore" class="section-title">${tr('Qué puedes consultar', 'Què pots consultar', 'What you can find')}</h2>
      <ul class="explore-list">${pages.map(({ id: pid, pg, meta }) => `<li><a class="explore-item" href="#/${pid}"><span class="topic-icon">${icon(pg.icono || 'file', 20)}</span><span class="topic-body"><span class="topic-title">${esc(pick(pg.titulo))}</span><span class="topic-desc">${esc(pick(pg.intro))}</span>
        <span class="explore-meta">${meta.updated ? `${t('updated')}: ${fmt.date(meta.updated)}` : ''}${meta.sources.length ? ` · ${t('source')}: ${esc(meta.sources.map((s) => s.nombre).join(', '))}` : ''}</span></span>${icon('chevron', 18)}</a></li>`).join('')}</ul></section>
    ${obl.length ? `<details class="status-summary"><summary>${icon('check', 18)}<span>${tr(`Estado de la información: <strong>${ok} de ${obl.length}</strong> apartados disponibles y al día`, `Estat de la informació: <strong>${ok} de ${obl.length}</strong> apartats disponibles i al dia`, `Information status: <strong>${ok} of ${obl.length}</strong> items available and up to date`)}</span></summary>
      <p class="muted small">${tr('Qué exige la normativa de transparencia en este tema y si está publicado.', 'Què exigeix la normativa de transparència en aquest tema i si està publicat.', 'What transparency law requires on this topic and whether it is published.')} <a href="#/indice">${tr('Ver el índice completo', 'Veure l’índex complet', 'See the full index')}</a></p>
      <div data-obl></div></details>` : ''}
    ${askCta(true)}
  </div></div>`;
  bindLocalNav(view);
  if (c.cifras?.length) Promise.all(c.cifras.map((it) => figure(it).catch(() => null))).then((fs) => { const row = view.querySelector('[data-figures]'); if (row) row.innerHTML = fs.filter(Boolean).map(figureHtml).join(''); });
  if (obl.length) { const { BLOCKS } = await import('./blocks/index.js'); await BLOCKS.indicadores.render(view.querySelector('[data-obl]'), { lista: c.paginas, plano: true }, {}); }
}

// ---------------------------------------------------------------- página
async function viewPage(view, id, query) {
  let pg;
  try { pg = await store.page(id); } catch { return notFound(view); }
  const cat = await store.categoryOf(id) || (id === 'sobre-los-datos' ? PORTAL.categorias.find((c) => c.id === 'datos') : null);
  const meta = await pageMeta(pg);
  view.innerHTML = `<div class="container ${cat ? 'layout-sidebar' : 'layout-single'}">${cat ? await categoryNav(cat, id) : ''}<div class="content">
    ${pageHeader(pg, [['#/', t('home')], ...(cat ? [[`#/categoria/${cat.id}`, pick(cat.titulo)]] : []), [null, pick(pg.titulo)]], metaBand(meta))}
  </div></div>`;
  const content = view.querySelector('.content');
  await renderBlocks(content, pg, { query });
  if (id !== 'derecho-acceso') content.insertAdjacentHTML('beforeend', askCta(true));
  bindLocalNav(view);
}
async function viewDataset(view, id) {
  const { datasetDetail } = await import('./blocks/avanzados.js');
  const cat = PORTAL.categorias.find((c) => c.id === 'datos');
  view.innerHTML = `<div class="container layout-sidebar">${cat ? await categoryNav(cat, 'datos-abiertos') : ''}<div class="content"></div></div>`;
  await datasetDetail(view.querySelector('.content'), id);
  bindLocalNav(view);
}
function notFound(view) {
  view.innerHTML = `<div class="container narrow"><h1 id="page-title" tabindex="-1">${t('not_found')}</h1>
    <p class="lead">${tr('Puede que la dirección haya cambiado. Prueba a buscar lo que necesitas.', 'Pot ser que l’adreça haja canviat. Prova a cercar el que necessites.', 'The address may have changed. Try searching for what you need.')}</p><div class="nf-search"></div><p><a href="#/">${t('back_home')}</a></p></div>`;
  searchBox(view.querySelector('.nf-search'), { size: 'lg', popular: popular() });
}

// ---------------------------------------------------------------- resultados de búsqueda
async function viewSearch(view, query) {
  const q = query.get('q') || '';
  const tipo = query.get('tipo') || '';
  view.innerHTML = `<div class="container layout-single search-page"><header class="page-header">
    <nav class="breadcrumb" aria-label="${esc(tr('Estás aquí', 'Estàs ací', 'You are here'))}"><ol><li><a href="#/">${t('home')}</a></li><li><span aria-current="page">${t('search')}</span></li></ol></nav>
    <h1 id="page-title" tabindex="-1">${q ? tr(`Resultados de «${esc(q)}»`, `Resultats de «${esc(q)}»`, `Results for “${esc(q)}”`) : t('search')}</h1><div class="search-page-box"></div></header><div class="search-results-area"></div></div>`;
  searchBox(view.querySelector('.search-page-box'), { size: 'lg', value: q, autofocus: !q, popular: popular() });
  const area = view.querySelector('.search-results-area');
  if (!q) { area.appendChild(h(`<section><h2 class="section-title">${tr('Lo más consultado', 'El més consultat', 'Most viewed')}</h2><ul class="faq-list">${(PORTAL.portada.preguntas || []).map((p) => `<li><a href="#/${p.pagina}">${icon('question', 20)}<span>${esc(pick(p.texto))}</span>${icon('arrow', 18)}</a></li>`).join('')}</ul></section>`)); return; }
  remember(q);
  const res = await search(q, { tipo: tipo || null });
  const all = res.allGroups || res.groups;
  const tabs = h(`<nav class="type-filter" aria-label="${esc(tr('Filtrar por tipo', 'Filtrar per tipus', 'Filter by type'))}"><ul>
    <li><a href="#/buscar?q=${encodeURIComponent(q)}"${!tipo ? ' aria-current="true"' : ''}>${tr('Todo', 'Tot', 'All')} <span class="count">${fmt.int(res.total)}</span></a></li>
    ${all.map((g) => `<li><a href="#/buscar?q=${encodeURIComponent(q)}&tipo=${g.tipo}"${tipo === g.tipo ? ' aria-current="true"' : ''}>${esc(TYPES[g.tipo].label())} <span class="count">${fmt.int(g.count)}</span></a></li>`).join('')}</ul></nav>`);
  area.appendChild(h(`<p class="result-count" role="status"><strong>${fmt.int(res.total)}</strong> ${res.total === 1 ? tr('resultado', 'resultat', 'result') : tr('resultados', 'resultats', 'results')}</p>`));
  if (res.total) area.appendChild(tabs);
  if (res.best && !tipo) area.appendChild(h(`<a class="best-bet" href="${res.best.href}"><span class="best-kicker">${tr('Página recomendada', 'Pàgina recomanada', 'Suggested page')}</span><span class="best-title">${esc(res.best.title)}</span>${icon('arrow', 20)}</a>`));
  if (!res.total) {
    area.appendChild(emptyState(tr(`No hemos encontrado nada para «${q}»`, `No hem trobat res per a «${q}»`, `Nothing found for “${q}”`),
      tr('Prueba con otras palabras o más generales (por ejemplo «contratos», «sueldos» o «presupuesto»), o solicita la información.', 'Prova amb altres paraules o més generals (per exemple «contractes», «sous» o «pressupost»), o sol·licita la informació.', 'Try other or more general words (for example “contracts”, “pay” or “budget”), or request the information.'),
      [{ label: tr('Solicitar información pública', 'Sol·licitar informació pública', 'Request public information'), href: '#/derecho-acceso', primary: true }, { label: tr('Ver todos los temas', 'Veure tots els temes', 'See all topics'), href: '#/' }]));
    return;
  }
  for (const g of res.groups) {
    const limit = tipo ? 100 : 5;
    const sec = h(`<section class="result-group" aria-labelledby="rg-${g.tipo}"><h2 id="rg-${g.tipo}" class="result-group-title">${icon(TYPES[g.tipo].icon, 18)}${esc(TYPES[g.tipo].label())} <span class="count">${fmt.int(g.count)}</span></h2>
      <ol class="result-list">${g.items.slice(0, limit).map((it) => `<li><a href="${it.href}" class="result-title">${highlight(it.title, res.terms)}</a>${it.meta ? `<p class="result-meta">${highlight(it.meta, res.terms)}</p>` : ''}${it.url && it.url !== '#' ? `<p class="result-meta"><a href="${esc(it.url)}" rel="noopener">${icon('download', 14)} ${tr('Abrir documento', 'Obrir document', 'Open document')}</a></p>` : ''}</li>`).join('')}</ol>
      ${g.count > limit ? `<p><a class="link-btn" href="#/buscar?q=${encodeURIComponent(q)}&tipo=${g.tipo}">${tr(`Ver los ${fmt.int(g.count)} resultados de ${TYPES[g.tipo].label().toLowerCase()}`, `Veure els ${fmt.int(g.count)} resultats de ${TYPES[g.tipo].label().toLowerCase()}`, `See all ${fmt.int(g.count)} ${TYPES[g.tipo].label().toLowerCase()}`)} →</a></p>` : ''}</section>`);
    area.appendChild(sec);
  }
  area.insertAdjacentHTML('beforeend', askCta(true));
}

// ---------------------------------------------------------------- arranque
async function init() {
  // Vista previa desde el editor (admin/): el portal se muestra en un iframe con los borradores sin publicar.
  try { const ov = window.parent !== window && window.parent.__edPreview?.(); if (ov) { for (const [p, o] of Object.entries(ov)) store.setOverride(p, o); document.documentElement.dataset.preview = '1'; } } catch { /* otro origen */ }
  [CFG, PORTAL] = await Promise.all([store.config(), store.portal()]);
  setCodelists(await store.getJSON('data/codelists.json'));
  let l = new URLSearchParams(location.search).get('lang');
  if (!l) { try { l = localStorage.getItem('lang'); } catch { /* */ } }
  setLang(LANGS.includes(l) ? l : CFG.idioma_por_defecto || 'es');
  applyTheme();
  await renderChrome();
  try { const th = localStorage.getItem('theme'); if (th) document.documentElement.dataset.theme = th; } catch { /* */ }
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.dataset.theme = cur === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', document.documentElement.dataset.theme); } catch { /* */ }
  });
  document.addEventListener('change', (e) => {
    if (!e.target.matches('[data-lang-select]')) return;
    setLang(e.target.value); try { localStorage.setItem('lang', e.target.value); } catch { /* */ }
    renderChrome().then(router);
  });
  const toggleMenu = (e) => { const p = document.getElementById('menu-panel'); if (p.hidden) openMenu(e.currentTarget); else closeMenu(true); };
  document.getElementById('menu-toggle').addEventListener('click', toggleMenu);
  document.getElementById('mainnav').addEventListener('click', (e) => { const b = e.target.closest('.nav-topics'); if (b) toggleMenu({ currentTarget: b }); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu(true);
    const typing = /input|textarea|select/i.test(document.activeElement.tagName);
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !document.querySelector('dialog[open]'))) {
      e.preventDefault();
      const inp = [...document.querySelectorAll('.searchbox input')].find((x) => x.offsetParent !== null);
      if (inp) inp.focus(); else location.hash = '#/buscar';
    }
  });
  document.addEventListener('click', (e) => { const p = document.getElementById('menu-panel'); if (!p.hidden && !p.contains(e.target) && !e.target.closest('[aria-controls="menu-panel"]')) closeMenu(); });
  window.addEventListener('hashchange', router);
  router();
}
init();
