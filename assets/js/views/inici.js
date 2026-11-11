import { t, tr, label, pick } from '../i18n.js';
import { h, icon, fmt, sum, kpiRow, delta, meter, esc } from '../ui.js';
import { rows, SECTIONS, datasetsMeta } from '../app.js';
import { scoreObligacions } from './compliment.js';

export default async function render(root) {
  const [pres, contractes, plantilla, dai, ind, obl, convenis, meta] = await Promise.all([
    rows('pressupost'), rows('contractes'), rows('plantilla'), rows('dret-acces'), rows('indicadors-turisme'), rows('obligacions'), rows('convenis'), datasetsMeta(),
  ]);

  const despesa = (y, k) => sum(pres.filter((r) => r.any === y && r.tipus === 'despesa'), (r) => r[k]);
  const ingres = (y, k) => sum(pres.filter((r) => r.any === y && r.tipus === 'ingres'), (r) => r[k]);
  const ctAny = (y) => contractes.filter((c) => c.data_adjudicacio.startsWith(String(y)));
  const efectius = (y) => sum(plantilla.filter((p) => p.any === y), (p) => p.efectius);
  const daiAny = (y) => dai.filter((d) => d.data_entrada.startsWith(String(y)) && d.dies_resolucio != null);
  const mitjanaDies = (y) => { const r = daiAny(y); return sum(r, (d) => d.dies_resolucio) / (r.length || 1); };
  const pernAny = (y) => sum(ind.filter((r) => r.any === y), (r) => r.pernoctacions_hoteleres);
  const score = scoreObligacions(obl);

  root.appendChild(h(`
    <section class="hero">
      <div class="container hero-grid">
        <div>
          <p class="kicker">${icon('shield', 18)}${t('portal_name')}</p>
          <h1 id="page-title" tabindex="-1">${tr('Comptes clars, dades obertes', 'Cuentas claras, datos abiertos', 'Clear accounts, open data')}</h1>
          <p class="lead">${tr(
            'Com s’obté i com es gasta cada euro, qui hi treballa, què es contracta i quin impacte té el turisme a la ciutat. Tota la informació es pot consultar, comparar i descarregar en formats oberts.',
            'Cómo se obtiene y cómo se gasta cada euro, quién trabaja, qué se contrata y qué impacto tiene el turismo en la ciudad. Toda la información se puede consultar, comparar y descargar en formatos abiertos.',
            'Where every euro comes from and how it is spent, who works here, what is contracted and how tourism affects the city. Everything can be browsed, compared and downloaded in open formats.')}</p>
          <button type="button" class="hero-search" id="hero-search">${icon('search', 20)}<span>${t('search_placeholder')}</span><kbd>Ctrl K</kbd></button>
          <ul class="hero-chips" aria-label="${esc(tr('Accessos ràpids', 'Accesos rápidos', 'Quick links'))}">
            <li><a href="#/economia">${tr('Pressupost', 'Presupuesto', 'Budget')}</a></li>
            <li><a href="#/contractacio">${tr('Contractes', 'Contratos', 'Contracts')}</a></li>
            <li><a href="#/bon-govern">${tr('Agenda i retribucions', 'Agenda y retribuciones', 'Diary & pay')}</a></li>
            <li><a href="#/dret-acces">${tr('Sol·licitar informació', 'Solicitar información', 'Request information')}</a></li>
          </ul>
        </div>
        <a class="score-card" href="#/compliment" aria-label="${esc(t('nav_compliment'))}: ${fmt.dec(score.total, 0)} %">
          <span class="score-label">${tr('Índex de compliment de publicitat activa', 'Índice de cumplimiento de publicidad activa', 'Proactive disclosure index')}</span>
          <span class="score-ring" style="--p:${score.total}"><span>${fmt.dec(score.total, 0)}<small>%</small></span></span>
          <span class="score-meta">${score.counts.publicat} ${label('estat_obligacio', 'publicat').toLowerCase()} · ${score.counts.parcial} ${label('estat_obligacio', 'parcial').toLowerCase()} · ${score.counts.pendent} ${label('estat_obligacio', 'pendent').toLowerCase()}</span>
          <span class="score-cta">${tr('Veure l’autoavaluació', 'Ver la autoevaluación', 'See the self-assessment')} →</span>
        </a>
      </div>
    </section>`));
  root.querySelector('#hero-search').addEventListener('click', () => window.dispatchEvent(new Event('portal:search')));

  const container = h('<div class="container"></div>');
  root.appendChild(container);

  container.appendChild(h(`<h2 class="section-title">${tr('Xifres clau', 'Cifras clave', 'Key figures')}</h2>`));
  const pernSeries = ind.slice(-24).map((r) => r.pernoctacions_hoteleres);
  container.appendChild(kpiRow([
    { label: tr('Pressupost de despesa 2026', 'Presupuesto de gasto 2026', '2026 expenditure budget'), value: fmt.eurC(despesa(2026, 'definitiu')), ...delta(despesa(2026, 'definitiu'), despesa(2025, 'definitiu')), context: tr('crèdit definitiu vs. 2025', 'crédito definitivo vs. 2025', 'final budget vs. 2025'), href: '#/economia' },
    { label: tr('Ingressos liquidats 2025', 'Ingresos liquidados 2025', '2025 revenue (outturn)'), value: fmt.eurC(ingres(2025, 'executat')), ...delta(ingres(2025, 'executat'), ingres(2024, 'executat')), context: tr('vs. 2024', 'vs. 2024', 'vs. 2024'), href: '#/economia?any=2025' },
    { label: tr('Contractes adjudicats 2026', 'Contratos adjudicados 2026', 'Contracts awarded 2026'), value: fmt.eurC(sum(ctAny(2026), (c) => c.import_adjudicacio_sense_iva)), context: `${fmt.int(ctAny(2026).length)} ${tr('contractes, sense IVA', 'contratos, sin IVA', 'contracts, excl. VAT')}`, href: '#/contractacio?any=2026' },
    { label: tr('Plantilla a 31/12/2025', 'Plantilla a 31/12/2025', 'Headcount 31/12/2025'), value: fmt.int(efectius(2025)), ...delta(efectius(2025), efectius(2024)), context: tr('persones', 'personas', 'people'), href: '#/personal' },
    { label: tr('Resposta al dret d’accés 2025', 'Respuesta al derecho de acceso 2025', 'FOI response time 2025'), value: `${fmt.dec(mitjanaDies(2025))} ${tr('dies', 'días', 'days')}`, ...delta(mitjanaDies(2025), mitjanaDies(2024), { invert: true }), context: tr('mitjana; termini legal 30', 'media; plazo legal 30', 'average; legal limit 30'), href: '#/dret-acces' },
    { label: tr('Pernoctacions hoteleres 2025', 'Pernoctaciones hoteleras 2025', 'Hotel nights 2025'), value: fmt.compact(pernAny(2025)), ...delta(pernAny(2025), pernAny(2024)), context: tr('darrers 24 mesos', 'últimos 24 meses', 'last 24 months'), spark: pernSeries, href: '#/activitat' },
  ]));

  // Explora per temes
  const headline = {
    institucio: tr('3 entitats consorciades', '3 entidades consorciadas', '3 member bodies'),
    economia: `${fmt.eurC(despesa(2026, 'definitiu'))} ${tr('pressupostats', 'presupuestados', 'budgeted')}`,
    contractacio: `${fmt.int(contractes.length)} ${tr('contractes des de 2022', 'contratos desde 2022', 'contracts since 2022')}`,
    subvencions: `${fmt.int(convenis.length)} ${tr('convenis signats', 'convenios firmados', 'agreements signed')}`,
    personal: `${fmt.int(efectius(2025))} ${tr('persones', 'personas', 'people')}`,
    'bon-govern': tr('Agenda, regals i declaracions', 'Agenda, regalos y declaraciones', 'Diary, gifts & declarations'),
    activitat: tr('Sèries mensuals des de 2019', 'Series mensuales desde 2019', 'Monthly series since 2019'),
    'dret-acces': `${fmt.int(dai.length)} ${tr('sol·licituds resoltes o en tràmit', 'solicitudes resueltas o en trámite', 'requests handled')}`,
    compliment: `${fmt.dec(score.total, 0)} % ${tr('d’obligacions complertes', 'de obligaciones cumplidas', 'of obligations met')}`,
    'dades-obertes': `${meta.conjunts.length} ${tr('conjunts de dades', 'conjuntos de datos', 'datasets')}`,
  };
  container.appendChild(h(`<h2 class="section-title">${tr('Explora per temes', 'Explora por temas', 'Explore by topic')}</h2>`));
  container.appendChild(h(`<ul class="topic-grid">${SECTIONS.map((s) => `
    <li><a class="topic-card" href="#/${s.id}">
      <span class="topic-icon">${icon(s.icon, 22)}</span>
      <span class="topic-title">${t('nav_' + s.id)}</span>
      <span class="topic-text">${t('intro_' + s.id)}</span>
      <span class="topic-figure">${headline[s.id] || ''}</span>
    </a></li>`).join('')}</ul>`));

  // Novetats + compliment per bloc
  const novetats = [
    ...contractes.slice(0, 6).map((c) => ({ date: c.data_adjudicacio, kind: tr('Contracte', 'Contrato', 'Contract'), title: c.objecte, meta: `${c.adjudicatari} · ${fmt.eur(c.import_adjudicacio_sense_iva)}`, href: `#/contractacio?q=${c.id}` })),
    ...[...convenis].sort((a, b) => b.data_signatura.localeCompare(a.data_signatura)).slice(0, 3).map((c) => ({ date: c.data_signatura, kind: tr('Conveni', 'Convenio', 'Agreement'), title: c.objecte, meta: c.part_signant, href: `#/subvencions?q=${c.id}` })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);

  container.appendChild(h(`
    <div class="two-col">
      <section class="card" aria-labelledby="h-news">
        <div class="card-head"><h2 id="h-news" class="card-title">${tr('Darreres publicacions', 'Últimas publicaciones', 'Latest updates')}</h2><a href="feed.xml" class="small">${icon('rss', 14)} Atom</a></div>
        <ol class="news-list">${novetats.map((n) => `<li><a href="${n.href}"><time datetime="${n.date}">${fmt.date(n.date)}</time><span class="news-kind">${n.kind}</span><span class="news-title">${esc(n.title)}</span><span class="news-meta">${esc(n.meta)}</span></a></li>`).join('')}</ol>
      </section>
      <section class="card" aria-labelledby="h-blocs">
        <div class="card-head"><h2 id="h-blocs" class="card-title">${tr('Compliment per blocs de la Llei 19/2014', 'Cumplimiento por bloques de la Ley 19/2014', 'Compliance by block (Law 19/2014)')}</h2></div>
        <ul class="meter-list">${score.byBloc.map((b) => `<li><a href="#/compliment?bloc=${b.bloc}"><span class="ml-label">${label('bloc_obligacio', b.bloc)}</span><span class="ml-val">${fmt.dec(b.score, 0)} %</span>${meter(b.score, { labelText: label('bloc_obligacio', b.bloc) })}</a></li>`).join('')}</ul>
      </section>
    </div>`));

  container.appendChild(h(`
    <section class="card open-data-teaser">
      <div>
        <h2 class="card-title">${icon('database', 22)} ${tr('Dades obertes i interoperables per defecte', 'Datos abiertos e interoperables por defecto', 'Open and interoperable by default')}</h2>
        <p>${tr(
          'Cada gràfic del portal es pot veure com a taula i descarregar. Els conjunts de dades es publiquen en CSV i JSON, descrits amb DCAT-AP (federable amb datos.gob.es i data.europa.eu), esquemes Frictionless i una API documentada amb OpenAPI.',
          'Cada gráfico del portal se puede ver como tabla y descargar. Los conjuntos de datos se publican en CSV y JSON, descritos con DCAT-AP (federable con datos.gob.es y data.europa.eu), esquemas Frictionless y una API documentada con OpenAPI.',
          'Every chart can be viewed as a table and downloaded. Datasets are published as CSV and JSON, described with DCAT-AP (harvestable by datos.gob.es and data.europa.eu), Frictionless schemas and an OpenAPI-documented API.')}</p>
        <ul class="chips">${['CSV', 'JSON', 'DCAT-AP', 'RDF', 'Frictionless', 'OpenAPI', 'Atom', 'CC BY 4.0'].map((c) => `<li>${c}</li>`).join('')}</ul>
      </div>
      <a class="btn" href="#/dades-obertes">${tr('Anar al catàleg', 'Ir al catálogo', 'Go to the catalogue')} →</a>
    </section>`));
}
