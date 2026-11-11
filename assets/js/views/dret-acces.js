import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, delta, chartCard, selectControl, icon, flushCharts } from '../ui.js';
import { columns, hBar, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

const SENTIT_COLOR = { estimacio: SERIES[0], estimacio_parcial: SERIES[2], desestimacio: SERIES[1], inadmissio: SERIES[3], desistiment: SERIES[4], en_tramit: SERIES[6] };

export default async function render(root, { query }) {
  const dai = await rows('dret-acces');
  const ds = await dsTitle('dret-acces');
  const anys = [...new Set(dai.map((d) => d.data_entrada.slice(0, 4)))].sort();
  let any = query.get('any') || String(Number(anys[anys.length - 1]) - 1);

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'inbox', title: t('nav_dret-acces'), intro: t('intro_dret-acces') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);

  const steps = [
    [tr('Presenta la sol·licitud', 'Presenta la solicitud', 'Submit your request'), tr('Per la seu electrònica, per correu o presencialment. No cal justificar el motiu.', 'Por la sede electrónica, por correo o presencialmente. No es necesario justificar el motivo.', 'Online, by email or in person. You do not need to give a reason.')],
    [tr('Tramitació', 'Tramitación', 'Processing'), tr('Si afecta terceres persones, se’ls dona audiència. Es pot demanar aclariment.', 'Si afecta a terceras personas, se les da audiencia. Se puede pedir aclaración.', 'Third parties affected are consulted. You may be asked to clarify.')],
    [tr('Resolució en un mes', 'Resolución en un mes', 'Decision within one month'), tr('Termini màxim d’un mes, prorrogable un mes més per volum o complexitat.', 'Plazo máximo de un mes, prorrogable un mes más por volumen o complejidad.', 'Maximum one month, extendable by one more for volume or complexity.')],
    [tr('Reclamació a la GAIP', 'Reclamación a la GAIP', 'Appeal to the GAIP'), tr('Si no hi estàs d’acord, pots reclamar gratuïtament a la Comissió de Garantia del Dret d’Accés.', 'Si no estás de acuerdo, puedes reclamar gratuitamente a la Comisión de Garantía del Derecho de Acceso.', 'If you disagree, you can appeal free of charge to the Access Guarantee Commission (GAIP).')],
  ];
  c.appendChild(h(`<section class="card how-to">
    <h2 class="card-title">${tr('Com sol·licitar informació pública', 'Cómo solicitar información pública', 'How to request public information')}</h2>
    <ol class="steps">${steps.map(([a, b], i) => `<li><span class="step-n">${i + 1}</span><div><strong>${a}</strong><p>${b}</p></div></li>`).join('')}</ol>
    <div class="how-actions">
      <a class="btn" href="https://seu.example.org/dret-acces" rel="noopener">${icon('external', 16)} ${tr('Presenta una sol·licitud', 'Presenta una solicitud', 'Submit a request')}</a>
      <a class="btn-ghost" href="https://www.gaip.cat" rel="noopener">GAIP ${icon('external', 14)}</a>
      <span class="muted small">${tr('Abans de sol·licitar-la, comprova si la informació ja és en aquest portal: fes servir el cercador.', 'Antes de solicitarla, comprueba si la información ya está en este portal: usa el buscador.', 'Before requesting, check whether the information is already on this portal: use the search.')}</span>
    </div></section>`));

  c.appendChild(h(`<h2 class="section-title">${tr('Estadístiques de sol·licituds', 'Estadísticas de solicitudes', 'Request statistics')}</h2>`));
  c.appendChild(h(`<div class="filters" role="group" aria-label="${t('filters')}">${selectControl('f-any', tr('Any', 'Año', 'Year'), anys.slice().reverse().map((a) => [a, a]), any)}</div>`));
  const out = h('<div></div>');
  c.appendChild(out);

  const draw = () => {
    out.innerHTML = '';
    const yr = dai.filter((d) => d.data_entrada.startsWith(any));
    const pv = dai.filter((d) => d.data_entrada.startsWith(String(any - 1)));
    const resolt = (s) => s.filter((d) => d.dies_resolucio != null);
    const avg = (s) => sum(resolt(s), (d) => d.dies_resolucio) / (resolt(s).length || 1);
    const estim = (s) => s.filter((d) => ['estimacio', 'estimacio_parcial'].includes(d.sentit_resolucio)).length / (resolt(s).length || 1) * 100;
    const dinsTermini = (s) => resolt(s).filter((d) => d.dies_resolucio <= 30).length / (resolt(s).length || 1) * 100;
    out.appendChild(kpiRow([
      { label: tr('Sol·licituds rebudes', 'Solicitudes recibidas', 'Requests received'), value: fmt.int(yr.length), ...delta(yr.length, pv.length), context: `${tr('vs.', 'vs.', 'vs.')} ${any - 1}` },
      { label: tr('Accés concedit', 'Acceso concedido', 'Access granted'), value: fmt.pct(estim(yr)), ...delta(estim(yr), pv.length ? estim(pv) : null, { pp: true }), context: tr('total o parcial', 'total o parcial', 'full or partial') },
      { label: tr('Temps mitjà de resposta', 'Tiempo medio de respuesta', 'Average response time'), value: `${fmt.dec(avg(yr))} ${tr('dies', 'días', 'days')}`, ...delta(avg(yr), pv.length ? avg(pv) : null, { invert: true }) },
      { label: tr('Resoltes dins de termini', 'Resueltas dentro de plazo', 'Resolved on time'), value: fmt.pct(dinsTermini(yr)), context: tr('≤ 30 dies', '≤ 30 días', '≤ 30 days') },
      { label: tr('Reclamacions a la GAIP', 'Reclamaciones a la GAIP', 'Appeals to GAIP'), value: fmt.int(yr.filter((d) => d.reclamacio_gaip).length) },
    ]));
    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    const sentits = codes('sentit_resolucio').filter((s) => dai.some((d) => d.sentit_resolucio === s));
    const series = sentits.map((s) => ({ name: label('sentit_resolucio', s), color: SENTIT_COLOR[s], values: anys.map((a) => dai.filter((d) => d.data_entrada.startsWith(a) && d.sentit_resolucio === s).length) }));
    grid.appendChild(chartCard({
      title: tr('Sol·licituds per any i sentit de la resolució', 'Solicitudes por año y sentido de la resolución', 'Requests by year and outcome'), subtitle: `${anys[0]}–${anys[anys.length - 1]}`,
      file: 'dai-sentit', dataset: 'dret-acces', datasetTitle: ds, wide: true,
      draw: (el) => columns(el, { categories: anys, series, stacked: true, format: fmt.int }),
      table: { columns: [{ key: 'a', label: tr('Any', 'Año', 'Year') }, ...series.map((s, i) => ({ key: 's' + i, label: s.name, align: 'right' }))], rows: anys.map((a, ai) => Object.fromEntries([['a', a], ...series.map((s, i) => ['s' + i, s.values[ai]])])) },
    }));
    const temes = codes('tema_dai').map((k) => ({ label: label('tema_dai', k), value: yr.filter((d) => d.tema === k).length })).filter((d) => d.value).sort((a, b) => b.value - a.value);
    grid.appendChild(chartCard({
      title: tr('Sobre què es pregunta', 'Sobre qué se pregunta', 'What people ask about'), subtitle: any,
      file: `dai-temes-${any}`, dataset: 'dret-acces', datasetTitle: ds,
      draw: (el) => hBar(el, { data: temes, format: fmt.int, color: SERIES[0], valueName: tr('Sol·licituds', 'Solicitudes', 'Requests') }),
      table: { columns: [{ key: 'label', label: tr('Tema', 'Tema', 'Topic') }, { key: 'value', label: 'N', align: 'right' }], rows: temes },
    }));
    const bins = ['0-5', '6-10', '11-15', '16-20', '21-25', '26-30', '31-40', '>40'];
    const binOf = (n) => (n <= 5 ? 0 : n <= 10 ? 1 : n <= 15 ? 2 : n <= 20 ? 3 : n <= 25 ? 4 : n <= 30 ? 5 : n <= 40 ? 6 : 7);
    const hist = bins.map((_, i) => resolt(yr).filter((d) => binOf(d.dies_resolucio) === i).length);
    grid.appendChild(chartCard({
      title: tr('Dies fins a la resolució', 'Días hasta la resolución', 'Days to decision'), subtitle: tr('Distribució; el termini legal és d’un mes', 'Distribución; el plazo legal es de un mes', 'Distribution; legal limit is one month'),
      file: `dai-dies-${any}`, dataset: 'dret-acces', datasetTitle: ds,
      draw: (el) => columns(el, { categories: bins, series: [{ name: tr('Sol·licituds', 'Solicitudes', 'Requests'), values: hist, color: SERIES[6] }], format: fmt.int }),
      table: { columns: [{ key: 'b', label: tr('Dies', 'Días', 'Days') }, { key: 'n', label: 'N', align: 'right' }], rows: bins.map((b, i) => ({ b, n: hist[i] })) },
    }));
    const sol = codes('tipus_sollicitant').map((k) => ({ label: label('tipus_sollicitant', k), value: yr.filter((d) => d.tipus_sollicitant === k).length })).filter((d) => d.value).sort((a, b) => b.value - a.value);
    grid.appendChild(chartCard({
      title: tr('Qui pregunta', 'Quién pregunta', 'Who asks'), subtitle: any,
      file: `dai-sollicitants-${any}`, dataset: 'dret-acces', datasetTitle: ds,
      draw: (el) => hBar(el, { data: sol, format: fmt.int, color: SERIES[2], valueName: tr('Sol·licituds', 'Solicitudes', 'Requests') }),
      table: { columns: [{ key: 'label', label: tr('Tipus', 'Tipo', 'Type') }, { key: 'value', label: 'N', align: 'right' }], rows: sol },
    }));
  };
  draw();
  c.querySelector('#f-any').addEventListener('change', (e) => { any = e.target.value; setQuery({ any }); draw(); flushCharts(); });
}
