#!/usr/bin/env node
/**
 * Construeix la capa d'interoperabilitat del portal a partir de:
 *   - data/<conjunt>.json        (dades font)
 *   - data/metadata/datasets.json (metadades del catàleg i esquemes)
 *   - data/codelists.json         (vocabularis controlats)
 *
 * Genera:
 *   - data/csv/<conjunt>.csv          CSV RFC 4180, UTF-8
 *   - data/catalog.jsonld             DCAT-AP 3 (JSON-LD)
 *   - data/catalog.ttl                DCAT-AP 3 (Turtle)
 *   - data/catalog.rdf                DCAT-AP-ES (RDF/XML, federable amb datos.gob.es)
 *   - datapackage.json                Frictionless Data Package + Table Schema
 *   - api/openapi.json                Descripció OpenAPI 3.1 de l'API estàtica
 *   - api/v1/index.json               Índex d'endpoints
 *   - feed.xml                        Canal Atom de novetats
 *   - sitemap.xml
 *
 * I VALIDA: camps declarats ↔ camps reals, tipus i valors de les llistes de codis.
 * Surt amb codi 1 si troba errors (útil a la integració contínua).
 *
 * Variable d'entorn opcional: BASE_URL (URL pública del portal, sense barra final).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_URL || 'https://jtorresestiguin-cloud.github.io/portal-transparencia').replace(/\/$/, '');
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const write = (p, content) => {
  mkdirSync(dirname(join(ROOT, p)), { recursive: true });
  writeFileSync(join(ROOT, p), content);
  console.log(`  ✓ ${p}`);
};

const meta = readJSON('data/metadata/datasets.json');
const codelists = readJSON('data/codelists.json');
const errors = [];

// ---------------------------------------------------------------------------
// Validació
// ---------------------------------------------------------------------------
const TYPE_CHECK = {
  string: (v) => typeof v === 'string',
  integer: (v) => Number.isInteger(v),
  number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean',
  date: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v),
  yearmonth: (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v),
};

const datasets = meta.conjunts.map((ds) => {
  const file = `data/${ds.id}.json`;
  if (!existsSync(join(ROOT, file))) { errors.push(`${ds.id}: falta ${file}`); return { ...ds, rows: [] }; }
  const src = readJSON(file);
  const rows = src.dades;
  const declared = ds.camps.map((c) => c.nom);
  rows.forEach((row, i) => {
    const keys = Object.keys(row);
    for (const k of keys) if (!declared.includes(k)) errors.push(`${ds.id}[${i}]: camp no declarat "${k}"`);
    for (const c of ds.camps) {
      const v = row[c.nom];
      if (v === null || v === undefined) continue;
      if (!TYPE_CHECK[c.tipus](v)) errors.push(`${ds.id}[${i}].${c.nom}: tipus ${c.tipus} invàlid (${JSON.stringify(v)})`);
      if (c.llista) {
        const ok = c.llista.split('|').some((l) => codelists[l] && Object.hasOwn(codelists[l], String(v)));
        if (!ok) errors.push(`${ds.id}[${i}].${c.nom}: valor "${v}" fora de la llista ${c.llista}`);
      }
    }
  });
  return { ...ds, rows, source: src };
});

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------
const csvCell = (v) => {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
console.log('Generant CSV…');
for (const ds of datasets) {
  const cols = ds.camps.map((c) => c.nom);
  const lines = [cols.join(','), ...ds.rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))];
  ds.csvBytes = Buffer.byteLength(lines.join('\r\n') + '\r\n');
  write(`data/csv/${ds.id}.csv`, lines.join('\r\n') + '\r\n');
  ds.jsonBytes = Buffer.byteLength(readFileSync(join(ROOT, `data/${ds.id}.json`)));
}

// ---------------------------------------------------------------------------
// DCAT-AP: model comú
// ---------------------------------------------------------------------------
const FREQ = (f) => `http://publications.europa.eu/resource/authority/frequency/${f}`;
const EU_THEME = (t) => `http://publications.europa.eu/resource/authority/data-theme/${t}`;
const NTI_THEME = (t) => `http://datos.gob.es/kos/sector-publico/sector/${t}`;
const FMT = { csv: 'http://publications.europa.eu/resource/authority/file-type/CSV', json: 'http://publications.europa.eu/resource/authority/file-type/JSON' };
const MT = { csv: 'http://www.iana.org/assignments/media-types/text/csv', json: 'http://www.iana.org/assignments/media-types/application/json' };
const LANG = { ca: 'http://publications.europa.eu/resource/authority/language/CAT', es: 'http://publications.europa.eu/resource/authority/language/SPA', en: 'http://publications.europa.eu/resource/authority/language/ENG' };
const cat = meta.cataleg;
const catalogURI = `${BASE}/data/catalog`;
const publisherURI = `${BASE}/#organitzacio`;
const dsURI = (id) => `${BASE}/#/dades-obertes/${id}`;
const distURI = (id, f) => `${BASE}/data/${f === 'csv' ? 'csv/' : ''}${id}.${f}`;

// JSON-LD
const langMap = (o) => Object.entries(o).map(([l, v]) => ({ '@language': l, '@value': v }));
const jsonld = {
  '@context': {
    dcat: 'http://www.w3.org/ns/dcat#', dct: 'http://purl.org/dc/terms/', foaf: 'http://xmlns.com/foaf/0.1/',
    vcard: 'http://www.w3.org/2006/vcard/ns#', xsd: 'http://www.w3.org/2001/XMLSchema#', adms: 'http://www.w3.org/ns/adms#',
    schema: 'https://schema.org/',
  },
  '@id': catalogURI,
  '@type': 'dcat:Catalog',
  'dct:title': langMap(cat.titol),
  'dct:description': langMap(cat.descripcio),
  'dct:publisher': { '@id': publisherURI, '@type': 'foaf:Agent', 'foaf:name': cat.publicador.nom, 'dct:identifier': cat.publicador.dir3 },
  'dct:language': cat.idiomes.map((l) => ({ '@id': LANG[l] })),
  'dct:license': { '@id': cat.llicencia },
  'dct:issued': { '@value': '2026-01-15', '@type': 'xsd:date' },
  'dct:modified': { '@value': TODAY, '@type': 'xsd:date' },
  'dct:spatial': [{ '@id': cat.espai }, { '@id': cat.espai_nti }],
  'foaf:homepage': { '@id': `${BASE}/` },
  'dcat:themeTaxonomy': { '@id': 'http://publications.europa.eu/resource/authority/data-theme' },
  'dcat:dataset': datasets.map((ds) => ({
    '@id': dsURI(ds.id),
    '@type': 'dcat:Dataset',
    'dct:identifier': ds.id,
    'dct:title': langMap(ds.titol),
    'dct:description': langMap(ds.descripcio),
    'dcat:keyword': ds.paraules_clau.map((k) => ({ '@language': 'ca', '@value': k })),
    'dcat:theme': [{ '@id': EU_THEME(ds.tema_eu) }, { '@id': NTI_THEME(ds.tema_nti) }],
    'dct:publisher': { '@id': publisherURI },
    'dct:accrualPeriodicity': { '@id': FREQ(ds.periodicitat) },
    'dct:temporal': { '@type': 'dct:PeriodOfTime', 'dcat:startDate': { '@value': ds.temporal[0], '@type': 'xsd:date' }, 'dcat:endDate': { '@value': ds.temporal[1], '@type': 'xsd:date' } },
    'dct:spatial': { '@id': cat.espai },
    'dct:modified': { '@value': TODAY, '@type': 'xsd:date' },
    'dct:language': cat.idiomes.map((l) => ({ '@id': LANG[l] })),
    'dcat:contactPoint': { '@type': 'vcard:Organization', 'vcard:fn': 'Unitat de Transparència', 'vcard:hasEmail': { '@id': cat.contacte } },
    'dcat:landingPage': { '@id': `${BASE}/#/${ds.seccio}` },
    'dct:conformsTo': { '@id': `${BASE}/datapackage.json#${ds.id}` },
    'dcat:distribution': ['csv', 'json'].map((f) => ({
      '@id': distURI(ds.id, f),
      '@type': 'dcat:Distribution',
      'dct:title': { '@language': 'ca', '@value': `${ds.titol.ca} (${f.toUpperCase()})` },
      'dcat:accessURL': { '@id': distURI(ds.id, f) },
      'dcat:downloadURL': { '@id': distURI(ds.id, f) },
      'dct:format': { '@id': FMT[f] },
      'dcat:mediaType': { '@id': MT[f] },
      'dcat:byteSize': { '@value': String(f === 'csv' ? ds.csvBytes : ds.jsonBytes), '@type': 'xsd:nonNegativeInteger' },
      'dct:license': { '@id': cat.llicencia },
    })),
  })),
};

// Turtle i RDF/XML (serialitzadors mínims sobre el mateix model)
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function turtle() {
  const L = [];
  L.push('@prefix dcat: <http://www.w3.org/ns/dcat#> .', '@prefix dct: <http://purl.org/dc/terms/> .', '@prefix foaf: <http://xmlns.com/foaf/0.1/> .',
    '@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .', '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .', '');
  const lm = (o) => Object.entries(o).map(([l, v]) => `"${esc(v)}"@${l}`).join(', ');
  L.push(`<${catalogURI}> a dcat:Catalog ;`,
    `  dct:title ${lm(cat.titol)} ;`, `  dct:description ${lm(cat.descripcio)} ;`,
    `  dct:publisher <${publisherURI}> ;`, `  dct:license <${cat.llicencia}> ;`,
    `  dct:language ${cat.idiomes.map((l) => `<${LANG[l]}>`).join(', ')} ;`,
    `  dct:modified "${TODAY}"^^xsd:date ;`, `  foaf:homepage <${BASE}/> ;`,
    `  dcat:dataset ${datasets.map((d) => `<${dsURI(d.id)}>`).join(',\n    ')} .`, '');
  L.push(`<${publisherURI}> a foaf:Agent ; foaf:name "${esc(cat.publicador.nom)}" ; dct:identifier "${cat.publicador.dir3}" .`, '');
  for (const ds of datasets) {
    L.push(`<${dsURI(ds.id)}> a dcat:Dataset ;`,
      `  dct:identifier "${ds.id}" ;`, `  dct:title ${lm(ds.titol)} ;`, `  dct:description ${lm(ds.descripcio)} ;`,
      `  dcat:keyword ${ds.paraules_clau.map((k) => `"${esc(k)}"@ca`).join(', ')} ;`,
      `  dcat:theme <${EU_THEME(ds.tema_eu)}>, <${NTI_THEME(ds.tema_nti)}> ;`,
      `  dct:publisher <${publisherURI}> ;`, `  dct:accrualPeriodicity <${FREQ(ds.periodicitat)}> ;`,
      `  dct:temporal [ a dct:PeriodOfTime ; dcat:startDate "${ds.temporal[0]}"^^xsd:date ; dcat:endDate "${ds.temporal[1]}"^^xsd:date ] ;`,
      `  dct:spatial <${cat.espai}> ;`, `  dct:modified "${TODAY}"^^xsd:date ;`,
      `  dcat:contactPoint [ a vcard:Organization ; vcard:fn "Unitat de Transparència" ; vcard:hasEmail <${cat.contacte}> ] ;`,
      `  dcat:landingPage <${BASE}/#/${ds.seccio}> ;`,
      `  dcat:distribution <${distURI(ds.id, 'csv')}>, <${distURI(ds.id, 'json')}> .`, '');
    for (const f of ['csv', 'json']) {
      L.push(`<${distURI(ds.id, f)}> a dcat:Distribution ;`, `  dcat:accessURL <${distURI(ds.id, f)}> ;`, `  dcat:downloadURL <${distURI(ds.id, f)}> ;`,
        `  dct:format <${FMT[f]}> ;`, `  dcat:mediaType <${MT[f]}> ;`, `  dcat:byteSize "${f === 'csv' ? ds.csvBytes : ds.jsonBytes}"^^xsd:nonNegativeInteger ;`,
        `  dct:license <${cat.llicencia}> .`, '');
    }
  }
  return L.join('\n');
}

function rdfxml() {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>',
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:dcat="http://www.w3.org/ns/dcat#" xmlns:dct="http://purl.org/dc/terms/" xmlns:foaf="http://xmlns.com/foaf/0.1/" xmlns:vcard="http://www.w3.org/2006/vcard/ns#" xmlns:time="http://www.w3.org/2006/time#">'];
  const lm = (tag, o, ind) => Object.entries(o).map(([l, v]) => `${ind}<${tag} xml:lang="${l}">${xesc(v)}</${tag}>`).join('\n');
  L.push(`  <dcat:Catalog rdf:about="${xesc(catalogURI)}">`, lm('dct:title', cat.titol, '    '), lm('dct:description', cat.descripcio, '    '),
    `    <dct:publisher rdf:resource="${xesc(publisherURI)}"/>`, `    <dct:license rdf:resource="${cat.llicencia}"/>`,
    ...cat.idiomes.map((l) => `    <dct:language rdf:resource="${LANG[l]}"/>`),
    `    <dct:spatial rdf:resource="${cat.espai_nti}"/>`,
    `    <dct:issued rdf:datatype="http://www.w3.org/2001/XMLSchema#date">2026-01-15</dct:issued>`,
    `    <dct:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${TODAY}</dct:modified>`,
    `    <foaf:homepage rdf:resource="${xesc(BASE)}/"/>`,
    `    <dcat:themeTaxonomy rdf:resource="http://datos.gob.es/kos/sector-publico/sector/"/>`);
  for (const ds of datasets) {
    L.push('    <dcat:dataset>', `      <dcat:Dataset rdf:about="${xesc(dsURI(ds.id))}">`,
      `        <dct:identifier>${xesc(dsURI(ds.id))}</dct:identifier>`,
      lm('dct:title', ds.titol, '        '), lm('dct:description', ds.descripcio, '        '),
      ...ds.paraules_clau.map((k) => `        <dcat:keyword xml:lang="ca">${xesc(k)}</dcat:keyword>`),
      `        <dcat:theme rdf:resource="${NTI_THEME(ds.tema_nti)}"/>`,
      `        <dcat:theme rdf:resource="${EU_THEME(ds.tema_eu)}"/>`,
      `        <dct:publisher rdf:resource="${xesc(publisherURI)}"/>`,
      `        <dct:accrualPeriodicity rdf:resource="${FREQ(ds.periodicitat)}"/>`,
      `        <dct:spatial rdf:resource="${cat.espai_nti}"/>`,
      `        <dct:temporal><dct:PeriodOfTime><dcat:startDate rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${ds.temporal[0]}</dcat:startDate><dcat:endDate rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${ds.temporal[1]}</dcat:endDate></dct:PeriodOfTime></dct:temporal>`,
      ...cat.idiomes.map((l) => `        <dct:language>${l}</dct:language>`),
      `        <dct:license rdf:resource="${cat.llicencia}"/>`,
      `        <dct:modified rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${TODAY}</dct:modified>`,
      `        <dcat:landingPage rdf:resource="${xesc(`${BASE}/#/${ds.seccio}`)}"/>`);
    for (const f of ['csv', 'json']) {
      L.push('        <dcat:distribution>', `          <dcat:Distribution rdf:about="${xesc(distURI(ds.id, f))}">`,
        `            <dct:title xml:lang="ca">${xesc(ds.titol.ca)} (${f.toUpperCase()})</dct:title>`,
        `            <dcat:accessURL rdf:resource="${xesc(distURI(ds.id, f))}"/>`,
        `            <dcat:downloadURL rdf:resource="${xesc(distURI(ds.id, f))}"/>`,
        `            <dct:format><dct:IMT><rdf:value>${f === 'csv' ? 'text/csv' : 'application/json'}</rdf:value><rdfs:label xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#">${f.toUpperCase()}</rdfs:label></dct:IMT></dct:format>`,
        `            <dcat:byteSize rdf:datatype="http://www.w3.org/2001/XMLSchema#decimal">${f === 'csv' ? ds.csvBytes : ds.jsonBytes}</dcat:byteSize>`,
        '          </dcat:Distribution>', '        </dcat:distribution>');
    }
    L.push('      </dcat:Dataset>', '    </dcat:dataset>');
  }
  L.push('  </dcat:Catalog>', `  <foaf:Agent rdf:about="${xesc(publisherURI)}"><foaf:name>${xesc(cat.publicador.nom)}</foaf:name><dct:identifier>${cat.publicador.dir3}</dct:identifier></foaf:Agent>`, '</rdf:RDF>', '');
  return L.join('\n');
}

console.log('Generant catàleg DCAT-AP…');
write('data/catalog.jsonld', JSON.stringify(jsonld, null, 2) + '\n');
write('data/catalog.ttl', turtle());
write('data/catalog.rdf', rdfxml());

// ---------------------------------------------------------------------------
// Frictionless Data Package
// ---------------------------------------------------------------------------
const FL_TYPE = { string: 'string', integer: 'integer', number: 'number', boolean: 'boolean', date: 'date', yearmonth: 'yearmonth' };
const datapackage = {
  profile: 'tabular-data-package',
  name: 'consorci-turisme-barcelona-transparencia',
  title: cat.titol.ca,
  description: cat.descripcio.ca,
  homepage: `${BASE}/`,
  version: TODAY.replace(/-/g, '.'),
  created: `${TODAY}T00:00:00Z`,
  licenses: [{ name: 'CC-BY-4.0', path: cat.llicencia, title: 'Creative Commons Attribution 4.0' }],
  contributors: [{ title: cat.publicador.nom, role: 'publisher' }],
  keywords: ['transparència', 'turisme', 'Barcelona', 'dades obertes'],
  resources: datasets.map((ds) => ({
    name: ds.id,
    title: ds.titol.ca,
    description: ds.descripcio.ca,
    path: `data/csv/${ds.id}.csv`,
    profile: 'tabular-data-resource',
    format: 'csv', mediatype: 'text/csv', encoding: 'utf-8', bytes: ds.csvBytes,
    dialect: { delimiter: ',', lineTerminator: '\r\n', header: true },
    schema: {
      fields: ds.camps.map((c) => {
        const f = { name: c.nom, type: FL_TYPE[c.tipus], description: c.descripcio };
        if (c.format) f.format = c.format;
        if (c.tipus === 'boolean') { f.trueValues = ['true']; f.falseValues = ['false']; }
        if (c.llista) {
          const values = c.llista.split('|').flatMap((l) => Object.keys(codelists[l] || {}));
          f.constraints = { enum: values };
          f.rdfType = `${BASE}/data/codelists.json#${c.llista.split('|')[0]}`;
        }
        return f;
      }),
      ...(ds.camps.some((c) => c.nom === 'id') ? { primaryKey: 'id' } : {}),
      missingValues: [''],
    },
  })),
};
write('datapackage.json', JSON.stringify(datapackage, null, 2) + '\n');

// ---------------------------------------------------------------------------
// OpenAPI 3.1 (API estàtica de només lectura)
// ---------------------------------------------------------------------------
const OA_TYPE = { string: { type: 'string' }, integer: { type: 'integer' }, number: { type: 'number' }, boolean: { type: 'boolean' }, date: { type: 'string', format: 'date' }, yearmonth: { type: 'string', pattern: '^\\d{4}-\\d{2}$' } };
const schemaName = (id) => id.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join('');
const openapi = {
  openapi: '3.1.0',
  info: {
    title: 'API de dades obertes — Consorci de Turisme de Barcelona',
    version: '1.0.0',
    description: 'API REST estàtica de només lectura. Cada conjunt de dades es pot obtenir en JSON (amb metadades) o CSV. No requereix autenticació; CORS obert quan es serveix des de GitHub Pages o un CDN.',
    license: { name: 'CC BY 4.0 (dades)', url: cat.llicencia },
    contact: { name: 'Unitat de Transparència', email: cat.contacte.replace('mailto:', '') },
  },
  servers: [{ url: BASE }],
  tags: [{ name: 'catàleg' }, { name: 'conjunts' }],
  paths: {
    '/data/catalog.jsonld': { get: { tags: ['catàleg'], summary: 'Catàleg DCAT-AP (JSON-LD)', responses: { 200: { description: 'Catàleg', content: { 'application/ld+json': {} } } } } },
    '/data/catalog.rdf': { get: { tags: ['catàleg'], summary: 'Catàleg DCAT-AP-ES (RDF/XML) per federar amb datos.gob.es', responses: { 200: { description: 'Catàleg', content: { 'application/rdf+xml': {} } } } } },
    '/data/catalog.ttl': { get: { tags: ['catàleg'], summary: 'Catàleg DCAT-AP (Turtle)', responses: { 200: { description: 'Catàleg', content: { 'text/turtle': {} } } } } },
    '/datapackage.json': { get: { tags: ['catàleg'], summary: 'Frictionless Data Package amb Table Schema de cada recurs', responses: { 200: { description: 'Data package', content: { 'application/json': {} } } } } },
    '/data/codelists.json': { get: { tags: ['catàleg'], summary: 'Llistes de codis multilingües (ca/es/en)', responses: { 200: { description: 'Vocabularis', content: { 'application/json': {} } } } } },
  },
  components: { schemas: {} },
};
for (const ds of datasets) {
  const name = schemaName(ds.id);
  openapi.components.schemas[name] = {
    type: 'object',
    description: ds.titol.ca,
    properties: Object.fromEntries(ds.camps.map((c) => [c.nom, { ...OA_TYPE[c.tipus], description: c.descripcio, ...(c.llista ? { enum: c.llista.split('|').flatMap((l) => Object.keys(codelists[l] || {})) } : {}) }])),
  };
  openapi.paths[`/data/${ds.id}.json`] = {
    get: {
      tags: ['conjunts'], operationId: `get_${ds.id.replace(/-/g, '_')}`, summary: `${ds.titol.ca} (JSON)`, description: ds.descripcio.ca,
      responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { generat: { type: 'string', format: 'date' }, avis: { type: 'string' }, dades: { type: 'array', items: { $ref: `#/components/schemas/${name}` } } } } } } } },
    },
  };
  openapi.paths[`/data/csv/${ds.id}.csv`] = {
    get: { tags: ['conjunts'], operationId: `get_${ds.id.replace(/-/g, '_')}_csv`, summary: `${ds.titol.ca} (CSV)`, responses: { 200: { description: 'OK', content: { 'text/csv': {} } } } },
  };
}
write('api/openapi.json', JSON.stringify(openapi, null, 2) + '\n');
write('api/v1/index.json', JSON.stringify({
  api: 'v1', base: BASE, actualitzat: TODAY,
  cataleg: { jsonld: `${BASE}/data/catalog.jsonld`, rdf: `${BASE}/data/catalog.rdf`, turtle: `${BASE}/data/catalog.ttl`, datapackage: `${BASE}/datapackage.json`, openapi: `${BASE}/api/openapi.json` },
  conjunts: datasets.map((ds) => ({ id: ds.id, titol: ds.titol, registres: ds.rows.length, json: distURI(ds.id, 'json'), csv: distURI(ds.id, 'csv'), esquema: `${BASE}/datapackage.json#${ds.id}` })),
}, null, 2) + '\n');

// ---------------------------------------------------------------------------
// Atom feed (novetats: darrers contractes, convenis i actualitzacions)
// ---------------------------------------------------------------------------
const contractes = datasets.find((d) => d.id === 'contractes').rows.slice(0, 15);
const convenis = [...datasets.find((d) => d.id === 'convenis').rows].sort((a, b) => b.data_signatura.localeCompare(a.data_signatura)).slice(0, 5);
const fmtEur = (n) => new Intl.NumberFormat('ca-ES', { style: 'currency', currency: 'EUR' }).format(n);
const entries = [
  ...contractes.map((c) => ({ id: `${BASE}/#/contractacio/${c.id}`, title: `Contracte adjudicat: ${c.objecte}`, updated: c.data_adjudicacio, summary: `${c.adjudicatari} · ${fmtEur(c.import_adjudicacio_sense_iva)} sense IVA · ${codelists.procediment[c.procediment].ca}` })),
  ...convenis.map((c) => ({ id: `${BASE}/#/subvencions/${c.id}`, title: `Conveni signat: ${c.objecte}`, updated: c.data_signatura, summary: `${c.part_signant}` })),
].sort((a, b) => b.updated.localeCompare(a.updated));
write('feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ca">
  <title>Novetats — Portal de Transparència del Consorci de Turisme de Barcelona</title>
  <link href="${xesc(BASE)}/feed.xml" rel="self"/>
  <link href="${xesc(BASE)}/"/>
  <id>${xesc(BASE)}/feed.xml</id>
  <updated>${TODAY}T00:00:00Z</updated>
  <author><name>${xesc(cat.publicador.nom)}</name></author>
${entries.map((e) => `  <entry>
    <title>${xesc(e.title)}</title>
    <link href="${xesc(e.id)}"/>
    <id>${xesc(e.id)}</id>
    <updated>${e.updated}T00:00:00Z</updated>
    <summary>${xesc(e.summary)}</summary>
  </entry>`).join('\n')}
</feed>
`);

const SECCIONS = ['', 'institucio', 'economia', 'contractacio', 'subvencions', 'personal', 'bon-govern', 'activitat', 'dret-acces', 'compliment', 'dades-obertes', 'accessibilitat'];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${SECCIONS.map((s) => `  <url><loc>${xesc(BASE)}/${s ? `#/${s}` : ''}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
  <url><loc>${xesc(BASE)}/data/catalog.jsonld</loc><lastmod>${TODAY}</lastmod></url>
</urlset>
`);

// ---------------------------------------------------------------------------
if (errors.length) {
  console.error(`\n✗ ${errors.length} errors de validació:`);
  errors.slice(0, 50).forEach((e) => console.error('   - ' + e));
  process.exit(1);
}
console.log(`\n✓ Validació correcta: ${datasets.length} conjunts, ${datasets.reduce((s, d) => s + d.rows.length, 0)} registres.`);
