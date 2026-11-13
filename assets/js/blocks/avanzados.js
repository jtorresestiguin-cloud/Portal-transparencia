/**
 * Componentes avanzados: exploradores interactivos que se insertan como un bloque más.
 */
import * as C from '../compliance.js';
import { tr, t, pick, label, codes, lang } from '../i18n.js';
import { h, esc, icon, fmt, sum, groupBy, chartCard, dataTable, kpiRow, delta, meter, statusBadge, selectControl, modal, definitionList, download, toCSV, flushCharts, filterSummary, emptyState } from '../ui.js';
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
  const env = await store.dataset('presupuesto');
  const anios = [...new Set(pres.map((r) => r.anio))].sort();
  const q = ctx?.query || new URLSearchParams();
  let anio = Number(q.get('anio')) || anios.at(-1);
  let area = q.get('area') || '';
  el.innerHTML = '';
  const filt = h(`<div class="filter-bar">${selectControl('f-anio', tr('Ejercicio', 'Exercici', 'Fiscal year'), anios.slice().reverse().map((a) => [a, a]), anio)}</div>`);
  const out = h('<div class="explorer"></div>');
  el.append(filt, out);
  const I = (s_, k) => sum(s_.filter((r) => r.tipo === 'ingreso'), (r) => r[k]);
  const G = (s_, k) => sum(s_.filter((r) => r.tipo === 'gasto'), (r) => r[k]);
  const draw = () => {
    out.innerHTML = '';
    const yr = pres.filter((r) => r.anio === anio), pv = pres.filter((r) => r.anio === anio - 1);
    const curso = yr[0]?.estado === 'en_ejecucion';
    const base = curso ? 'definitivo' : 'ejecutado';
    const baseTxt = curso ? tr('presupuesto definitivo', 'pressupost definitiu', 'final budget') : tr('importe liquidado', 'import liquidat', 'outturn');
    if (curso) out.appendChild(h(`<div class="callout callout-info">${icon('info', 20)}<div><p>${tr(`El ejercicio ${anio} está en curso: la ejecución es la acumulada a ${fmt.full(env.fecha_corte_en_ejecucion || '')}.`, `L’exercici ${anio} està en curs: l’execució és l’acumulada a ${fmt.full(env.fecha_corte_en_ejecucion || '')}.`, `${anio} is the current year: execution is cumulative to ${fmt.full(env.fecha_corte_en_ejecucion || '')}.`)}</p></div></div>`));
    const crumbs = h(`<nav class="drill-crumbs" aria-label="${esc(tr('Nivel de detalle', 'Nivell de detall', 'Detail level'))}"><ol><li>${area ? `<button type="button" class="link-btn" data-area="">${tr('Presupuesto', 'Pressupost', 'Budget')} ${anio}</button>` : `<span aria-current="true">${tr('Presupuesto', 'Pressupost', 'Budget')} ${anio}</span>`}</li>${area ? `<li><span aria-current="true">${esc(label('area_gasto', area))}</span></li>` : ''}</ol></nav>`);
    out.appendChild(crumbs);
    if (!area) {
      out.appendChild(kpiRow([
        { label: tr('Presupuesto de gastos', 'Pressupost de despeses', 'Spending budget'), value: fmt.eurC(G(yr, 'definitivo')), ...delta(G(yr, 'definitivo'), G(pv, 'definitivo')), context: `vs. ${anio - 1}` },
        { label: tr('Ejecutado', 'Executat', 'Executed'), value: fmt.pct((G(yr, 'ejecutado') / G(yr, 'definitivo')) * 100), context: `${fmt.eurC(G(yr, 'ejecutado'))} ${tr('de gasto reconocido', 'de despesa reconeguda', 'spent')}` },
        { label: curso ? tr('Saldo a la fecha', 'Saldo a la data', 'Balance to date') : tr('Resultado (ingresos − gastos)', 'Resultat (ingressos − despeses)', 'Outturn (revenue − spending)'), value: fmt.eurC(I(yr, 'ejecutado') - G(yr, 'ejecutado')) },
      ]));
      const ing = codes('capitulo_ingreso').map((c) => ({ name: label('capitulo_ingreso', c), value: sum(yr.filter((r) => r.tipo === 'ingreso' && r.capitulo === c), (r) => r[base]) })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
      const areas = codes('area_gasto').map((a) => ({ key: a, name: label('area_gasto', a), value: sum(yr.filter((r) => r.tipo === 'gasto' && r.area_gasto === a), (r) => r[base]), color: AREA_COLOR[a], ink: a === '4' ? '#0b0b0b' : undefined })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
      out.appendChild(h(`<h2 class="section-title">${tr('¿De dónde viene el dinero?', 'D’on ve els diners?', 'Where does the money come from?')}</h2>`));
      const g1 = h('<div class="chart-grid"></div>'); out.appendChild(g1);
      const totI = sum(ing, (d) => d.value);
      g1.appendChild(chartCard({ title: tr(`Ingresos por tipo (${anio})`, `Ingressos per tipus (${anio})`, `Revenue by type (${anio})`), subtitle: `${baseTxt} · ${tr('euros', 'euros', 'EUR')}`, file: `ingresos-${anio}`, dataset: 'presupuesto', datasetTitle: ds, wide: true, level: 3,
        draw: (b) => hBar(b, { data: ing.map((d) => ({ label: d.name, value: d.value, note: fmt.pct((d.value / totI) * 100) })), format: fmt.eurC, color: 'var(--s1)', valueName: tr('Ingresos', 'Ingressos', 'Revenue') }),
        table: { columns: [{ key: 'name', label: tr('Tipo de ingreso', 'Tipus d’ingrés', 'Revenue type') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: ing } }));
      out.appendChild(h(`<h2 class="section-title">${tr('¿En qué se gasta?', 'En què es gasta?', 'What is it spent on?')}</h2><p class="muted">${tr('Pulsa un área para ver su detalle.', 'Prem una àrea per a veure’n el detall.', 'Select an area to see its detail.')}</p>`));
      const g2 = h('<div class="chart-grid"></div>'); out.appendChild(g2);
      g2.appendChild(chartCard({ title: tr(`Gasto por área (${anio})`, `Despesa per àrea (${anio})`, `Spending by area (${anio})`), subtitle: baseTxt, file: `gasto-areas-${anio}`, dataset: 'presupuesto', datasetTitle: ds, wide: true, level: 3,
        draw: (b) => treemap(b, { data: areas, format: fmt.eurC, onClick: (d) => { area = d.key; setQ({ area }); draw(); flushCharts(); } }),
        table: { columns: [{ key: 'name', label: tr('Área', 'Àrea', 'Area') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: areas } }));
      const list = h(`<ul class="drill-list">${areas.map((a) => `<li><button type="button" data-area="${a.key}"><span class="drill-swatch" style="background:${a.color}"></span><span class="drill-name">${esc(a.name)}</span><span class="drill-value">${fmt.eurC(a.value)}</span>${icon('chevron', 16)}</button></li>`).join('')}</ul>`);
      out.appendChild(list);
      out.appendChild(h(`<h2 class="section-title">${tr('¿Cuánto se ha ejecutado?', 'Quant s’ha executat?', 'How much has been executed?')}</h2>`));
      const g3 = h('<div class="chart-grid"></div>'); out.appendChild(g3);
      const evo = anios.map((a) => { const s_ = pres.filter((r) => r.anio === a); return { a, def: G(s_, 'definitivo'), eje: G(s_, 'ejecutado') }; });
      g3.appendChild(chartCard({ title: tr('Gasto previsto y ejecutado por año', 'Despesa prevista i executada per any', 'Planned and executed spending by year'), subtitle: `${anios[0]}–${anios.at(-1)} · ${tr('euros', 'euros', 'EUR')}`, file: 'presupuesto-ejecucion', dataset: 'presupuesto', datasetTitle: ds, wide: true, level: 3,
        draw: (b) => columns(b, { categories: evo.map((e) => String(e.a)), series: [{ name: tr('Previsto (definitivo)', 'Previst (definitiu)', 'Planned (final)'), values: evo.map((e) => e.def), color: 'var(--seq-3)' }, { name: tr('Ejecutado', 'Executat', 'Executed'), values: evo.map((e) => e.eje), color: 'var(--seq-6)' }], format: fmt.eur, axisFormat: fmt.eurC }),
        table: { columns: [{ key: 'a', label: tr('Año', 'Any', 'Year') }, { key: 'def', label: tr('Previsto', 'Previst', 'Planned'), align: 'right', format: fmt.eur }, { key: 'eje', label: tr('Ejecutado', 'Executat', 'Executed'), align: 'right', format: fmt.eur }, { key: 'p', label: '%', align: 'right', format: (v, r) => fmt.pct((r.eje / r.def) * 100) }], rows: evo } }));
    } else {
      const ar = yr.filter((r) => r.tipo === 'gasto' && r.area_gasto === area);
      const arPv = pv.filter((r) => r.tipo === 'gasto' && r.area_gasto === area);
      out.appendChild(h(`<h2 class="section-title">${esc(label('area_gasto', area))}</h2>`));
      out.appendChild(kpiRow([
        { label: tr('Presupuesto del área', 'Pressupost de l’àrea', 'Area budget'), value: fmt.eurC(sum(ar, (r) => r.definitivo)), ...delta(sum(ar, (r) => r.definitivo), sum(arPv, (r) => r.definitivo)), context: `vs. ${anio - 1}` },
        { label: tr('Peso sobre el total', 'Pes sobre el total', 'Share of total'), value: fmt.pct((sum(ar, (r) => r.definitivo) / G(yr, 'definitivo')) * 100) },
        { label: tr('Ejecutado', 'Executat', 'Executed'), value: fmt.pct((sum(ar, (r) => r.ejecutado) / sum(ar, (r) => r.definitivo)) * 100) },
      ]));
      const caps = ar.map((r) => ({ name: `${r.capitulo}. ${label('capitulo_gasto', r.capitulo)}`, inicial: r.inicial, definitivo: r.definitivo, ejecutado: r.ejecutado, pct: (r.ejecutado / r.definitivo) * 100 }));
      const g = h('<div class="chart-grid"></div>'); out.appendChild(g);
      g.appendChild(chartCard({ title: tr('Previsto y ejecutado por tipo de gasto', 'Previst i executat per tipus de despesa', 'Planned and executed by spending type'), subtitle: `${anio} · ${tr('euros', 'euros', 'EUR')}`, file: `area-${area}-${anio}`, dataset: 'presupuesto', datasetTitle: ds, wide: true, level: 3,
        draw: (b) => columns(b, { categories: caps.map((c) => c.name), series: [{ name: tr('Previsto', 'Previst', 'Planned'), values: caps.map((c) => c.definitivo), color: 'var(--seq-3)' }, { name: tr('Ejecutado', 'Executat', 'Executed'), values: caps.map((c) => c.ejecutado), color: 'var(--seq-6)' }], format: fmt.eur, axisFormat: fmt.eurC }),
        table: { columns: [{ key: 'name', label: tr('Tipo de gasto (capítulo)', 'Tipus de despesa (capítol)', 'Spending type (chapter)') }, { key: 'inicial', label: tr('Inicial', 'Inicial', 'Initial'), align: 'right', format: fmt.eur }, { key: 'definitivo', label: tr('Definitivo', 'Definitiu', 'Final'), align: 'right', format: fmt.eur }, { key: 'ejecutado', label: tr('Ejecutado', 'Executat', 'Executed'), align: 'right', format: fmt.eur }, { key: 'pct', label: '%', align: 'right', format: (v) => fmt.pct(v) }], rows: caps } }));
      out.appendChild(h(`<p class="callout callout-info">${icon('info', 20)}<span>${tr('El siguiente nivel de detalle (programas y partidas) estará disponible cuando la contabilidad municipal publique el presupuesto con clasificación por programas.', 'El següent nivell de detall (programes i partides) estarà disponible quan la comptabilitat municipal publique el pressupost amb classificació per programes.', 'The next level (programmes and line items) will be available once the accounts are published by programme.')}</span></p>`));
    }
    out.querySelectorAll('[data-area]').forEach((b) => b.addEventListener('click', () => { area = b.dataset.area; setQ({ area }); draw(); flushCharts(); out.querySelector('.drill-crumbs')?.scrollIntoView({ block: 'start' }); }));
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
  const st = { anio: q.get('anio') || '', tipo: q.get('tipo') || '', proc: q.get('proc') || '', q: q.get('q') || '', vista: q.get('vista') || 'lista' };
  const A = [['', t('all')]];
  const usedTipos = [...new Set(all.map((c) => c.tipo))], usedProcs = [...new Set(all.map((c) => c.procedimiento))];
  el.innerHTML = '';
  const form = h(`<form class="filter-bar" onsubmit="return false" aria-label="${t('filters')}">
    <label class="control grow"><span>${tr('Buscar contratos', 'Cercar contractes', 'Search contracts')}</span><input id="fc-q" type="search" value="${esc(st.q)}" placeholder="${esc(tr('Objeto, empresa, NIF o expediente', 'Objecte, empresa, NIF o expedient', 'Subject, company, tax ID or file'))}"></label>
    <details class="more-filters"><summary class="btn-ghost btn-sm">${icon('layout', 16)}${tr('Filtros', 'Filtres', 'Filters')}<span class="count" data-nf></span></summary><div class="more-filters-body">
    ${selectControl('fc-anio', tr('Año', 'Any', 'Year'), [...A, ...anios.map((a) => [a, a])], st.anio)}
    ${selectControl('fc-tipo', tr('Tipo', 'Tipus', 'Type'), [...A, ...codes('tipo_contrato').filter((k) => usedTipos.includes(k)).map((k) => [k, label('tipo_contrato', k)])], st.tipo)}
    ${selectControl('fc-proc', tr('Procedimiento', 'Procediment', 'Procedure'), [...A, ...codes('procedimiento').filter((k) => usedProcs.includes(k)).map((k) => [k, label('procedimiento', k)])], st.proc)}</div></details></form>`);
  form.querySelector('.more-filters').open = matchMedia('(min-width: 768px)').matches;
  const tabs = h(`<div class="tabs" role="tablist" aria-label="${esc(tr('Vistas de la contratación', 'Vistes de la contractació', 'Procurement views'))}">
    ${[['lista', tr('Contratos', 'Contractes', 'Contracts')], ['estadisticas', tr('Estadísticas', 'Estadístiques', 'Statistics')], ['riesgo', tr('Indicadores de riesgo', 'Indicadors de risc', 'Risk indicators')]].map(([k, l]) => `<button type="button" role="tab" id="tab-${k}" aria-controls="panel-c" aria-selected="${st.vista === k}" tabindex="${st.vista === k ? 0 : -1}" data-vista="${k}">${l}</button>`).join('')}</div>`);
  const summary = h('<div></div>');
  const panel = h('<div id="panel-c" role="tabpanel" class="tab-panel" tabindex="0"></div>');
  el.append(form, summary, tabs, panel);
  const norm = (s_) => String(s_ ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const filtered = () => all.filter((c) => (!st.anio || (c.fecha_adjudicacion || '').startsWith(st.anio)) && (!st.tipo || c.tipo === st.tipo) && (!st.proc || c.procedimiento === st.proc) && (!st.q || norm(`${c.objeto} ${c.adjudicatario} ${c.adjudicatario_nif} ${c.id} ${c.expediente}`).includes(norm(st.q))));
  const showDetail = (c) => {
    const baja = c.presupuesto_base_sin_iva && c.importe_adjudicacion_sin_iva ? (1 - c.importe_adjudicacion_sin_iva / c.presupuesto_base_sin_iva) * 100 : null;
    const fact = (k, v) => `<div><dt>${k}</dt><dd>${v ?? '—'}</dd></div>`;
    const dlg = modal(tr('Contrato', 'Contracte', 'Contract'), `
      <p class="contract-subject">${esc(c.objeto)}</p>
      <div class="contract-headline"><div><span class="contract-amount">${c.importe_adjudicacion_sin_iva ? fmt.eur2(c.importe_adjudicacion_sin_iva) : '—'}</span><span class="muted small">${tr('importe de adjudicación sin IVA', 'import d’adjudicació sense IVA', 'award value excl. VAT')}${c.importe_adjudicacion_con_iva ? ` · ${fmt.eur2(c.importe_adjudicacion_con_iva)} ${tr('con IVA', 'amb IVA', 'incl. VAT')}` : ''}</span></div>
        <span class="badge badge-neutral">${label('estado_contrato', c.estado)}</span></div>
      <dl class="fact-grid">
        ${fact(tr('Adjudicatario', 'Adjudicatari', 'Supplier'), c.adjudicatario ? `${esc(c.adjudicatario)}<br><span class="muted small">NIF ${esc(c.adjudicatario_nif || '—')}${c.adjudicatario_pyme ? ' · PYME' : ''}</span>` : '—')}
        ${fact(tr('Procedimiento', 'Procediment', 'Procedure'), `${label('procedimiento', c.procedimiento)}${c.numero_ofertas ? `<br><span class="muted small">${c.numero_ofertas} ${c.numero_ofertas === 1 ? tr('oferta recibida', 'oferta rebuda', 'bid received') : tr('ofertas recibidas', 'ofertes rebudes', 'bids received')}</span>` : ''}`)}
        ${fact(tr('Tipo de contrato', 'Tipus de contracte', 'Contract type'), label('tipo_contrato', c.tipo))}
        ${fact(tr('Órgano que contrata', 'Òrgan que contracta', 'Contracting body'), esc(c.organo || '—'))}
        ${fact(tr('Fecha de adjudicación', 'Data d’adjudicació', 'Award date'), fmt.full(c.fecha_adjudicacion))}
        ${fact(tr('Fecha de formalización', 'Data de formalització', 'Signature date'), c.fecha_formalizacion ? fmt.full(c.fecha_formalizacion) : '—')}
        ${fact(tr('Duración', 'Durada', 'Duration'), c.duracion_meses ? `${fmt.dec(c.duracion_meses, 0)} ${tr('meses', 'mesos', 'months')}` : '—')}
        ${fact(tr('Presupuesto de licitación', 'Pressupost de licitació', 'Tender budget'), c.presupuesto_base_sin_iva ? `${fmt.eur(c.presupuesto_base_sin_iva)}${baja !== null ? `<br><span class="muted small">${tr('Rebaja', 'Rebaixa', 'Discount')}: ${fmt.pct(baja)}</span>` : ''}` : '—')}
        ${fact(tr('Qué se contrata (CPV)', 'Què es contracta (CPV)', 'What (CPV)'), c.cpv ? `${label('cpv', c.cpv)}<br><span class="muted small">${esc(c.cpv)}</span>` : '—')}
        ${fact(tr('Expediente', 'Expedient', 'File'), esc(c.expediente || '—'))}
      </dl>
      <h3 class="fact-h">${tr('Fuente y datos', 'Font i dades', 'Source and data')}</h3>
      <p class="muted small">${t('source')}: ${label('fuente', c.fuente)}</p>
      <div class="modal-actions">${c.url ? `<a class="btn" href="${esc(c.url)}" rel="noopener">${tr('Ver en la Plataforma de Contratación', 'Veure en la Plataforma de Contractació', 'View on the Procurement Platform')} ${icon('external', 16)}</a>` : ''}
        <button type="button" class="btn-ghost" data-ocds>${icon('code', 16)} OCDS (JSON)</button><button type="button" class="btn-ghost" data-link>${icon('link', 16)} ${tr('Copiar enlace', 'Copiar enllaç', 'Copy link')}</button></div>`);
    dlg.querySelector('[data-ocds]').addEventListener('click', () => download(`${c.id}.ocds.json`, JSON.stringify(toOCDS(c, ent), null, 2), 'application/json'));
    dlg.querySelector('[data-link]').addEventListener('click', async (e) => { try { await navigator.clipboard.writeText(`${location.href.split('#')[0]}#/contratos?q=${encodeURIComponent(c.id)}`); e.currentTarget.textContent = tr('Enlace copiado', 'Enllaç copiat', 'Link copied'); } catch { /* */ } });
  };
  const sync = () => { setQ({ anio: st.anio, tipo: st.tipo, proc: st.proc, q: st.q, vista: st.vista === 'lista' ? '' : st.vista }); };
  const update = () => { sync(); draw(); flushCharts(); };
  const draw = () => {
    const f = filtered();
    const adj = f.filter((c) => c.importe_adjudicacion_sin_iva);
    const imp = sum(adj, (c) => c.importe_adjudicacion_sin_iva);
    // Resumen con chips de filtros activos
    const chips = [
      ...(st.q ? [{ label: `«${st.q}»`, onRemove: () => { st.q = ''; form.querySelector('#fc-q').value = ''; update(); } }] : []),
      ...(st.anio ? [{ label: st.anio, onRemove: () => { st.anio = ''; form.querySelector('#fc-anio').value = ''; update(); } }] : []),
      ...(st.tipo ? [{ label: label('tipo_contrato', st.tipo), onRemove: () => { st.tipo = ''; form.querySelector('#fc-tipo').value = ''; update(); } }] : []),
      ...(st.proc ? [{ label: label('procedimiento', st.proc), onRemove: () => { st.proc = ''; form.querySelector('#fc-proc').value = ''; update(); } }] : []),
    ];
    const clear = () => { Object.assign(st, { anio: '', tipo: '', proc: '', q: '' }); form.querySelectorAll('select').forEach((x) => (x.value = '')); form.querySelector('#fc-q').value = ''; update(); };
    const nf = [st.anio, st.tipo, st.proc].filter(Boolean).length; form.querySelector('[data-nf]').textContent = nf || ''; form.querySelector('[data-nf]').hidden = !nf;
    summary.replaceChildren(filterSummary({ count: f.length, noun: f.length === 1 ? tr('contrato', 'contracte', 'contract') : tr('contratos', 'contractes', 'contracts'), chips, onClear: clear, clearAlways: true,
      extra: h(`<p class="summary-figures"><span><strong>${fmt.eurC(imp)}</strong> ${tr('adjudicados sin IVA', 'adjudicats sense IVA', 'awarded excl. VAT')}</span><span><strong>${fmt.int(new Set(adj.map((c) => c.adjudicatario_nif)).size)}</strong> ${tr('empresas', 'empreses', 'companies')}</span><span><strong>${fmt.int(f.filter((c) => c.procedimiento === '6').length)}</strong> ${tr('contratos menores', 'contractes menors', 'minor contracts')}</span></p>`) }));
    tabs.querySelectorAll('[role="tab"]').forEach((b) => { const on = b.dataset.vista === st.vista; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    panel.setAttribute('aria-labelledby', `tab-${st.vista}`);
    panel.innerHTML = '';
    if (!f.length) { panel.appendChild(emptyState(tr('No hemos encontrado contratos con estos filtros.', 'No hem trobat contractes amb aquests filtres.', 'No contracts match these filters.'), '', [{ label: tr('Limpiar filtros', 'Netejar filtres', 'Clear filters'), onClick: clear, primary: true }])); return; }
    if (st.vista === 'lista') {
      const tbl = dataTable({ caption: tr('Contratos', 'Contractes', 'Contracts'), rows: f, pageSize: 20, onRow: showDetail, sortKey: 'fecha_adjudicacion', sortDir: -1, columns: [
        { key: 'objeto', label: tr('Contrato', 'Contracte', 'Contract'), width: '40%', html: true, format: (v, c) => `<span class="cell-strong">${esc(v)}</span><span class="cell-sub">${label('procedimiento', c.procedimiento)}</span>` },
        { key: 'adjudicatario', label: tr('Adjudicatario', 'Adjudicatari', 'Supplier') },
        { key: 'fecha_adjudicacion', label: tr('Fecha', 'Data', 'Date'), format: fmt.date },
        { key: 'importe_adjudicacion_sin_iva', label: tr('Importe sin IVA', 'Import sense IVA', 'Value ex VAT'), align: 'right', format: (v) => (v ? fmt.eur(v) : '—') }] });
      panel.appendChild(tbl);
      panel.appendChild(h(`<p class="table-foot">${tr('Pulsa un contrato para ver su ficha.', 'Prem un contracte per a veure’n la fitxa.', 'Select a contract to see its details.')} · <button type="button" class="link-btn" data-export>${icon('download', 14)} ${tr('Descargar esta selección (CSV)', 'Descarregar aquesta selecció (CSV)', 'Download this selection (CSV)')}</button></p>`));
      panel.querySelector('[data-export]').addEventListener('click', () => download('contratos-seleccion.csv', '﻿' + toCSV(Object.keys(f[0] || {}).map((k) => ({ key: k, label: k })), f), 'text/csv;charset=utf-8'));
    } else if (st.vista === 'estadisticas') {
      const grid = h('<div class="chart-grid"></div>');
      panel.appendChild(grid);
      const years = anios.slice().reverse();
      const tipos = [...new Set(adj.map((c) => c.tipo))];
      const series = tipos.map((tp, i) => ({ name: label('tipo_contrato', tp), color: SERIES[i], values: years.map((y) => sum(adj.filter((c) => c.tipo === tp && (c.fecha_adjudicacion || '').startsWith(y)), (c) => c.importe_adjudicacion_sin_iva)) }));
      grid.appendChild(chartCard({ title: tr('¿Cuánto se contrata cada año?', 'Quant es contracta cada any?', 'How much is contracted each year?'), subtitle: tr('Importe adjudicado sin IVA, por tipo de contrato', 'Import adjudicat sense IVA, per tipus de contracte', 'Value awarded excl. VAT, by contract type'), file: 'contratos-anual', dataset: 'contratos', datasetTitle: ds, wide: true, level: 2,
        draw: (b) => columns(b, { categories: years, series, stacked: true, format: fmt.eur, axisFormat: fmt.eurC }), table: { columns: [{ key: 'y', label: tr('Año', 'Any', 'Year') }, ...series.map((s_, i) => ({ key: 's' + i, label: s_.name, align: 'right', format: fmt.eur }))], rows: years.map((y, yi) => Object.fromEntries([['y', y], ...series.map((s_, i) => ['s' + i, s_.values[yi]])])) } }));
      const byProc = [...groupBy(adj, (c) => c.procedimiento)].map(([k, v]) => ({ key: k, label: label('procedimiento', k), value: sum(v, (c) => c.importe_adjudicacion_sin_iva), color: PROC_COLOR[k] || SERIES[7], note: `${v.length} ${tr('contratos', 'contractes', 'contracts')}` })).sort((a, b) => b.value - a.value);
      grid.appendChild(chartCard({ title: tr('¿Cómo se adjudica?', 'Com s’adjudica?', 'How is it awarded?'), subtitle: tr('Importe por procedimiento · pulsa para filtrar', 'Import per procediment · prem per a filtrar', 'Value by procedure · click to filter'), file: 'contratos-procedimiento', dataset: 'contratos', datasetTitle: ds, level: 2,
        draw: (b) => hBar(b, { data: byProc, format: fmt.eurC, onClick: (d) => { st.proc = d.key; form.querySelector('#fc-proc').value = d.key; st.vista = 'lista'; update(); } }), table: { columns: [{ key: 'label', label: tr('Procedimiento', 'Procediment', 'Procedure') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byProc } }));
      const byEmp = [...groupBy(adj, (c) => c.adjudicatario || '—')].map(([k, v]) => ({ label: k, value: sum(v, (c) => c.importe_adjudicacion_sin_iva), note: `${v.length} ${tr('contratos', 'contractes', 'contracts')}` })).sort((a, b) => b.value - a.value);
      grid.appendChild(chartCard({ title: tr('¿A quién se adjudica?', 'A qui s’adjudica?', 'Who wins contracts?'), subtitle: tr('Las 10 empresas con más importe', 'Les 10 empreses amb més import', 'Top 10 companies by value'), file: 'contratos-adjudicatarios', dataset: 'contratos', datasetTitle: ds, level: 2,
        draw: (b) => hBar(b, { data: byEmp.slice(0, 10), format: fmt.eurC, maxLabel: 240, onClick: (d) => { st.q = d.label; form.querySelector('#fc-q').value = d.label; st.vista = 'lista'; update(); } }), table: { columns: [{ key: 'label', label: tr('Empresa', 'Empresa', 'Company') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byEmp } }));
      const byCpv = [...groupBy(adj.filter((c) => c.cpv), (c) => c.cpv)].map(([k, v]) => ({ label: label('cpv', k), value: sum(v, (c) => c.importe_adjudicacion_sin_iva) })).sort((a, b) => b.value - a.value);
      grid.appendChild(chartCard({ title: tr('¿Qué se contrata?', 'Què es contracta?', 'What is contracted?'), subtitle: tr('Importe por tipo de bien o servicio (CPV), 10 principales', 'Import per tipus de bé o servei (CPV), 10 principals', 'Value by goods/service type (CPV), top 10'), file: 'contratos-cpv', dataset: 'contratos', datasetTitle: ds, level: 2,
        draw: (b) => hBar(b, { data: byCpv.slice(0, 10), format: fmt.eurC, color: SERIES[2] }), table: { columns: [{ key: 'label', label: 'CPV' }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: byCpv } }));
    } else {
      const noMen = adj.filter((c) => c.procedimiento !== '6');
      const unica = adj.filter((c) => ['1', '9'].includes(c.procedimiento) && c.numero_ofertas === 1);
      const fracc = [...groupBy(adj.filter((c) => c.procedimiento === '6'), (c) => `${c.adjudicatario_nif}|${c.cpv}|${(c.fecha_adjudicacion || '').slice(0, 4)}`)].map(([k, v]) => ({ k, v, total: sum(v, (c) => c.importe_adjudicacion_sin_iva) })).filter((g) => g.v.length > 1 && g.total > (UMBRAL_MENOR[g.v[0].tipo] || UMBRAL_MENOR.default));
      const byEmp = [...groupBy(adj, (c) => c.adjudicatario || '—')].map(([k, v]) => ({ k, value: sum(v, (c) => c.importe_adjudicacion_sin_iva) }));
      const conc = byEmp.filter((d) => d.value / imp > 0.1);
      panel.appendChild(h(`<div class="callout callout-info">${icon('info', 20)}<div><p>${tr('Son señales calculadas automáticamente para facilitar el control ciudadano. <strong>No implican ninguna irregularidad</strong>: indican dónde conviene mirar con más detalle.', 'Són senyals calculats automàticament per a facilitar el control ciutadà. <strong>No impliquen cap irregularitat</strong>: indiquen on convé mirar amb més detall.', 'These are automatic signals to support public scrutiny. <strong>They do not imply wrongdoing</strong>: they show where to look more closely.')}</p></div></div>`));
      const li = (n, ti, de, lvl, key) => `<li class="alert alert-${n ? lvl : 'good'}"><span class="alert-n">${n}</span><div><strong>${ti}</strong><p>${de}</p>${n && key ? `<button type="button" class="link-btn" data-alert="${key}">${tr('Ver los contratos', 'Veure els contractes', 'See the contracts')} ↓</button>` : ''}</div></li>`;
      panel.appendChild(h(`<ul class="alert-grid">
        ${li(unica.length, tr('Procedimientos abiertos con una sola oferta', 'Procediments oberts amb una sola oferta', 'Open procedures with a single bid'), tr('Puede indicar poca competencia.', 'Pot indicar poca competència.', 'May signal low competition.'), 'warning', 'unica')}
        ${li(fracc.length, tr('Posible fraccionamiento de contratos menores', 'Possible fraccionament de contractes menors', 'Possible split minor contracts'), tr('Misma empresa y objeto en un año por encima del límite legal.', 'Mateixa empresa i objecte en un any per damunt del límit legal.', 'Same company and object in a year above the legal limit.'), 'serious', 'fracc')}
        ${li(conc.length, tr('Empresas con más del 10 % del importe', 'Empreses amb més del 10 % de l’import', 'Companies above 10% of value'), tr('Concentración en pocos proveedores.', 'Concentració en pocs proveïdors.', 'Concentration on few suppliers.'), 'warning', null)}
        ${li(noMen.length ? Math.round((sum(noMen, (c) => c.numero_ofertas || 0) / noMen.length) * 10) / 10 : 0, tr('Ofertas por licitación (media)', 'Ofertes per licitació (mitjana)', 'Average bids per tender'), tr('Excluye contratos menores. Más ofertas suele indicar más competencia.', 'Exclou contractes menors. Més ofertes sol indicar més competència.', 'Excludes minor contracts. More bids usually means more competition.'), 'good', null)}</ul><div data-alert-table></div>`));
      panel.querySelectorAll('[data-alert]').forEach((b) => b.addEventListener('click', () => {
        const rows_ = b.dataset.alert === 'unica' ? unica : fracc.flatMap((g) => g.v);
        panel.querySelector('[data-alert-table]').replaceChildren(dataTable({ caption: b.closest('li').querySelector('strong').textContent, rows: rows_, pageSize: 20, onRow: showDetail, columns: [{ key: 'objeto', label: tr('Contrato', 'Contracte', 'Contract') }, { key: 'adjudicatario', label: tr('Adjudicatario', 'Adjudicatari', 'Supplier') }, { key: 'fecha_adjudicacion', label: tr('Fecha', 'Data', 'Date'), format: fmt.date }, { key: 'importe_adjudicacion_sin_iva', label: tr('Importe', 'Import', 'Value'), align: 'right', format: fmt.eur }] }));
      }));
    }
    const exact = all.find((c) => c.id === st.q);
    if (exact && !draw.opened) { draw.opened = true; setTimeout(() => showDetail(exact), 200); }
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-vista]'); if (b) { st.vista = b.dataset.vista; update(); b.focus(); } });
  tabs.addEventListener('keydown', (e) => {
    const ks = ['lista', 'estadisticas', 'riesgo']; const i = ks.indexOf(st.vista);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { st.vista = ks[(i + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; update(); tabs.querySelector(`[data-vista="${st.vista}"]`).focus(); }
  });
  ['anio', 'tipo', 'proc'].forEach((k) => form.querySelector(`#fc-${k}`).addEventListener('change', (e) => { st[k] = e.target.value; update(); }));
  let deb; form.querySelector('#fc-q').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value.trim(); update(); }, 250); });
  draw();
}

// ============================================================================ ÍNDICE
// El estado se calcula a partir de las evidencias (compliance.js); isStale y score
// se mantienen por compatibilidad con bloques y extensiones existentes.
const MAX_DIAS = C.MAX_DIAS;
export const isStale = (o, hoy = new Date()) => o.estado === 'publicado' && o.ultima_actualizacion && (hoy - new Date(o.ultima_actualizacion + 'T00:00:00Z')) / 864e5 > MAX_DIAS[o.periodicidad];
export const score = (ev) => C.score(ev[0] && 'estado_calc' in ev[0] ? ev : ev.map((o) => ({ ...o, estado_calc: isStale(o) ? 'desactualizada' : o.estado })));
async function indice(el) {
  const ev = await C.obligaciones();
  const sc = C.score(ev);
  const stat = (n, txt, cls, ic) => `<div class="status-stat status-${cls}">${icon(ic, 22)}<span class="status-n">${n}</span><span>${txt}</span></div>`;
  el.innerHTML = `<div class="callout callout-info">${icon('info', 20)}<div><p>${tr('Esta página explica qué información obliga a publicar la normativa de transparencia y si el Ayuntamiento la tiene publicada y al día. Es información de control: <strong>si buscas un dato concreto, usa el buscador o los temas</strong>.', 'Aquesta pàgina explica quina informació obliga a publicar la normativa de transparència i si l’Ajuntament la té publicada i al dia. És informació de control: <strong>si busques una dada concreta, usa el cercador o els temes</strong>.', 'This page explains what transparency law requires to be published and whether it is published and up to date. It is a control tool: <strong>to find specific information, use search or topics</strong>.')}</p></div></div>
    <section><h2 class="section-title">${tr('¿Está publicada la información?', 'Està publicada la informació?', 'Is the information published?')}</h2>
      <div class="status-stats">${stat(sc.counts.publicado, tr('Disponibles y al día', 'Disponibles i al dia', 'Available and up to date'), 'good', 'ok')}${stat(sc.counts.desactualizada, tr('Disponibles, pendientes de actualizar', 'Disponibles, pendents d’actualitzar', 'Available, need updating'), 'serious', 'clock')}${stat(sc.counts.parcial, tr('Incompletas', 'Incompletes', 'Incomplete'), 'warning', 'alert')}${stat(sc.counts.pendiente, tr('Pendientes de publicar', 'Pendents de publicar', 'Not yet published'), 'critical', 'alert')}</div>
      <p class="muted small">${tr(`Índice de cumplimiento: <strong>${fmt.dec(sc.total, 0)} %</strong> (al día = 1 punto, pendiente de actualizar = 0,75, incompleta = 0,5, pendiente = 0; ${sc.n} obligaciones evaluadas). El estado se calcula automáticamente con la fecha de la última actualización de cada página y conjunto de datos y la periodicidad exigida.`, `Índex de compliment: <strong>${fmt.dec(sc.total, 0)} %</strong> (al dia = 1 punt, pendent d’actualitzar = 0,75, incompleta = 0,5, pendent = 0; ${sc.n} obligacions avaluades). L’estat es calcula automàticament amb la data de l’última actualització de cada pàgina i conjunt de dades i la periodicitat exigida.`, `Compliance index: <strong>${fmt.dec(sc.total, 0)}%</strong> (up to date = 1, needs updating = 0.75, incomplete = 0.5, pending = 0; ${sc.n} obligations assessed). Status is computed automatically from the last update of each page and dataset and the required frequency.`)}</p></section>
    <section><h2 class="section-title">${tr('Por temas', 'Per temes', 'By topic')}</h2><ul class="meter-list">${sc.byBloque.map((b) => `<li><span class="ml-label">${label('bloque_obligacion', b.bloque)}</span><span class="ml-val">${fmt.dec(b.score, 0)} %</span>${meter(b.score, { labelText: `${label('bloque_obligacion', b.bloque)}: ${fmt.dec(b.score, 0)} %` })}</li>`).join('')}</ul></section>`;
  const card = h(`<section><h2 class="section-title">${tr('Detalle técnico: obligación, fundamento, estado y evidencia', 'Detall tècnic: obligació, fonament, estat i evidència', 'Technical detail: obligation, legal basis, status and evidence')}</h2></section>`);
  const ORD = { no_aplica: -1, pendiente: 0, parcial: 0.5, desactualizada: 0.75, publicado: 1 };
  card.appendChild(dataTable({ caption: tr('Obligaciones', 'Obligacions', 'Obligations'), rows: ev, pageSize: 60, columns: [
    { key: 'titulo', label: tr('Obligación', 'Obligació', 'Obligation') },
    { key: 'norma', label: tr('Fundamento', 'Fonament', 'Legal basis'), format: (v, o) => `${v}, ${o.articulo}` },
    { key: 'estado_calc', label: tr('Estado', 'Estat', 'Status'), html: true, format: (v, o) => `${statusBadge(v)}${o.automatico ? `<span class="muted small obl-why">${esc(C.motivoTexto(o, tr, fmt.date))}</span>` : ''}`, sortValue: (o) => ORD[o.estado_calc] ?? 0 },
    { key: 'evidencia', label: t('updated'), format: (v, o) => (v ? `${fmt.date(v)} · ${label('periodicidad', o.periodicidad)}` : label('periodicidad', o.periodicidad)) },
    { key: 'pagina', label: tr('Evidencia', 'Evidència', 'Evidence'), html: true, format: (v) => `<a href="#/${v}">${tr('Ver dónde se publica', 'Veure on es publica', 'See where it is published')}</a>` }] }));
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
  el.innerHTML = `<header class="page-header"><nav class="breadcrumb" aria-label="${esc(tr('Estás aquí', 'Estàs ací', 'You are here'))}"><ol><li><a href="#/">${t('home')}</a></li><li><a href="#/datos-abiertos">${tr('Datos abiertos', 'Dades obertes', 'Open data')}</a></li><li><span aria-current="page">${esc(pick(d.titulo))}</span></li></ol></nav>
    <h1 id="page-title" tabindex="-1">${esc(pick(d.titulo))}</h1><p class="lead">${esc(pick(d.descripcion))}</p></header>
    <div class="two-col"><section class="card"><h2 class="block-title">${tr('Descarga y API', 'Descàrrega i API', 'Download & API')}</h2>
      <p><a class="btn" href="data/csv/${id}.csv" download>${icon('download', 16)} CSV</a> <a class="btn" href="data/${id}.json">${icon('download', 16)} JSON</a> <a class="btn-ghost" href="#/${d.pagina}">${icon('chart', 16)} ${tr('Ver en el portal', 'Veure en el portal', 'See on the portal')}</a></p>
      <p class="label-sm">API REST</p><pre><code>curl -s ${esc(j)}</code></pre>
      <p class="label-sm">Python</p><pre><code>import pandas as pd
df = pd.read_csv("${esc(c)}")</code></pre></section>
    <section class="card"><h2 class="block-title">${tr('Metadatos', 'Metadades', 'Metadata')}</h2>${definitionList([
      [tr('Identificador', 'Identificador', 'Identifier'), `<code>${id}</code>`], [t('records'), fmt.int((env.datos || []).length)], [t('source'), d.fuente.url ? `<a href="${esc(d.fuente.url)}">${esc(d.fuente.nombre)}</a>` : esc(d.fuente.nombre)], [tr('Responsable', 'Responsable', 'Owner'), esc(pick(d.responsable) || '—')],
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
