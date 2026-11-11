import { t, tr, label, codes } from '../i18n.js';
import { h, sectionHeader, fmt, sum, kpiRow, chartCard, dataTable, icon, selectControl, esc, flushCharts } from '../ui.js';
import { calendar, hBar, SERIES } from '../charts.js';
import { rows, dsTitle } from '../app.js';

export default async function render(root) {
  const [alts, agenda, regals] = await Promise.all([rows('alts-carrecs'), rows('agenda'), rows('regals')]);
  const [dsA, dsAg, dsR] = await Promise.all([dsTitle('alts-carrecs'), dsTitle('agenda'), dsTitle('regals')]);

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'shield', title: t('nav_bon-govern'), intro: t('intro_bon-govern') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);

  const reunions = agenda.filter((a) => a.tipus === 'reunio');
  const ambGI = reunions.filter((a) => a.grup_interes_registrat);
  c.appendChild(kpiRow([
    { label: tr('Llocs directius', 'Puestos directivos', 'Senior positions'), value: fmt.int(alts.length), context: tr('amb retribució publicada', 'con retribución publicada', 'with published pay') },
    { label: tr('Declaracions d’interessos', 'Declaraciones de intereses', 'Declarations of interest'), value: `${alts.filter((a) => a.declaracio_interessos).length}/${alts.length}`, context: tr('publicades', 'publicadas', 'published') },
    { label: tr('Activitats a l’agenda', 'Actividades en la agenda', 'Diary entries'), value: fmt.int(agenda.length), context: tr('darrers 12 mesos', 'últimos 12 meses', 'last 12 months') },
    { label: tr('Reunions amb grups d’interès', 'Reuniones con grupos de interés', 'Meetings with lobby groups'), value: fmt.int(ambGI.length), context: `${fmt.pct((ambGI.length / (reunions.length || 1)) * 100, 0)} ${tr('de les reunions', 'de las reuniones', 'of meetings')}` },
    { label: tr('Regals registrats', 'Regalos registrados', 'Gifts registered'), value: fmt.int(regals.length), context: `${fmt.eur(sum(regals, (r) => r.valor_estimat))} ${tr('valor estimat', 'valor estimado', 'estimated value')}` },
  ]));

  // Alts càrrecs
  c.appendChild(h(`<h2 class="section-title">${tr('Alts càrrecs i personal directiu', 'Altos cargos y personal directivo', 'Senior officials')}</h2>`));
  const altsCard = h('<section class="card"></section>');
  altsCard.appendChild(dataTable({
    caption: tr('Alts càrrecs', 'Altos cargos', 'Senior officials'),
    columns: [
      { key: 'lloc', label: tr('Lloc', 'Puesto', 'Position'), format: (v) => label('lloc', v) },
      { key: 'tipus_vinculacio', label: tr('Vinculació', 'Vinculación', 'Type'), format: (v) => (v === 'alta_direccio' ? tr('Alta direcció', 'Alta dirección', 'Senior executive') : tr('Personal directiu', 'Personal directivo', 'Management')) },
      { key: 'data_nomenament', label: tr('Nomenament', 'Nombramiento', 'Appointed'), format: fmt.date },
      { key: 'retribucio_fixa', label: tr('Retribució bruta anual', 'Retribución bruta anual', 'Gross annual pay'), align: 'right', format: fmt.eur },
      { key: 'declaracio_interessos', label: tr('Decl. interessos', 'Decl. intereses', 'Interests decl.'), html: true, format: (v) => (v ? `<span class="badge badge-good">${icon('ok', 14)}${t('yes')}</span>` : `<span class="badge badge-critical">${icon('x', 14)}${t('no')}</span>`) },
      { key: 'declaracio_patrimonial', label: tr('Decl. patrimonial', 'Decl. patrimonial', 'Assets decl.'), html: true, format: (v) => (v ? `<span class="badge badge-good">${icon('ok', 14)}${t('yes')}</span>` : `<span class="badge badge-neutral">${tr('No obligatòria', 'No obligatoria', 'Not required')}</span>`) },
    ],
    rows: alts,
  }));
  altsCard.appendChild(h(`<p class="chart-source">${t('source')}: <a href="#/dades-obertes/alts-carrecs">${t('dataset')} «${esc(dsA)}»</a> · ${tr('El prototip mostra els llocs sense noms personals; la versió en producció ha d’incloure identificació, perfil i trajectòria (art. 9.1.g).', 'El prototipo muestra los puestos sin nombres personales; la versión en producción debe incluir identificación, perfil y trayectoria (art. 9.1.g).', 'The prototype shows positions without personal names; production must include identity, profile and career (art. 9.1.g).')}</p>`));
  c.appendChild(altsCard);

  // Agenda
  c.appendChild(h(`<h2 class="section-title">${tr('Agenda institucional', 'Agenda institucional', 'Official diary')}</h2>`));
  const grid = h('<div class="chart-grid"></div>');
  c.appendChild(grid);
  const counts = new Map();
  agenda.forEach((a) => counts.set(a.data, (counts.get(a.data) || 0) + 1));
  const from = agenda[agenda.length - 1].data, to = agenda[0].data;
  grid.appendChild(chartCard({
    title: tr('Intensitat de l’agenda', 'Intensidad de la agenda', 'Diary activity'), subtitle: `${fmt.date(from)} – ${fmt.date(to)}`,
    file: 'agenda-calendari', dataset: 'agenda', datasetTitle: dsAg, wide: true,
    draw: (el) => calendar(el, {
      counts, from, to, monthLabels: Array.from({ length: 12 }, (_, i) => fmt.monthName(i + 1)),
      dayLabels: [tr('dl', 'lu', 'Mo', ''), '', tr('dc', 'mi', 'We'), '', tr('dv', 'vi', 'Fr'), '', ''],
      dateFormat: fmt.dateLong, itemsFor: (d) => agenda.filter((a) => a.data === d).map((a) => `• ${esc(a.activitat)}`).join('<br>'),
      ariaLabel: tr('Calendari d’activitats', 'Calendario de actividades', 'Activity calendar'),
    }),
    table: { columns: [{ key: 'd', label: tr('Data', 'Fecha', 'Date') }, { key: 'n', label: 'N', align: 'right' }], rows: [...counts].map(([d, n]) => ({ d, n })) },
  }));
  const byTipus = codes('tipus_agenda').map((k, i) => ({ label: label('tipus_agenda', k), value: agenda.filter((a) => a.tipus === k).length, color: SERIES[i] })).sort((a, b) => b.value - a.value);
  grid.appendChild(chartCard({
    title: tr('Activitats per tipus', 'Actividades por tipo', 'Entries by type'), subtitle: tr('Darrers 12 mesos', 'Últimos 12 meses', 'Last 12 months'),
    file: 'agenda-tipus', dataset: 'agenda', datasetTitle: dsAg,
    draw: (el) => hBar(el, { data: byTipus, format: fmt.int, color: SERIES[0], valueName: tr('Activitats', 'Actividades', 'Entries') }),
    table: { columns: [{ key: 'label', label: tr('Tipus', 'Tipo', 'Type') }, { key: 'value', label: 'N', align: 'right' }], rows: byTipus },
  }));

  const agCard = h(`<section class="card"><div class="filters inline">${selectControl('f-carrec', tr('Càrrec', 'Cargo', 'Official'), [['all', t('all')], ...codes('lloc').map((k) => [k, label('lloc', k)])], 'all')}${selectControl('f-tipus', tr('Tipus', 'Tipo', 'Type'), [['all', t('all')], ...codes('tipus_agenda').map((k) => [k, label('tipus_agenda', k)])], 'all')}<label class="control check"><input type="checkbox" id="f-gi"> <span>${tr('Només amb grups d’interès', 'Solo con grupos de interés', 'Lobby meetings only')}</span></label></div><div class="ag-table"></div></section>`);
  c.appendChild(agCard);
  const drawAg = () => {
    const cr = agCard.querySelector('#f-carrec').value, tp = agCard.querySelector('#f-tipus').value, gi = agCard.querySelector('#f-gi').checked;
    const f = agenda.filter((a) => (cr === 'all' || a.carrec === cr) && (tp === 'all' || a.tipus === tp) && (!gi || a.grup_interes_registrat));
    agCard.querySelector('.ag-table').replaceChildren(dataTable({
      caption: tr('Agenda institucional', 'Agenda institucional', 'Official diary'),
      columns: [
        { key: 'data', label: tr('Data', 'Fecha', 'Date'), format: fmt.date },
        { key: 'carrec', label: tr('Càrrec', 'Cargo', 'Official'), format: (v) => label('lloc', v) },
        { key: 'tipus', label: tr('Tipus', 'Tipo', 'Type'), format: (v) => label('tipus_agenda', v) },
        { key: 'activitat', label: tr('Activitat', 'Actividad', 'Activity') },
        { key: 'lloc_activitat', label: tr('Lloc', 'Lugar', 'Place') },
        { key: 'codi_registre_gi', label: tr('Grup d’interès', 'Grupo de interés', 'Lobby register'), html: true, format: (v) => (v ? `<code>${v}</code>` : '—') },
      ],
      rows: f, pageSize: 10, sortKey: 'data', sortDir: -1,
    }));
  };
  agCard.querySelectorAll('select, input').forEach((el) => el.addEventListener('change', drawAg));
  drawAg();

  // Regals i integritat
  c.appendChild(h(`<h2 class="section-title">${tr('Regals i integritat', 'Regalos e integridad', 'Gifts and integrity')}</h2>`));
  const two = h('<div class="two-col"></div>');
  c.appendChild(two);
  const rc = h('<section class="card"></section>');
  rc.appendChild(dataTable({
    caption: tr('Registre de regals', 'Registro de regalos', 'Gift register'),
    columns: [
      { key: 'data', label: tr('Data', 'Fecha', 'Date'), format: fmt.date },
      { key: 'carrec', label: tr('Càrrec', 'Cargo', 'Official'), format: (v) => label('lloc', v) },
      { key: 'descripcio', label: tr('Descripció', 'Descripción', 'Description') },
      { key: 'valor_estimat', label: tr('Valor', 'Valor', 'Value'), align: 'right', format: fmt.eur },
      { key: 'destinacio', label: tr('Destinació', 'Destino', 'Outcome'), format: (v) => label('destinacio_regal', v) },
    ],
    rows: regals, pageSize: 8, sortKey: 'data', sortDir: -1, compact: true,
  }));
  rc.appendChild(h(`<p class="chart-source">${t('source')}: <a href="#/dades-obertes/regals">${t('dataset')} «${esc(dsR)}»</a></p>`));
  two.appendChild(rc);
  two.appendChild(h(`<section class="card prose">
    <h3 class="card-title">${tr('Marc d’integritat', 'Marco de integridad', 'Integrity framework')}</h3>
    <ul class="link-cards">
      <li>${icon('file', 20)}<div><strong>${tr('Codi ètic i de conducta', 'Código ético y de conducta', 'Code of ethics and conduct')}</strong><span>${tr('Principis i regles de conducta per a tot el personal i la direcció.', 'Principios y reglas de conducta para todo el personal y la dirección.', 'Principles and rules for all staff and management.')}</span></div></li>
      <li>${icon('shield', 20)}<div><strong>${tr('Canal intern d’informació', 'Canal interno de información', 'Internal reporting channel')}</strong><span>${tr('Comunicació confidencial o anònima d’irregularitats (Llei 2/2023).', 'Comunicación confidencial o anónima de irregularidades (Ley 2/2023).', 'Confidential or anonymous reporting of wrongdoing (Law 2/2023).')}</span></div></li>
      <li>${icon('users', 20)}<div><strong>${tr('Registre de grups d’interès', 'Registro de grupos de interés', 'Lobby register')}</strong><span>${tr('Les reunions amb grups d’interès s’identifiquen a l’agenda amb el seu codi de registre.', 'Las reuniones con grupos de interés se identifican en la agenda con su código de registro.', 'Lobby meetings are flagged in the diary with their register code.')}</span></div></li>
      <li>${icon('flag', 20)}<div><strong>${tr('Pla de mesures antifrau', 'Plan de medidas antifraude', 'Anti-fraud plan')}</strong><span>${tr('Prevenció, detecció i correcció del frau, la corrupció i els conflictes d’interès.', 'Prevención, detección y corrección del fraude, la corrupción y los conflictos de interés.', 'Preventing, detecting and correcting fraud, corruption and conflicts of interest.')}</span></div></li>
    </ul></section>`));
}
