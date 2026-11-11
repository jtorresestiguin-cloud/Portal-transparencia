import { t, tr, pick, label, lang } from '../i18n.js';
import { h, sectionHeader, fmt, icon, esc, dataTable, definitionList } from '../ui.js';
import { datasetsMeta, rows } from '../app.js';

const FREQ = {
  CONT: ['Contínua', 'Continua', 'Continuous'], WEEKLY: ['Setmanal', 'Semanal', 'Weekly'], MONTHLY: ['Mensual', 'Mensual', 'Monthly'],
  QUARTERLY: ['Trimestral', 'Trimestral', 'Quarterly'], BIANNUAL: ['Semestral', 'Semestral', 'Half-yearly'], ANNUAL: ['Anual', 'Anual', 'Annual'],
};
const freq = (k) => tr(...(FREQ[k] || [k, k, k]));
const SECCIO_ICON = { economia: 'euro', contractacio: 'file', subvencions: 'hand', personal: 'users', 'bon-govern': 'shield', activitat: 'chart', 'dret-acces': 'inbox', compliment: 'check' };
const baseURL = () => new URL('.', location.href.split('#')[0]).href;

function copyButton(text) {
  return `<button type="button" class="icon-btn copy-btn" data-copy="${esc(text)}" title="${esc(tr('Copia', 'Copiar', 'Copy'))}">${icon('copy', 16)}<span class="sr-only">${tr('Copia', 'Copiar', 'Copy')}</span></button>`;
}
function bindCopy(root) {
  root.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copy); b.classList.add('copied'); b.title = tr('Copiat!', '¡Copiado!', 'Copied!'); setTimeout(() => b.classList.remove('copied'), 1500); } catch { /* */ }
  });
}

