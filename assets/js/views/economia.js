import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, delta, chartCard, dataTable, selectControl, icon, flushCharts } from '../ui.js';
import { sankey, treemap, columns, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

export const PROGRAM_COLOR = { P1: SERIES[0], P2: SERIES[1], P3: SERIES[2], P4: SERIES[3], P5: SERIES[4], P6: SERIES[5] };
export const PROGRAM_INK = { P4: '#0b0b0b' };

export default async function render(root, { query }) {
  const pres = await rows('pressupost');
  const dsName = await dsTitle('pressupost');
  const anys = [...new Set(pres.map((r) => r.any))].sort();
  let any = Number(query.get('any')) || anys[anys.length - 1];

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'euro', title: t('nav_economia'), intro: t('intro_economia') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);
  c.appendChild(h(`<div class="filters" role="group" aria-label="${t('filters')}">${selectControl('f-any', tr('Exercici', 'Ejercicio', 'Fiscal year'), anys.slice().reverse().map((a) => [a, a]), any)}</div>`));
  const out = h('<div></div>');
  c.appendChild(out);

  const draw = () => {
    out.innerHTML = '';
    const yr = pres.filter((r) => r.any === any);
    const prev = pres.filter((r) => r.any === any - 1);
    const enCurs = yr[0]?.estat === 'en_execucio';
    const I = (set, k) => sum(set.filter((r) => r.tipus === 'ingres'), (r) => r[k]);
    const D = (set, k) => sum(set.filter((r) => r.tipus === 'despesa'), (r) => r[k]);
    const execPct = (D(yr, 'executat') / D(yr, 'definitiu')) * 100;
    const resultat = I(yr, 'executat') - D(yr, 'executat');
    const personal = sum(yr.filter((r) => r.tipus === 'despesa' && r.capitol === '1'), (r) => r.executat);

    if (enCurs) out.appendChild(h(`<p class="notice">${icon('info', 18)} ${tr(`Exercici en curs: execució acumulada a 30 de setembre de ${any}.`, `Ejercicio en curso: ejecución acumulada a 30 de septiembre de ${any}.`, `Current year: execution to 30 September ${any}.`)}</p>`));

    out.appendChild(kpiRow([
      { label: tr('Pressupost d’ingressos (definitiu)', 'Presupuesto de ingresos (definitivo)', 'Revenue budget (final)'), value: fmt.eurC(I(yr, 'definitiu')), ...delta(I(yr, 'definitiu'), I(prev, 'definitiu')), context: `${tr('vs.', 'vs.', 'vs.')} ${any - 1}` },
      { label: tr('Pressupost de despeses (definitiu)', 'Presupuesto de gastos (definitivo)', 'Expenditure budget (final)'), value: fmt.eurC(D(yr, 'definitiu')), ...delta(D(yr, 'definitiu'), D(prev, 'definitiu')), context: `${tr('vs.', 'vs.', 'vs.')} ${any - 1}` },
      { label: tr('Grau d’execució de la despesa', 'Grado de ejecución del gasto', 'Expenditure execution rate'), value: fmt.pct(execPct), context: tr('obligacions reconegudes / crèdit definitiu', 'obligaciones reconocidas / crédito definitivo', 'obligations / final budget') },
      { label: enCurs ? tr('Saldo a data de tall', 'Saldo a fecha de corte', 'Balance to date') : tr('Resultat pressupostari', 'Resultado presupuestario', 'Budget outturn'), value: fmt.eurC(resultat), context: tr('drets – obligacions reconeguts', 'derechos – obligaciones reconocidos', 'revenue – expenditure recognised') },
      { label: tr('Pes de la despesa de personal', 'Peso del gasto de personal', 'Staff cost share'), value: fmt.pct((personal / D(yr, 'executat')) * 100), context: tr('capítol 1 sobre despesa executada', 'capítulo 1 sobre gasto ejecutado', 'chapter 1 over executed spend') },
    ]));

    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    const basis = enCurs ? 'definitiu' : 'executat';
    const basisTxt = enCurs ? tr('pressupost definitiu', 'presupuesto definitivo', 'final budget') : tr('import liquidat', 'importe liquidado', 'outturn');

    // Sankey: d'on surt i on va cada euro
    const ing = codes('capitol_ingres').map((cap, i) => ({ key: cap, name: label('capitol_ingres', cap), value: sum(yr.filter((r) => r.tipus === 'ingres' && r.capitol === cap), (r) => r[basis]), color: `var(--seq-${7 - i * 2 > 1 ? 7 - i * 2 : 2})` })).filter((d) => d.value > 0);
    const prog = codes('programa').map((p) => ({ key: p, name: label('programa', p), value: sum(yr.filter((r) => r.tipus === 'despesa' && r.programa === p), (r) => r[basis]), color: PROGRAM_COLOR[p], ink: PROGRAM_INK[p] })).filter((d) => d.value > 0);
    grid.appendChild(chartCard({
      title: tr(`D’on surten i on van els diners (${any})`, `De dónde salen y adónde van los fondos (${any})`, `Where the money comes from and goes (${any})`),
      subtitle: `${tr('Ingressos per capítol → despesa per programa', 'Ingresos por capítulo → gasto por programa', 'Revenue by chapter → spending by programme')} · ${basisTxt}`,
      full: true, file: `pressupost-fluxos-${any}`, dataset: 'pressupost', datasetTitle: dsName,
      draw: (el) => sankey(el, { left: ing, right: prog, format: fmt.eurC, centerLabel: fmt.eurC(sum(ing, (d) => d.value)), sideLabels: { L: tr('Ingrés', 'Ingreso', 'Revenue'), R: tr('Despesa', 'Gasto', 'Spending') }, ariaLabel: tr('Diagrama de flux del pressupost', 'Diagrama de flujo del presupuesto', 'Budget flow diagram') }),
      table: { columns: [{ key: 'tipus', label: tr('Tipus', 'Tipo', 'Type') }, { key: 'name', label: tr('Concepte', 'Concepto', 'Item') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: [...ing.map((d) => ({ ...d, tipus: tr('Ingrés', 'Ingreso', 'Revenue') })), ...prog.map((d) => ({ ...d, tipus: tr('Despesa', 'Gasto', 'Spending') }))] },
    }));

    grid.appendChild(chartCard({
      title: tr('Despesa per programa', 'Gasto por programa', 'Spending by programme'),
      subtitle: `${any} · ${basisTxt}`,
      file: `despesa-programes-${any}`, dataset: 'pressupost', datasetTitle: dsName,
      draw: (el) => treemap(el, { data: prog, format: fmt.eurC, ariaLabel: tr('Mapa d’arbre de despesa per programa', 'Mapa de árbol de gasto por programa', 'Treemap of spending by programme') }),
      table: { columns: [{ key: 'name', label: tr('Programa', 'Programa', 'Programme') }, { key: 'value', label: 'EUR', align: 'right', format: fmt.eur }], rows: prog },
    }));

    const caps = codes('capitol_despesa').filter((cap) => yr.some((r) => r.tipus === 'despesa' && r.capitol === cap));
    const capRows = caps.map((cap) => {
      const set = yr.filter((r) => r.tipus === 'despesa' && r.capitol === cap);
      return { cap, name: `${tr('Cap.', 'Cap.', 'Ch.')} ${cap} · ${label('capitol_despesa', cap)}`, inicial: sum(set, (r) => r.inicial), definitiu: sum(set, (r) => r.definitiu), executat: sum(set, (r) => r.executat) };
    });
    grid.appendChild(chartCard({
      title: tr('Execució per capítol de despesa', 'Ejecución por capítulo de gasto', 'Execution by spending chapter'),
      subtitle: tr('Crèdit definitiu i obligacions reconegudes', 'Crédito definitivo y obligaciones reconocidas', 'Final budget and recognised obligations'),
      file: `execucio-capitols-${any}`, dataset: 'pressupost', datasetTitle: dsName,
      draw: (el) => columns(el, {
        categories: capRows.map((r) => `${tr('Cap.', 'Cap.', 'Ch.')} ${r.cap}`),
        series: [{ name: tr('Definitiu', 'Definitivo', 'Final budget'), values: capRows.map((r) => r.definitiu), color: 'var(--seq-3)' }, { name: tr('Executat', 'Ejecutado', 'Executed'), values: capRows.map((r) => r.executat), color: 'var(--seq-6)' }],
        format: fmt.eur, axisFormat: fmt.eurC, ariaLabel: tr('Execució per capítol', 'Ejecución por capítulo', 'Execution by chapter'),
      }),
      table: { columns: [{ key: 'name', label: tr('Capítol', 'Capítulo', 'Chapter') }, { key: 'inicial', label: tr('Inicial', 'Inicial', 'Initial'), align: 'right', format: fmt.eur }, { key: 'definitiu', label: tr('Definitiu', 'Definitivo', 'Final'), align: 'right', format: fmt.eur }, { key: 'executat', label: tr('Executat', 'Ejecutado', 'Executed'), align: 'right', format: fmt.eur }], rows: capRows },
    }));

    // Evolució plurianual
    const evo = anys.map((a) => {
      const s = pres.filter((r) => r.any === a);
      return { any: a, ingressos: I(s, 'executat'), despeses: D(s, 'executat'), pressupost: D(s, 'definitiu') };
    });
    grid.appendChild(chartCard({
      title: tr('Evolució d’ingressos i despeses liquidats', 'Evolución de ingresos y gastos liquidados', 'Revenue and spending outturn over time'),
      subtitle: `${anys[0]}–${anys[anys.length - 1]} · ${tr('2026 fins a setembre', '2026 hasta septiembre', '2026 to September')}`,
      wide: true, file: 'pressupost-evolucio', dataset: 'pressupost', datasetTitle: dsName,
      draw: (el) => columns(el, {
        categories: evo.map((e) => String(e.any)),
        series: [{ name: tr('Ingressos', 'Ingresos', 'Revenue'), values: evo.map((e) => e.ingressos) }, { name: tr('Despeses', 'Gastos', 'Spending'), values: evo.map((e) => e.despeses) }],
        format: fmt.eur, axisFormat: fmt.eurC,
      }),
      table: { columns: [{ key: 'any', label: tr('Any', 'Año', 'Year') }, { key: 'ingressos', label: tr('Ingressos', 'Ingresos', 'Revenue'), align: 'right', format: fmt.eur }, { key: 'despeses', label: tr('Despeses', 'Gastos', 'Spending'), align: 'right', format: fmt.eur }, { key: 'pressupost', label: tr('Pressupost despesa', 'Presupuesto gasto', 'Spending budget'), align: 'right', format: fmt.eur }], rows: evo },
    }));

    // Taula de detall
    const detall = yr.map((r) => ({ ...r, concepte: r.tipus === 'ingres' ? label('capitol_ingres', r.capitol) : label('capitol_despesa', r.capitol), prog: r.programa ? label('programa', r.programa) : '—', exec: (r.executat / r.definitiu) * 100 }));
    out.appendChild(h(`<h2 class="section-title">${tr('Detall pressupostari', 'Detalle presupuestario', 'Budget detail')} ${any}</h2>`));
    const card = h('<div class="card"></div>');
    card.appendChild(dataTable({
      caption: tr('Detall pressupostari', 'Detalle presupuestario', 'Budget detail'),
      columns: [
        { key: 'tipus', label: tr('Tipus', 'Tipo', 'Type'), format: (v) => (v === 'ingres' ? tr('Ingrés', 'Ingreso', 'Revenue') : tr('Despesa', 'Gasto', 'Spending')) },
        { key: 'prog', label: tr('Programa', 'Programa', 'Programme') },
        { key: 'capitol', label: tr('Cap.', 'Cap.', 'Ch.') },
        { key: 'concepte', label: tr('Concepte', 'Concepto', 'Item') },
        { key: 'inicial', label: tr('Inicial', 'Inicial', 'Initial'), align: 'right', format: fmt.eur },
        { key: 'definitiu', label: tr('Definitiu', 'Definitivo', 'Final'), align: 'right', format: fmt.eur },
        { key: 'executat', label: tr('Executat', 'Ejecutado', 'Executed'), align: 'right', format: fmt.eur },
        { key: 'exec', label: '% exec.', align: 'right', format: (v) => fmt.pct(v) },
      ],
      rows: detall, pageSize: 20,
    }));
    out.appendChild(card);
  };

  draw();
  c.querySelector('#f-any').addEventListener('change', (e) => { any = Number(e.target.value); setQuery({ any }); draw(); flushCharts(); });
}
