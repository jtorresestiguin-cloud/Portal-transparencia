import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, chartCard, dataTable, selectControl, esc, groupBy, modal, definitionList, flushCharts } from '../ui.js';
import { hBar, columns, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

const LINIA_COLOR = { L1: SERIES[0], L2: SERIES[1], L3: SERIES[2], L4: SERIES[3] };
const TODAY = '2026-11-11';

export default async function render(root, { query }) {
  const [subv, conv] = await Promise.all([rows('subvencions'), rows('convenis')]);
  const [dsS, dsC] = await Promise.all([dsTitle('subvencions'), dsTitle('convenis')]);
  const anys = [...new Set(subv.map((s) => s.any))].sort().reverse();
  const st = { any: query.get('any') || 'all', linia: query.get('linia') || 'all', q: query.get('q') || '' };

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'hand', title: t('nav_subvencions'), intro: t('intro_subvencions') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);
  c.appendChild(h(`<nav class="subnav" aria-label="${tr('En aquesta pàgina', 'En esta página', 'On this page')}"><a href="#/subvencions" data-jump="h-subv">${tr('Subvencions', 'Subvenciones', 'Grants')}</a><a href="#/subvencions" data-jump="h-conv">${tr('Convenis', 'Convenios', 'Agreements')}</a></nav>`));
  c.querySelectorAll('[data-jump]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); document.getElementById(a.dataset.jump)?.scrollIntoView({ behavior: 'smooth' }); }));

  c.appendChild(h(`<h2 class="section-title" id="h-subv">${tr('Subvencions i ajuts atorgats', 'Subvenciones y ayudas concedidas', 'Grants awarded')}</h2>`));
  c.appendChild(h(`<form class="filters" onsubmit="return false" aria-label="${t('filters')}">
    ${selectControl('f-any', tr('Any', 'Año', 'Year'), [['all', t('all')], ...anys.map((a) => [a, a])], st.any)}
    ${selectControl('f-linia', tr('Línia', 'Línea', 'Line'), [['all', t('all')], ...codes('linia_subvencio').map((k) => [k, label('linia_subvencio', k)])], st.linia)}
    <label class="control grow" for="f-q"><span>${tr('Cerca', 'Buscar', 'Search')}</span><input id="f-q" type="search" value="${esc(st.q)}" placeholder="${esc(tr('Beneficiari, NIF o codi', 'Beneficiario, NIF o código', 'Beneficiary, tax ID or code'))}"></label>
  </form>`));
  const out = h('<div aria-live="polite"></div>');
  c.appendChild(out);
  const convOut = h('<div></div>');
  c.appendChild(convOut);

  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const showSub = (r) => modal(esc(r.beneficiari), definitionList([
    [tr('Codi', 'Código', 'Code'), `<code>${r.id}</code>`], ['BDNS', `<code>${r.bdns}</code>`],
    [tr('Línia', 'Línea', 'Line'), label('linia_subvencio', r.linia)], [tr('Modalitat', 'Modalidad', 'Modality'), label('modalitat_subvencio', r.modalitat)],
    ['NIF', `<code>${r.beneficiari_nif}</code>`], [tr('Districte', 'Distrito', 'District'), r.districte || tr('Àmbit ciutat', 'Ámbito ciudad', 'City-wide')],
    [tr('Sol·licitat', 'Solicitado', 'Requested'), fmt.eur2(r.import_sollicitat)], [tr('Atorgat', 'Concedido', 'Awarded'), `<strong>${fmt.eur2(r.import_atorgat)}</strong>`],
    [tr('Data de concessió', 'Fecha de concesión', 'Award date'), fmt.date(r.data_concessio)], [tr('Justificació', 'Justificación', 'Accounting'), label('estat_justificacio', r.estat_justificacio)],
  ]));

  const draw = () => {
    out.innerHTML = '';
    const f = subv.filter((r) => (st.any === 'all' || String(r.any) === st.any) && (st.linia === 'all' || r.linia === st.linia) && (!st.q || norm(`${r.beneficiari} ${r.beneficiari_nif} ${r.id} ${r.bdns}`).includes(norm(st.q))));
    const imp = sum(f, (r) => r.import_atorgat);
    out.appendChild(kpiRow([
      { label: tr('Import atorgat', 'Importe concedido', 'Amount awarded'), value: fmt.eurC(imp), context: `${fmt.int(f.length)} ${tr('subvencions', 'subvenciones', 'grants')}` },
      { label: tr('Per concurrència competitiva', 'Por concurrencia competitiva', 'Through competitive calls'), value: fmt.pct(imp ? (sum(f.filter((r) => r.modalitat === 'concurrencia'), (r) => r.import_atorgat) / imp) * 100 : 0), context: tr('de l’import', 'del importe', 'of amount') },
      { label: tr('Cobertura de la demanda', 'Cobertura de la demanda', 'Demand covered'), value: fmt.pct(imp ? (imp / sum(f, (r) => r.import_sollicitat)) * 100 : 0), context: tr('atorgat / sol·licitat', 'concedido / solicitado', 'awarded / requested') },
      { label: tr('Pendents de justificar', 'Pendientes de justificar', 'Pending accounting'), value: fmt.int(f.filter((r) => r.estat_justificacio !== 'justificada').length), context: tr('subvencions', 'subvenciones', 'grants') },
    ]));
    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    const yrs = anys.slice().reverse().map(String);
    const lines = codes('linia_subvencio').filter((l) => f.some((r) => r.linia === l));
    const series = lines.map((l) => ({ name: label('linia_subvencio', l), color: LINIA_COLOR[l], values: yrs.map((y) => sum(f.filter((r) => r.linia === l && String(r.any) === y), (r) => r.import_atorgat)) }));
    grid.appendChild(chartCard({
      title: tr('Import atorgat per línia i any', 'Importe concedido por línea y año', 'Amount awarded by line and year'), subtitle: tr('Euros', 'Euros', 'EUR'),
      file: 'subvencions-linia-any', dataset: 'subvencions', datasetTitle: dsS,
      draw: (el) => columns(el, { categories: yrs, series, stacked: true, format: fmt.eur, axisFormat: fmt.eurC }),
      table: { columns: [{ key: 'y', label: tr('Any', 'Año', 'Year') }, ...series.map((s, i) => ({ key: 's' + i, label: s.name, align: 'right', format: fmt.eur }))], rows: yrs.map((y, yi) => Object.fromEntries([['y', y], ...series.map((s, i) => ['s' + i, s.values[yi]])])) },
    }));
    const byDist = [...groupBy(f.filter((r) => r.districte), (r) => r.districte)].map(([k, v]) => ({ label: k, value: sum(v, (r) => r.import_atorgat), n: v.length })).sort((a, b) => b.value - a.value);
    byDist.forEach((d) => (d.note = `${d.n} ${tr('projectes', 'proyectos', 'projects')}`));
    grid.appendChild(chartCard({
      title: tr('Retorn als barris: import per districte', 'Retorno a los barrios: importe por distrito', 'Back to neighbourhoods: amount by district'), subtitle: tr('Subvencions amb àmbit territorial', 'Subvenciones con ámbito territorial', 'Grants with a district scope'),
      file: 'subvencions-districte', dataset: 'subvencions', datasetTitle: dsS,
      draw: (el) => hBar(el, { data: byDist, format: fmt.eurC, color: SERIES[2], valueName: tr('Import', 'Importe', 'Amount') }),
      table: { columns: [{ key: 'label', label: tr('Districte', 'Distrito', 'District') }, { key: 'n', label: 'N', align: 'right' }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byDist },
    }));
    const card = h('<section class="card"></section>');
    card.appendChild(dataTable({
      caption: tr('Subvencions atorgades', 'Subvenciones concedidas', 'Grants awarded'),
      columns: [
        { key: 'data_concessio', label: tr('Data', 'Fecha', 'Date'), format: fmt.date },
        { key: 'beneficiari', label: tr('Beneficiari', 'Beneficiario', 'Beneficiary') },
        { key: 'linia', label: tr('Línia', 'Línea', 'Line'), format: (v) => label('linia_subvencio', v) },
        { key: 'modalitat', label: tr('Modalitat', 'Modalidad', 'Modality'), format: (v) => label('modalitat_subvencio', v) },
        { key: 'import_atorgat', label: tr('Atorgat', 'Concedido', 'Awarded'), align: 'right', format: fmt.eur },
        { key: 'estat_justificacio', label: tr('Justificació', 'Justificación', 'Accounting'), format: (v) => label('estat_justificacio', v) },
      ],
      rows: f, onRow: showSub, sortKey: 'data_concessio', sortDir: -1,
    }));
    out.appendChild(card);
    const exact = subv.find((r) => r.id === st.q);
    if (exact && !draw.opened) { draw.opened = true; setTimeout(() => showSub(exact), 200); }
  };

  // Convenis
  const vigents = conv.filter((r) => r.data_signatura <= TODAY && r.data_fi >= TODAY);
  convOut.appendChild(h(`<h2 class="section-title" id="h-conv">${tr('Convenis de col·laboració', 'Convenios de colaboración', 'Collaboration agreements')}</h2>`));
  convOut.appendChild(kpiRow([
    { label: tr('Convenis vigents', 'Convenios vigentes', 'Agreements in force'), value: fmt.int(vigents.length), context: `${fmt.int(conv.length)} ${tr('signats des de 2022', 'firmados desde 2022', 'signed since 2022')}` },
    { label: tr('Compromisos del Consorci (vigents)', 'Compromisos del Consorcio (vigentes)', 'Consortium commitments (in force)'), value: fmt.eurC(sum(vigents, (r) => r.obligacions_economiques_ctb)) },
    { label: tr('Aportacions d’altres parts (vigents)', 'Aportaciones de otras partes (vigentes)', 'Contributions from partners (in force)'), value: fmt.eurC(sum(vigents, (r) => r.aportacio_altra_part)) },
  ]));
  const g2 = h('<div class="chart-grid"></div>');
  convOut.appendChild(g2);
  const byPart = codes('tipus_part').map((k, i) => ({ label: label('tipus_part', k), value: conv.filter((r) => r.tipus_part === k).length, color: SERIES[i] })).filter((d) => d.value).sort((a, b) => b.value - a.value);
  g2.appendChild(chartCard({
    title: tr('Amb qui col·laborem', 'Con quién colaboramos', 'Who we partner with'), subtitle: tr('Nombre de convenis per tipus de part', 'Número de convenios por tipo de parte', 'Agreements by type of partner'),
    file: 'convenis-tipus', dataset: 'convenis', datasetTitle: dsC,
    draw: (el) => hBar(el, { data: byPart, format: fmt.int, color: SERIES[6], valueName: tr('Convenis', 'Convenios', 'Agreements') }),
    table: { columns: [{ key: 'label', label: tr('Tipus', 'Tipo', 'Type') }, { key: 'value', label: 'N', align: 'right' }], rows: byPart },
  }));
  const cyrs = [...new Set(conv.map((r) => r.data_signatura.slice(0, 4)))].sort();
  g2.appendChild(chartCard({
    title: tr('Compromisos econòmics per any de signatura', 'Compromisos económicos por año de firma', 'Financial commitments by year signed'), subtitle: tr('Euros', 'Euros', 'EUR'),
    file: 'convenis-imports', dataset: 'convenis', datasetTitle: dsC,
    draw: (el) => columns(el, { categories: cyrs, series: [{ name: tr('Consorci', 'Consorcio', 'Consortium'), values: cyrs.map((y) => sum(conv.filter((r) => r.data_signatura.startsWith(y)), (r) => r.obligacions_economiques_ctb)) }, { name: tr('Altra part', 'Otra parte', 'Partner'), values: cyrs.map((y) => sum(conv.filter((r) => r.data_signatura.startsWith(y)), (r) => r.aportacio_altra_part)) }], format: fmt.eur, axisFormat: fmt.eurC }),
    table: { columns: [{ key: 'y', label: tr('Any', 'Año', 'Year') }, { key: 'a', label: tr('Consorci', 'Consorcio', 'Consortium'), align: 'right', format: fmt.eur }, { key: 'b', label: tr('Altra part', 'Otra parte', 'Partner'), align: 'right', format: fmt.eur }], rows: cyrs.map((y) => ({ y, a: sum(conv.filter((r) => r.data_signatura.startsWith(y)), (r) => r.obligacions_economiques_ctb), b: sum(conv.filter((r) => r.data_signatura.startsWith(y)), (r) => r.aportacio_altra_part) })) },
  }));
  const cc = h('<section class="card"></section>');
  cc.appendChild(dataTable({
    caption: tr('Convenis', 'Convenios', 'Agreements'),
    columns: [
      { key: 'data_signatura', label: tr('Signatura', 'Firma', 'Signed'), format: fmt.date },
      { key: 'objecte', label: tr('Objecte', 'Objeto', 'Purpose') },
      { key: 'part_signant', label: tr('Part signant', 'Parte firmante', 'Partner') },
      { key: 'data_fi', label: tr('Vigència', 'Vigencia', 'In force'), html: true, format: (v, r) => (r.data_fi >= TODAY ? `<span class="badge badge-good">${tr('Vigent', 'Vigente', 'In force')}</span>` : `<span class="badge badge-neutral">${tr('Finalitzat', 'Finalizado', 'Ended')}</span>`) + ` <span class="muted small">${fmt.date(v)}</span>`, sortValue: (r) => r.data_fi },
      { key: 'obligacions_economiques_ctb', label: tr('Compromís CTB', 'Compromiso CTB', 'CTB commitment'), align: 'right', format: fmt.eur },
    ],
    rows: st.q && conv.some((r) => r.id === st.q) ? conv.filter((r) => r.id === st.q) : conv, sortKey: 'data_signatura', sortDir: -1,
  }));
  convOut.appendChild(cc);
  if (conv.some((r) => r.id === st.q)) setTimeout(() => document.getElementById('h-conv')?.scrollIntoView(), 300);

  const sync = () => { setQuery(st); draw(); flushCharts(); };
  draw();
  c.querySelector('#f-any').addEventListener('change', (e) => { st.any = e.target.value; sync(); });
  c.querySelector('#f-linia').addEventListener('change', (e) => { st.linia = e.target.value; sync(); });
  let deb;
  c.querySelector('#f-q').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value.trim(); sync(); }, 250); });
}
