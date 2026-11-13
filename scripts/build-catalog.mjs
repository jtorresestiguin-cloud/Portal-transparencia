#!/usr/bin/env node
/**
 * Construye la capa de interoperabilidad a partir de:
 *   config/entidad.json, data/<conjunto>.json, data/metadata/datasets.json, data/codelists.json
 * Genera: data/csv/*.csv, data/catalog.{jsonld,ttl,rdf} (DCAT-AP / DCAT-AP-ES),
 *   datapackage.json (Frictionless), api/openapi.json, api/v1/index.json, feed.xml, sitemap.xml
 * Y VALIDA cada registro contra su esquema (sale con código 1 si hay errores).
 * Variable opcional: BASE_URL (URL pública del portal).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toXLSX } from '../assets/js/xlsx.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_URL || 'https://jtorresestiguin-cloud.github.io/Portal-transparencia').replace(/\/$/, '');
const TODAY = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const readJSON = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const write = (p, c) => { mkdirSync(dirname(join(ROOT, p)), { recursive: true }); writeFileSync(join(ROOT, p), c); console.log(`  ✓ ${p}`); };

const ent = readJSON('config/entidad.json');
const meta = readJSON('data/metadata/datasets.json');
const codelists = readJSON('data/codelists.json');
const errors = [];
const warnings = [];

// ---------------------------------------------------------------- validación
const CHECK = {
  string: (v) => typeof v === 'string', integer: (v) => Number.isInteger(v), number: (v) => typeof v === 'number' && Number.isFinite(v),
  boolean: (v) => typeof v === 'boolean', date: (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v), yearmonth: (v) => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v),
};
const datasets = meta.conjuntos.map((ds) => {
  const file = `data/${ds.id}.json`;
  if (!existsSync(join(ROOT, file))) { errors.push(`${ds.id}: falta ${file}`); return { ...ds, rows: [], src: {} }; }
  const src = readJSON(file);
  const rows = src.datos || [];
  const names = ds.campos.map((c) => c.nombre);
  rows.forEach((row, i) => {
    for (const k of Object.keys(row)) if (!names.includes(k)) errors.push(`${ds.id}[${i}]: campo no declarado «${k}»`);
    for (const c of ds.campos) {
      const v = row[c.nombre];
      if (v === null || v === undefined || v === '') continue;
      if (!CHECK[c.tipo](v)) errors.push(`${ds.id}[${i}].${c.nombre}: tipo ${c.tipo} no válido (${JSON.stringify(v)})`);
      else if (c.lista && !c.lista.split('|').some((l) => codelists[l] && Object.hasOwn(codelists[l], String(v)))) {
        // Un código nuevo procedente de una fuente oficial no debe bloquear la publicación: se avisa.
        (['placsp', 'bdns'].includes(row.fuente) ? warnings : errors).push(`${ds.id}[${i}].${c.nombre}: «${v}» no está en la lista ${c.lista}`);
      }
    }
  });
  return { ...ds, rows, src };
});
// Contenidos: cada página referenciada en portal.json existe y cada bloque tiene tipo
const portal = readJSON('content/portal.json');
const paginas = existsSync(join(ROOT, 'content/paginas')) ? readdirSync(join(ROOT, 'content/paginas')).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)) : [];
for (const cat of portal.categorias) for (const p of cat.paginas) if (!paginas.includes(p)) errors.push(`portal.json: la categoría «${cat.id}» enlaza la página inexistente «${p}»`);
for (const p of paginas) {
  const pg = readJSON(`content/paginas/${p}.json`);
  (pg.bloques || []).forEach((b, i) => { if (!b.tipo) errors.push(`paginas/${p}.json: el bloque ${i} no tiene tipo`); if (b.conjunto && !meta.conjuntos.some((d) => d.id === b.conjunto)) errors.push(`paginas/${p}.json: bloque ${i} usa el conjunto inexistente «${b.conjunto}»`); });
}

// ---------------------------------------------------------------- CSV
const cell = (v) => { if (v === null || v === undefined) return ''; const s = typeof v === 'boolean' ? String(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
console.log('CSV…');
for (const ds of datasets) {
  const cols = ds.campos.map((c) => c.nombre);
  const out = [cols.join(','), ...ds.rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n') + '\r\n';
  ds.csvBytes = Buffer.byteLength(out);
  ds.jsonBytes = existsSync(join(ROOT, `data/${ds.id}.json`)) ? Buffer.byteLength(readFileSync(join(ROOT, `data/${ds.id}.json`))) : 0;
  write(`data/csv/${ds.id}.csv`, out);
}
// ---------------------------------------------------------------- Excel (.xlsx): cabeceras legibles y listas de códigos con su texto
console.log('Excel…');
const CL = existsSync(join(ROOT, 'data/codelists.json')) ? readJSON('data/codelists.json') : {};
const clLabel = (c, v) => { if (!c.lista || v === null || v === undefined) return v; for (const l of c.lista.split('|')) { const e = CL[l]?.[v]; if (e) return e.es || v; } return v; };
mkdirSync(join(ROOT, 'data/xlsx'), { recursive: true });
for (const ds of datasets) {
  const bin = toXLSX({ sheet: ds.titulo.es, title: ds.titulo.es, columns: ds.campos.map((c) => ({ label: c.descripcion || c.nombre, value: (r) => clLabel(c, r[c.nombre]) })), rows: ds.rows });
  ds.xlsxBytes = bin.length;
  writeFileSync(join(ROOT, `data/xlsx/${ds.id}.xlsx`), bin);
}

// ---------------------------------------------------------------- DCAT-AP
const FREQ = (f) => `http://publications.europa.eu/resource/authority/frequency/${f}`;
const EU_THEME = (t) => `http://publications.europa.eu/resource/authority/data-theme/${t}`;
const NTI_THEME = (t) => `http://datos.gob.es/kos/sector-publico/sector/${t}`;
const FMT = { csv: 'http://publications.europa.eu/resource/authority/file-type/CSV', xlsx: 'http://publications.europa.eu/resource/authority/file-type/XLSX', json: 'http://publications.europa.eu/resource/authority/file-type/JSON' };
const MT = { csv: 'text/csv', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json' };
const LANG = { es: 'SPA', va: 'CAT', en: 'ENG' };
const langURI = (l) => `http://publications.europa.eu/resource/authority/language/${LANG[l]}`;
const RDF_LANG = { es: 'es', va: 'ca-valencia', en: 'en' };
const catalogURI = `${BASE}/data/catalog`;
const publisherURI = `http://datos.gob.es/recurso/sector-publico/org/Organismo/${ent.dir3}`;
const dsURI = (id) => `${BASE}/#/datos/${id}`;
const distURI = (id, f) => `${BASE}/data/${f === 'json' ? '' : `${f}/`}${id}.${f}`;
const DISTS = ['csv', 'xlsx', 'json'];
const lm = (o) => Object.entries(o).map(([l, v]) => ({ '@language': RDF_LANG[l] || l, '@value': v }));
const ENT_NAME = ent.nombre.es;

const jsonld = {
  '@context': { dcat: 'http://www.w3.org/ns/dcat#', dct: 'http://purl.org/dc/terms/', foaf: 'http://xmlns.com/foaf/0.1/', vcard: 'http://www.w3.org/2006/vcard/ns#', xsd: 'http://www.w3.org/2001/XMLSchema#' },
  '@id': catalogURI, '@type': 'dcat:Catalog',
  'dct:title': lm(meta.catalogo.titulo), 'dct:description': lm(meta.catalogo.descripcion),
  'dct:publisher': { '@id': publisherURI, '@type': 'foaf:Agent', 'foaf:name': ENT_NAME, 'dct:identifier': ent.dir3 },
  'dct:language': ent.idiomas.map((l) => ({ '@id': langURI(l) })), 'dct:license': { '@id': ent.licencia_datos },
  'dct:modified': { '@value': TODAY, '@type': 'xsd:date' }, 'foaf:homepage': { '@id': `${BASE}/` },
  'dcat:dataset': datasets.map((ds) => ({
    '@id': dsURI(ds.id), '@type': 'dcat:Dataset', 'dct:identifier': ds.id,
    'dct:title': lm(ds.titulo), 'dct:description': lm(ds.descripcion),
    'dcat:keyword': ds.palabras_clave.map((k) => ({ '@language': 'es', '@value': k })),
    'dcat:theme': [{ '@id': EU_THEME(ds.tema_eu) }, { '@id': NTI_THEME(ds.tema_nti) }],
    'dct:publisher': { '@id': publisherURI }, 'dct:accrualPeriodicity': { '@id': FREQ(ds.periodicidad) },
    'dct:temporal': { '@type': 'dct:PeriodOfTime', 'dcat:startDate': { '@value': ds.temporal[0], '@type': 'xsd:date' }, 'dcat:endDate': { '@value': ds.temporal[1], '@type': 'xsd:date' } },
    'dct:modified': { '@value': ds.src.actualizado || ds.src.generado || TODAY, '@type': 'xsd:date' },
    'dct:source': ds.fuente.url ? { '@id': ds.fuente.url } : undefined,
    'dcat:contactPoint': { '@type': 'vcard:Organization', 'vcard:fn': 'Unidad de Transparencia', 'vcard:hasEmail': { '@id': `mailto:${ent.email_transparencia}` } },
    'dcat:landingPage': { '@id': `${BASE}/#/${ds.pagina}` },
    'dct:conformsTo': { '@id': `${BASE}/datapackage.json#${ds.id}` },
    'dcat:distribution': DISTS.map((f) => ({
      '@id': distURI(ds.id, f), '@type': 'dcat:Distribution', 'dcat:accessURL': { '@id': distURI(ds.id, f) }, 'dcat:downloadURL': { '@id': distURI(ds.id, f) },
      'dct:format': { '@id': FMT[f] }, 'dcat:mediaType': { '@id': `http://www.iana.org/assignments/media-types/${MT[f]}` },
      'dcat:byteSize': { '@value': String({ csv: ds.csvBytes, xlsx: ds.xlsxBytes, json: ds.jsonBytes }[f]), '@type': 'xsd:nonNegativeInteger' }, 'dct:license': { '@id': ent.licencia_datos },
    })),
  })),
};
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function turtle() {
  const L = ['@prefix dcat: <http://www.w3.org/ns/dcat#> .', '@prefix dct: <http://purl.org/dc/terms/> .', '@prefix foaf: <http://xmlns.com/foaf/0.1/> .', '@prefix vcard: <http://www.w3.org/2006/vcard/ns#> .', '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .', ''];
  const l = (o) => Object.entries(o).map(([k, v]) => `"${esc(v)}"@${RDF_LANG[k]}`).join(', ');
  L.push(`<${catalogURI}> a dcat:Catalog ;`, `  dct:title ${l(meta.catalogo.titulo)} ;`, `  dct:description ${l(meta.catalogo.descripcion)} ;`, `  dct:publisher <${publisherURI}> ;`, `  dct:license <${ent.licencia_datos}> ;`,
    `  dct:language ${ent.idiomas.map((x) => `<${langURI(x)}>`).join(', ')} ;`, `  dct:modified "${TODAY}"^^xsd:date ;`, `  foaf:homepage <${BASE}/> ;`, `  dcat:dataset ${datasets.map((d) => `<${dsURI(d.id)}>`).join(',\n    ')} .`, '',
    `<${publisherURI}> a foaf:Agent ; foaf:name "${esc(ENT_NAME)}" ; dct:identifier "${ent.dir3}" .`, '');
  for (const ds of datasets) {
    L.push(`<${dsURI(ds.id)}> a dcat:Dataset ;`, `  dct:identifier "${ds.id}" ;`, `  dct:title ${l(ds.titulo)} ;`, `  dct:description ${l(ds.descripcion)} ;`,
      `  dcat:keyword ${ds.palabras_clave.map((k) => `"${esc(k)}"@es`).join(', ')} ;`, `  dcat:theme <${EU_THEME(ds.tema_eu)}>, <${NTI_THEME(ds.tema_nti)}> ;`,
      `  dct:publisher <${publisherURI}> ;`, `  dct:accrualPeriodicity <${FREQ(ds.periodicidad)}> ;`,
      `  dct:temporal [ a dct:PeriodOfTime ; dcat:startDate "${ds.temporal[0]}"^^xsd:date ; dcat:endDate "${ds.temporal[1]}"^^xsd:date ] ;`,
      `  dcat:contactPoint [ a vcard:Organization ; vcard:fn "Unidad de Transparencia" ; vcard:hasEmail <mailto:${ent.email_transparencia}> ] ;`,
      `  dcat:landingPage <${BASE}/#/${ds.pagina}> ;`, `  dcat:distribution ${DISTS.map((f) => `<${distURI(ds.id, f)}>`).join(', ')} .`, '');
    for (const f of DISTS) L.push(`<${distURI(ds.id, f)}> a dcat:Distribution ; dcat:accessURL <${distURI(ds.id, f)}> ; dcat:downloadURL <${distURI(ds.id, f)}> ; dct:format <${FMT[f]}> ; dct:license <${ent.licencia_datos}> .`, '');
  }
  return L.join('\n');
}
function rdfxml() {
  const L = ['<?xml version="1.0" encoding="UTF-8"?>', '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#" xmlns:dcat="http://www.w3.org/ns/dcat#" xmlns:dct="http://purl.org/dc/terms/" xmlns:foaf="http://xmlns.com/foaf/0.1/">'];
  const l = (tag, o, ind) => Object.entries(o).map(([k, v]) => `${ind}<${tag} xml:lang="${RDF_LANG[k]}">${xesc(v)}</${tag}>`).join('\n');
  const date = (tag, v) => `<${tag} rdf:datatype="http://www.w3.org/2001/XMLSchema#date">${v}</${tag}>`;
  L.push(`  <dcat:Catalog rdf:about="${xesc(catalogURI)}">`, l('dct:title', meta.catalogo.titulo, '    '), l('dct:description', meta.catalogo.descripcion, '    '),
    `    <dct:publisher rdf:resource="${xesc(publisherURI)}"/>`, `    <dct:license rdf:resource="${ent.licencia_datos}"/>`, ...ent.idiomas.map((x) => `    <dct:language>${RDF_LANG[x]}</dct:language>`),
    `    ${date('dct:modified', TODAY)}`, `    <foaf:homepage rdf:resource="${xesc(BASE)}/"/>`, `    <dcat:themeTaxonomy rdf:resource="http://datos.gob.es/kos/sector-publico/sector/"/>`);
  for (const ds of datasets) {
    L.push('    <dcat:dataset>', `      <dcat:Dataset rdf:about="${xesc(dsURI(ds.id))}">`, `        <dct:identifier>${xesc(dsURI(ds.id))}</dct:identifier>`,
      l('dct:title', ds.titulo, '        '), l('dct:description', ds.descripcion, '        '), ...ds.palabras_clave.map((k) => `        <dcat:keyword xml:lang="es">${xesc(k)}</dcat:keyword>`),
      `        <dcat:theme rdf:resource="${NTI_THEME(ds.tema_nti)}"/>`, `        <dct:publisher rdf:resource="${xesc(publisherURI)}"/>`, `        <dct:accrualPeriodicity rdf:resource="${FREQ(ds.periodicidad)}"/>`,
      `        <dct:temporal><dct:PeriodOfTime>${date('dcat:startDate', ds.temporal[0])}${date('dcat:endDate', ds.temporal[1])}</dct:PeriodOfTime></dct:temporal>`,
      `        <dct:license rdf:resource="${ent.licencia_datos}"/>`, `        ${date('dct:modified', ds.src.actualizado || ds.src.generado || TODAY)}`);
    for (const f of DISTS) L.push('        <dcat:distribution>', `          <dcat:Distribution rdf:about="${xesc(distURI(ds.id, f))}">`, `            <dcat:accessURL rdf:resource="${xesc(distURI(ds.id, f))}"/>`,
      `            <dct:format><dct:IMT><rdf:value>${MT[f]}</rdf:value><rdfs:label>${f.toUpperCase()}</rdfs:label></dct:IMT></dct:format>`, '          </dcat:Distribution>', '        </dcat:distribution>');
    L.push('      </dcat:Dataset>', '    </dcat:dataset>');
  }
  L.push('  </dcat:Catalog>', `  <foaf:Agent rdf:about="${xesc(publisherURI)}"><foaf:name>${xesc(ENT_NAME)}</foaf:name><dct:identifier>${ent.dir3}</dct:identifier></foaf:Agent>`, '</rdf:RDF>', '');
  return L.join('\n');
}
console.log('Catálogo DCAT-AP…');
write('data/catalog.jsonld', JSON.stringify(jsonld, null, 2) + '\n');
write('data/catalog.ttl', turtle());
write('data/catalog.rdf', rdfxml());

// ---------------------------------------------------------------- Data Package
write('datapackage.json', JSON.stringify({
  profile: 'tabular-data-package', name: 'portal-transparencia', title: meta.catalogo.titulo.es, homepage: `${BASE}/`, version: TODAY.replace(/-/g, '.'),
  licenses: [{ name: 'CC-BY-4.0', path: ent.licencia_datos }], contributors: [{ title: ENT_NAME, role: 'publisher' }],
  resources: datasets.map((ds) => ({
    name: ds.id, title: ds.titulo.es, description: ds.descripcion.es, path: `data/csv/${ds.id}.csv`, profile: 'tabular-data-resource', format: 'csv', mediatype: 'text/csv', encoding: 'utf-8', bytes: ds.csvBytes,
    sources: [{ title: ds.fuente.nombre, ...(ds.fuente.url ? { path: ds.fuente.url } : {}) }],
    schema: {
      fields: ds.campos.map((c) => ({ name: c.nombre, type: c.tipo, description: c.descripcion, ...(c.formato ? { format: c.formato } : {}), ...(c.tipo === 'boolean' ? { trueValues: ['true'], falseValues: ['false'] } : {}),
        ...(c.lista ? { constraints: { enum: c.lista.split('|').flatMap((l) => Object.keys(codelists[l] || {})) } } : {}) })),
      ...(ds.campos[0]?.nombre === 'id' ? { primaryKey: 'id' } : {}), missingValues: [''],
    },
  })),
}, null, 2) + '\n');

// ---------------------------------------------------------------- OpenAPI
const OA = { string: { type: 'string' }, integer: { type: 'integer' }, number: { type: 'number' }, boolean: { type: 'boolean' }, date: { type: 'string', format: 'date' }, yearmonth: { type: 'string', pattern: '^\\d{4}-\\d{2}$' } };
const openapi = {
  openapi: '3.1.0', info: { title: `API de datos abiertos — ${ENT_NAME}`, version: '1.0.0', description: 'API REST estática de solo lectura. Cada conjunto se ofrece en JSON (con metadatos) y CSV.', license: { name: 'CC BY 4.0', url: ent.licencia_datos } },
  servers: [{ url: BASE }], paths: {
    '/config/entidad.json': { get: { summary: 'Datos de la entidad', responses: { 200: { description: 'OK' } } } },
    '/data/catalog.jsonld': { get: { summary: 'Catálogo DCAT-AP (JSON-LD)', responses: { 200: { description: 'OK', content: { 'application/ld+json': {} } } } } },
    '/data/catalog.rdf': { get: { summary: 'Catálogo DCAT-AP-ES (RDF/XML) para datos.gob.es', responses: { 200: { description: 'OK', content: { 'application/rdf+xml': {} } } } } },
    '/datapackage.json': { get: { summary: 'Frictionless Data Package', responses: { 200: { description: 'OK' } } } },
    '/data/codelists.json': { get: { summary: 'Listas de códigos (es/va/en)', responses: { 200: { description: 'OK' } } } },
    '/data/sync/estado.json': { get: { summary: 'Estado de la última sincronización automática con PLACSP y BDNS', responses: { 200: { description: 'OK' } } } },
  }, components: { schemas: {} },
};
for (const ds of datasets) {
  const name = ds.id.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
  openapi.components.schemas[name] = { type: 'object', properties: Object.fromEntries(ds.campos.map((c) => [c.nombre, { ...OA[c.tipo], description: c.descripcion }])) };
  openapi.paths[`/data/${ds.id}.json`] = { get: { summary: `${ds.titulo.es} (JSON)`, responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { generado: { type: 'string' }, fuente: { type: 'string' }, datos: { type: 'array', items: { $ref: `#/components/schemas/${name}` } } } } } } } } } };
  openapi.paths[`/data/csv/${ds.id}.csv`] = { get: { summary: `${ds.titulo.es} (CSV)`, responses: { 200: { description: 'OK', content: { 'text/csv': {} } } } } };
}
write('api/openapi.json', JSON.stringify(openapi, null, 2) + '\n');
write('api/v1/index.json', JSON.stringify({ api: 'v1', base: BASE, actualizado: TODAY, entidad: { nombre: ENT_NAME, nif: ent.nif, dir3: ent.dir3 },
  catalogo: { jsonld: `${BASE}/data/catalog.jsonld`, rdf: `${BASE}/data/catalog.rdf`, turtle: `${BASE}/data/catalog.ttl`, datapackage: `${BASE}/datapackage.json`, openapi: `${BASE}/api/openapi.json` },
  conjuntos: datasets.map((ds) => ({ id: ds.id, titulo: ds.titulo, registros: ds.rows.length, fuente: ds.fuente.tipo, actualizado: ds.src.actualizado || ds.src.generado, json: distURI(ds.id, 'json'), csv: distURI(ds.id, 'csv'), xlsx: distURI(ds.id, 'xlsx') })) }, null, 2) + '\n');

// ---------------------------------------------------------------- Atom + sitemap
const fmtEur = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
const ct = (datasets.find((d) => d.id === 'contratos')?.rows || []).filter((c) => c.fecha_adjudicacion).slice(0, 20);
const sb = (datasets.find((d) => d.id === 'subvenciones')?.rows || []).slice(0, 10);
const entries = [
  ...ct.map((c) => ({ id: `${BASE}/#/contratos?q=${encodeURIComponent(c.id)}`, title: `Contrato: ${c.objeto}`, updated: c.fecha_adjudicacion, summary: `${c.adjudicatario || ''} · ${c.importe_adjudicacion_sin_iva ? fmtEur(c.importe_adjudicacion_sin_iva) : ''}` })),
  ...sb.map((s) => ({ id: `${BASE}/#/subvenciones?q=${encodeURIComponent(s.id)}`, title: `Subvención: ${s.convocatoria}`, updated: s.fecha_concesion, summary: `${s.beneficiario} · ${fmtEur(s.importe)}` })),
].sort((a, b) => b.updated.localeCompare(a.updated));
write('feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="es">
  <title>Novedades — Portal de Transparencia — ${xesc(ENT_NAME)}</title>
  <link href="${xesc(BASE)}/feed.xml" rel="self"/><link href="${xesc(BASE)}/"/>
  <id>${xesc(BASE)}/feed.xml</id><updated>${TODAY}T00:00:00Z</updated><author><name>${xesc(ENT_NAME)}</name></author>
${entries.map((e) => `  <entry><title>${xesc(e.title)}</title><link href="${xesc(e.id)}"/><id>${xesc(e.id)}</id><updated>${e.updated}T00:00:00Z</updated><summary>${xesc(e.summary)}</summary></entry>`).join('\n')}
</feed>
`);
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${xesc(BASE)}/</loc><lastmod>${TODAY}</lastmod></url>
${paginas.map((p) => `  <url><loc>${xesc(BASE)}/#/${p}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`);

if (warnings.length) { console.warn(`\n⚠ ${warnings.length} avisos (códigos nuevos de fuentes oficiales; añádelos a data/codelists.json):`); [...new Set(warnings.map((w) => w.replace(/\[\d+\]/, '')))].slice(0, 20).forEach((w) => console.warn('   - ' + w)); }
if (errors.length) { console.error(`\n✗ ${errors.length} errores de validación:`); errors.slice(0, 60).forEach((e) => console.error('   - ' + e)); process.exit(1); }
console.log(`\n✓ Validación correcta: ${datasets.length} conjuntos, ${datasets.reduce((s, d) => s + d.rows.length, 0)} registros, ${paginas.length} páginas.`);
