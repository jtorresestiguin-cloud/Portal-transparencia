import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, kpiRow, dataTable, selectControl, meter, statusBadge, icon, esc, chartCard, flushCharts } from '../ui.js';
import { columns, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

const PES = { publicat: 1, parcial: 0.5, pendent: 0 };
const MAX_DIES = { continua: 15, setmanal: 10, mensual: 45, trimestral: 105, semestral: 200, anual: 380, quan_canvii: 400 };
const TODAY = new Date('2026-11-11T00:00:00Z');

export const isStale = (o) => o.darrera_actualitzacio && (TODAY - new Date(o.darrera_actualitzacio + 'T00:00:00Z')) / 864e5 > MAX_DIES[o.periodicitat];

export function scoreObligacions(obl) {
  const score = (set) => (set.reduce((s, o) => s + PES[o.estat], 0) / (set.length || 1)) * 100;
  const counts = { publicat: 0, parcial: 0, pendent: 0 };
  obl.forEach((o) => counts[o.estat]++);
  const blocs = [...new Set(obl.map((o) => o.bloc))];
  return {
    total: score(obl), counts,
    byBloc: blocs.map((b) => { const s = obl.filter((o) => o.bloc === b); return { bloc: b, score: score(s), n: s.length }; }).sort((a, b) => b.score - a.score),
    stale: obl.filter(isStale).length,
  };
}

export default async function render(root, { query }) {
  const obl = await rows('obligacions');
  const ds = await dsTitle('obligacions');
  const sc = scoreObligacions(obl);
  const st = { bloc: query.get('bloc') || 'all', estat: query.get('estat') || 'all', q: query.get('q') || '' };

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'check', title: t('nav_compliment'), intro: t('intro_compliment') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);

  c.appendChild(h(`<div class="compliance-hero card">
    <div class="score-ring big" style="--p:${sc.total}" role="img" aria-label="${fmt.dec(sc.total, 0)} %"><span>${fmt.dec(sc.total, 0)}<small>%</small></span></div>
    <div>
      <h2 class="card-title">${tr('Índex de compliment', 'Índice de cumplimiento', 'Compliance index')}</h2>
      <p>${tr(
        `S’han avaluat ${obl.length} obligacions de publicitat activa de la Llei 19/2014. Cada obligació publicada compta 1 punt, la parcial 0,5 i la pendent 0.`,
        `Se han evaluado ${obl.length} obligaciones de publicidad activa de la Ley 19/2014. Cada obligación publicada cuenta 1 punto, la parcial 0,5 y la pendiente 0.`,
        `${obl.length} proactive disclosure obligations under Law 19/2014 were assessed. Published counts 1 point, partial 0.5, pending 0.`)}</p>
      <div class="status-legend">${statusBadge('publicat')} ${sc.counts.publicat} &nbsp; ${statusBadge('parcial')} ${sc.counts.parcial} &nbsp; ${statusBadge('pendent')} ${sc.counts.pendent} &nbsp; <span class="badge badge-serious">${icon('warn', 14)}${tr('Desactualitzades', 'Desactualizadas', 'Out of date')}</span> ${sc.stale}</div>
    </div></div>`));

  const grid = h('<div class="chart-grid"></div>');
  c.appendChild(grid);
  const blocCodes = sc.byBloc.map((b) => b.bloc);
  const series = ['publicat', 'parcial', 'pendent'].map((e, i) => ({ name: label('estat_obligacio', e), color: ['var(--good)', 'var(--warning)', 'var(--critical)'][i], values: blocCodes.map((b) => obl.filter((o) => o.bloc === b && o.estat === e).length) }));
  grid.appendChild(chartCard({
    title: tr('Estat per bloc', 'Estado por bloque', 'Status by block'), subtitle: tr('Nombre d’obligacions', 'Número de obligaciones', 'Number of obligations'),
    file: 'compliment-blocs', dataset: 'obligacions', datasetTitle: ds, wide: true,
    draw: (el) => columns(el, { categories: blocCodes.map((b) => label('bloc_obligacio', b).replace(/ i .*| y .*| & .*|, .*/, '')), series, stacked: true, format: fmt.int }),
    table: { columns: [{ key: 'b', label: tr('Bloc', 'Bloque', 'Block') }, ...series.map((s, i) => ({ key: 's' + i, label: s.name, align: 'right' })), { key: 'p', label: '%', align: 'right', format: (v) => fmt.pct(v, 0) }], rows: blocCodes.map((b, bi) => Object.fromEntries([['b', label('bloc_obligacio', b)], ...series.map((s, i) => ['s' + i, s.values[bi]]), ['p', sc.byBloc[bi].score]])) },
  }));
  grid.appendChild(h(`<section class="card"><h3 class="chart-title">${tr('Puntuació per bloc', 'Puntuación por bloque', 'Score by block')}</h3>
    <ul class="meter-list">${sc.byBloc.map((b) => `<li><button type="button" class="ml-btn" data-bloc="${b.bloc}"><span class="ml-label">${label('bloc_obligacio', b.bloc)}</span><span class="ml-val">${fmt.dec(b.score, 0)} %</span>${meter(b.score, { labelText: label('bloc_obligacio', b.bloc) })}</button></li>`).join('')}</ul></section>`));

  c.appendChild(h(`<h2 class="section-title">${tr('Obligacions una per una', 'Obligaciones una a una', 'Obligations one by one')}</h2>`));
  c.appendChild(h(`<form class="filters" onsubmit="return false" aria-label="${t('filters')}">
    ${selectControl('f-bloc', tr('Bloc', 'Bloque', 'Block'), [['all', t('all')], ...codes('bloc_obligacio').map((k) => [k, label('bloc_obligacio', k)])], st.bloc)}
    ${selectControl('f-estat', tr('Estat', 'Estado', 'Status'), [['all', t('all')], ...codes('estat_obligacio').map((k) => [k, label('estat_obligacio', k)]), ['stale', tr('Desactualitzades', 'Desactualizadas', 'Out of date')]], st.estat)}
    <label class="control grow" for="f-q"><span>${tr('Cerca', 'Buscar', 'Search')}</span><input id="f-q" type="search" value="${esc(st.q)}" placeholder="${esc(tr('Obligació, article o codi', 'Obligación, artículo o código', 'Obligation, article or code'))}"></label>
  </form>`));
  const tableHost = h('<section class="card"></section>');
  c.appendChild(tableHost);
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const drawTable = () => {
    const f = obl.filter((o) => (st.bloc === 'all' || o.bloc === st.bloc) && (st.estat === 'all' || (st.estat === 'stale' ? isStale(o) : o.estat === st.estat)) && (!st.q || norm(`${o.id} ${o.titol} ${o.article}`).includes(norm(st.q))));
    tableHost.replaceChildren(dataTable({
      caption: tr('Obligacions de publicitat activa', 'Obligaciones de publicidad activa', 'Proactive disclosure obligations'),
      columns: [
        { key: 'id', label: tr('Codi', 'Código', 'Code'), html: true, format: (v) => `<code>${v}</code>` },
        { key: 'titol', label: tr('Obligació', 'Obligación', 'Obligation'), html: true, format: (v, o) => `<a href="#/${o.seccio}">${esc(v)}</a>` },
        { key: 'article', label: tr('Article', 'Artículo', 'Article') },
        { key: 'estat', label: tr('Estat', 'Estado', 'Status'), html: true, format: (v) => statusBadge(v), sortValue: (o) => PES[o.estat] },
        { key: 'periodicitat', label: tr('Periodicitat', 'Periodicidad', 'Frequency'), format: (v) => label('periodicitat', v) },
        { key: 'darrera_actualitzacio', label: tr('Actualitzat', 'Actualizado', 'Updated'), html: true, format: (v, o) => (v ? `${fmt.date(v)}${isStale(o) ? ` <span class="badge badge-serious" title="${esc(tr('Supera la periodicitat prevista', 'Supera la periodicidad prevista', 'Exceeds expected frequency'))}">${icon('warn', 12)}</span>` : ''}` : '—') },
        { key: 'conjunt_dades', label: tr('Dades', 'Datos', 'Data'), html: true, format: (v) => (v ? `<a href="#/dades-obertes/${v}" aria-label="${esc(tr('Conjunt de dades', 'Conjunto de datos', 'Dataset'))} ${v}">${icon('database', 16)}</a>` : '—') },
      ],
      rows: f, pageSize: 50,
    }));
  };
  drawTable();
  const sync = () => { setQuery(st); drawTable(); };
  c.querySelector('#f-bloc').addEventListener('change', (e) => { st.bloc = e.target.value; sync(); });
  c.querySelector('#f-estat').addEventListener('change', (e) => { st.estat = e.target.value; sync(); });
  let deb;
  c.querySelector('#f-q').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value.trim(); sync(); }, 200); });
  c.querySelectorAll('[data-bloc]').forEach((b) => b.addEventListener('click', () => { st.bloc = b.dataset.bloc; c.querySelector('#f-bloc').value = st.bloc; sync(); tableHost.scrollIntoView({ behavior: 'smooth' }); }));

  c.appendChild(h(`<section class="card prose"><h2 class="card-title">${tr('Metodologia', 'Metodología', 'Methodology')}</h2>
    <p>${tr(
      'L’autoavaluació segueix l’estructura de la Llei 19/2014 i els criteris d’avaluació del Síndic de Greuges de Catalunya. Una obligació es considera desactualitzada quan la darrera actualització supera la periodicitat prevista amb un marge de tolerància. Les dades de l’autoavaluació es publiquen com a conjunt de dades obert perquè qualsevol persona en pugui verificar el càlcul.',
      'La autoevaluación sigue la estructura de la Ley 19/2014 y los criterios de evaluación del Síndic de Greuges de Cataluña. Una obligación se considera desactualizada cuando la última actualización supera la periodicidad prevista con un margen de tolerancia. Los datos de la autoevaluación se publican como conjunto de datos abierto para que cualquier persona pueda verificar el cálculo.',
      'The self-assessment follows the structure of Law 19/2014 and the criteria used by the Catalan Ombudsman. An obligation is out of date when its last update exceeds the expected frequency plus a tolerance margin. The assessment is itself published as open data so anyone can check the calculation.')}</p></section>`));
}
