/**
 * app.js — Nucli del portal: encaminament, dades, navegació, cerca global,
 * idioma i tema. Aplicació estàtica (sense compilació) basada en mòduls ES.
 */
import { t, lang, setLang, setCodelists, pick, label, LANGS } from './i18n.js';
import { h, icon, esc, flushCharts, fmt } from './ui.js';

// ---------------------------------------------------------------------------
// Dades (amb memòria cau)
// ---------------------------------------------------------------------------
const cache = new Map();
export function getData(id) {
  if (!cache.has(id)) {
    cache.set(id, fetch(`data/${id}.json`).then((r) => {
      if (!r.ok) throw new Error(`${id}: HTTP ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(id);
}
export async function rows(id) { return (await getData(id)).dades; }
let catalogMeta;
export async function datasetsMeta() {
  catalogMeta ||= await fetch('data/metadata/datasets.json').then((r) => r.json());
  return catalogMeta;
}
export async function dsTitle(id) {
  const m = await datasetsMeta();
  return pick(m.conjunts.find((d) => d.id === id)?.titol || { ca: id });
}

// ---------------------------------------------------------------------------
// Seccions i encaminament
// ---------------------------------------------------------------------------
export const SECTIONS = [
  { id: 'institucio', icon: 'building', view: () => import('./views/institucio.js') },
  { id: 'economia', icon: 'euro', view: () => import('./views/economia.js') },
  { id: 'contractacio', icon: 'file', view: () => import('./views/contractacio.js') },
  { id: 'subvencions', icon: 'hand', view: () => import('./views/subvencions.js') },
  { id: 'personal', icon: 'users', view: () => import('./views/personal.js') },
  { id: 'bon-govern', icon: 'shield', view: () => import('./views/bon-govern.js') },
  { id: 'activitat', icon: 'chart', view: () => import('./views/activitat.js') },
  { id: 'dret-acces', icon: 'inbox', view: () => import('./views/dret-acces.js') },
  { id: 'compliment', icon: 'check', view: () => import('./views/compliment.js') },
  { id: 'dades-obertes', icon: 'database', view: () => import('./views/dades-obertes.js') },
];
const EXTRA = {
  '': () => import('./views/inici.js'),
  accessibilitat: () => import('./views/accessibilitat.js'),
};

export function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  const [route = '', ...rest] = path.split('/').filter(Boolean);
  return { route, sub: rest.join('/') || null, query: new URLSearchParams(qs || '') };
}
/** Actualitza la query de la URL sense tornar a renderitzar (per a filtres compartibles). */
export function setQuery(params) {
  const { route, sub, query } = parseHash();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined || v === '' || v === 'all') query.delete(k); else query.set(k, v);
  }
  const qs = query.toString();
  history.replaceState(null, '', `#/${route}${sub ? '/' + sub : ''}${qs ? '?' + qs : ''}`);
}

const main = () => document.getElementById('main');
let renderSeq = 0;
async function router() {
  const seq = ++renderSeq;
  const { route, sub, query } = parseHash();
  const sec = SECTIONS.find((s) => s.id === route);
  const loader = sec ? sec.view : EXTRA[route];
  updateNav(route);
  const root = main();
  if (!loader) {
    root.innerHTML = `<section class="container narrow page-404"><h1 id="page-title" tabindex="-1">${t('not_found')}</h1><p><a href="#/">${t('back_home')}</a></p></section>`;
    return;
  }
  root.setAttribute('aria-busy', 'true');
  try {
    const mod = await loader();
    if (seq !== renderSeq) return;
    const frag = document.createElement('div');
    frag.className = 'view';
    await mod.default(frag, { sub, query });
    if (seq !== renderSeq) return;
    root.replaceChildren(frag);
    flushCharts();
    const title = frag.querySelector('h1')?.textContent?.trim();
    document.title = `${title && route ? title + ' · ' : ''}${t('site_title')}`;
    if (!window.__firstRender) { window.__firstRender = true; }
    else { window.scrollTo({ top: 0 }); document.getElementById('page-title')?.focus({ preventScroll: true }); }
    announce(title || t('site_title'));
  } catch (err) {
    console.error(err);
    root.innerHTML = `<section class="container narrow"><h1 id="page-title" tabindex="-1">${t('error_title')}</h1><p>${esc(err.message)}</p><p class="muted">${t('error_hint')}</p></section>`;
  } finally {
    root.removeAttribute('aria-busy');
  }
}
function announce(msg) {
  const live = document.getElementById('live');
  live.textContent = '';
  setTimeout(() => (live.textContent = msg), 50);
}

// ---------------------------------------------------------------------------
// Capçalera, navegació i peu
// ---------------------------------------------------------------------------
function renderChrome() {
  document.documentElement.lang = lang();
  document.querySelector('.skip-link').textContent = t('skip');
  document.getElementById('brand-name').textContent = t('org_name');
  document.getElementById('brand-sub').textContent = t('portal_name');
  document.getElementById('demo-banner').innerHTML = `${icon('info', 16)} <span>${t('demo_banner')}</span> <a href="#/accessibilitat">${t('demo_more')}</a>`;
  const nav = document.getElementById('nav-list');
  nav.innerHTML = SECTIONS.map((s) => `<li><a href="#/${s.id}" data-route="${s.id}">${icon(s.icon, 18)}<span>${t('nav_' + s.id)}</span></a></li>`).join('');
  document.getElementById('nav-toggle').setAttribute('aria-label', t('menu'));
  document.getElementById('nav-toggle-text').textContent = t('menu');
  document.getElementById('search-open').setAttribute('aria-label', t('search'));
  document.getElementById('search-open-text').textContent = t('search');
  document.getElementById('theme-toggle').setAttribute('aria-label', t('toggle_theme'));
  document.getElementById('lang-switch').innerHTML = LANGS.map((l) => `<button type="button" data-lang="${l}" aria-pressed="${l === lang()}" lang="${l}" title="${t('lang_' + l)}">${l.toUpperCase()}</button>`).join('');
  document.getElementById('lang-switch').setAttribute('aria-label', t('language'));
  document.getElementById('site-footer').innerHTML = `
    <div class="container footer-grid">
      <div>
        <p class="footer-brand">${t('org_name')}</p>
        <p class="muted">${t('footer_about')}</p>
        <p class="muted small">${t('footer_license')} <a href="https://creativecommons.org/licenses/by/4.0/deed.${lang() === 'en' ? 'en' : lang()}" rel="license">CC BY 4.0</a>.</p>
      </div>
      <div>
        <p class="footer-h">${t('footer_interop')}</p>
        <ul class="footer-links">
          <li><a href="data/catalog.jsonld">${icon('database', 16)} DCAT-AP (JSON-LD)</a></li>
          <li><a href="data/catalog.rdf">${icon('database', 16)} DCAT-AP-ES (RDF/XML)</a></li>
          <li><a href="datapackage.json">${icon('code', 16)} Data Package</a></li>
          <li><a href="api/openapi.json">${icon('code', 16)} OpenAPI 3.1</a></li>
          <li><a href="feed.xml">${icon('rss', 16)} ${t('feed')}</a></li>
        </ul>
      </div>
      <div>
        <p class="footer-h">${t('footer_portal')}</p>
        <ul class="footer-links">
          <li><a href="#/compliment">${t('nav_compliment')}</a></li>
          <li><a href="#/dret-acces">${t('nav_dret-acces')}</a></li>
          <li><a href="#/accessibilitat">${t('nav_accessibilitat')}</a></li>
          <li><a href="https://www.transparenciacatalunya.cat" rel="noopener">${t('footer_tc')} ${icon('external', 14)}</a></li>
        </ul>
      </div>
    </div>`;
}
function updateNav(route) {
  document.querySelectorAll('#nav-list a').forEach((a) => {
    if (a.dataset.route === route) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.body.classList.remove('nav-open');
  document.getElementById('nav-toggle').setAttribute('aria-expanded', 'false');
}

// ---------------------------------------------------------------------------
// Tema clar/fosc (respecta la preferència del sistema)
// ---------------------------------------------------------------------------
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('theme'); } catch { /* sense emmagatzematge */ }
  if (saved) document.documentElement.dataset.theme = saved;
  document.getElementById('theme-toggle').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch { /* */ }
  });
}

// ---------------------------------------------------------------------------
// Cerca global (Ctrl/Cmd + K)
// ---------------------------------------------------------------------------
let searchIndex = null;
async function buildIndex() {
  if (searchIndex) return searchIndex;
  const [meta, contractes, subv, convenis, obligacions] = await Promise.all([
    datasetsMeta(), rows('contractes'), rows('subvencions'), rows('convenis'), rows('obligacions'),
  ]);
  const idx = [];
  for (const s of SECTIONS) idx.push({ type: t('search_type_section'), title: t('nav_' + s.id), text: t('intro_' + s.id), href: `#/${s.id}`, icon: s.icon });
  for (const d of meta.conjunts) idx.push({ type: t('search_type_dataset'), title: pick(d.titol), text: pick(d.descripcio) + ' ' + d.paraules_clau.join(' '), href: `#/dades-obertes/${d.id}`, icon: 'database' });
  for (const o of obligacions) idx.push({ type: t('search_type_obligation'), title: o.titol, text: `${o.article} ${label('bloc_obligacio', o.bloc)}`, href: `#/compliment?q=${encodeURIComponent(o.id)}`, icon: 'check' });
  for (const c of contractes) idx.push({ type: t('search_type_contract'), title: c.objecte, text: `${c.adjudicatari} ${c.id} ${c.expedient}`, meta: `${fmt.eur(c.import_adjudicacio_sense_iva)} · ${fmt.date(c.data_adjudicacio)}`, href: `#/contractacio?q=${encodeURIComponent(c.id)}`, icon: 'file' });
  for (const s of subv) idx.push({ type: t('search_type_grant'), title: s.beneficiari, text: `${label('linia_subvencio', s.linia)} ${s.id}`, meta: `${fmt.eur(s.import_atorgat)} · ${s.any}`, href: `#/subvencions?q=${encodeURIComponent(s.id)}`, icon: 'hand' });
  for (const c of convenis) idx.push({ type: t('search_type_agreement'), title: c.objecte, text: `${c.part_signant} ${c.id}`, meta: fmt.date(c.data_signatura), href: `#/subvencions?q=${encodeURIComponent(c.id)}`, icon: 'hand' });
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  idx.forEach((d) => (d._n = norm(`${d.title} ${d.text}`)));
  searchIndex = { idx, norm };
  return searchIndex;
}
function openSearch() {
  const dlg = h(`<dialog class="modal search-modal" aria-label="${esc(t('search'))}">
    <form method="dialog" class="search-form" role="search">
      ${icon('search', 20)}
      <label for="global-q" class="sr-only">${t('search_placeholder')}</label>
      <input id="global-q" type="search" autocomplete="off" placeholder="${esc(t('search_placeholder'))}" aria-controls="search-results" aria-describedby="search-hint">
      <kbd>Esc</kbd>
    </form>
    <p id="search-hint" class="sr-only">${t('search_hint')}</p>
    <ul id="search-results" class="search-results" role="listbox" aria-label="${esc(t('search_results'))}"></ul>
  </dialog>`);
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.showModal();
  const input = dlg.querySelector('input');
  const list = dlg.querySelector('#search-results');
  let active = -1;
  const draw = async () => {
    const { idx, norm } = await buildIndex();
    const q = norm(input.value.trim());
    if (q.length < 2) { list.innerHTML = `<li class="search-empty">${t('search_suggest')}</li>`; return; }
    const terms = q.split(/\s+/);
    const res = idx.filter((d) => terms.every((tm) => d._n.includes(tm))).slice(0, 40);
    active = res.length ? 0 : -1;
    list.innerHTML = res.length ? res.map((r, i) => `<li role="option" id="sr-${i}" aria-selected="${i === 0}"><a href="${r.href}">${icon(r.icon, 18)}<span class="sr-main"><span class="sr-title">${esc(r.title)}</span><span class="sr-meta">${esc(r.type)}${r.meta ? ' · ' + esc(r.meta) : ''}</span></span></a></li>`).join('')
      : `<li class="search-empty">${t('no_results')}</li>`;
    input.setAttribute('aria-activedescendant', res.length ? 'sr-0' : '');
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('[role="option"]')];
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items.forEach((it, i) => it.setAttribute('aria-selected', String(i === active)));
      items[active].scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', items[active].id);
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      location.hash = items[active].querySelector('a').getAttribute('href');
      dlg.close();
    }
  });
  list.addEventListener('click', (e) => { if (e.target.closest('a')) dlg.close(); });
  draw();
  input.focus();
}

// ---------------------------------------------------------------------------
// Inici
// ---------------------------------------------------------------------------
async function init() {
  const codelists = await fetch('data/codelists.json').then((r) => r.json());
  setCodelists(codelists);
  let l = new URLSearchParams(location.search).get('lang');
  if (!l) { try { l = localStorage.getItem('lang'); } catch { /* */ } }
  if (!l) l = (navigator.language || 'ca').slice(0, 2);
  setLang(LANGS.includes(l) ? l : 'ca');
  initTheme();
  renderChrome();

  document.getElementById('lang-switch').addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (!b) return;
    setLang(b.dataset.lang);
    try { localStorage.setItem('lang', b.dataset.lang); } catch { /* */ }
    searchIndex = null;
    renderChrome();
    router();
  });
  document.getElementById('nav-toggle').addEventListener('click', (e) => {
    const open = document.body.classList.toggle('nav-open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.getElementById('search-open').addEventListener('click', openSearch);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); openSearch(); }
  });
  window.addEventListener('hashchange', router);
  window.addEventListener('portal:search', openSearch);
  router();
}
init();
