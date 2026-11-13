/**
 * Componentes avanzados: exploradores interactivos que se insertan como un bloque más.
 */
import { tr, t, pick, label, codes, lang } from '../i18n.js';
import { h, esc, icon, fmt, sum, groupBy, chartCard, dataTable, kpiRow, delta, meter, statusBadge, selectControl, modal, definitionList, download, toCSV, flushCharts } from '../ui.js';
import { sankey, treemap, columns, hBar, SERIES } from '../charts.js';
import * as store from '../store.js';
import { L } from './index.js';

const setQ = (params) => {
  const [path, qs] = location.hash.replace(/^#/, '').split('?');
  const q = new URLSearchParams(qs || '');
  for (const [k, v] of Object.entries(params)) { if (v === null || v === undefined || v === '' || v === 'all') q.delete(k); else q.set(k, v); }
  history.replaceState(null, '', `#${path}${q.toString() ? '?' + q : ''}`);
};
const AREA_COLOR = { 0: SERIES[7], 1: SERIES[0], 2: SERIES[1], 3: SERIES[2], 4: SERIES[3], 9: SERIES[6] };

// ============================================================================ PRESUPUESTO
async function presupuesto(el, p, ctx) {
  const pres = await store.rows('presupuesto');
  const ds = pick((await store.dsMeta('presupuesto')).titulo);
  const anios = [...new Set(pres.map((r) => r.anio))].sort();
  let anio = Number(ctx?.query?.get('anio')) || anios.at(-1);
  el.innerHTML = '';
  const filt = h(`<div class="filters">${selectControl('f-anio', tr('Ejercicio', 'Exercici', 'Fiscal year'), anios.slice().reverse().map((a) => [a, a]), anio)}</div>`);
  const out = h('<div></div>');
  el.append(filt, out);
  const draw = () => {
    out.innerHTML = '';
    const yr = pres.filter((r) => r.anio === anio), pv = pres.filter((r) => r.anio === anio - 1);
    const curso = yr[0]?.estado === 'en_ejecucion';
    const I = (s, k) => sum(s.filter((r) => r.tipo === 'ingreso'), (r) => r[k]);
    const G = (s, k) => sum(s.filter((r) => r.tipo === 'gasto'), (r) => r[k]);
    if (curso) out.appendChild(h(`<div class="callout callout-info">${icon('info', 20)}<div><p>${tr(`Ejercicio en curso: ejecución acumulada a 30 de septiembre de ${anio}.`, `Exercici en curs: execució acumulada a 30 de setembre de ${anio}.`, `Current year: execution to 30 September ${anio}.`)}</p></div></div>`));
    out.appendChild(kpiRow([
      { label: tr('Presupuesto de ingresos', 'Pressupost d’ingressos', 'Revenue budget'), value: fmt.eurC(I(yr, 'definitivo')), ...delta(I(yr, 'definitivo'), I(pv, 'definitivo')), context: `${tr('definitivo', 'definitiu', 'final')} · vs. ${anio - 1}` },
      { label: tr('Presupuesto de gastos', 'Pressupost de despeses', 'Spending budget'), value: fmt.eurC(G(yr, 'definitivo')), ...delta(G(yr, 'definitivo'), G(pv, 'definitivo')), context: `${tr('definitivo', 'definitiu', 'final')} · vs. ${anio - 1}` },
      { label: tr('Ejecución del gasto', 'Execució de la despesa', 'Spending execution'), value: fmt.pct((G(yr, 'ejecutado') / G(yr, 'definitivo')) * 100), context: tr('obligaciones reconocidas / crédito definitivo', 'obligacions reconegudes / crèdit definitiu', 'obligations / final budget') },
      { label: curso ? tr('Saldo a la fecha', 'Saldo a la data', 'Balance to date') : tr('Resultado presupuestario', 'Resultat pressupostari', 'Budget outturn'), value: fmt.eurC(I(yr, 'ejecutado') - G(yr, 'ejecutado')), context: tr('derechos – obligaciones', 'drets – obligacions', 'revenue – spending') },
    ]));
    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    const base = curso ? 'definitivo' : 'ejecutado';
    const baseTxt = curso ? tr('presupuesto definitivo', 'pressupost definitiu', 'final budget') : tr('importe liquidado', 'import liquidat', 'outturn');
    const ing = codes('capitulo_ingreso').map((c) => ({ name: label('capitulo_ingreso', c), value: sum(yr.filter((r) => r.tipo === 'ingreso' && r.capitulo === c), (r) => r[base]) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value).map((d, i) => ({ ...d, color: `var(--seq-${Math.max(2, 7 - i)})` }));
    const areas = codes('area_gasto').map((a) => ({ key: a, name: label('area_gasto', a), value: sum(yr.filter((r) => r.tipo === 'gasto' && r.area_gasto === a), (r) => r[base]), color: AREA_COLOR[a], ink: a === '4' ? '#0b0b0b' : undefined })).filter((d) => d.value > 0);
    grid.appendChild(chartCard({
      title: tr(`De dónde vienen y a dónde van los fondos (${anio})`, `D’on vénen i on van els fons (${anio})`, `Where the money comes from and goes (${anio})`),
      subtitle: `${tr('Ingresos por capítulo → gasto por área', 'Ingressos per capítol → despesa per àrea', 'Revenue by chapter → spending by area')} · ${baseTxt}`, full: true, file: `presupuesto-flujos-${anio}`, dataset: 'presupuesto', datasetTitle: ds,
      draw: (b) => sankey(b, { left: ing, right: areas, format: fmt.eurC, centerLabel: fmt.eurC(sum(ing, (d) => d.value)), sideLabels: { L: tr('Ingreso', 'Ingrés', 'Revenue'), R: tr('Gasto', 'Despesa', 'Spending') } }),
      table: { columns: [{ key: 't', label: tr('Tipo', 'Tipus', 'Type') }, { key: 'name', label: tr('Concepto', 'Concepte', 'Item') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: [...ing.map((d) => ({ ...d, t: tr('Ingreso', 'Ingrés', 'Revenue') })), ...areas.map((d) => ({ ...d, t: tr('Gasto', 'Despesa', 'Spending') }))] },
    }));
    grid.appendChild(chartCard({
      title: tr('Gasto por área', 'Despesa per àrea', 'Spending by area'), subtitle: `${anio} · ${baseTxt}`, file: `gasto-areas-${anio}`, dataset: 'presupuesto', datasetTitle: ds,
      draw: (b) => treemap(b, { data: areas, format: fmt.eurC }),
      table: { columns: [{ key: 'name', label: tr('Área', 'Àrea', 'Area') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: areas },
    }));
    const caps = codes('capitulo_gasto').filter((c) => yr.some((r) => r.tipo === 'gasto' && r.capitulo === c));
    const capRows = caps.map((c) => { const s = yr.filter((r) => r.tipo === 'gasto' && r.capitulo === c); return { c, name: `${c}. ${label('capitulo_gasto', c)}`, definitivo: sum(s, (r) => r.definitivo), ejecutado: sum(s, (r) => r.ejecutado) }; });
    grid.appendChild(chartCard({
      title: tr('Ejecución por capítulo de gasto', 'Execució per capítol de despesa', 'Execution by spending chapter'), subtitle: tr('Crédito definitivo y obligaciones reconocidas', 'Crèdit definitiu i obligacions reconegudes', 'Final budget and obligations'), file: `ejecucion-capitulos-${anio}`, dataset: 'presupuesto', datasetTitle: ds,
      draw: (b) => columns(b, { categories: capRows.map((r) => `${tr('Cap.', 'Cap.', 'Ch.')} ${r.c}`), series: [{ name: tr('Definitivo', 'Definitiu', 'Final'), values: capRows.map((r) => r.definitivo), color: 'var(--seq-3)' }, { name: tr('Ejecutado', 'Executat', 'Executed'), values: capRows.map((r) => r.ejecutado), color: 'var(--seq-6)' }], format: fmt.eur, axisFormat: fmt.eurC }),
      table: { columns: [{ key: 'name', label: tr('Capítulo', 'Capítol', 'Chapter') }, { key: 'definitivo', label: tr('Definitivo', 'Definitiu', 'Final'), align: 'right', format: fmt.eur }, { key: 'ejecutado', label: tr('Ejecutado', 'Executat', 'Executed'), align: 'right', format: fmt.eur }], rows: capRows },
    }));
    const evo = anios.map((a) => { const s = pres.filter((r) => r.anio === a); return { a, i: I(s, 'ejecutado'), g: G(s, 'ejecutado') }; });
    grid.appendChild(chartCard({
      title: tr('Evolución de ingresos y gastos liquidados', 'Evolució d’ingressos i despeses liquidats', 'Revenue and spending over time'), subtitle: `${anios[0]}–${anios.at(-1)}`, file: 'presupuesto-evolucion', dataset: 'presupuesto', datasetTitle: ds,
      draw: (b) => columns(b, { categories: evo.map((e) => String(e.a)), series: [{ name: tr('Ingresos', 'Ingressos', 'Revenue'), values: evo.map((e) => e.i) }, { name: tr('Gastos', 'Despeses', 'Spending'), values: evo.map((e) => e.g) }], format: fmt.eur, axisFormat: fmt.eurC }),
      table: { columns: [{ key: 'a', label: tr('Año', 'Any', 'Year') }, { key: 'i', label: tr('Ingresos', 'Ingressos', 'Revenue'), align: 'right', format: fmt.eur }, { key: 'g', label: tr('Gastos', 'Despeses', 'Spending'), align: 'right', format: fmt.eur }], rows: evo },
    }));
    const det = yr.map((r) => ({ ...r, concepto: r.tipo === 'ingreso' ? label('capitulo_ingreso', r.capitulo) : label('capitulo_gasto', r.capitulo), area: r.area_gasto ? label('area_gasto', r.area_gasto) : '—', pct: (r.ejecutado / r.definitivo) * 100 }));
    const card = h(`<section class="card"><h2 class="block-title">${tr('Detalle', 'Detall', 'Detail')} ${anio}</h2></section>`);
    card.appendChild(dataTable({ caption: tr('Detalle presupuestario', 'Detall pressupostari', 'Budget detail'), pageSize: 20, rows: det, columns: [
      { key: 'tipo', label: tr('Tipo', 'Tipus', 'Type'), format: (v) => (v === 'ingreso' ? tr('Ingreso', 'Ingrés', 'Revenue') : tr('Gasto', 'Despesa', 'Spending')) },
      { key: 'area', label: tr('Área', 'Àrea', 'Area') }, { key: 'capitulo', label: tr('Cap.', 'Cap.', 'Ch.') }, { key: 'concepto', label: tr('Concepto', 'Concepte', 'Item') },
      { key: 'inicial', label: tr('Inicial', 'Inicial', 'Initial'), align: 'right', format: fmt.eur }, { key: 'definitivo', label: tr('Definitivo', 'Definitiu', 'Final'), align: 'right', format: fmt.eur },
      { key: 'ejecutado', label: tr('Ejecutado', 'Executat', 'Executed'), align: 'right', format: fmt.eur }, { key: 'pct', label: '%', align: 'right', format: (v) => fmt.pct(v) }] }));
    out.appendChild(card);
  };
  draw();
  filt.querySelector('select').addEventListener('change', (e) => { anio = Number(e.target.value); setQ({ anio }); draw(); flushCharts(); });
}

// ============================================================================ CONTRATACIÓN
const PROC_COLOR = { 1: SERIES[0], 9: SERIES[1], 6: SERIES[3], 3: SERIES[4], 7: SERIES[5], 13: SERIES[2], 2: SERIES[6], 4: SERIES[7] };
const CONCURRENCIA = ['1', '2', '4', '5', '7', '9', '13'];
const UMBRAL_MENOR = { 3: 40000, default: 15000 };
export function toOCDS(c, ent) {
  return {
    ocid: `ocds-placsp-${c.id}`, id: `${c.id}-award`, date: `${c.fecha_adjudicacion}T00:00:00Z`, tag: ['award'], initiationType: 'tender', language: 'es',
    buyer: { id: ent?.dir3, name: pick(ent?.nombre) },
    parties: [{ id: ent?.dir3, name: pick(ent?.nombre), roles: ['buyer', 'procuringEntity'] }, ...(c.adjudicatario ? [{ id: c.adjudicatario_nif, name: c.adjudicatario, roles: ['supplier'], details: { scale: c.adjudicatario_pyme ? 'sme' : 'large' } }] : [])],
    tender: { id: c.expediente, title: c.objeto, procurementMethod: c.procedimiento === '6' ? 'direct' : ['3', '2'].includes(c.procedimiento) ? 'limited' : 'open', procurementMethodDetails: label('procedimiento', c.procedimiento),
      mainProcurementCategory: { 1: 'goods', 2: 'services', 3: 'works' }[c.tipo] || 'services', value: { amount: c.presupuesto_base_sin_iva, currency: 'EUR' }, numberOfTenderers: c.numero_ofertas, items: c.cpv ? [{ id: '1', classification: { scheme: 'CPV', id: c.cpv, description: label('cpv', c.cpv) } }] : [] },
    awards: c.importe_adjudicacion_sin_iva ? [{ id: `${c.id}-1`, date: `${c.fecha_adjudicacion}T00:00:00Z`, status: 'active', value: { amount: c.importe_adjudicacion_sin_iva, currency: 'EUR' }, suppliers: [{ id: c.adjudicatario_nif, name: c.adjudicatario }] }] : [],
    contracts: c.fecha_formalizacion ? [{ id: c.id, awardID: `${c.id}-1`, dateSigned: `${c.fecha_formalizacion}T00:00:00Z`, value: { amount: c.importe_adjudicacion_con_iva, currency: 'EUR' } }] : [],
  };
}
async function contratacion(el, p, ctx) {
  const all = await store.rows('contratos');
  const ent = await store.config();
  const ds = pick((await store.dsMeta('contratos')).titulo);
  const q = ctx?.query || new URLSearchParams();
  const anios = [...new Set(all.map((c) => (c.fecha_adjudicacion || '').slice(0, 4)).filter(Boolean))].sort().reverse();
  const st = { anio: q.get('anio') || 'all', tipo: q.get('tipo') || 'all', proc: q.get('proc') || 'all', q: q.get('q') || '' };
  const A = [['all', t('all')]];
  const usedTipos = [...new Set(all.map((c) => c.tipo))], usedProcs = [...new Set(all.map((c) => c.procedimiento))];
  el.innerHTML = '';
  const form = h(`<form class="filters" onsubmit="return false" aria-label="${t('filters')}">
    ${selectControl('fc-anio', tr('Año', 'Any', 'Year'), [...A, ...anios.map((a) => [a, a])], st.anio)}
    ${selectControl('fc-tipo', tr('Tipo', 'Tipus', 'Type'), [...A, ...codes('tipo_contrato').filter((k) => usedTipos.includes(k)).map((k) => [k, label('tipo_contrato', k)])], st.tipo)}
    ${selectControl('fc-proc', tr('Procedimiento', 'Procediment', 'Procedure'), [...A, ...codes('procedimiento').filter((k) => usedProcs.includes(k)).map((k) => [k, label('procedimiento', k)])], st.proc)}
    <label class="control grow"><span>${t('search')}</span><input id="fc-q" type="search" value="${esc(st.q)}" placeholder="${esc(tr('Objeto, empresa, NIF o expediente', 'Objecte, empresa, NIF o expedient', 'Subject, company, tax ID or file'))}"></label>
    <button type="button" class="btn-ghost" id="fc-reset">${tr('Limpiar', 'Netejar', 'Reset')}</button></form>`);
  const out = h('<div aria-live="polite"></div>');
  el.append(form, out);
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = () => all.filter((c) => (st.anio === 'all' || (c.fecha_adjudicacion || '').startsWith(st.anio)) && (st.tipo === 'all' || c.tipo === st.tipo) && (st.proc === 'all' || c.procedimiento === st.proc) && (!st.q || norm(`${c.objeto} ${c.adjudicatario} ${c.adjudicatario_nif} ${c.id} ${c.expediente}`).includes(norm(st.q))));
  const showDetail = (c) => {
    const dlg = modal(esc(c.objeto), `${definitionList([
      [tr('Expediente', 'Expedient', 'File'), esc(c.expediente)], [tr('Tipo', 'Tipus', 'Type'), label('tipo_contrato', c.tipo)], [tr('Procedimiento', 'Procediment', 'Procedure'), label('procedimiento', c.procedimiento)],
      [tr('Estado', 'Estat', 'Status'), label('estado_contrato', c.estado)], ['CPV', c.cpv ? `${c.cpv} · ${label('cpv', c.cpv)}` : '—'], [tr('Órgano', 'Òrgan', 'Body'), esc(c.organo || '—')],
      [tr('Adjudicación', 'Adjudicació', 'Award'), fmt.date(c.fecha_adjudicacion)], [tr('Formalización', 'Formalització', 'Signature'), fmt.date(c.fecha_formalizacion)],
      [tr('Duración', 'Durada', 'Duration'), c.duracion_meses ? `${fmt.dec(c.duracion_meses, 0)} ${tr('meses', 'mesos', 'months')}` : '—'],
      [tr('Presupuesto base (sin IVA)', 'Pressupost base (sense IVA)', 'Tender budget (ex VAT)'), c.presupuesto_base_sin_iva ? fmt.eur2(c.presupuesto_base_sin_iva) : '—'],
      [tr('Importe de adjudicación', 'Import d’adjudicació', 'Award value'), c.importe_adjudicacion_sin_iva ? `<strong>${fmt.eur2(c.importe_adjudicacion_sin_iva)}</strong> ${tr('sin IVA', 'sense IVA', 'ex VAT')} · ${fmt.eur2(c.importe_adjudicacion_con_iva || 0)} ${tr('con IVA', 'amb IVA', 'inc VAT')}` : '—'],
      [tr('Ofertas', 'Ofertes', 'Bids'), c.numero_ofertas ?? '—'], [tr('Adjudicatario', 'Adjudicatari', 'Supplier'), c.adjudicatario ? `${esc(c.adjudicatario)} · <code>${esc(c.adjudicatario_nif || '')}</code>${c.adjudicatario_pyme ? ' <span class="chip">PYME</span>' : ''}` : '—'],
      [t('source'), label('fuente', c.fuente)]])}
      <div class="modal-actions">${c.url ? `<a class="btn" href="${esc(c.url)}" rel="noopener">${tr('Ver en la Plataforma de Contratación', 'Veure en la Plataforma de Contractació', 'View on the Procurement Platform')} ${icon('external', 16)}</a>` : ''}
      <button type="button" class="btn-ghost" data-ocds>${icon('code', 16)} OCDS (JSON)</button></div>`);
    dlg.querySelector('[data-ocds]').addEventListener('click', () => download(`${c.id}.ocds.json`, JSON.stringify(toOCDS(c, ent), null, 2), 'application/json'));
  };
  const draw = () => {
    out.innerHTML = '';
    const f = filtered();
    if (!f.length) { out.appendChild(h(`<p class="callout callout-info">${t('no_results')}</p>`)); return; }
    const adj = f.filter((c) => c.importe_adjudicacion_sin_iva);
    const groupBySafe = groupBy;
    const imp = sum(adj, (c) => c.importe_adjudicacion_sin_iva);
    const noMen = adj.filter((c) => c.procedimiento !== '6');
    out.appendChild(kpiRow([
      { label: tr('Contratos', 'Contractes', 'Contracts'), value: fmt.int(f.length), context: `${fmt.int(f.filter((c) => c.procedimiento === '6').length)} ${tr('menores', 'menors', 'minor')}` },
      { label: tr('Importe adjudicado', 'Import adjudicat', 'Awarded value'), value: fmt.eurC(imp), context: tr('sin IVA', 'sense IVA', 'ex VAT') },
      { label: tr('Importe con concurrencia', 'Import amb concurrència', 'Competitively tendered'), value: imp ? fmt.pct((sum(adj.filter((c) => CONCURRENCIA.includes(c.procedimiento)), (c) => c.importe_adjudicacion_sin_iva) / imp) * 100) : '—', context: tr('procedimientos con publicidad', 'procediments amb publicitat', 'advertised procedures') },
      { label: tr('Ofertas por licitación', 'Ofertes per licitació', 'Bids per tender'), value: noMen.length ? fmt.dec(sum(noMen, (c) => c.numero_ofertas || 0) / noMen.length) : '—', context: tr('media, sin menores', 'mitjana, sense menors', 'average, excl. minor') },
      { label: tr('Adjudicado a pymes', 'Adjudicat a pimes', 'Awarded to SMEs'), value: imp ? fmt.pct((sum(adj.filter((c) => c.adjudicatario_pyme), (c) => c.importe_adjudicacion_sin_iva) / imp) * 100) : '—', context: tr('del importe', 'de l’import', 'of value') },
    ]));
    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    const byProc = [...groupBy(adj, (c) => c.procedimiento)].map(([k, v]) => ({ key: k, label: label('procedimiento', k), value: sum(v, (c) => c.importe_adjudicacion_sin_iva), color: PROC_COLOR[k] || SERIES[7], note: `${v.length} ${tr('contratos', 'contractes', 'contracts')}` })).sort((a, b) => b.value - a.value);
    grid.appendChild(chartCard({ title: tr('Importe por procedimiento', 'Import per procediment', 'Value by procedure'), subtitle: tr('Euros sin IVA · pulsa para filtrar', 'Euros sense IVA · prem per a filtrar', 'EUR ex VAT · click to filter'), file: 'contratos-procedimiento', dataset: 'contratos', datasetTitle: ds,
      draw: (b) => hBar(b, { data: byProc, format: fmt.eurC, onClick: (d) => { st.proc = d.key; sync(); } }), table: { columns: [{ key: 'label', label: tr('Procedimiento', 'Procediment', 'Procedure') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byProc } }));
    const years = anios.slice().reverse();
    const tipos = [...new Set(adj.map((c) => c.tipo))];
    const series = tipos.map((tp, i) => ({ name: label('tipo_contrato', tp), color: SERIES[i], values: years.map((y) => sum(adj.filter((c) => c.tipo === tp && (c.fecha_adjudicacion || '').startsWith(y)), (c) => c.importe_adjudicacion_sin_iva)) }));
    grid.appendChild(chartCard({ title: tr('Importe adjudicado por año', 'Import adjudicat per any', 'Value awarded by year'), subtitle: tr('Apilado por tipo de contrato', 'Apilat per tipus de contracte', 'Stacked by contract type'), file: 'contratos-anual', dataset: 'contratos', datasetTitle: ds,
      draw: (b) => columns(b, { categories: years, series, stacked: true, format: fmt.eur, axisFormat: fmt.eurC }), table: { columns: [{ key: 'y', label: tr('Año', 'Any', 'Year') }, ...series.map((s, i) => ({ key: 's' + i, label: s.name, align: 'right', format: fmt.eur }))], rows: years.map((y, yi) => Object.fromEntries([['y', y], ...series.map((s, i) => ['s' + i, s.values[yi]])])) } }));
    const byEmp = [...groupBy(adj, (c) => c.adjudicatario || '—')].map(([k, v]) => ({ label: k, value: sum(v, (c) => c.importe_adjudicacion_sin_iva), note: `${v.length} ${tr('contratos', 'contractes', 'contracts')}` })).sort((a, b) => b.value - a.value);
    grid.appendChild(chartCard({ title: tr('Principales adjudicatarios', 'Principals adjudicataris', 'Top suppliers'), subtitle: `${fmt.int(byEmp.length)} ${tr('empresas', 'empreses', 'companies')}`, file: 'contratos-adjudicatarios', dataset: 'contratos', datasetTitle: ds,
      draw: (b) => hBar(b, { data: byEmp.slice(0, 10), format: fmt.eurC, maxLabel: 240, onClick: (d) => { st.q = d.label; sync(); } }), table: { columns: [{ key: 'label', label: tr('Empresa', 'Empresa', 'Company') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byEmp } }));
    const bins = ['1', '2', '3', '4', '5', '6+'];
    const dist = bins.map((b) => noMen.filter((c) => (c.numero_ofertas >= 6 ? '6+' : String(c.numero_ofertas)) === b).length);
    grid.appendChild(chartCard({ title: tr('Competencia: ofertas recibidas', 'Competència: ofertes rebudes', 'Competition: bids received'), subtitle: tr('Contratos no menores', 'Contractes no menors', 'Non-minor contracts'), file: 'contratos-ofertas', dataset: 'contratos', datasetTitle: ds,
      draw: (b) => columns(b, { categories: bins, series: [{ name: tr('Contratos', 'Contractes', 'Contracts'), values: dist, color: SERIES[6] }], format: fmt.int }), table: { columns: [{ key: 'b', label: tr('Ofertas', 'Ofertes', 'Bids') }, { key: 'n', label: 'N', align: 'right' }], rows: bins.map((b, i) => ({ b, n: dist[i] })) } }));
    // Indicadores de riesgo
    const unica = adj.filter((c) => ['1', '9'].includes(c.procedimiento) && c.numero_ofertas === 1);
    const fracc = [...groupBy(adj.filter((c) => c.procedimiento === '6'), (c) => `${c.adjudicatario_nif}|${c.cpv}|${(c.fecha_adjudicacion || '').slice(0, 4)}`)].map(([k, v]) => ({ k, v, total: sum(v, (c) => c.importe_adjudicacion_sin_iva) })).filter((g) => g.v.length > 1 && g.total > (UMBRAL_MENOR[g.v[0].tipo] || UMBRAL_MENOR.default));
    const conc = byEmp.filter((d) => d.value / imp > 0.1);
    const alertLi = (n, ti, de, lvl, key) => `<li class="alert alert-${n ? lvl : 'good'}"><span class="alert-n">${n}</span><div><strong>${ti}</strong><p>${de}</p>${n && key ? `<button type="button" class="link-btn" data-alert="${key}">${tr('Ver en la tabla', 'Veure en la taula', 'Show in table')} ↓</button>` : ''}</div></li>`;
    out.appendChild(h(`<section class="card"><h2 class="block-title">${icon('flag', 20)} ${tr('Indicadores de riesgo e integridad', 'Indicadors de risc i integritat', 'Risk & integrity indicators')}</h2>
      <p class="muted small">${tr('Señales calculadas automáticamente para facilitar el control ciudadano. No implican irregularidad.', 'Senyals calculats automàticament per a facilitar el control ciutadà. No impliquen irregularitat.', 'Automatic signals to support public scrutiny. They do not imply wrongdoing.')}</p>
      <ul class="alert-grid">${alertLi(unica.length, tr('Procedimientos abiertos con una sola oferta', 'Procediments oberts amb una sola oferta', 'Open procedures with a single bid'), tr('Puede indicar baja competencia.', 'Pot indicar baixa competència.', 'May signal low competition.'), 'warning', 'unica')}
      ${alertLi(fracc.length, tr('Posible fraccionamiento de menores', 'Possible fraccionament de menors', 'Possible split minor contracts'), tr('Mismo adjudicatario y CPV en un año por encima del umbral legal.', 'Mateix adjudicatari i CPV en un any per damunt del llindar legal.', 'Same supplier and CPV in a year above the legal threshold.'), 'serious', 'fracc')}
      ${alertLi(conc.length, tr('Empresas con más del 10 % del importe', 'Empreses amb més del 10 % de l’import', 'Suppliers above 10% of value'), tr('Concentración en un solo proveedor.', 'Concentració en un sol proveïdor.', 'Concentration on a single supplier.'), 'warning', null)}</ul></section>`));
    const tableHost = h('<section class="card"></section>');
    out.appendChild(tableHost);
    const drawTable = (subset, extra = '') => {
      tableHost.innerHTML = `<div class="card-head"><h2 class="block-title">${tr('Relación de contratos', 'Relació de contractes', 'Contract list')}${extra}</h2><button type="button" class="btn-ghost" data-export>${icon('download', 16)} CSV</button></div>`;
      tableHost.appendChild(dataTable({ caption: tr('Contratos', 'Contractes', 'Contracts'), rows: subset, pageSize: 15, onRow: showDetail, sortKey: 'fecha_adjudicacion', sortDir: -1, columns: [
        { key: 'fecha_adjudicacion', label: tr('Fecha', 'Data', 'Date'), format: fmt.date }, { key: 'objeto', label: tr('Objeto', 'Objecte', 'Subject'), width: '36%' },
        { key: 'procedimiento', label: tr('Procedimiento', 'Procediment', 'Procedure'), format: (v) => label('procedimiento', v) }, { key: 'adjudicatario', label: tr('Adjudicatario', 'Adjudicatari', 'Supplier') },
        { key: 'numero_ofertas', label: tr('Ofertas', 'Ofertes', 'Bids'), align: 'right' }, { key: 'importe_adjudicacion_sin_iva', label: tr('Importe sin IVA', 'Import sense IVA', 'Value ex VAT'), align: 'right', format: (v) => (v ? fmt.eur(v) : '—') }] }));
      tableHost.querySelector('[data-export]').addEventListener('click', () => download('contratos-seleccion.csv', '﻿' + toCSV(Object.keys(subset[0] || {}).map((k) => ({ key: k, label: k })), subset), 'text/csv;charset=utf-8'));
    };
    drawTable(f);
    out.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', () => { const k = b.dataset.alert; drawTable(k === 'unica' ? unica : fracc.flatMap((g) => g.v), ` · ${b.closest('li').querySelector('strong').textContent}`); tableHost.scrollIntoView({ behavior: 'smooth' }); }));
    const exact = all.find((c) => c.id === st.q);
    if (exact && !draw.opened) { draw.opened = true; setTimeout(() => showDetail(exact), 200); }
  };
  const sync = () => { setQ(st); ['anio', 'tipo', 'proc'].forEach((k) => (form.querySelector(`#fc-${k}`).value = st[k])); form.querySelector('#fc-q').value = st.q; draw(); flushCharts(); };
  draw();
  ['anio', 'tipo', 'proc'].forEach((k) => form.querySelector(`#fc-${k}`).addEventListener('change', (e) => { st[k] = e.target.value; sync(); }));
  let deb; form.querySelector('#fc-q').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value.trim(); sync(); }, 250); });
  form.querySelector('#fc-reset').addEventListener('click', () => { Object.assign(st, { anio: 'all', tipo: 'all', proc: 'all', q: '' }); sync(); });
}

// ============================================================================ ÍNDICE
const PESO = { publicado: 1, parcial: 0.5, pendiente: 0 };
const MAX_DIAS = { continua: 15, semanal: 10, mensual: 45, trimestral: 105, semestral: 200, anual: 380, cuando_cambie: 400 };
export const isStale = (o, hoy = new Date()) => o.ultima_actualizacion && (hoy - new Date(o.ultima_actualizacion + 'T00:00:00Z')) / 864e5 > MAX_DIAS[o.periodicidad];
export function score(obl) {
  const s = (set) => (set.reduce((a, o) => a + PESO[o.estado], 0) / (set.length || 1)) * 100;
  const counts = { publicado: 0, parcial: 0, pendiente: 0 };
  obl.forEach((o) => counts[o.estado]++);
  return { total: s(obl), counts, byBloque: [...new Set(obl.map((o) => o.bloque))].map((b) => ({ bloque: b, score: s(obl.filter((o) => o.bloque === b)), n: obl.filter((o) => o.bloque === b).length })), stale: obl.filter((o) => isStale(o)).length };
}
async function indice(el) {
  const obl = await store.rows('obligaciones');
  const sc = score(obl);
  el.innerHTML = `<div class="card compliance-hero">
    <div class="score-ring big" style="--p:${sc.total}" role="img" aria-label="${fmt.dec(sc.total, 0)} %"><span>${fmt.dec(sc.total, 0)}<small>%</small></span></div>
    <div><h2 class="block-title">${tr('Índice de cumplimiento', 'Índex de compliment', 'Compliance index')}</h2>
    <p>${tr(`Se evalúan ${obl.length} obligaciones de publicidad activa. Publicada = 1 punto, parcial = 0,5, pendiente = 0.`, `S’avaluen ${obl.length} obligacions de publicitat activa. Publicada = 1 punt, parcial = 0,5, pendent = 0.`, `${obl.length} disclosure obligations assessed. Published = 1, partial = 0.5, pending = 0.`)}</p>
    <div class="status-legend">${statusBadge('publicado')} ${sc.counts.publicado} ${statusBadge('parcial')} ${sc.counts.parcial} ${statusBadge('pendiente')} ${sc.counts.pendiente} <span class="badge badge-serious">${icon('warn', 12)}${tr('Desactualizadas', 'Desactualitzades', 'Out of date')}</span> ${sc.stale}</div></div></div>
    <section class="card"><h2 class="block-title">${tr('Por bloques', 'Per blocs', 'By block')}</h2><ul class="meter-list">${sc.byBloque.map((b) => `<li><span class="ml-label">${label('bloque_obligacion', b.bloque)}</span><span class="ml-val">${fmt.dec(b.score, 0)} %</span>${meter(b.score)}</li>`).join('')}</ul></section>`;
  const card = h(`<section class="card"><h2 class="block-title">${tr('Obligaciones una a una', 'Obligacions una a una', 'Obligations one by one')}</h2></section>`);
  card.appendChild(dataTable({ caption: tr('Obligaciones', 'Obligacions', 'Obligations'), rows: obl, pageSize: 50, columns: [
    { key: 'titulo', label: tr('Obligación', 'Obligació', 'Obligation'), html: true, format: (v, o) => `<a href="#/${o.pagina}">${esc(v)}</a>` },
    { key: 'norma', label: tr('Norma', 'Norma', 'Law'), format: (v, o) => `${v}, ${o.articulo}` }, { key: 'estado', label: tr('Estado', 'Estat', 'Status'), html: true, format: (v) => statusBadge(v), sortValue: (o) => PESO[o.estado] },
    { key: 'periodicidad', label: tr('Periodicidad', 'Periodicitat', 'Frequency'), format: (v) => label('periodicidad', v) },
    { key: 'ultima_actualizacion', label: t('updated'), html: true, format: (v, o) => (v ? `${fmt.date(v)}${isStale(o) ? ` <span class="badge badge-serious" title="${esc(tr('Supera la periodicidad prevista', 'Supera la periodicitat prevista', 'Exceeds expected frequency'))}">${icon('warn', 12)}</span>` : ''}` : '—') }] }));
  el.appendChild(card);
}

// ============================================================================ CATÁLOGO
async function catalogo(el, p, ctx) {
  const [m, idx] = await Promise.all([store.meta(), fetch(store.url('api/v1/index.json')).then((r) => r.json()).catch(() => ({ conjuntos: [] }))]);
  const base = store.url('');
  const copyBtn = (txt) => `<button type="button" class="icon-btn" data-copy="${esc(txt)}" title="${esc(tr('Copiar', 'Copiar', 'Copy'))}">${icon('copy', 16)}<span class="sr-only">${tr('Copiar', 'Copiar', 'Copy')}</span></button>`;
  el.addEventListener('click', async (e) => { const b = e.target.closest('[data-copy]'); if (b) { try { await navigator.clipboard.writeText(b.dataset.copy); b.classList.add('copied'); } catch { /* */ } } });
  const interop = [['DCAT-AP · JSON-LD', 'data/catalog.jsonld', tr('Federable con data.europa.eu', 'Federable amb data.europa.eu', 'Harvestable by data.europa.eu')], ['DCAT-AP-ES · RDF/XML', 'data/catalog.rdf', tr('Federable con datos.gob.es', 'Federable amb datos.gob.es', 'Harvestable by datos.gob.es')],
    ['Frictionless Data Package', 'datapackage.json', tr('Esquemas de cada tabla', 'Esquemes de cada taula', 'Per-table schemas')], ['OpenAPI 3.1', 'api/openapi.json', tr('Descripción de la API', 'Descripció de l’API', 'API description')],
    [tr('Listas de códigos', 'Llistes de codis', 'Code lists'), 'data/codelists.json', tr('Vocabularios es/va/en', 'Vocabularis es/va/en', 'es/va/en vocabularies')], [tr('Estado de sincronización', 'Estat de sincronització', 'Sync status'), 'data/sync/estado.json', 'PLACSP · BDNS'], ['Atom', 'feed.xml', tr('Novedades', 'Novetats', 'Updates')]];
  el.innerHTML = `<h2 class="section-title">${tr('Interoperabilidad', 'Interoperabilitat', 'Interoperability')}</h2>
    <ul class="interop-grid">${interop.map(([n, path, d]) => `<li class="card interop"><strong>${n}</strong><span class="muted small">${d}</span><div class="interop-url"><a href="${path}"><code>${path}</code></a>${copyBtn(base + path)}</div></li>`).join('')}</ul>
    <h2 class="section-title">${tr('Conjuntos de datos', 'Conjunts de dades', 'Datasets')}</h2>
    <ul class="dataset-grid">${m.conjuntos.map((d) => { const i = idx.conjuntos.find((x) => x.id === d.id); return `<li class="card dataset">
      <a class="dataset-title" href="#/datos/${d.id}">${icon(['placsp', 'bdns'].includes(d.fuente.tipo) ? 'sync' : 'database', 18)}<span>${esc(pick(d.titulo))}</span></a>
      <p>${esc(pick(d.descripcion))}</p><p class="muted small">${fmt.int(i?.registros || 0)} ${t('records')} · ${t('source')}: ${esc(d.fuente.nombre)}</p>
      <div class="dataset-actions"><a class="chip" href="data/csv/${d.id}.csv" download>CSV</a><a class="chip" href="data/${d.id}.json">JSON</a><a class="link-btn" href="#/datos/${d.id}">${tr('Ficha', 'Fitxa', 'Details')} →</a></div></li>`; }).join('')}</ul>`;
}
export async function datasetDetail(el, id) {
  const m = await store.meta();
  const d = m.conjuntos.find((x) => x.id === id);
  if (!d) { el.innerHTML = `<h1 id="page-title" tabindex="-1">${t('not_found')}</h1>`; return; }
  const env = await store.dataset(id);
  const base = store.url('');
  const j = `${base}data/${id}.json`, c = `${base}data/csv/${id}.csv`;
  el.innerHTML = `<header class="page-head-inline"><nav class="breadcrumb"><a href="#/">${t('home')}</a> › <a href="#/datos-abiertos">${tr('Datos abiertos', 'Dades obertes', 'Open data')}</a> › ${esc(id)}</nav>
    <h1 id="page-title" tabindex="-1">${esc(pick(d.titulo))}</h1><p class="lead">${esc(pick(d.descripcion))}</p></header>
    <div class="two-col"><section class="card"><h2 class="block-title">${tr('Descarga y API', 'Descàrrega i API', 'Download & API')}</h2>
      <p><a class="btn" href="data/csv/${id}.csv" download>${icon('download', 16)} CSV</a> <a class="btn" href="data/${id}.json">${icon('download', 16)} JSON</a> <a class="btn-ghost" href="#/${d.pagina}">${icon('chart', 16)} ${tr('Ver en el portal', 'Veure en el portal', 'See on the portal')}</a></p>
      <p class="label-sm">API REST</p><pre><code>curl -s ${esc(j)}</code></pre>
      <p class="label-sm">Python</p><pre><code>import pandas as pd
df = pd.read_csv("${esc(c)}")</code></pre></section>
    <section class="card"><h2 class="block-title">${tr('Metadatos', 'Metadades', 'Metadata')}</h2>${definitionList([
      [tr('Identificador', 'Identificador', 'Identifier'), `<code>${id}</code>`], [t('records'), fmt.int((env.datos || []).length)], [t('source'), d.fuente.url ? `<a href="${esc(d.fuente.url)}">${esc(d.fuente.nombre)}</a>` : esc(d.fuente.nombre)],
      [t('updated'), fmt.date(String(env.actualizado || env.generado).slice(0, 10))], [tr('Cobertura temporal', 'Cobertura temporal', 'Temporal coverage'), `${d.temporal[0].slice(0, 4)}–${d.temporal[1].slice(0, 4)}`],
      [tr('Licencia', 'Llicència', 'Licence'), '<a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>'], [tr('Temas', 'Temes', 'Themes'), `EU: ${d.tema_eu} · NTI: ${d.tema_nti}`]])}</section></div>`;
  const sch = h(`<section class="card"><h2 class="block-title">${tr('Diccionario de datos', 'Diccionari de dades', 'Data dictionary')}</h2></section>`);
  sch.appendChild(dataTable({ caption: 'schema', rows: d.campos, pageSize: 60, columns: [{ key: 'nombre', label: tr('Campo', 'Camp', 'Field'), html: true, format: (v) => `<code>${v}</code>` }, { key: 'tipo', label: tr('Tipo', 'Tipus', 'Type') }, { key: 'descripcion', label: tr('Descripción', 'Descripció', 'Description') }, { key: 'lista', label: tr('Lista de códigos', 'Llista de codis', 'Code list'), format: (v) => v || '—' }] }));
  el.appendChild(sch);
}

// ============================================================================ ACCESO
async function acceso(el) {
  const [sol, ent] = await Promise.all([store.rows('solicitudes-acceso'), store.config()]);
  const y = String(new Date().getFullYear() - 1);
  const yr = sol.filter((s) => s.fecha_entrada.startsWith(y));
  const res = yr.filter((s) => s.dias_resolucion != null);
  const steps = [[tr('Presenta la solicitud', 'Presenta la sol·licitud', 'Submit your request'), tr('En la sede electrónica o en el registro. No es necesario motivarla.', 'En la seu electrònica o en el registre. No cal motivar-la.', 'Online or at the registry. No reason needed.')],
    [tr('Tramitación', 'Tramitació', 'Processing'), tr('Si afecta a terceros, se les da audiencia.', 'Si afecta tercers, se’ls dona audiència.', 'Affected third parties are consulted.')],
    [tr('Resolución en un mes', 'Resolució en un mes', 'Decision within a month'), tr('Ampliable un mes más por volumen o complejidad.', 'Ampliable un mes més per volum o complexitat.', 'Extendable by one month.')],
    [tr('Reclamación', 'Reclamació', 'Appeal'), tr(`Puedes reclamar gratuitamente ante el ${ent.consejo_transparencia?.nombre || 'Consejo de Transparencia'}.`, `Pots reclamar gratuïtament davant el ${ent.consejo_transparencia?.nombre || 'Consell de Transparència'}.`, `You can appeal free of charge to the ${ent.consejo_transparencia?.nombre || 'Transparency Council'}.`)]];
  el.innerHTML = `<section class="card"><h2 class="block-title">${tr('Cómo solicitar información', 'Com sol·licitar informació', 'How to request information')}</h2>
    <ol class="steps">${steps.map(([a, b], i) => `<li><span class="step-n">${i + 1}</span><div><strong>${a}</strong><p>${b}</p></div></li>`).join('')}</ol>
    <p><a class="btn" href="${esc(ent.sede_electronica)}" rel="noopener">${icon('external', 16)} ${tr('Presentar una solicitud', 'Presentar una sol·licitud', 'Submit a request')}</a> ${ent.consejo_transparencia?.url ? `<a class="btn-ghost" href="${esc(ent.consejo_transparencia.url)}" rel="noopener">${esc(ent.consejo_transparencia.nombre)} ${icon('external', 14)}</a>` : ''}</p></section>`;
  el.appendChild(kpiRow([
    { label: tr(`Solicitudes ${y}`, `Sol·licituds ${y}`, `Requests ${y}`), value: fmt.int(yr.length) },
    { label: tr('Acceso concedido', 'Accés concedit', 'Access granted'), value: res.length ? fmt.pct((yr.filter((s) => s.sentido.startsWith('estimada')).length / res.length) * 100) : '—', context: tr('total o parcial', 'total o parcial', 'full or partial') },
    { label: tr('Tiempo medio de respuesta', 'Temps mitjà de resposta', 'Average response time'), value: res.length ? fmt.dias(sum(res, (s) => s.dias_resolucion) / res.length) : '—' },
    { label: tr('Resueltas en plazo', 'Resoltes en termini', 'On time'), value: res.length ? fmt.pct((res.filter((s) => s.dias_resolucion <= 30).length / res.length) * 100) : '—', context: '≤ 30' },
  ]));
}

export const ADVANCED = {
  presupuesto: { nombre: L('Explorador del presupuesto', 'Explorador del pressupost', 'Budget explorer'), icono: 'euro', grupo: 'avanzado', props: [], nuevo: () => ({}), render: presupuesto },
  contratacion: { nombre: L('Explorador de contratación', 'Explorador de contractació', 'Procurement explorer'), icono: 'file', grupo: 'avanzado', props: [], nuevo: () => ({}), render: contratacion },
  indice: { nombre: L('Índice de transparencia', 'Índex de transparència', 'Transparency index'), icono: 'check', grupo: 'avanzado', props: [], nuevo: () => ({}), render: indice },
  catalogo: { nombre: L('Catálogo de datos abiertos', 'Catàleg de dades obertes', 'Open data catalogue'), icono: 'database', grupo: 'avanzado', props: [], nuevo: () => ({}), render: catalogo },
  acceso: { nombre: L('Solicitar información', 'Sol·licitar informació', 'Request information'), icono: 'inbox', grupo: 'avanzado', props: [], nuevo: () => ({}), render: acceso },
};
