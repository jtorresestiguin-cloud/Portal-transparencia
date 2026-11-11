import { t, tr, label } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, delta, chartCard, selectControl, meter, icon, esc, flushCharts } from '../ui.js';
import { lines, heatmap, hBar, SERIES } from '../charts.js';
import { rows, setQuery, dsTitle } from '../app.js';

const INDICADORS = {
  pernoctacions_hoteleres: { ca: 'Pernoctacions hoteleres', es: 'Pernoctaciones hoteleras', en: 'Hotel nights', f: 'compact', agg: 'sum' },
  turistes_hotelers: { ca: 'Turistes allotjats en hotels', es: 'Turistas alojados en hoteles', en: 'Hotel guests', f: 'compact', agg: 'sum' },
  ocupacio_hotelera_pct: { ca: 'Ocupació hotelera (%)', es: 'Ocupación hotelera (%)', en: 'Hotel occupancy (%)', f: 'pct', agg: 'avg' },
  preu_mitja_habitacio_eur: { ca: 'Preu mitjà per habitació (ADR)', es: 'Precio medio por habitación (ADR)', en: 'Average daily rate (ADR)', f: 'eur', agg: 'avg' },
  passatgers_aeroport: { ca: 'Passatgers a l’aeroport', es: 'Pasajeros en el aeropuerto', en: 'Airport passengers', f: 'compact', agg: 'sum' },
  creueristes: { ca: 'Passatgers de creuers', es: 'Pasajeros de cruceros', en: 'Cruise passengers', f: 'compact', agg: 'sum' },
  consultes_oficines_informacio: { ca: 'Consultes a oficines d’informació', es: 'Consultas en oficinas de información', en: 'Information office enquiries', f: 'compact', agg: 'sum' },
  usuaris_bus_turistic: { ca: 'Usuaris del bus turístic', es: 'Usuarios del bus turístico', en: 'Tourist bus riders', f: 'compact', agg: 'sum' },
  vendes_targeta_turistica: { ca: 'Targetes turístiques venudes', es: 'Tarjetas turísticas vendidas', en: 'City passes sold', f: 'compact', agg: 'sum' },
};

