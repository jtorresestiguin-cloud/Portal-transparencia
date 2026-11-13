#!/usr/bin/env node
/**
 * Sincronización automática con fuentes oficiales.
 *
 *   node scripts/sync/run.mjs                         sincronización diaria (incremental)
 *   node scripts/sync/run.mjs --solo placsp|bdns      solo una fuente
 *   node scripts/sync/run.mjs --placsp-archivos DIR   carga histórica desde los ficheros .atom
 *                                                     de los ZIP mensuales de datos abiertos de PLACSP
 *   node scripts/sync/run.mjs --fixtures              usa tests/fixtures (pruebas sin red)
 *
 * Reglas de fusión:
 *  - Los registros con fuente «placsp»/«bdns» se actualizan con la versión más reciente.
 *  - Los registros cargados a mano (fuente «manual») se conservan siempre.
 *  - Los datos de ejemplo se eliminan en cuanto llega el primer dato real.
 *  - Si la fuente no devuelve nada del órgano, no se toca el conjunto y se avisa.
 * El resultado se registra en data/sync/estado.json.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { syncPlacsp } from './placsp.mjs';
import { syncBdns } from './bdns.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const FIX = args.includes('--fixtures');
const ONLY = arg('--solo');
const NOW = new Date().toISOString();
const readJ = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const writeJ = (p, o) => writeFileSync(join(ROOT, p), JSON.stringify(o, null, 1) + '\n');

const UA = 'PortalTransparencia-Sync/1.0 (+https://github.com)';
async function fetchWithRetry(url, accept, tries = 4) {
  if (url.startsWith('file:')) return readFileSync(fileURLToPath(url), 'utf8');
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch(url, { headers: { Accept: accept, 'User-Agent': UA }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} en ${url}`), { fatal: true });
      return await r.text();
    } catch (e) {
      if (e.fatal || i === tries - 1) throw e;
      await new Promise((res) => setTimeout(res, 2000 * 2 ** i));
    }
  }
}
const fetchText = (u) => fetchWithRetry(u, 'application/atom+xml, application/xml;q=0.9, */*;q=0.5');
const fetchJSON = async (u) => JSON.parse(await fetchWithRetry(u, 'application/json'));

function merge(file, nuevos, fuente) {
  const env = readJ(file);
  const prev = env.ejemplo ? [] : (env.datos || []).filter((r) => r.fuente !== 'ejemplo');
  const map = new Map(prev.map((r) => [r.id, r]));
  let added = 0;
  for (const r of nuevos) { if (!map.has(r.id)) added++; map.set(r.id, r); }
  const datos = [...map.values()];
  writeJ(file, { generado: NOW.slice(0, 10), actualizado: NOW.slice(0, 10), fuente, datos });
  return { total: datos.length, added };
}

const cfg = readJ('config/entidad.json');
const estadoPath = 'data/sync/estado.json';
const estado = existsSync(join(ROOT, estadoPath)) ? readJ(estadoPath) : { fuentes: {} };
estado.fecha = NOW;
let failures = 0;

// ------------------------------------------------------------ PLACSP
if ((!ONLY || ONLY === 'placsp') && cfg.fuentes?.placsp?.activo) {
  const P = cfg.fuentes.placsp;
  const st = estado.fuentes.placsp || {};
  try {
    let feeds = P.feeds;
    const dir = arg('--placsp-archivos');
    if (FIX) feeds = [{ tipo: 'licitaciones', url: pathToFileURL(join(ROOT, 'tests/fixtures/placsp-licitaciones.atom')).href }, { tipo: 'menores', url: pathToFileURL(join(ROOT, 'tests/fixtures/placsp-menores.atom')).href }];
    else if (dir) feeds = readdirSync(dir).filter((f) => f.endsWith('.atom')).map((f) => ({ tipo: /menor/i.test(f) ? 'menores' : 'licitaciones', url: pathToFileURL(resolve(dir, f)).href }));
    // Incremental: solo lo publicado desde la última sincronización correcta (con 3 días de margen)
    const desde = !dir && st.ultima_ok ? new Date(new Date(st.ultima_ok).getTime() - 3 * 864e5).toISOString().slice(0, 10) : P.desde;
    const res = await syncPlacsp({ ...P, feeds, desde, max_paginas: dir ? 100000 : P.max_paginas }, fetchText);
    const n = res.contratos.length + res.encargos.length;
    if (!n && !(readJ('data/contratos.json').datos || []).some((r) => r.fuente === 'placsp')) {
      estado.fuentes.placsp = { ...st, estado: 'sin_resultados', fecha: NOW, paginas: res.pages, mensaje: `Se han leído ${res.pages} páginas, pero ninguna entrada corresponde a los identificadores configurados (${P.identificadores_organo.join(', ')}). Revisa el NIF/DIR3 del órgano de contratación en la pestaña «Entidad».` };
    } else {
      const c = merge('data/contratos.json', res.contratos, 'placsp');
      const e = merge('data/encargos.json', res.encargos, 'placsp');
      estado.fuentes.placsp = { estado: 'ok', fecha: NOW, ultima_ok: NOW, paginas: res.pages, registros: c.total + e.total, nuevos: c.added + e.added, mensaje: `Contratos: ${c.total} (${c.added} nuevos). Encargos: ${e.total} (${e.added} nuevos).` };
    }
  } catch (err) {
    failures++;
    estado.fuentes.placsp = { ...st, estado: 'error', fecha: NOW, mensaje: String(err.message || err) };
  }
  console.log('PLACSP:', estado.fuentes.placsp.estado, '-', estado.fuentes.placsp.mensaje);
}

// ------------------------------------------------------------ BDNS
if ((!ONLY || ONLY === 'bdns') && cfg.fuentes?.bdns?.activo) {
  const B = cfg.fuentes.bdns;
  const st = estado.fuentes.bdns || {};
  try {
    const fj = FIX ? async () => readJ('tests/fixtures/bdns-concesiones.json') : fetchJSON;
    const desde = st.ultima_ok ? new Date(new Date(st.ultima_ok).getTime() - 7 * 864e5).toISOString().slice(0, 10) : B.desde;
    const res = await syncBdns({ ...B, desde, ...(FIX ? { organos: B.organos?.length ? B.organos : ['FIXTURE'] } : {}) }, fj);
    if (!res.subvenciones.length && !(readJ('data/subvenciones.json').datos || []).some((r) => r.fuente === 'bdns')) {
      estado.fuentes.bdns = { ...st, estado: 'sin_resultados', fecha: NOW, mensaje: 'La BDNS no ha devuelto concesiones para el órgano configurado. Revisa su identificador.' };
    } else {
      const s = merge('data/subvenciones.json', res.subvenciones, 'bdns');
      estado.fuentes.bdns = { estado: 'ok', fecha: NOW, ultima_ok: NOW, paginas: res.pages, registros: s.total, nuevos: s.added, mensaje: `Concesiones: ${s.total} (${s.added} nuevas).` };
    }
  } catch (err) {
    failures++;
    estado.fuentes.bdns = { ...st, estado: 'error', fecha: NOW, mensaje: String(err.message || err) };
  }
  console.log('BDNS:', estado.fuentes.bdns.estado, '-', estado.fuentes.bdns.mensaje);
}

writeJ(estadoPath, estado);
// Un fallo de una fuente externa no debe impedir publicar el resto: se registra y se sale con 0,
// salvo que se pida lo contrario con --estricto.
process.exit(failures && args.includes('--estricto') ? 1 : 0);
