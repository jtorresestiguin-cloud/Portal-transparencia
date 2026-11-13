/**
 * Conector con la Plataforma de Contratación del Sector Público (PLACSP).
 *
 * Lee los feeds Atom de sindicación (formato CODICE), sigue la paginación
 * (link rel="next"), filtra las entradas cuyo órgano de contratación coincida
 * con los identificadores (NIF/DIR3) o nombres configurados y las convierte al
 * modelo de datos del portal (data/contratos.json y data/encargos.json).
 *
 * Referencias: «Formato de sindicación y reutilización de datos sobre las
 * publicaciones en la PLACSP» y listas de códigos CODICE. Los códigos
 * (procedimiento, tipo, estado) se guardan tal cual; sus etiquetas están en
 * data/codelists.json y deben verificarse contra la versión oficial vigente.
 */
import { parseXML, find, findAll, text, deep } from './xml.mjs';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const num = (s) => (s === null || s === undefined || s === '' ? null : Number(String(s).replace(',', '.')));
const r2 = (n) => (n === null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);
const date = (s) => (s ? String(s).slice(0, 10) : null);

function months(el) {
  if (!el) return null;
  const v = num(el.text), u = (el.attrs.unitCode || 'MON').toUpperCase();
  if (v === null) return null;
  return r2(u === 'ANN' ? v * 12 : u === 'DAY' ? v / 30 : u === 'WEE' ? v / 4.345 : v);
}

/** Convierte una <entry> CODICE en un registro del portal (o null si no es del órgano). */
export function parseEntry(entry, opts) {
  const cfs = deep(entry, 'ContractFolderStatus');
  if (!cfs) return null;
  const party = find(cfs, 'LocatedContractingParty/Party');
  const ids = party ? findAll(party, 'PartyIdentification/ID').map((e) => e.text.trim()) : [];
  const partyName = party ? text(party, 'PartyName/Name') : null;
  const wantIds = (opts.identificadores_organo || []).map((x) => x.toUpperCase());
  const wantNames = (opts.nombres_organo || []).map(norm).filter(Boolean);
  const isOurs = ids.some((x) => wantIds.includes(x.toUpperCase())) || (partyName && wantNames.some((n) => norm(partyName) === n || norm(partyName).includes(n)));
  if (!isOurs) return null;

  const proj = find(cfs, 'ProcurementProject');
  const results = findAll(cfs, 'TenderResult');
  const sumOf = (path) => { const vals = results.map((r) => num(text(r, path))).filter((v) => v !== null); return vals.length ? r2(vals.reduce((a, b) => a + b, 0)) : null; };
  const firstRes = results.find((r) => find(r, 'WinningParty')) || results[0];
  const winner = firstRes ? find(firstRes, 'WinningParty') : null;
  const linkEl = entry.children.find((c) => c.name === 'link' && (!c.attrs.rel || c.attrs.rel === 'alternate'));
  const entryId = text(entry, 'id') || '';
  const procCode = text(cfs, 'TenderingProcess/ProcedureCode') || (opts.tipoFeed === 'menores' ? '6' : null);
  const title = text(entry, 'title');
  const objeto = (proj && text(proj, 'Name')) || title || '';
  const sme = firstRes ? text(firstRes, 'SMEAwardedIndicator') : null;
  const offers = results.map((r) => num(text(r, 'ReceivedTenderQuantity'))).filter((v) => v !== null);
  return {
    id: `placsp-${entryId.split('/').pop()}`,
    expediente: text(cfs, 'ContractFolderID'),
    objeto,
    tipo: proj ? text(proj, 'TypeCode') : null,
    procedimiento: procCode,
    estado: text(cfs, 'ContractFolderStatusCode'),
    cpv: proj ? text(proj, 'RequiredCommodityClassification/ItemClassificationCode') : null,
    organo: partyName,
    fecha_adjudicacion: firstRes ? date(text(firstRes, 'AwardDate')) : null,
    fecha_formalizacion: firstRes ? date(text(firstRes, 'Contract/IssueDate')) : null,
    duracion_meses: proj ? months(find(proj, 'PlannedPeriod/DurationMeasure')) : null,
    presupuesto_base_sin_iva: proj ? r2(num(text(proj, 'BudgetAmount/TaxExclusiveAmount'))) : null,
    importe_adjudicacion_sin_iva: sumOf('AwardedTenderedProject/LegalMonetaryTotal/TaxExclusiveAmount'),
    importe_adjudicacion_con_iva: sumOf('AwardedTenderedProject/LegalMonetaryTotal/PayableAmount'),
    numero_ofertas: offers.length ? Math.max(...offers) : null,
    adjudicatario: winner ? text(winner, 'PartyName/Name') : null,
    adjudicatario_nif: winner ? text(winner, 'PartyIdentification/ID') : null,
    adjudicatario_pyme: sme === null ? null : sme === 'true',
    url: linkEl?.attrs.href || null,
    fuente: 'placsp',
    _actualizado: text(entry, 'updated'),
    _texto: `${title || ''} ${text(entry, 'summary') || ''}`,
  };
}