export default async function render(root, { query }) {
  const [ind, merc, ofi, obj] = await Promise.all([rows('indicadors-turisme'), rows('mercats-origen'), rows('oficines-informacio'), rows('objectius')]);
  const [dsI, dsM, dsO, dsOb] = await Promise.all(['indicadors-turisme', 'mercats-origen', 'oficines-informacio', 'objectius'].map(dsTitle));
  let key = INDICADORS[query.get('ind')] ? query.get('ind') : 'pernoctacions_hoteleres';

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'chart', title: t('nav_activitat'), intro: t('intro_activitat') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);

  // ---------------- Objectius estratègics
  c.appendChild(h(`<h2 class="section-title">${tr('Objectius estratègics i grau de compliment', 'Objetivos estratégicos y grado de cumplimiento', 'Strategic objectives and progress')}</h2>`));
  c.appendChild(h(`<ul class="goal-grid">${obj.map((o) => {
    const prog = Math.max(0, Math.min(100, ((o.valor_actual - o.valor_base) / (o.valor_objectiu - o.valor_base)) * 100));
    const n = (v) => (Number.isInteger(v) ? fmt.int(v) : fmt.dec(v));
    return `<li class="card goal">
      <span class="goal-eix">${label('eix', o.eix)}</span>
      <h3>${esc(o.objectiu)}</h3>
      <p class="muted small">${esc(o.indicador)}</p>
      <div class="goal-figs"><span><small>${tr('Base', 'Base', 'Baseline')}</small>${n(o.valor_base)}</span><span class="goal-now"><small>${tr('Actual', 'Actual', 'Current')}</small>${n(o.valor_actual)}</span><span><small>${tr('Fita', 'Meta', 'Target')} ${o.any_objectiu}</small>${n(o.valor_objectiu)}</span></div>
      ${meter(prog, { labelText: o.objectiu, status: prog >= 75 ? 'good' : prog >= 40 ? 'warning' : 'serious' })}
      <p class="goal-pct">${fmt.dec(prog, 0)} % ${tr('del camí recorregut', 'del camino recorrido', 'of the way there')}</p>
    </li>`;
  }).join('')}</ul>`));
  c.appendChild(h(`<p class="chart-source">${t('source')}: <a href="#/dades-obertes/objectius">${t('dataset')} «${esc(dsOb)}»</a></p>`));

  // ---------------- Indicadors turístics
  c.appendChild(h(`<h2 class="section-title">${tr('Indicadors turístics de la ciutat', 'Indicadores turísticos de la ciudad', 'City tourism indicators')}</h2>`));
  c.appendChild(h(`<div class="filters" role="group" aria-label="${t('filters')}">${selectControl('f-ind', tr('Indicador', 'Indicador', 'Indicator'), Object.entries(INDICADORS).map(([k, v]) => [k, v[document.documentElement.lang] || v.ca]), key)}</div>`));
  const out = h('<div></div>');
  c.appendChild(out);

  const draw = () => {
    out.innerHTML = '';
    const def = INDICADORS[key];
    const name = def[document.documentElement.lang] || def.ca;
    const F = def.f === 'pct' ? (v) => fmt.pct(v) : def.f === 'eur' ? fmt.eur2 : fmt.int;
    const FA = def.f === 'pct' ? (v) => `${fmt.dec(v, 0)} %` : def.f === 'eur' ? (v) => fmt.eur(v) : fmt.compact;
    const last = ind[ind.length - 1];
    const sameLY = ind.find((r) => r.any === last.any - 1 && r.mes === last.mes);
    const same19 = ind.find((r) => r.any === 2019 && r.mes === last.mes);
    const ytd = (y) => { const s = ind.filter((r) => r.any === y && r.mes <= last.mes); return def.agg === 'sum' ? sum(s, (r) => r[key]) : sum(s, (r) => r[key]) / s.length; };
    out.appendChild(kpiRow([
      { label: `${name} · ${fmt.month(last.periode, true)}`, value: F(last[key]), ...delta(last[key], sameLY?.[key], { pp: def.f === 'pct' }), context: tr('vs. mateix mes any anterior', 'vs. mismo mes año anterior', 'vs. same month last year') },
      { label: tr(`Acumulat gener–${fmt.monthName(last.mes, 'long')} ${last.any}`, `Acumulado enero–${fmt.monthName(last.mes, 'long')} ${last.any}`, `Year to date (Jan–${fmt.monthName(last.mes, 'long')} ${last.any})`), value: F(ytd(last.any)), ...delta(ytd(last.any), ytd(last.any - 1), { pp: def.f === 'pct' }), context: `${tr('vs.', 'vs.', 'vs.')} ${last.any - 1}${def.agg === 'avg' ? ` · ${tr('mitjana', 'media', 'average')}` : ''}` },
      { label: tr('Respecte a 2019 (prepandèmia)', 'Respecto a 2019 (prepandemia)', 'vs. 2019 (pre-pandemic)'), value: delta(last[key], same19?.[key], { pp: def.f === 'pct' }).delta?.replace(/^[▲▼■] /, '') || '—', context: `${fmt.month(last.periode)} ${tr('vs.', 'vs.', 'vs.')} ${fmt.month(same19.periode)}` },
    ]));
    const grid = h('<div class="chart-grid"></div>');
    out.appendChild(grid);
    grid.appendChild(chartCard({
      title: name, subtitle: tr('Sèrie mensual 2019 – actualitat', 'Serie mensual 2019 – actualidad', 'Monthly series 2019 – present'),
      full: true, file: `indicador-${key}`, dataset: 'indicadors-turisme', datasetTitle: dsI,
      draw: (el) => lines(el, { x: ind.map((r) => r.periode), series: [{ name, values: ind.map((r) => r[key]), color: SERIES[0] }], area: true, format: F, axisFormat: FA, xLabel: (p, long) => (long ? fmt.month(p, true) : p.endsWith('-01') ? p.slice(0, 4) : ''), xEvery: 1, height: 300, ariaLabel: name }),
      table: { columns: [{ key: 'periode', label: tr('Període', 'Periodo', 'Period') }, { key: key, label: name, align: 'right', format: F }], rows: ind },
    }));
    const yrs = [2019, last.any - 1, last.any];
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    grid.appendChild(chartCard({
      title: tr('Estacionalitat: comparativa per mesos', 'Estacionalidad: comparativa por meses', 'Seasonality: month-by-month'), subtitle: yrs.join(' · '),
      file: `estacionalitat-${key}`, dataset: 'indicadors-turisme', datasetTitle: dsI,
      draw: (el) => lines(el, { x: months.map(String), series: yrs.map((y, i) => ({ name: String(y), color: [SERIES[6], SERIES[2], SERIES[0]][i], values: months.map((m) => ind.find((r) => r.any === y && r.mes === m)?.[key] ?? null) })), format: F, axisFormat: FA, xLabel: (m) => fmt.monthName(Number(m)) }),
      table: { columns: [{ key: 'm', label: tr('Mes', 'Mes', 'Month') }, ...yrs.map((y) => ({ key: 'y' + y, label: String(y), align: 'right', format: (v) => (v == null ? '—' : F(v)) }))], rows: months.map((m) => Object.fromEntries([['m', fmt.monthName(m, 'long')], ...yrs.map((y) => ['y' + y, ind.find((r) => r.any === y && r.mes === m)?.[key] ?? null])])) },
    }));
    const hy = [...new Set(ind.map((r) => r.any))];
    grid.appendChild(chartCard({
      title: tr('Mapa de calor any × mes', 'Mapa de calor año × mes', 'Heatmap year × month'), subtitle: tr('Més fosc = valor més alt', 'Más oscuro = valor más alto', 'Darker = higher'),
      file: `heatmap-${key}`, dataset: 'indicadors-turisme', datasetTitle: dsI,
      draw: (el) => heatmap(el, { rows: hy.map(String), cols: months.map((m) => fmt.monthName(m).replace('.', '')), values: hy.map((y) => months.map((m) => ind.find((r) => r.any === y && r.mes === m)?.[key] ?? null)), format: F, valueName: name, cellLabel: (r, col) => `${col} ${r}`, lowLabel: tr('Baix', 'Bajo', 'Low'), highLabel: tr('Alt', 'Alto', 'High') }),
      table: { columns: [{ key: 'periode', label: tr('Període', 'Periodo', 'Period') }, { key: key, label: name, align: 'right', format: F }], rows: ind },
    }));
  };
  draw();
  c.querySelector('#f-ind').addEventListener('change', (e) => { key = e.target.value; setQuery({ ind: key }); draw(); flushCharts(); });

  // ---------------- Mercats d'origen i oficines
  const mAnys = [...new Set(merc.map((m) => m.any))].sort();
  const g2 = h('<div class="chart-grid"></div>');
  c.appendChild(h(`<h2 class="section-title">${tr('D’on ens visiten i on els atenem', 'De dónde nos visitan y dónde les atendemos', 'Where visitors come from and where we serve them')}</h2>`));
  c.appendChild(g2);
  const lastM = mAnys[mAnys.length - 1];
  const mData = merc.filter((m) => m.any === lastM).map((m) => {
    const prev = merc.find((x) => x.any === 2019 && x.mercat === m.mercat);
    return { label: label('mercat', m.mercat), value: m.quota_pct, note: prev ? `2019: ${fmt.pct(prev.quota_pct)}` : '' };
  }).sort((a, b) => b.value - a.value);
  g2.appendChild(chartCard({
    title: tr(`Mercats d’origen (${lastM})`, `Mercados de origen (${lastM})`, `Source markets (${lastM})`), subtitle: tr('Quota de turistes allotjats en hotels', 'Cuota de turistas alojados en hoteles', 'Share of hotel guests'),
    file: `mercats-${lastM}`, dataset: 'mercats-origen', datasetTitle: dsM,
    draw: (el) => hBar(el, { data: mData, format: (v) => fmt.pct(v), color: SERIES[0], valueName: tr('Quota', 'Cuota', 'Share') }),
    table: { columns: [{ key: 'label', label: tr('Mercat', 'Mercado', 'Market') }, { key: 'value', label: '%', align: 'right', format: (v) => fmt.pct(v) }], rows: mData },
  }));

  const ofiSorted = ofi.slice().sort((a, b) => b.visites_2025 - a.visites_2025);
  const mapCard = h(`<figure class="card chart-card">
      <figcaption class="chart-head"><div><h3 class="chart-title">${icon('map', 18)} ${tr('Oficines i punts d’informació turística', 'Oficinas y puntos de información turística', 'Tourist information offices')}</h3><p class="chart-sub">${tr('Mida del punt proporcional a les visites de 2025', 'Tamaño del punto proporcional a las visitas de 2025', 'Dot size proportional to 2025 visits')}</p></div></figcaption>
      <div class="map" id="ofi-map" role="region" aria-label="${esc(tr('Mapa d’oficines', 'Mapa de oficinas', 'Office map'))}"></div>
      <ol class="map-list">${ofiSorted.map((o) => `<li><span>${esc(o.nom)}</span><span class="muted">${fmt.int(o.visites_2025)}${o.accessible ? '' : ` · <abbr title="${esc(tr('Accés no adaptat', 'Acceso no adaptado', 'Not step-free'))}">⚠</abbr>`}</span></li>`).join('')}</ol>
      <p class="chart-source">${t('source')}: <a href="#/dades-obertes/oficines-informacio">${t('dataset')} «${esc(dsO)}»</a> · © <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a></p>
    </figure>`);
  g2.appendChild(mapCard);
  queueMicrotask(() => loadMap(mapCard.querySelector('#ofi-map'), ofi));
}

