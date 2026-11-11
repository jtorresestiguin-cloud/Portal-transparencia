import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, delta, chartCard, selectControl, flushCharts } from '../ui.js';
import { pyramid, columns, lines, rangeDots, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

const FRANGES = ['<30', '30-39', '40-49', '50-59', '>=60'];
const REL_COLOR = { indefinit: SERIES[0], temporal: SERIES[1], fix_discontinu: SERIES[2] };

export default async function render(root, { query }) {
  const [pl, ret] = await Promise.all([rows('plantilla'), rows('retribucions')]);
  const [dsP, dsR] = await Promise.all([dsTitle('plantilla'), dsTitle('retribucions')]);
  const anys = [...new Set(pl.map((r) => r.any))].sort();
  const anysTancats = anys.filter((a) => a < 2026);
  let any = Number(query.get('any')) || anysTancats[anysTancats.length - 1];

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'users', title: t('nav_personal'), intro: t('intro_personal') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);
  c.appendChild(h(`<div class="filters" role="group" aria-label="${t('filters')}">${selectControl('f-any', tr('Data de referència', 'Fecha de referencia', 'Reference date'), anys.slice().reverse().map((a) => [a, `31/12/${a}`]), any)}</div>`));
  const out = h('<div></div>');
  c.appendChild(out);

  const draw = () => {
    out.innerHTML = '';
    const yr = pl.filter((r) => r.any === any), pv = pl.filter((r) => r.any === any - 1);
    const tot = sum(yr, (r) => r.efectius), totP = sum(pv, (r) => r.efectius);
    const dones = sum(yr.filter((r) => r.sexe === 'dona'), (r) => r.efectius);
    const temp = sum(yr.filter((r) => r.tipus_relacio === 'temporal'), (r) => r.efectius);
    const tempP = sum(pv.filter((r) => r.tipus_relacio === 'temporal'), (r) => r.efectius);
    const dir = yr.filter((r) => ['direccio', 'comandament'].includes(r.categoria));
    const donesDir = sum(dir.filter((r) => r.sexe === 'dona'), (r) => r.efectius) / (sum(dir, (r) => r.efectius) || 1) * 100;
    const retY = ret.filter((r) => r.any === Math.min(any, Math.max(...ret.map((x) => x.any))) && r.any >= Math.min(...ret.map((x) => x.any)));
    const pesos = Object.fromEntries(codes('categoria').map((k) => [k, sum(yr.filter((r) => r.categoria === k), (r) => r.efectius)]));
    const bretxa = retY.length ? sum(retY, (r) => ((r.retribucio_mitjana_homes - r.retribucio_mitjana_dones) / r.retribucio_mitjana_homes) * (pesos[r.categoria] || 0)) / (sum(retY, (r) => pesos[r.categoria] || 0) || 1) * 100 : null;

    out.appendChild(kpiRow([
      { label: tr('Persones en plantilla', 'Personas en plantilla', 'Headcount'), value: fmt.int(tot), ...delta(tot, totP), context: `${tr('vs.', 'vs.', 'vs.')} ${any - 1}` },
      { label: tr('Dones', 'Mujeres', 'Women'), value: fmt.pct((dones / tot) * 100), context: tr('del total de la plantilla', 'del total de la plantilla', 'of all staff') },
      { label: tr('Dones en llocs de comandament', 'Mujeres en puestos de mando', 'Women in management'), value: fmt.pct(donesDir), context: tr('direcció i comandaments', 'dirección y mandos', 'senior & middle management') },
      { label: tr('Taxa de temporalitat', 'Tasa de temporalidad', 'Temporary contracts'), value: fmt.pct((temp / tot) * 100), ...delta((temp / tot) * 100, totP ? (tempP / totP) * 100 : null, { pp: true, invert: true }) },
      ...(bretxa !== null ? [{ label: tr('Bretxa salarial ajustada', 'Brecha salarial ajustada', 'Adjusted gender pay gap'), value: fmt.pct(bretxa), context: tr('mitjana ponderada per categoria', 'media ponderada por categoría', 'weighted average by category') }] : []),
    ]));

    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    const pyr = { dona: FRANGES.map((f) => sum(yr.filter((r) => r.sexe === 'dona' && r.franja_edat === f), (r) => r.efectius)), home: FRANGES.map((f) => sum(yr.filter((r) => r.sexe === 'home' && r.franja_edat === f), (r) => r.efectius)) };
    grid.appendChild(chartCard({
      title: tr('Piràmide d’edat i sexe', 'Pirámide de edad y sexo', 'Age and sex pyramid'), subtitle: `31/12/${any}`,
      file: `plantilla-piramide-${any}`, dataset: 'plantilla', datasetTitle: dsP,
      draw: (el) => pyramid(el, { bands: FRANGES.map((f) => f.replace('>=', '≥')), left: { name: label('sexe', 'dona'), values: pyr.dona, color: SERIES[6] }, right: { name: label('sexe', 'home'), values: pyr.home, color: SERIES[2] }, format: fmt.int }),
      table: { columns: [{ key: 'f', label: tr('Edat', 'Edad', 'Age') }, { key: 'd', label: label('sexe', 'dona'), align: 'right' }, { key: 'h', label: label('sexe', 'home'), align: 'right' }], rows: FRANGES.map((f, i) => ({ f, d: pyr.dona[i], h: pyr.home[i] })) },
    }));

    const cats = codes('categoria');
    const sx = ['dona', 'home'].map((s, i) => ({ name: label('sexe', s), color: i ? SERIES[2] : SERIES[6], values: cats.map((k) => sum(yr.filter((r) => r.categoria === k && r.sexe === s), (r) => r.efectius)) }));
    grid.appendChild(chartCard({
      title: tr('Plantilla per categoria i sexe', 'Plantilla por categoría y sexo', 'Staff by category and sex'), subtitle: `31/12/${any}`,
      file: `plantilla-categoria-${any}`, dataset: 'plantilla', datasetTitle: dsP,
      draw: (el) => columns(el, { categories: cats.map((k) => label('categoria', k)), series: sx, stacked: true, format: fmt.int }),
      table: { columns: [{ key: 'k', label: tr('Categoria', 'Categoría', 'Category') }, { key: 'd', label: label('sexe', 'dona'), align: 'right' }, { key: 'h', label: label('sexe', 'home'), align: 'right' }], rows: cats.map((k, i) => ({ k: label('categoria', k), d: sx[0].values[i], h: sx[1].values[i] })) },
    }));

    const rel = codes('tipus_relacio').map((k) => ({ name: label('tipus_relacio', k), color: REL_COLOR[k], values: anys.map((a) => sum(pl.filter((r) => r.any === a && r.tipus_relacio === k), (r) => r.efectius)) }));
    grid.appendChild(chartCard({
      title: tr('Evolució de la plantilla per tipus de contracte', 'Evolución de la plantilla por tipo de contrato', 'Headcount by contract type over time'), subtitle: `${anys[0]}–${anys[anys.length - 1]}`,
      file: 'plantilla-evolucio', dataset: 'plantilla', datasetTitle: dsP,
      draw: (el) => columns(el, { categories: anys.map(String), series: rel, stacked: true, format: fmt.int }),
      table: { columns: [{ key: 'a', label: tr('Any', 'Año', 'Year') }, ...rel.map((s, i) => ({ key: 's' + i, label: s.name, align: 'right' }))], rows: anys.map((a, ai) => Object.fromEntries([['a', a], ...rel.map((s, i) => ['s' + i, s.values[ai]])])) },
    }));

    const retAny = ret.filter((r) => r.any === Math.max(...ret.map((x) => x.any).filter((a) => a <= Math.max(any, Math.min(...ret.map((x) => x.any))))));
    const anyRet = retAny[0]?.any;
    const rd = retAny.map((r) => ({ label: label('categoria', r.categoria), min: r.retribucio_minima, max: r.retribucio_maxima, a: r.retribucio_mitjana_dones, b: r.retribucio_mitjana_homes, note: `${tr('Bretxa', 'Brecha', 'Gap')}: ${fmt.pct(((r.retribucio_mitjana_homes - r.retribucio_mitjana_dones) / r.retribucio_mitjana_homes) * 100)}` }));
    grid.appendChild(chartCard({
      title: tr('Bandes retributives i mitjanes per sexe', 'Bandas retributivas y medias por sexo', 'Pay bands and averages by sex'), subtitle: `${tr('Euros bruts anuals', 'Euros brutos anuales', 'Gross annual EUR')} · ${anyRet}`,
      file: `retribucions-${anyRet}`, dataset: 'retribucions', datasetTitle: dsR, wide: true,
      draw: (el) => rangeDots(el, { data: rd, markers: [{ name: label('sexe', 'dona'), color: SERIES[6] }, { name: label('sexe', 'home'), color: SERIES[2] }], rangeName: tr('Banda', 'Banda', 'Band'), format: fmt.eur, axisFormat: fmt.eurC }),
      table: { columns: [{ key: 'label', label: tr('Categoria', 'Categoría', 'Category') }, { key: 'min', label: 'Min.', align: 'right', format: fmt.eur }, { key: 'max', label: 'Max.', align: 'right', format: fmt.eur }, { key: 'a', label: label('sexe', 'dona'), align: 'right', format: fmt.eur }, { key: 'b', label: label('sexe', 'home'), align: 'right', format: fmt.eur }], rows: rd },
    }));

    const gapYears = [...new Set(ret.map((r) => r.any))].sort();
    const gapSeries = gapYears.map((a) => { const s = ret.filter((r) => r.any === a); return sum(s, (r) => (r.retribucio_mitjana_homes - r.retribucio_mitjana_dones) / r.retribucio_mitjana_homes) / s.length * 100; });
    grid.appendChild(chartCard({
      title: tr('Evolució de la bretxa salarial', 'Evolución de la brecha salarial', 'Gender pay gap over time'), subtitle: tr('Mitjana simple de les categories (%)', 'Media simple de las categorías (%)', 'Simple average across categories (%)'),
      file: 'bretxa-evolucio', dataset: 'retribucions', datasetTitle: dsR,
      draw: (el) => lines(el, { x: gapYears.map(String), series: [{ name: tr('Bretxa', 'Brecha', 'Gap'), values: gapSeries, color: SERIES[6] }], format: (v) => fmt.pct(v), axisFormat: (v) => `${fmt.dec(v, 0)} %` }),
      table: { columns: [{ key: 'a', label: tr('Any', 'Año', 'Year') }, { key: 'v', label: '%', align: 'right', format: (v) => fmt.pct(v) }], rows: gapYears.map((a, i) => ({ a, v: gapSeries[i] })) },
    }));
  };
  draw();
  c.querySelector('#f-any').addEventListener('change', (e) => { any = Number(e.target.value); setQuery({ any }); draw(); flushCharts(); });
}