/** Lee un feed paginado y devuelve los registros del órgano. */
export async function readFeed(url, opts, fetchText) {
  const out = new Map();
  const deleted = new Set();
  let next = url, pages = 0;
  const desde = opts.desde || '0000';
  while (next && pages < (opts.max_paginas || 200)) {
    const xml = parseXML(await fetchText(next));
    const feed = xml.children.find((c) => c.name === 'feed') || xml;
    pages++;
    let newest = '';
    for (const de of feed.children.filter((c) => c.name === 'deleted-entry')) deleted.add(`placsp-${String(de.attrs.ref || '').split('/').pop()}`);
    for (const entry of feed.children.filter((c) => c.name === 'entry')) {
      const upd = text(entry, 'updated') || '';
      if (upd > newest) newest = upd;
      const rec = parseEntry(entry, opts);
      if (!rec) continue;
      const prev = out.get(rec.id);
      if (!prev || (rec._actualizado || '') > (prev._actualizado || '')) out.set(rec.id, rec);
    }
    const nl = feed.children.find((c) => c.name === 'link' && c.attrs.rel === 'next');
    next = nl ? new URL(nl.attrs.href, next).href : null;
    if (newest && newest.slice(0, 10) < desde) break; // los feeds van de más reciente a más antiguo
  }
  for (const d of deleted) out.delete(d);
  return { records: [...out.values()], pages };
}

const ENCARGO = /encargo|encomienda|medio propio/i;
/**
 * @param {object} cfg config.fuentes.placsp
 * @param {(url:string)=>Promise<string>} fetchText
 */
export async function syncPlacsp(cfg, fetchText) {
  const all = new Map();
  let pages = 0;
  for (const f of cfg.feeds) {
    const { records, pages: p } = await readFeed(f.url, { ...cfg, tipoFeed: f.tipo }, fetchText);
    pages += p;
    records.forEach((r) => { const prev = all.get(r.id); if (!prev || (r._actualizado || '') > (prev._actualizado || '')) all.set(r.id, r); });
  }
  const contratos = [], encargos = [];
  for (const r of all.values()) {
    if (cfg.desde && r.fecha_adjudicacion && r.fecha_adjudicacion < cfg.desde) continue;
    if (ENCARGO.test(r._texto)) {
      encargos.push({ id: r.id, objeto: r.objeto, medio_propio: r.adjudicatario, medio_propio_nif: r.adjudicatario_nif, fecha_encargo: r.fecha_formalizacion || r.fecha_adjudicacion, importe_sin_iva: r.importe_adjudicacion_sin_iva ?? r.presupuesto_base_sin_iva, duracion_meses: r.duracion_meses, url: r.url, fuente: 'placsp' });
    } else {
      const { _actualizado, _texto, ...rec } = r;
      contratos.push(rec);
    }
  }
  const byDate = (k) => (a, b) => String(b[k] || '').localeCompare(String(a[k] || ''));
  return { contratos: contratos.sort(byDate('fecha_adjudicacion')), encargos: encargos.sort(byDate('fecha_encargo')), pages };
}