export default async function render(root, { sub, query }) {
  const meta = await datasetsMeta();
  const index = await fetch('api/v1/index.json').then((r) => r.json()).catch(() => ({ conjunts: [] }));
  const count = (id) => index.conjunts.find((d) => d.id === id)?.registres;
  if (sub) return renderDetail(root, meta, sub, count(sub));

  root.appendChild(h(sectionHeader({ kicker: t('portal_name'), iconName: 'database', title: t('nav_dades-obertes'), intro: t('intro_dades-obertes') })));
  const c = h('<div class="container"></div>');
  root.appendChild(c);
  bindCopy(c);
  const base = baseURL();
  const interop = [
    ['DCAT-AP · JSON-LD', 'data/catalog.jsonld', tr('Catàleg segons el perfil europeu d’aplicació DCAT. Federable amb data.europa.eu.', 'Catálogo según el perfil europeo de aplicación DCAT. Federable con data.europa.eu.', 'Catalogue in the European DCAT application profile. Harvestable by data.europa.eu.'), 'database'],
    ['DCAT-AP-ES · RDF/XML', 'data/catalog.rdf', tr('Format de federació amb datos.gob.es (NTI-RISP).', 'Formato de federación con datos.gob.es (NTI-RISP).', 'Harvesting format for datos.gob.es (NTI-RISP).'), 'database'],
    ['DCAT-AP · Turtle', 'data/catalog.ttl', tr('Mateix catàleg en Turtle per a eines de web semàntic.', 'Mismo catálogo en Turtle para herramientas de web semántica.', 'Same catalogue in Turtle for semantic-web tools.'), 'database'],
    ['Frictionless Data Package', 'datapackage.json', tr('Esquema de cada taula (tipus, descripció, valors permesos) per validar i carregar automàticament.', 'Esquema de cada tabla (tipo, descripción, valores permitidos) para validar y cargar automáticamente.', 'Per-table schema (types, descriptions, allowed values) for validation and automated loading.'), 'code'],
    ['OpenAPI 3.1', 'api/openapi.json', tr('Descripció formal de l’API REST de només lectura.', 'Descripción formal de la API REST de solo lectura.', 'Formal description of the read-only REST API.'), 'code'],
    [tr('Llistes de codis', 'Listas de códigos', 'Code lists'), 'data/codelists.json', tr('Vocabularis controlats amb etiquetes en català, castellà i anglès.', 'Vocabularios controlados con etiquetas en catalán, castellano e inglés.', 'Controlled vocabularies labelled in Catalan, Spanish and English.'), 'globe'],
    ['Atom', 'feed.xml', tr('Canal de novetats per subscriure’s a noves publicacions.', 'Canal de novedades para suscribirse a nuevas publicaciones.', 'Feed to subscribe to new publications.'), 'rss'],
  ];
  c.appendChild(h(`<section aria-labelledby="h-interop"><h2 class="section-title" id="h-interop">${tr('Interoperabilitat', 'Interoperabilidad', 'Interoperability')}</h2>
    <ul class="interop-grid">${interop.map(([n, p, d, ic]) => `<li class="card interop"><div class="interop-head">${icon(ic, 20)}<strong>${n}</strong></div><p>${d}</p><div class="interop-url"><a href="${p}"><code>${p}</code></a>${copyButton(base + p)}</div></li>`).join('')}</ul></section>`));

  c.appendChild(h(`<h2 class="section-title">${tr('Catàleg de conjunts de dades', 'Catálogo de conjuntos de datos', 'Dataset catalogue')}</h2>`));
  c.appendChild(h(`<form class="filters" onsubmit="return false"><label class="control grow" for="f-q"><span>${tr('Cerca al catàleg', 'Buscar en el catálogo', 'Search the catalogue')}</span><input id="f-q" type="search" value="${esc(query.get('q') || '')}" placeholder="${esc(tr('Pressupost, contractes, turisme…', 'Presupuesto, contratos, turismo…', 'Budget, contracts, tourism…'))}"></label></form>`));
  const list = h('<ul class="dataset-grid"></ul>');
  c.appendChild(list);
  const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const draw = (q = '') => {
    const f = meta.conjunts.filter((d) => !q || norm(`${pick(d.titol)} ${pick(d.descripcio)} ${d.paraules_clau.join(' ')} ${d.id}`).includes(norm(q)));
    list.innerHTML = f.length ? f.map((d) => `<li class="card dataset">
      <a class="dataset-title" href="#/dades-obertes/${d.id}">${icon(SECCIO_ICON[d.seccio] || 'database', 20)}<span>${esc(pick(d.titol))}</span></a>
      <p>${esc(pick(d.descripcio))}</p>
      <ul class="dataset-meta"><li>${fmt.int(count(d.id) || 0)} ${t('records')}</li><li>${freq(d.periodicitat)}</li><li>${d.temporal[0].slice(0, 4)}–${d.temporal[1].slice(0, 4)}</li></ul>
      <div class="dataset-actions"><a class="fmt-btn" href="data/csv/${d.id}.csv" download>CSV</a><a class="fmt-btn" href="data/${d.id}.json">JSON</a><a class="link-btn" href="#/dades-obertes/${d.id}">${tr('Fitxa i esquema', 'Ficha y esquema', 'Details & schema')} →</a></div>
    </li>`).join('') : `<li class="notice">${t('no_results')}</li>`;
  };
  draw(query.get('q') || '');
  c.querySelector('#f-q').addEventListener('input', (e) => draw(e.target.value));

  c.appendChild(h(`<section class="card prose"><h2 class="card-title">${tr('Condicions de reutilització', 'Condiciones de reutilización', 'Terms of reuse')}</h2>
    <p>${tr(
      'Totes les dades es publiquen sota la llicència Creative Commons Reconeixement 4.0 (CC BY 4.0): les pots copiar, transformar i redistribuir, també amb finalitat comercial, citant el Consorci de Turisme de Barcelona com a font. Els fitxers CSV estan codificats en UTF-8, amb coma com a separador i el punt com a separador decimal; les dates segueixen la norma ISO 8601.',
      'Todos los datos se publican bajo la licencia Creative Commons Reconocimiento 4.0 (CC BY 4.0): puedes copiarlos, transformarlos y redistribuirlos, también con finalidad comercial, citando al Consorci de Turisme de Barcelona como fuente. Los ficheros CSV están codificados en UTF-8, con coma como separador y punto como separador decimal; las fechas siguen la norma ISO 8601.',
      'All data is published under Creative Commons Attribution 4.0 (CC BY 4.0): you may copy, transform and redistribute it, including commercially, crediting the Barcelona Tourism Consortium as source. CSV files are UTF-8, comma-separated, with a dot as decimal separator; dates follow ISO 8601.')}</p></section>`));
}

