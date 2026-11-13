/** Pruebas de los conectores de sincronización (sin red). Ejecutar: node --test tests/ */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseXML, find, text } from '../scripts/sync/xml.mjs';
import { syncPlacsp } from '../scripts/sync/placsp.mjs';
import { syncBdns, splitBeneficiario, finalidad } from '../scripts/sync/bdns.mjs';

const FX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
const fetchText = async (u) => readFileSync(fileURLToPath(u), 'utf8');
const cfg = { identificadores_organo: ['P0000000X', 'L00000000'], nombres_organo: [], desde: '2022-01-01', max_paginas: 10,
  feeds: [{ tipo: 'licitaciones', url: pathToFileURL(join(FX, 'placsp-licitaciones.atom')).href }, { tipo: 'menores', url: pathToFileURL(join(FX, 'placsp-menores.atom')).href }] };

test('parser XML: espacios de nombres, entidades, CDATA y autocierre', () => {
  const x = parseXML('<?xml version="1.0"?><a:r xmlns:a="u"><a:b k="1 &amp; 2"/><c><![CDATA[<x>]]></c><d>A &lt; B &#233;</d></a:r>');
  const r = x.children[0];
  assert.equal(r.name, 'r');
  assert.equal(find(r, 'b').attrs.k, '1 & 2');
  assert.equal(text(r, 'c'), '<x>');
  assert.equal(text(r, 'd'), 'A < B é');
});

test('PLACSP: filtra por órgano, sigue la paginación y suma lotes', async () => {
  const { contratos, encargos, pages } = await syncPlacsp(cfg, fetchText);
  assert.equal(pages, 3, 'lee las dos páginas del feed de licitaciones y la del de menores');
  const ids = contratos.map((c) => c.id).sort();
  assert.deepEqual(ids, ['placsp-1001', 'placsp-1004', 'placsp-2001'], 'excluye el contrato de otro órgano y el encargo');
  const c = contratos.find((x) => x.id === 'placsp-1001');
  assert.equal(c.procedimiento, '9'); assert.equal(c.tipo, '2'); assert.equal(c.cpv, '90910000');
  assert.equal(c.importe_adjudicacion_sin_iva, 104500.5); assert.equal(c.duracion_meses, 24); assert.equal(c.adjudicatario_pyme, true);
  assert.equal(c.fecha_formalizacion, '2026-11-05'); assert.match(c.url, /idEvl=AAA1001/);
  const lotes = contratos.find((x) => x.id === 'placsp-1004');
  assert.equal(lotes.importe_adjudicacion_sin_iva, 430000, 'suma los importes de los lotes');
  assert.equal(lotes.numero_ofertas, 5);
  const menor = contratos.find((x) => x.id === 'placsp-2001');
  assert.equal(menor.procedimiento, '6', 'los del feed de menores se marcan como contrato menor');
  assert.equal(encargos.length, 1); assert.equal(encargos[0].medio_propio, 'Empresa Municipal de Prueba, SA');
});

test('PLACSP: sin coincidencias de órgano no devuelve nada', async () => {
  const r = await syncPlacsp({ ...cfg, identificadores_organo: ['NADA'] }, fetchText);
  assert.equal(r.contratos.length + r.encargos.length, 0);
});

test('BDNS: mapea concesiones, fechas y beneficiarios', async () => {
  const fx = JSON.parse(readFileSync(join(FX, 'bdns-concesiones.json'), 'utf8'));
  const urls = [];
  const { subvenciones } = await syncBdns({ api: 'https://www.infosubvenciones.es/bdnstrans/api', organos: ['123'], desde: '2026-01-01' }, async (u) => { urls.push(u); return fx; });
  assert.match(urls[0], /concesiones\/busqueda\?/); assert.match(urls[0], /fechaDesde=01%2F01%2F2026/); assert.match(urls[0], /organos=123/);
  assert.equal(subvenciones.length, 2);
  const club = subvenciones.find((s) => s.id === 'bdns-SB900001');
  assert.equal(club.beneficiario_nif, 'G12345678'); assert.equal(club.finalidad, 'deporte'); assert.equal(club.importe, 4500);
  const pf = subvenciones.find((s) => s.id === 'bdns-SB900002');
  assert.equal(pf.fecha_concesion, '2026-10-02'); assert.equal(pf.beneficiario_nif, null, 'no publica identificadores de personas físicas'); assert.equal(pf.importe, 600.5);
});

test('BDNS: exige el identificador del órgano para no descargar toda la base', async () => {
  await assert.rejects(() => syncBdns({ api: 'x', organos: [] }, async () => ({})), /identificador del órgano/);
});

test('utilidades BDNS', () => {
  assert.deepEqual(splitBeneficiario('B12345678 EMPRESA, SL'), { nombre: 'EMPRESA, SL', nif: 'B12345678' });
  assert.equal(finalidad('Ayudas a la eficiencia energética'), 'medio_ambiente');
});