let leafletPromise;
function loadLeaflet() {
  leafletPromise ||= new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'assets/vendor/leaflet/leaflet.css'; // Leaflet 1.9.4 (BSD-2), servit localment
    document.head.appendChild(css);
    const s = document.createElement('script');
    s.src = 'assets/vendor/leaflet/leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return leafletPromise;
}
async function loadMap(el, ofi) {
  try {
    const L = await loadLeaflet();
    for (let i = 0; i < 30 && !el.isConnected; i++) await new Promise((r) => setTimeout(r, 100));
    if (!el.isConnected) return;
    const map = L.map(el, { scrollWheelZoom: false }).setView([41.37, 2.14], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    const max = Math.max(...ofi.map((o) => o.visites_2025));
    const pts = ofi.map((o) => L.circleMarker([o.lat, o.lon], { radius: 6 + 14 * Math.sqrt(o.visites_2025 / max), color: '#fff', weight: 2, fillColor: '#2a78d6', fillOpacity: 0.85 })
      .bindPopup(`<strong>${esc(o.nom)}</strong><br>${esc(o.districte)}<br>${fmt.int(o.visites_2025)} ${tr('visites (2025)', 'visitas (2025)', 'visits (2025)')}`).addTo(map));
    map.fitBounds(L.featureGroup(pts).getBounds().pad(0.15));
  } catch {
    el.classList.add('map-fallback');
    el.textContent = tr('No s’ha pogut carregar el mapa. Consulteu la llista d’oficines.', 'No se ha podido cargar el mapa. Consulte la lista de oficinas.', 'The map could not be loaded. See the list of offices.');
  }
}