async function renderDetail(root, meta, id, n) {
  const d = meta.conjunts.find((x) => x.id === id);
  if (!d) { root.appendChild(h(`<section class="container narrow"><h1 id="page-title" tabindex="-1">${t('not_found')}</h1><p><a href="#/dades-obertes">← ${t('nav_dades-obertes')}</a></p></section>`)); return; }
  const data = await rows(id);
  const codelists = (await import('../i18n.js')).getCodelists();
  const base = baseURL();
  const jsonURL = `${base}data/${id}.json`, csvURL = `${base}data/csv/${id}.csv`;

  root.appendChild(h(`<header class="page-head"><div class="page-head-inner">
    <nav class="breadcrumb" aria-label="${tr('Ruta', 'Ruta', 'Breadcrumb')}"><a href="#/dades-obertes">${t('nav_dades-obertes')}</a> / <span>${id}</span></nav>
    <h1 id="page-title" tabindex="-1">${esc(pick(d.titol))}</h1><p class="lead">${esc(pick(d.descripcio))}</p></div></header>`));
  const c = h('<div class="container"></div>');
  root.appendChild(c);
  bindCopy(c);

  c.appendChild(h(`<div class="two-col wide-left">
    <section class="card">
      <h2 class="card-title">${tr('Descàrrega i accés programàtic', 'Descarga y acceso programático', 'Download & programmatic access')}</h2>
      <div class="download-row"><a class="btn" href="data/csv/${id}.csv" download>${icon('download', 16)} CSV</a><a class="btn" href="data/${id}.json">${icon('download', 16)} JSON</a><a class="btn-ghost" href="#/${d.seccio}">${icon('chart', 16)} ${tr('Veure visualitzat', 'Ver visualizado', 'See it visualised')}</a></div>
      <p class="label-sm">API REST (JSON)</p><div class="interop-url"><code>${jsonURL}</code>${copyButton(jsonURL)}</div>
      <p class="label-sm">CSV</p><div class="interop-url"><code>${csvURL}</code>${copyButton(csvURL)}</div>
      <div class="tabs" role="tablist" aria-label="${tr('Exemples de codi', 'Ejemplos de código', 'Code examples')}">
        ${['curl', 'Python', 'R', 'JavaScript'].map((l, i) => `<button type="button" role="tab" id="tab-${i}" aria-controls="panel-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${l}</button>`).join('')}
      </div>
      ${[
        `curl -s ${jsonURL} | jq '.dades | length'`,
        `import pandas as pd\n\ndf = pd.read_csv("${csvURL}")\nprint(df.head())`,
        `library(readr)\n\ndf <- read_csv("${csvURL}")\nsummary(df)`,
        `const res = await fetch("${jsonURL}");\nconst { dades } = await res.json();\nconsole.table(dades.slice(0, 5));`,
      ].map((code, i) => `<div role="tabpanel" id="panel-${i}" aria-labelledby="tab-${i}"${i ? ' hidden' : ''} class="code-panel"><pre><code>${esc(code)}</code></pre>${copyButton(code)}</div>`).join('')}
    </section>
    <section class="card">
      <h2 class="card-title">${tr('Metadades', 'Metadatos', 'Metadata')}</h2>
      ${definitionList([
        [tr('Identificador', 'Identificador', 'Identifier'), `<code>${id}</code>`],
        [tr('Registres', 'Registros', 'Records'), fmt.int(n ?? data.length)],
        [tr('Publicador', 'Publicador', 'Publisher'), esc(meta.cataleg.publicador.nom)],
        [tr('Llicència', 'Licencia', 'Licence'), `<a href="${meta.cataleg.llicencia}" rel="license">CC BY 4.0</a>`],
        [tr('Periodicitat', 'Periodicidad', 'Frequency'), freq(d.periodicitat)],
        [tr('Cobertura temporal', 'Cobertura temporal', 'Temporal coverage'), `${fmt.date(d.temporal[0])} – ${fmt.date(d.temporal[1])}`],
        [tr('Cobertura geogràfica', 'Cobertura geográfica', 'Spatial coverage'), 'Barcelona'],
        [tr('Temes', 'Temas', 'Themes'), `<a href="http://publications.europa.eu/resource/authority/data-theme/${d.tema_eu}" rel="noopener">EU: ${d.tema_eu}</a> · <a href="http://datos.gob.es/kos/sector-publico/sector/${d.tema_nti}" rel="noopener">NTI: ${d.tema_nti}</a>`],
        [tr('Paraules clau', 'Palabras clave', 'Keywords'), d.paraules_clau.map((k) => `<span class="chip">${esc(k)}</span>`).join(' ')],
        [tr('Idiomes', 'Idiomas', 'Languages'), 'ca · es · en'],
      ])}
    </section></div>`));

  const tabs = [...c.querySelectorAll('[role="tab"]')];
  const select = (i) => tabs.forEach((tb, j) => { tb.setAttribute('aria-selected', String(i === j)); tb.tabIndex = i === j ? 0 : -1; c.querySelector(`#panel-${j}`).hidden = i !== j; if (i === j) tb.focus(); });
  tabs.forEach((tb, i) => {
    tb.addEventListener('click', () => select(i));
    tb.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') select((i + 1) % tabs.length); if (e.key === 'ArrowLeft') select((i - 1 + tabs.length) % tabs.length); });
  });

  // Esquema
  c.appendChild(h(`<h2 class="section-title">${tr('Diccionari de dades', 'Diccionario de datos', 'Data dictionary')}</h2>`));
  const sch = h('<section class="card"></section>');
  sch.appendChild(dataTable({
    caption: tr('Diccionari de dades', 'Diccionario de datos', 'Data dictionary'),
    columns: [
      { key: 'nom', label: tr('Camp', 'Campo', 'Field'), html: true, format: (v) => `<code>${v}</code>` },
      { key: 'tipus', label: tr('Tipus', 'Tipo', 'Type'), html: true, format: (v) => `<span class="chip">${v}</span>` },
      { key: 'descripcio', label: tr('Descripció', 'Descripción', 'Description') },
      { key: 'llista', label: tr('Valors', 'Valores', 'Values'), html: true, format: (v) => {
        if (!v) return '—';
        const lists = v.split('|');
        const items = lists.flatMap((l) => Object.keys(codelists[l] || {}).map((k) => `<li><code>${esc(k)}</code> ${esc(label(l, k))}</li>`));
        return `<details><summary>${items.length} ${tr('codis', 'códigos', 'codes')}</summary><ul class="code-list">${items.join('')}</ul></details>`;
      } },
    ],
    rows: d.camps, pageSize: 50,
  }));
  c.appendChild(sch);

  // Previsualització
  c.appendChild(h(`<h2 class="section-title">${tr('Previsualització', 'Previsualización', 'Preview')}</h2>`));
  const pv = h('<section class="card"></section>');
  const cols = d.camps.slice(0, 8).map((f) => ({ key: f.nom, label: f.nom, align: ['number', 'integer'].includes(f.tipus) ? 'right' : 'left', format: (v) => (typeof v === 'boolean' ? String(v) : typeof v === 'number' ? fmt.dec(v, Number.isInteger(v) ? 0 : 2) : v) }));
  pv.appendChild(dataTable({ caption: tr('Previsualització', 'Previsualización', 'Preview'), columns: cols, rows: data, pageSize: 10, compact: true }));
  if (d.camps.length > 8) pv.appendChild(h(`<p class="muted small">${tr(`Es mostren 8 de ${d.camps.length} camps. Descarrega el fitxer per veure’ls tots.`, `Se muestran 8 de ${d.camps.length} campos. Descarga el fichero para verlos todos.`, `Showing 8 of ${d.camps.length} fields. Download the file to see them all.`)}</p>`));
  c.appendChild(pv);

  // schema.org Dataset (per a cercadors de dades)
  document.querySelectorAll('script[data-schema-dataset]').forEach((s) => s.remove());
  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.dataset.schemaDataset = '';
  ld.textContent = JSON.stringify({
    '@context': 'https://schema.org/', '@type': 'Dataset', name: pick(d.titol), description: pick(d.descripcio), inLanguage: lang(),
    url: location.href, identifier: id, keywords: d.paraules_clau, license: meta.cataleg.llicencia, isAccessibleForFree: true,
    temporalCoverage: `${d.temporal[0]}/${d.temporal[1]}`, spatialCoverage: 'Barcelona',
    creator: { '@type': 'GovernmentOrganization', name: meta.cataleg.publicador.nom },
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: csvURL }, { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: jsonURL }],
  });
  document.head.appendChild(ld);
}
