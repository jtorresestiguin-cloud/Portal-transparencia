import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, chartCard, dataTable, selectControl, icon, esc, groupBy, modal, definitionList, download, toCSV, flushCharts } from '../ui.js';
import { hBar, columns, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

const PROC_COLOR = { obert: SERIES[0], obert_simplificat: SERIES[1], simplificat_abreujat: SERIES[2], menor: SERIES[3], negociat_sense_publicitat: SERIES[4], basat_acord_marc: SERIES[5] };
const TIPUS_COLOR = { serveis: SERIES[0], subministrament: SERIES[1], obres: SERIES[2] };
const AMB_CONCURRENCIA = ['obert', 'obert_simplificat', 'simplificat_abreujat', 'basat_acord_marc'];
const LLINDAR_MENOR = { serveis: 15000, subministrament: 15000, obres: 40000 };

/** Converteix un contracte al format Open Contracting Data Standard (release simplificada). */
export function toOCDS(c) {
  return {
    ocid: `ocds-ctb-${c.id}`,
    id: `${c.id}-award`,
    date: `${c.data_adjudicacio}T00:00:00Z`,
    tag: ['award'],
    initiationType: 'tender',
    language: 'ca',
    buyer: { id: 'CTB', name: 'Consorci de Turisme de Barcelona' },
    parties: [
      { id: 'CTB', name: 'Consorci de Turisme de Barcelona', roles: ['buyer', 'procuringEntity'] },
      { id: c.adjudicatari_nif, name: c.adjudicatari, roles: ['supplier'], details: { scale: c.adjudicatari_pime ? 'sme' : 'large' } },
    ],
    tender: {
      id: c.expedient, title: c.objecte,
      procurementMethod: c.procediment === 'negociat_sense_publicitat' ? 'limited' : c.procediment === 'menor' ? 'direct' : c.procediment === 'basat_acord_marc' ? 'selective' : 'open',
      procurementMethodDetails: label('procediment', c.procediment),
      mainProcurementCategory: { serveis: 'services', subministrament: 'goods', obres: 'works' }[c.tipus],
      value: { amount: c.pressupost_licitacio_sense_iva, currency: 'EUR' },
      numberOfTenderers: c.nombre_licitadors,
      items: [{ id: '1', classification: { scheme: 'CPV', id: c.cpv, description: label('cpv', c.cpv) } }],
    },
    awards: [{
      id: `${c.id}-1`, date: `${c.data_adjudicacio}T00:00:00Z`, status: 'active',
      value: { amount: c.import_adjudicacio_sense_iva, currency: 'EUR' },
      suppliers: [{ id: c.adjudicatari_nif, name: c.adjudicatari }],
      contractPeriod: { durationInDays: c.durada_mesos * 30 },
    }],
    contracts: c.data_formalitzacio ? [{ id: c.id, awardID: `${c.id}-1`, dateSigned: `${c.data_formalitzacio}T00:00:00Z`, value: { amount: c.import_adjudicacio_amb_iva, currency: 'EUR' }, status: 'active' }] : [],
  };
}

export default async function render(root, { query }) {
  const all = await rows('contractes');
  const dsName = await dsTitle('contractes');
  const anys = [...new Set(all.map((c) => c.data_adjudicacio.slice(0, 4)))].sort().reverse();
  const st = {
    any: query.get('any') || 'all', tipus: query.get('tipus') || 'all', proc: query.get('proc') || 'all',
    prog: query.get('prog') || 'all', q: query.get('q') || '',
  };

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'file', title: t('nav_contractacio'), intro: t('intro_contractacio') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);
  const all_ = [['all', t('all')]];
  c.appendChild(h(`<form class="filters" role="search" aria-label="${t('filters')}" onsubmit="return false">
    ${selectControl('f-any', tr('Any', 'Año', 'Year'), [...all_, ...anys.map((a) => [a, a])], st.any)}
    ${selectControl('f-tipus', tr('Tipus', 'Tipo', 'Type'), [...all_, ...codes('tipus_contracte').map((k) => [k, label('tipus_contracte', k)])], st.tipus)}
    ${selectControl('f-proc', tr('Procediment', 'Procedimiento', 'Procedure'), [...all_, ...codes('procediment').map((k) => [k, label('procediment', k)])], st.proc)}
    ${selectControl('f-prog', tr('Programa', 'Programa', 'Programme'), [...all_, ...codes('programa').map((k) => [k, label('programa', k)])], st.prog)}
    <label class="control grow" for="f-q"><span>${tr('Cerca', 'Buscar', 'Search')}</span><input id="f-q" type="search" value="${esc(st.q)}" placeholder="${esc(tr('Objecte, empresa, NIF o expedient', 'Objeto, empresa, NIF o expediente', 'Subject, company, tax ID or file'))}"></label>
    <button type="button" class="btn-ghost" id="f-reset">${tr('Restableix', 'Restablecer', 'Reset')}</button>
  </form>`));
  const out = h('<div aria-live="polite"></div>');
  c.appendChild(out);

  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = () => all.filter((r) =>
    (st.any === 'all' || r.data_adjudicacio.startsWith(st.any)) &&
    (st.tipus === 'all' || r.tipus === st.tipus) &&
    (st.proc === 'all' || r.procediment === st.proc) &&
    (st.prog === 'all' || r.programa === st.prog) &&
    (!st.q || norm(`${r.objecte} ${r.adjudicatari} ${r.adjudicatari_nif} ${r.id} ${r.expedient} ${r.cpv}`).includes(norm(st.q))));

  const showDetail = (r) => {
    const dlg = modal(esc(r.objecte), `
      ${definitionList([
        [tr('Identificador', 'Identificador', 'ID'), `<code>${r.id}</code>`],
        [tr('Expedient', 'Expediente', 'File'), r.expedient],
        [tr('Tipus', 'Tipo', 'Type'), label('tipus_contracte', r.tipus)],
        [tr('Procediment', 'Procedimiento', 'Procedure'), label('procediment', r.procediment)],
        ['CPV', `${r.cpv} · ${label('cpv', r.cpv)}`],
        [tr('Programa', 'Programa', 'Programme'), label('programa', r.programa)],
        [tr('Adjudicació', 'Adjudicación', 'Award date'), fmt.date(r.data_adjudicacio)],
        [tr('Formalització', 'Formalización', 'Signature'), fmt.date(r.data_formalitzacio)],
        [tr('Durada', 'Duración', 'Duration'), `${r.durada_mesos} ${tr('mesos', 'meses', 'months')}`],
        [tr('Pressupost de licitació', 'Presupuesto de licitación', 'Tender budget'), `${fmt.eur2(r.pressupost_licitacio_sense_iva)} ${tr('sense IVA', 'sin IVA', 'excl. VAT')}`],
        [tr('Import d’adjudicació', 'Importe de adjudicación', 'Award value'), `<strong>${fmt.eur2(r.import_adjudicacio_sense_iva)}</strong> ${tr('sense IVA', 'sin IVA', 'excl. VAT')} · ${fmt.eur2(r.import_adjudicacio_amb_iva)} ${tr('amb IVA', 'con IVA', 'incl. VAT')}`],
        [tr('Baixa', 'Baja', 'Discount'), fmt.pct((1 - r.import_adjudicacio_sense_iva / r.pressupost_licitacio_sense_iva) * 100)],
        [tr('Ofertes rebudes', 'Ofertas recibidas', 'Bids received'), r.nombre_licitadors],
        [tr('Adjudicatari', 'Adjudicatario', 'Supplier'), `${esc(r.adjudicatari)} · <code>${r.adjudicatari_nif}</code>${r.adjudicatari_pime ? ` <span class="badge badge-neutral">PIME</span>` : ''}`],
        [tr('Clàusules', 'Cláusulas', 'Clauses'), [r.clausules_socials && tr('socials', 'sociales', 'social'), r.clausules_ambientals && tr('ambientals', 'ambientales', 'environmental')].filter(Boolean).join(', ') || '—'],
        [tr('Modificat', 'Modificado', 'Amended'), fmt.bool(r.modificat)],
      ])}
      <div class="modal-actions">
        <a class="btn" href="${r.enllac_pscp}" rel="noopener">${tr('Veure a la PSCP', 'Ver en la PSCP', 'View on PSCP')} ${icon('external', 16)}</a>
        <button type="button" class="btn-ghost" data-ocds>${icon('code', 16)} ${tr('Descarrega OCDS (JSON)', 'Descargar OCDS (JSON)', 'Download OCDS (JSON)')}</button>
      </div>
      <details class="code-details"><summary>${tr('Registre en format Open Contracting (OCDS)', 'Registro en formato Open Contracting (OCDS)', 'Open Contracting (OCDS) record')}</summary><pre><code>${esc(JSON.stringify(toOCDS(r), null, 2))}</code></pre></details>`);
    dlg.querySelector('[data-ocds]').addEventListener('click', () => download(`${r.id}.ocds.json`, JSON.stringify(toOCDS(r), null, 2), 'application/json'));
  };

  const draw = () => {
    out.innerHTML = '';
    const f = filtered();
    if (!f.length) { out.appendChild(h(`<p class="notice">${t('no_results')}</p>`)); return; }
    const imp = sum(f, (r) => r.import_adjudicacio_sense_iva);
    const noMenors = f.filter((r) => r.procediment !== 'menor');
    const ambConc = sum(f.filter((r) => AMB_CONCURRENCIA.includes(r.procediment)), (r) => r.import_adjudicacio_sense_iva);
    const pime = sum(f.filter((r) => r.adjudicatari_pime), (r) => r.import_adjudicacio_sense_iva);
    const baixa = sum(noMenors, (r) => 1 - r.import_adjudicacio_sense_iva / r.pressupost_licitacio_sense_iva) / (noMenors.length || 1) * 100;
    out.appendChild(kpiRow([
      { label: tr('Contractes', 'Contratos', 'Contracts'), value: fmt.int(f.length), context: `${fmt.int(f.filter((r) => r.procediment === 'menor').length)} ${tr('menors', 'menores', 'minor')}` },
      { label: tr('Import adjudicat', 'Importe adjudicado', 'Awarded value'), value: fmt.eurC(imp), context: tr('sense IVA', 'sin IVA', 'excl. VAT') },
      { label: tr('Import amb concurrència', 'Importe con concurrencia', 'Value competitively tendered'), value: fmt.pct((ambConc / imp) * 100), context: tr('procediments oberts o amb publicitat', 'procedimientos abiertos o con publicidad', 'open or advertised procedures') },
      { label: tr('Ofertes per licitació', 'Ofertas por licitación', 'Bids per tender'), value: fmt.dec(sum(noMenors, (r) => r.nombre_licitadors) / (noMenors.length || 1)), context: tr('mitjana, excloent menors', 'media, excluyendo menores', 'average, excl. minor') },
      { label: tr('Baixa mitjana', 'Baja media', 'Average discount'), value: fmt.pct(baixa), context: tr('sobre pressupost de licitació', 'sobre presupuesto de licitación', 'on tender budget') },
      { label: tr('Adjudicat a PIMEs', 'Adjudicado a pymes', 'Awarded to SMEs'), value: fmt.pct((pime / imp) * 100), context: tr('de l’import', 'del importe', 'of value') },
      { label: tr('Amb clàusules socials', 'Con cláusulas sociales', 'With social clauses'), value: fmt.pct((noMenors.filter((r) => r.clausules_socials).length / (noMenors.length || 1)) * 100), context: tr('contractes no menors', 'contratos no menores', 'non-minor contracts') },
    ]));

    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);

    // Per procediment
    const byProc = codes('procediment').map((p) => { const s = f.filter((r) => r.procediment === p); return { key: p, label: label('procediment', p), value: sum(s, (r) => r.import_adjudicacio_sense_iva), n: s.length, color: PROC_COLOR[p] }; }).filter((d) => d.n);
    byProc.forEach((d) => (d.note = `${fmt.int(d.n)} ${tr('contractes', 'contratos', 'contracts')}`));
    grid.appendChild(chartCard({
      title: tr('Import per procediment', 'Importe por procedimiento', 'Value by procedure'), subtitle: tr('Euros sense IVA · clica per filtrar', 'Euros sin IVA · clic para filtrar', 'EUR excl. VAT · click to filter'),
      file: 'contractes-procediment', dataset: 'contractes', datasetTitle: dsName,
      draw: (el) => hBar(el, { data: byProc.sort((a, b) => b.value - a.value), format: fmt.eurC, valueName: tr('Import', 'Importe', 'Value'), onClick: (d) => { st.proc = d.key; sync(); } }),
      table: { columns: [{ key: 'label', label: tr('Procediment', 'Procedimiento', 'Procedure') }, { key: 'n', label: 'N', align: 'right' }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byProc },
    }));

    // Evolució temporal apilada per tipus
    const perMes = st.any !== 'all';
    const cats = perMes ? Array.from({ length: 12 }, (_, i) => `${st.any}-${String(i + 1).padStart(2, '0')}`) : anys.slice().reverse();
    const tipusPresents = codes('tipus_contracte').filter((tp) => f.some((r) => r.tipus === tp));
    const series = tipusPresents.map((tp) => ({ name: label('tipus_contracte', tp), color: TIPUS_COLOR[tp], values: cats.map((k) => sum(f.filter((r) => r.tipus === tp && r.data_adjudicacio.startsWith(k)), (r) => r.import_adjudicacio_sense_iva)) }));
    grid.appendChild(chartCard({
      title: perMes ? tr(`Import adjudicat per mes (${st.any})`, `Importe adjudicado por mes (${st.any})`, `Value awarded by month (${st.any})`) : tr('Import adjudicat per any', 'Importe adjudicado por año', 'Value awarded by year'),
      subtitle: tr('Apilat per tipus de contracte', 'Apilado por tipo de contrato', 'Stacked by contract type'),
      file: 'contractes-evolucio', dataset: 'contractes', datasetTitle: dsName,
      draw: (el) => columns(el, { categories: perMes ? cats.map((k) => fmt.monthName(Number(k.slice(5)))) : cats, series, stacked: true, format: fmt.eur, axisFormat: fmt.eurC }),
      table: { columns: [{ key: 'p', label: tr('Període', 'Periodo', 'Period') }, ...series.map((s, i) => ({ key: 's' + i, label: s.name, align: 'right', format: fmt.eur }))], rows: cats.map((k, ci) => Object.fromEntries([['p', k], ...series.map((s, i) => ['s' + i, s.values[ci]])])) },
    }));

    // Top adjudicataris
    const byEmp = [...groupBy(f, (r) => r.adjudicatari)].map(([k, v]) => ({ label: k, value: sum(v, (r) => r.import_adjudicacio_sense_iva), n: v.length })).sort((a, b) => b.value - a.value);
    const top = byEmp.slice(0, 10);
    top.forEach((d) => (d.note = `${fmt.int(d.n)} ${tr('contractes', 'contratos', 'contracts')} · ${fmt.pct((d.value / imp) * 100)} ${tr('del total', 'del total', 'of total')}`));
    const top5 = sum(byEmp.slice(0, 5), (d) => d.value) / imp * 100;
    grid.appendChild(chartCard({
      title: tr('Principals adjudicataris', 'Principales adjudicatarios', 'Top suppliers'),
      subtitle: `${tr('Els 5 primers concentren el', 'Los 5 primeros concentran el', 'Top 5 hold')} ${fmt.pct(top5)} ${tr('de l’import', 'del importe', 'of value')} · ${fmt.int(byEmp.length)} ${tr('empreses', 'empresas', 'companies')}`,
      file: 'contractes-adjudicataris', dataset: 'contractes', datasetTitle: dsName,
      draw: (el) => hBar(el, { data: top, format: fmt.eurC, valueName: tr('Import', 'Importe', 'Value'), maxLabel: 260, onClick: (d) => { st.q = d.label; sync(); } }),
      table: { columns: [{ key: 'label', label: tr('Empresa', 'Empresa', 'Company') }, { key: 'n', label: 'N', align: 'right' }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byEmp },
    }));

    // Competència: distribució d'ofertes
    const bins = ['1', '2', '3', '4', '5', '6+'];
    const binOf = (n) => (n >= 6 ? '6+' : String(n));
    const dist = bins.map((b) => noMenors.filter((r) => binOf(r.nombre_licitadors) === b).length);
    grid.appendChild(chartCard({
      title: tr('Competència: ofertes rebudes', 'Competencia: ofertas recibidas', 'Competition: bids received'),
      subtitle: tr('Nombre de contractes no menors segons ofertes', 'Número de contratos no menores según ofertas', 'Non-minor contracts by number of bids'),
      file: 'contractes-licitadors', dataset: 'contractes', datasetTitle: dsName,
      draw: (el) => columns(el, { categories: bins, series: [{ name: tr('Contractes', 'Contratos', 'Contracts'), values: dist, color: SERIES[6] }], format: fmt.int }),
      table: { columns: [{ key: 'b', label: tr('Ofertes', 'Ofertas', 'Bids') }, { key: 'n', label: tr('Contractes', 'Contratos', 'Contracts'), align: 'right' }], rows: bins.map((b, i) => ({ b, n: dist[i] })) },
    }));

    // CPV
    const byCpv = [...groupBy(f, (r) => r.cpv)].map(([k, v]) => ({ label: label('cpv', k), cpv: k, value: sum(v, (r) => r.import_adjudicacio_sense_iva), n: v.length })).sort((a, b) => b.value - a.value);
    grid.appendChild(chartCard({
      title: tr('Què es contracta (CPV)', 'Qué se contrata (CPV)', 'What is procured (CPV)'), subtitle: tr('Top 10 per import', 'Top 10 por importe', 'Top 10 by value'),
      file: 'contractes-cpv', dataset: 'contractes', datasetTitle: dsName, wide: true,
      draw: (el) => hBar(el, { data: byCpv.slice(0, 10), format: fmt.eurC, color: SERIES[0], valueName: tr('Import', 'Importe', 'Value') }),
      table: { columns: [{ key: 'cpv', label: 'CPV' }, { key: 'label', label: tr('Descripció', 'Descripción', 'Description') }, { key: 'n', label: 'N', align: 'right' }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byCpv },
    }));

    // Alertes d'integritat
    const unicaOferta = f.filter((r) => ['obert', 'obert_simplificat'].includes(r.procediment) && r.nombre_licitadors === 1);
    const fracc = [...groupBy(f.filter((r) => r.procediment === 'menor'), (r) => `${r.adjudicatari}|${r.cpv}|${r.data_adjudicacio.slice(0, 4)}`)]
      .map(([k, v]) => ({ k, v, total: sum(v, (r) => r.import_adjudicacio_sense_iva) }))
      .filter((g) => g.v.length > 1 && g.total > LLINDAR_MENOR[g.v[0].tipus]);
    const modificats = f.filter((r) => r.modificat);
    const concentrats = byEmp.filter((d) => d.value / imp > 0.1);
    const alert = (n, titleTxt, desc, lvl, q) => `<li class="alert alert-${n ? lvl : 'good'}">
      <span class="alert-n">${fmt.int(n)}</span>
      <div><strong>${titleTxt}</strong><p>${desc}</p>${n && q ? `<button type="button" class="link-btn" data-alert="${q}">${tr('Mostra a la taula', 'Mostrar en la tabla', 'Show in table')} ↓</button>` : ''}</div></li>`;
    out.appendChild(h(`<section class="card" aria-labelledby="h-alerts">
      <div class="card-head"><h2 id="h-alerts" class="card-title">${icon('flag', 20)} ${tr('Indicadors de risc i integritat', 'Indicadores de riesgo e integridad', 'Risk & integrity indicators')}</h2></div>
      <p class="muted small">${tr('Senyals calculats automàticament per facilitar el control públic. No impliquen cap irregularitat: indiquen on convé mirar amb més detall.', 'Señales calculadas automáticamente para facilitar el control público. No implican ninguna irregularidad: indican dónde conviene mirar con más detalle.', 'Automatically computed signals to support public scrutiny. They do not imply wrongdoing; they show where to look more closely.')}</p>
      <ul class="alert-grid">
        ${alert(unicaOferta.length, tr('Procediments oberts amb una sola oferta', 'Procedimientos abiertos con una sola oferta', 'Open procedures with a single bid'), tr('Pot indicar baixa competència o plecs massa restrictius.', 'Puede indicar baja competencia o pliegos demasiado restrictivos.', 'May signal low competition or restrictive specifications.'), 'warning', 'unica')}
        ${alert(fracc.length, tr('Possible fraccionament de menors', 'Posible fraccionamiento de menores', 'Possible split minor contracts'), tr('Mateix adjudicatari i CPV en el mateix any amb menors que sumen més del llindar legal.', 'Mismo adjudicatario y CPV en el mismo año con menores que suman más del umbral legal.', 'Same supplier and CPV in one year, minor contracts adding up above the legal threshold.'), 'serious', 'fracc')}
        ${alert(modificats.length, tr('Contractes modificats', 'Contratos modificados', 'Amended contracts'), tr('Modificacions posteriors a l’adjudicació.', 'Modificaciones posteriores a la adjudicación.', 'Changes after award.'), 'warning', 'mod')}
        ${alert(concentrats.length, tr('Empreses amb més del 10 % de l’import', 'Empresas con más del 10 % del importe', 'Suppliers above 10% of value'), tr('Grau de concentració en un sol proveïdor.', 'Grado de concentración en un solo proveedor.', 'Concentration on a single supplier.'), 'warning', null)}
      </ul></section>`));

    // Taula
    let tableRows = f;
    const tableHost = h('<section class="card" aria-labelledby="h-table"></section>');
    out.appendChild(tableHost);
    const drawTable = (subset, titleExtra = '') => {
      tableHost.innerHTML = `<div class="card-head"><h2 id="h-table" class="card-title">${tr('Relació de contractes', 'Relación de contratos', 'Contract list')}${titleExtra}</h2>
        <button type="button" class="btn-ghost" data-export>${icon('download', 16)} ${tr('Exporta la selecció (CSV)', 'Exportar la selección (CSV)', 'Export selection (CSV)')}</button></div>`;
      tableRows = subset;
      tableHost.appendChild(dataTable({
        caption: tr('Relació de contractes', 'Relación de contratos', 'Contract list'),
        columns: [
          { key: 'data_adjudicacio', label: tr('Data', 'Fecha', 'Date'), format: fmt.date },
          { key: 'objecte', label: tr('Objecte', 'Objeto', 'Subject'), width: '34%' },
          { key: 'procediment', label: tr('Procediment', 'Procedimiento', 'Procedure'), format: (v) => label('procediment', v) },
          { key: 'adjudicatari', label: tr('Adjudicatari', 'Adjudicatario', 'Supplier') },
          { key: 'nombre_licitadors', label: tr('Ofertes', 'Ofertas', 'Bids'), align: 'right' },
          { key: 'import_adjudicacio_sense_iva', label: tr('Import s/IVA', 'Importe s/IVA', 'Value ex VAT'), align: 'right', format: fmt.eur },
        ],
        rows: subset, pageSize: 15, onRow: showDetail, sortKey: 'data_adjudicacio', sortDir: -1,
      }));
      tableHost.querySelector('[data-export]').addEventListener('click', () => {
        const cols = Object.keys(subset[0] || {}).map((k) => ({ key: k, label: k }));
        download('contractes-seleccio.csv', '﻿' + toCSV(cols, tableRows), 'text/csv;charset=utf-8');
      });
    };
    drawTable(f);
    out.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.alert;
      const subset = k === 'unica' ? unicaOferta : k === 'mod' ? modificats : fracc.flatMap((g) => g.v);
      drawTable(subset, ` · ${b.closest('li').querySelector('strong').textContent}`);
      tableHost.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));

    // Si la cerca és un identificador exacte, obre'n el detall
    const exact = all.find((r) => r.id === st.q);
    if (exact && !draw.opened) { draw.opened = true; setTimeout(() => showDetail(exact), 200); }
  };

  const sync = () => {
    setQuery({ any: st.any, tipus: st.tipus, proc: st.proc, prog: st.prog, q: st.q });
    ['any', 'tipus', 'proc', 'prog'].forEach((k) => (c.querySelector(`#f-${k}`).value = st[k]));
    c.querySelector('#f-q').value = st.q;
    draw();
    flushCharts();
  };
  draw();
  ['any', 'tipus', 'proc', 'prog'].forEach((k) => c.querySelector(`#f-${k}`).addEventListener('change', (e) => { st[k] = e.target.value; sync(); }));
  let deb;
  c.querySelector('#f-q').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value.trim(); sync(); }, 250); });
  c.querySelector('#f-reset').addEventListener('click', () => { Object.assign(st, { any: 'all', tipus: 'all', proc: 'all', prog: 'all', q: '' }); sync(); });
}
