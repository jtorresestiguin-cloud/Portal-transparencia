#!/usr/bin/env node
/**
 * Genera DATOS DE EJEMPLO para el prototipo del portal de transparencia de una
 * entidad local genérica (≈15.000 habitantes).
 *
 * IMPORTANTE: todas las cifras, personas, empresas y entidades son ficticias.
 * Los conjuntos «contratos», «encargos» y «subvenciones» se sustituyen
 * automáticamente por datos reales cuando se ejecuta la sincronización
 * (scripts/sync/*.mjs) con la configuración de config/entidad.json.
 * El resto se edita desde el editor visual (admin/).
 *
 * Uso: node scripts/generate-data.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
mkdirSync(DATA, { recursive: true });

let seed = 46000;
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + (b - a) * rnd();
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (pairs) => { const tot = pairs.reduce((s, [, w]) => s + w, 0); let r = rnd() * tot; for (const [v, w] of pairs) if ((r -= w) <= 0) return v; return pairs.at(-1)[0]; };
const r2 = (n) => Math.round(n * 100) / 100;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const HOY = '2026-11-13';

// --solo=cargos,grupos-municipales → escribe solo esos conjuntos (no toca el resto)
const SOLO = (process.argv.find((a) => a.startsWith('--solo=')) || '').slice(7).split(',').filter(Boolean);
function save(name, fuente, datos, extra = {}) {
  if (SOLO.length && !SOLO.includes(name)) return;
  writeFileSync(join(DATA, `${name}.json`), JSON.stringify({
    generado: HOY, fuente, ejemplo: true,
    aviso: 'Datos de ejemplo generados sintéticamente. No son cifras oficiales.', ...extra, datos,
  }, null, 1) + '\n');
  console.log(`  ✓ data/${name}.json (${datos.length})`);
}
console.log('Generando datos de ejemplo…');

// 1. PRESUPUESTO -------------------------------------------------------------
const ANYS = [2021, 2022, 2023, 2024, 2025, 2026];
const crec = { 2021: 0.9, 2022: 0.94, 2023: 1, 2024: 1.05, 2025: 1.09, 2026: 1.13 };
const ING = { 1: 0.38, 2: 0.02, 3: 0.17, 4: 0.33, 5: 0.02, 6: 0.005, 7: 0.045, 8: 0.005, 9: 0.03 };
const AREAS = { 0: 0.035, 1: 0.34, 2: 0.13, 3: 0.17, 4: 0.07, 9: 0.255 };
const CAP_AREA = {
  0: { 3: 0.25, 9: 0.75 }, 1: { 1: 0.35, 2: 0.48, 6: 0.17 }, 2: { 1: 0.45, 2: 0.2, 4: 0.35 },
  3: { 1: 0.4, 2: 0.38, 4: 0.12, 6: 0.1 }, 4: { 1: 0.3, 2: 0.3, 4: 0.1, 6: 0.3 }, 9: { 1: 0.58, 2: 0.32, 4: 0.06, 5: 0.02, 6: 0.02 },
};
const presupuesto = [];
for (const anio of ANYS) {
  const total = 15_200_000 * crec[anio];
  const curso = anio === 2026;
  for (const [cap, p] of Object.entries(ING)) {
    const ini = total * p * between(0.95, 1.05), def = ini * between(1, 1.08);
    presupuesto.push({ anio, tipo: 'ingreso', capitulo: cap, area_gasto: null, inicial: r2(ini), definitivo: r2(def), ejecutado: r2(def * (curso ? between(0.6, 0.75) : between(0.92, 1.05))), estado: curso ? 'en_ejecucion' : 'liquidado' });
  }
  for (const [area, pa] of Object.entries(AREAS)) {
    for (const [cap, pc] of Object.entries(CAP_AREA[area])) {
      const ini = total * pa * pc * between(0.94, 1.06), def = ini * between(0.99, 1.1);
      presupuesto.push({ anio, tipo: 'gasto', capitulo: cap, area_gasto: area, inicial: r2(ini), definitivo: r2(def), ejecutado: r2(def * (curso ? between(0.55, 0.72) : cap === '6' ? between(0.55, 0.85) : between(0.88, 0.98))), estado: curso ? 'en_ejecucion' : 'liquidado' });
    }
  }
}
save('presupuesto', 'ejemplo', presupuesto, { unidad: 'EUR', fecha_corte_en_ejecucion: '2026-09-30' });

// 2. CONTRATOS (formato alineado con PLACSP/CODICE) ---------------------------
const CPVS = [
  ['90910000', '2', 6, ['Servicio de limpieza de edificios municipales', 'Limpieza de colegios públicos']],
  ['90511000', '2', 2, ['Servicio de recogida y transporte de residuos urbanos']],
  ['77310000', '2', 5, ['Mantenimiento de parques y jardines', 'Poda del arbolado urbano']],
  ['45233140', '3', 6, ['Reurbanización de calle', 'Asfaltado de caminos municipales', 'Mejora de la accesibilidad en aceras']],
  ['45210000', '3', 2, ['Construcción de pabellón polideportivo', 'Ampliación del centro social']],
  ['45453000', '3', 4, ['Rehabilitación de la casa de cultura', 'Reforma de aseos del colegio público']],
  ['50232100', '2', 3, ['Mantenimiento del alumbrado público']],
  ['09310000', '1', 2, ['Suministro de energía eléctrica para instalaciones municipales']],
  ['72000000', '2', 4, ['Mantenimiento de aplicaciones de gestión municipal', 'Servicio de soporte informático']],
  ['48000000', '1', 3, ['Licencias de software de gestión', 'Suministro de software de sede electrónica']],
  ['79952000', '2', 5, ['Organización de las fiestas patronales', 'Producción técnica de conciertos de verano']],
  ['92312000', '2', 4, ['Programación cultural de la casa de cultura', 'Talleres culturales para mayores']],
  ['85310000', '2', 3, ['Servicio de ayuda a domicilio', 'Programa de atención a la infancia']],
  ['80410000', '2', 2, ['Escuela de verano municipal']],
  ['92610000', '2', 2, ['Gestión de la piscina municipal']],
  ['79710000', '2', 1, ['Vigilancia de eventos municipales']],
  ['66510000', '2', 1, ['Seguro de responsabilidad civil y daños']],
  ['34144000', '1', 1, ['Suministro de vehículo para la policía local', 'Suministro de barredora urbana']],
];
const RAICES = ['Albufera', 'Horta', 'Llevant', 'Garbí', 'Ponent', 'Xaloc', 'Mestral', 'Tramuntana', 'Mediterrània', 'Taronger', 'Arrossar', 'Barraca', 'Séquia', 'Marjal', 'Alqueria', 'Palmera', 'Brosquil', 'Rajola'];
const SECT = ['Servicios', 'Obras', 'Limpiezas', 'Sistemas', 'Gestión', 'Instalaciones'];
const EMPRESAS = RAICES.map((r, i) => ({ nombre: `${SECT[i % SECT.length]} ${r} Ejemplo, SL`, nif: `B9${pad(9000000 + i * 211, 7)}`, pyme: rnd() < 0.85 }));
const contratos = [];
let seq = 1;
for (const anio of [2022, 2023, 2024, 2025, 2026]) {
  const n = anio === 2026 ? int(52, 60) : int(70, 85);
  for (let i = 0; i < n; i++) {
    const [cpv, tipo, , objs] = weighted(CPVS.map((c) => [c, c[2]]));
    const proc = weighted([['6', 55], ['9', 22], ['1', 12], ['3', 3], ['7', 6], ['13', 2]]);
    let base;
    if (proc === '6') base = tipo === '3' ? between(5000, 39900) : between(1000, 14900);
    else if (proc === '9') base = tipo === '3' ? between(40000, 1500000) : between(15000, 139000);
    else if (proc === '1') base = between(120000, 2200000);
    else base = between(15000, 200000);
    const ofertas = proc === '6' ? int(1, 3) : proc === '3' ? 1 : weighted([[1, 2], [2, 3], [3, 5], [4, 4], [5, 3], [7, 2], [9, 1]]);
    const baja = ofertas === 1 ? between(0, 0.03) : Math.min(0.3, between(0.02, 0.07) * Math.sqrt(ofertas) * between(0.7, 1.4));
    const adj = base * (1 - baja);
    const emp = pick(rnd() < 0.4 ? EMPRESAS.slice(0, 6) : EMPRESAS);
    const fadj = iso(anio, int(1, anio === 2026 ? 10 : 12), int(1, 28));
    const iva = cpv === '85310000' ? 1.04 : 1.21;
    contratos.push({
      id: `EJ-${anio}-${pad(seq++, 4)}`, expediente: `${anio}/${pad(int(100, 2999), 4)}`,
      objeto: `${pick(objs)}${proc !== '6' && rnd() < 0.3 ? ` (${anio}-${anio + 2})` : ''}`,
      tipo, procedimiento: proc, estado: proc === '6' ? 'ADJ' : weighted([['RES', 7], ['ADJ', 3]]), cpv,
      organo: proc === '6' ? 'Alcaldía' : weighted([['Junta de Gobierno Local', 3], ['Pleno', 1], ['Alcaldía', 2]]),
      fecha_adjudicacion: fadj, fecha_formalizacion: proc === '6' ? null : addDays(fadj, int(10, 30)),
      duracion_meses: proc === '6' ? int(1, 12) : weighted([[12, 4], [24, 3], [36, 1], [48, 1], [6, 1]]),
      presupuesto_base_sin_iva: r2(base), importe_adjudicacion_sin_iva: r2(adj), importe_adjudicacion_con_iva: r2(adj * iva),
      numero_ofertas: ofertas, adjudicatario: emp.nombre, adjudicatario_nif: emp.nif, adjudicatario_pyme: emp.pyme,
      url: 'https://contrataciondelsectorpublico.gob.es', fuente: 'ejemplo',
    });
  }
}
contratos.sort((a, b) => b.fecha_adjudicacion.localeCompare(a.fecha_adjudicacion));
save('contratos', 'ejemplo', contratos, { unidad: 'EUR' });

// 3. ENCARGOS A MEDIOS PROPIOS ----------------------------------------------
const MEDIOS = [['Empresa Municipal de Servicios Ejemplo, SA', 'A99000001'], ['Consorcio Comarcal de Ejemplo', 'P9900001J'], ['Sociedad Pública Provincial de Ejemplo, SA', 'A99000002']];
const OBJ_ENC = ['Gestión del servicio de agua potable', 'Mantenimiento de instalaciones deportivas', 'Redacción de proyecto técnico', 'Gestión de la escuela infantil', 'Apoyo técnico en urbanismo'];
const encargos = [];
for (let i = 0; i < 14; i++) {
  const [m, nif] = pick(MEDIOS), y = pick([2022, 2023, 2024, 2025, 2026]);
  encargos.push({ id: `ENC-${y}-${pad(i + 1, 3)}`, objeto: pick(OBJ_ENC), medio_propio: m, medio_propio_nif: nif, fecha_encargo: iso(y, int(1, y === 2026 ? 9 : 12), int(1, 28)), importe_sin_iva: r2(between(18000, 420000)), duracion_meses: pick([12, 24, 36]), url: 'https://contrataciondelsectorpublico.gob.es', fuente: 'ejemplo' });
}
encargos.sort((a, b) => b.fecha_encargo.localeCompare(a.fecha_encargo));
save('encargos', 'ejemplo', encargos, { unidad: 'EUR' });

// 4. SUBVENCIONES (formato alineado con BDNS) --------------------------------
const CONVOC = [
  ['cultura', 'concurrencia', 'Subvenciones a asociaciones culturales', [1500, 9000]],
  ['deporte', 'concurrencia', 'Subvenciones a clubes y entidades deportivas', [2000, 15000]],
  ['servicios_sociales', 'concurrencia', 'Ayudas a entidades de acción social', [2000, 12000]],
  ['educacion', 'concurrencia', 'Ayudas a AMPA para actividades extraescolares', [800, 4000]],
  ['comercio', 'concurrencia', 'Ayudas al comercio local y la contratación', [1000, 6000]],
  ['fiestas', 'nominativa', 'Subvención nominativa a la comisión de fiestas', [8000, 30000]],
  ['cooperacion', 'directa', 'Ayuda humanitaria de emergencia', [3000, 10000]],
  ['medio_ambiente', 'concurrencia', 'Ayudas para la eficiencia energética en viviendas', [500, 3000]],
];
const ENTIDADES = ['Asociación Cultural', 'Club Deportivo', 'AMPA del CEIP', 'Asociación de Comerciantes', 'Sociedad Musical', 'Asociación de Mayores', 'Fundación Social', 'Comisión de Fiestas', 'Asociación Juvenil', 'Club de Atletismo'];
const subvenciones = [];
let sseq = 1;
for (const y of [2022, 2023, 2024, 2025, 2026]) {
  for (const [fin, mod, conv, [a, b]] of CONVOC) {
    const bdns = String(600000 + int(1, 299999));
    const n = mod === 'concurrencia' ? int(4, 10) : 1;
    for (let i = 0; i < n; i++) {
      subvenciones.push({
        id: `SUB-${y}-${pad(sseq++, 4)}`, codigo_bdns: bdns, convocatoria: `${conv} ${y}`, finalidad: fin, modalidad: mod,
        beneficiario: `${pick(ENTIDADES)} ${pick(RAICES)} de Ejemplo`, beneficiario_nif: `G9${pad(8000000 + int(1, 99999), 7)}`,
        fecha_concesion: iso(y, int(3, y === 2026 ? 9 : 11), int(1, 28)), importe: r2(between(a, b)), fuente: 'ejemplo',
      });
    }
  }
}
subvenciones.sort((a, b) => b.fecha_concesion.localeCompare(a.fecha_concesion));
save('subvenciones', 'ejemplo', subvenciones, { unidad: 'EUR' });

// 5. CONVENIOS -----------------------------------------------------------------
const CONV = [['Convenio con la Diputación Provincial para la asistencia técnica municipal', 'administracion'], ['Convenio con la Generalitat para el servicio de atención temprana', 'administracion'],
  ['Convenio de colaboración con la sociedad musical para la escuela de música', 'entidad'], ['Convenio con la universidad para prácticas de estudiantes', 'universidad'],
  ['Convenio con entidad bancaria para la gestión de la recaudación', 'privado'], ['Convenio con Cruz Roja para el servicio de teleasistencia', 'entidad'],
  ['Convenio con el consorcio de bomberos', 'administracion'], ['Convenio con asociación de comerciantes para la dinamización comercial', 'entidad']];
const convenios = [];
for (let i = 0; i < 26; i++) {
  const [obj, tp] = pick(CONV), y = pick([2022, 2023, 2024, 2025, 2026]), f = iso(y, int(1, y === 2026 ? 10 : 12), int(1, 28)), dur = pick([12, 24, 48]);
  convenios.push({ id: `CNV-${y}-${pad(i + 1, 3)}`, objeto: obj, partes: `Ayuntamiento y ${tp === 'administracion' ? 'Administración de ejemplo' : 'Entidad de ejemplo ' + pick(RAICES)}`, tipo_parte: tp, fecha_firma: f, fecha_fin: addDays(f, dur * 30), obligaciones_economicas: r2(rnd() < 0.3 ? 0 : between(3000, 120000)), url: '' });
}
convenios.sort((a, b) => b.fecha_firma.localeCompare(a.fecha_firma));
save('convenios', 'ejemplo', convenios, { unidad: 'EUR' });

// 6. CARGOS Y GRUPOS MUNICIPALES ----------------------------------------------
// Simulación a escala de un municipio de unos 1.800 habitantes (como Riola): 11 concejales
// (art. 179 LOREG), tres grupos municipales y una Junta de Gobierno Local con la Alcaldía y tres
// tenencias (máximo un tercio del número legal de concejales, art. 23 LRBRL). Personas y grupos
// ficticios; los logotipos son ilustraciones genéricas (assets/img/grupos/).
const GRUPOS = [
  { id: 'EPL', nombre: 'Esquerra Progressista Local', siglas: 'EPL', color: '#b3262e', logo: 'assets/img/grupos/epl.svg', portavoz_id: 'C02', en_gobierno: true, web: '' },
  { id: 'CDM', nombre: 'Centre Democràtic Municipal', siglas: 'CDM', color: '#1f5fa8', logo: 'assets/img/grupos/cdm.svg', portavoz_id: 'C08', en_gobierno: false, web: '' },
  { id: 'AV', nombre: 'Alternativa Veïnal', siglas: 'AV', color: '#2b7a4b', logo: 'assets/img/grupos/av.svg', portavoz_id: 'C03', en_gobierno: true, web: '' },
];
const CORP = [
  // id, nombre, tipo, cargo, grupo, JGL, áreas, dedicación
  ['C01', 'Benito Pérez', 'alcaldia', 'Alcalde', 'EPL', true, 'Presidencia, Hacienda, Personal y Policía Local', 'exclusiva'],
  ['C02', 'Laura Ejemplo Ferrer', 'teniente_alcaldia', '1.ª Teniente de Alcalde', 'EPL', true, 'Urbanismo, Obras y Servicios', 'parcial'],
  ['C03', 'Vicent Ejemplo Sanchis', 'teniente_alcaldia', '2.º Teniente de Alcalde', 'AV', true, 'Agricultura, Medio Ambiente y Participación', 'ninguna'],
  ['C04', 'Marta Ejemplo Gil', 'teniente_alcaldia', '3.ª Teniente de Alcalde', 'EPL', true, 'Bienestar Social, Igualdad y Educación', 'ninguna'],
  ['C05', 'Josep Ejemplo Martí', 'concejalia', 'Concejal', 'EPL', false, 'Cultura, Fiestas y Deportes', 'ninguna'],
  ['C06', 'Amparo Ejemplo Navarro', 'concejalia', 'Concejala', 'EPL', false, 'Juventud y Comercio', 'ninguna'],
  ['C07', 'Pau Ejemplo Climent', 'concejalia', 'Concejal', 'AV', false, 'Transparencia y Nuevas Tecnologías', 'ninguna'],
  ['C08', 'Rosa Ejemplo García', 'concejalia', 'Concejala', 'CDM', false, '', 'ninguna'],
  ['C09', 'Andrés Ejemplo López', 'concejalia', 'Concejal', 'CDM', false, '', 'ninguna'],
  ['C10', 'Núria Ejemplo Ruiz', 'concejalia', 'Concejala', 'CDM', false, '', 'ninguna'],
  ['C11', 'Toni Ejemplo Bosch', 'concejalia', 'Concejal', 'CDM', false, '', 'ninguna'],
];
const cargos = CORP.map(([id, nombre, tipo, cargo, grupo, jgl, areas, ded]) => ({
  id, nombre, tipo_cargo: tipo, cargo, areas: areas || 'Sin delegación', grupo_municipal: grupo, junta_gobierno: jgl, dedicacion: ded,
  retribucion_anual: ded === 'exclusiva' ? 31500 : ded === 'parcial' ? 12600 : 0,
  indemnizaciones_anuales: ded === 'ninguna' ? r2((jgl ? 22 : 11) * (jgl ? 90 : 70)) : 0,
  fecha_nombramiento: tipo === 'concejalia' ? '2023-06-17' : '2023-06-23', foto: '', email: `${id.toLowerCase()}@example.org`,
  cv_url: '', declaracion_bienes_url: '#', declaracion_actividades_url: '#',
}));
save('grupos-municipales', 'manual', GRUPOS);
save('cargos', 'manual', cargos, { unidad: 'EUR bruto anual' });

// 7. AGENDA -------------------------------------------------------------------
const ACT = [['reunion', 'Reunión con la asociación de vecinos'], ['reunion', 'Reunión con empresa adjudicataria del servicio de limpieza'], ['acto', 'Inauguración de la reforma del parque'],
  ['pleno', 'Sesión ordinaria del Pleno'], ['junta', 'Junta de Gobierno Local'], ['reunion', 'Reunión con la Diputación Provincial'], ['acto', 'Acto de entrega de premios escolares'],
  ['reunion', 'Reunión con asociación empresarial'], ['viaje', 'Asamblea de la federación de municipios']];
const agenda = [];
const d = new Date('2025-11-03T00:00:00Z');
while (d <= new Date('2026-11-12T00:00:00Z')) {
  if (d.getUTCDay() > 0 && d.getUTCDay() < 6 && rnd() < 0.45) {
    const [tipo, asunto] = pick(ACT);
    agenda.push({ fecha: d.toISOString().slice(0, 10), cargo_id: weighted([['C01', 5], ['C02', 2], ['C03', 1], ['C04', 1]]), tipo, asunto, lugar: tipo === 'viaje' ? 'Valencia' : 'Casa Consistorial', grupo_interes: tipo === 'reunion' && /empresa|empresarial/.test(asunto) ? `Inscrito RGI-${int(100, 999)}` : '' });
  }
  d.setUTCDate(d.getUTCDate() + 1);
}
agenda.sort((a, b) => b.fecha.localeCompare(a.fecha));
save('agenda', 'manual', agenda);

// 8. PLANTILLA ------------------------------------------------------------------
const plantilla = [];
const BASE = { funcionario: { A1: 6, A2: 9, C1: 28, C2: 22, AP: 8 }, interino: { A1: 1, A2: 3, C1: 4, C2: 5, AP: 2 }, laboral_fijo: { A2: 2, C1: 3, C2: 8, AP: 12 }, laboral_temporal: { C2: 6, AP: 9 }, eventual: { A2: 1 } };
for (const anio of [2021, 2022, 2023, 2024, 2025]) {
  for (const [tp, gr] of Object.entries(BASE)) for (const [g, n] of Object.entries(gr)) {
    const tot = Math.max(0, Math.round(n * (tp === 'interino' || tp === 'laboral_temporal' ? (1.3 - (anio - 2021) * 0.12) : (0.92 + (anio - 2021) * 0.03)) * between(0.9, 1.1)));
    const muj = Math.round(tot * ({ A1: 0.5, A2: 0.6, C1: 0.45, C2: 0.62, AP: 0.35 }[g]));
    if (muj) plantilla.push({ anio, tipo_personal: tp, grupo: g, sexo: 'mujer', efectivos: muj });
    if (tot - muj) plantilla.push({ anio, tipo_personal: tp, grupo: g, sexo: 'hombre', efectivos: tot - muj });
  }
}
save('plantilla', 'manual', plantilla);

// 9. PMP y DEUDA ----------------------------------------------------------------
const pmp = [];
for (let y = 2022; y <= 2026; y++) for (let m = 1; m <= 12; m++) { if (y === 2026 && m > 9) break; pmp.push({ periodo: `${y}-${pad(m)}`, pmp_dias: r2(Math.max(4, 34 - (y - 2022) * 5 + between(-6, 8) + (m === 12 ? 6 : 0))) }); }
save('pmp', 'manual', pmp);
const deuda = [];
let dv = 6_800_000;
for (let y = 2019; y <= 2025; y++) { dv *= between(0.84, 0.92); deuda.push({ anio: y, deuda_viva: r2(dv), ingresos_corrientes: r2(13_500_000 * (1 + (y - 2019) * 0.035) * between(0.98, 1.02)) }); }
save('deuda', 'manual', deuda, { unidad: 'EUR' });

// 10. INMUEBLES -------------------------------------------------------------------
const INM = [['Casa Consistorial', 'edificio', 'demanial', 'Oficinas municipales'], ['Casa de Cultura', 'edificio', 'demanial', 'Equipamiento cultural'], ['Polideportivo municipal', 'deportivo', 'demanial', 'Instalación deportiva'],
  ['Piscina municipal', 'deportivo', 'demanial', 'Instalación deportiva'], ['CEIP Ejemplo', 'educativo', 'demanial', 'Centro educativo'], ['Escuela infantil municipal', 'educativo', 'demanial', 'Centro educativo'],
  ['Parque central', 'parque', 'demanial', 'Zona verde'], ['Jardín de la Glorieta', 'parque', 'demanial', 'Zona verde'], ['Centro social de mayores', 'edificio', 'demanial', 'Servicios sociales'],
  ['Retén de la Policía Local', 'edificio', 'demanial', 'Seguridad'], ['Solar del antiguo mercado', 'solar', 'patrimonial', 'Sin uso'], ['Finca rústica del camí vell', 'rustico', 'patrimonial', 'Arrendamiento agrícola'],
  ['Almacén municipal', 'edificio', 'patrimonial', 'Almacén de la brigada'], ['Local comercial de la plaza', 'edificio', 'patrimonial', 'Alquiler']];
const inmuebles = INM.map(([den, tipo, nat, uso], i) => ({ id: `INV-${pad(i + 1, 3)}`, denominacion: den, tipo, naturaleza: nat, direccion: `Calle Ejemplo, ${int(1, 120)}`, referencia_catastral: `${int(1000000, 9999999)}YJ${int(1000, 9999)}N0001${pick(['AB', 'KL', 'PQ'])}`, superficie_m2: r2(tipo === 'rustico' ? between(4000, 25000) : between(150, 6000)), uso, lat: r2(39.57 + between(-0.008, 0.008)) , lon: r2(-0.33 + between(-0.01, 0.01)) }));
inmuebles.forEach((x) => { x.lat = Math.round((39.57 + between(-0.008, 0.008)) * 1e5) / 1e5; x.lon = Math.round((-0.33 + between(-0.01, 0.01)) * 1e5) / 1e5; });
save('inmuebles', 'manual', inmuebles, { aviso_coordenadas: 'Coordenadas ficticias para la demostración.' });

// 11. NORMATIVA ---------------------------------------------------------------------
const NORMAS = [['Ordenanza fiscal reguladora del Impuesto sobre Bienes Inmuebles', 'ordenanza_fiscal'], ['Ordenanza fiscal del Impuesto sobre Vehículos de Tracción Mecánica', 'ordenanza_fiscal'],
  ['Ordenanza fiscal del Impuesto sobre Construcciones, Instalaciones y Obras', 'ordenanza_fiscal'], ['Ordenanza fiscal de la tasa de recogida de residuos', 'ordenanza_fiscal'],
  ['Ordenanza reguladora de la convivencia ciudadana', 'ordenanza'], ['Ordenanza de tenencia de animales de compañía', 'ordenanza'], ['Ordenanza de terrazas y ocupación de la vía pública', 'ordenanza'],
  ['Reglamento orgánico municipal', 'reglamento'], ['Reglamento de transparencia, participación y datos abiertos', 'reglamento'], ['Reglamento de la administración electrónica', 'reglamento'],
  ['Reglamento de uso de instalaciones deportivas', 'reglamento'], ['Instrucción sobre contratación menor', 'instruccion']];
const normativa = NORMAS.map(([titulo, tipo], i) => { const f = iso(int(2005, 2025), int(1, 12), int(1, 28)); return { id: `NOR-${pad(i + 1, 3)}`, titulo, tipo, fecha_aprobacion: f, fecha_publicacion: addDays(f, int(10, 40)), boletin: `BOP n.º ${int(1, 250)}`, url: '#', vigente: true }; });
save('normativa', 'manual', normativa);

// 12. SOLICITUDES DE ACCESO ------------------------------------------------------
const solicitudes = [];
let dseq = 1;
for (const y of [2021, 2022, 2023, 2024, 2025, 2026]) {
  const n = { 2021: 14, 2022: 19, 2023: 26, 2024: 31, 2025: 38, 2026: 30 }[y];
  for (let i = 0; i < n; i++) {
    const ent = iso(y, int(1, y === 2026 ? 10 : 12), int(1, 28));
    const s = weighted([['estimada', 58], ['estimada_parcial', 15], ['desestimada', 8], ['inadmitida', 10], ['desistimiento', 4], ['en_tramite', y === 2026 ? 8 : 0]]);
    const dias = s === 'en_tramite' ? null : Math.max(2, Math.round(between(5, 30) * (rnd() < 0.1 ? 1.5 : 1)));
    solicitudes.push({ id: `SAI-${y}-${pad(dseq++, 3)}`, fecha_entrada: ent, canal: weighted([['sede', 7], ['registro', 2], ['correo', 1]]), tipo_solicitante: weighted([['persona', 6], ['medio', 1.5], ['asociacion', 1.5], ['empresa', 1], ['grupo_politico', 1]]),
      tema: weighted([['contratacion', 4], ['urbanismo', 4], ['economia', 2], ['personal', 2], ['subvenciones', 1], ['servicios', 3], ['otros', 1]]), sentido: s,
      fecha_resolucion: dias === null ? null : addDays(ent, dias), dias_resolucion: dias, reclamacion_consejo: ['desestimada', 'estimada_parcial'].includes(s) && rnd() < 0.3 });
  }
}
save('solicitudes-acceso', 'manual', solicitudes, { plazo_legal_dias: 30 });

// 13. OBLIGACIONES ------------------------------------------------------------------
const ob = (id, bloque, norma, articulo, titulo, pagina, estado, periodicidad, conjunto = null) => ({ id, bloque, norma, articulo, titulo, pagina, estado, periodicidad, conjunto, ultima_actualizacion: estado === 'pendiente' ? null : addDays(HOY, -int(1, 80)) });
const L19 = 'Ley 19/2013', LBRL = 'Ley 7/1985', LCSP = 'Ley 9/2017', CV = 'Ley 1/2022 CV', BP = 'Buena práctica';
const obligaciones = [
  ob('INS-01', 'institucional', L19, 'art. 6.1', 'Funciones y normativa de aplicación', 'organizacion', 'publicado', 'cuando_cambie'),
  ob('INS-02', 'institucional', L19, 'art. 6.1', 'Estructura organizativa y organigrama', 'organizacion', 'publicado', 'cuando_cambie'),
  ob('INS-03', 'institucional', L19, 'art. 6.1', 'Órganos de gobierno: composición y funciones', 'organizacion', 'publicado', 'cuando_cambie', 'cargos'),
  ob('INS-04', 'institucional', L19, 'art. 6.2', 'Planes y programas anuales y plurianuales', 'organizacion', 'parcial', 'anual'),
  ob('INS-05', 'institucional', L19, 'art. 6 bis', 'Registro de actividades de tratamiento de datos', 'organizacion', 'publicado', 'cuando_cambie'),
  ob('INS-06', 'ciudadania', L19, 'art. 8.1.i', 'Información estadística sobre la calidad de los servicios', 'servicios', 'pendiente', 'anual'),
  ob('CIU-01', 'ciudadania', BP, '—', 'Catálogo de servicios y cartas de servicios', 'servicios', 'publicado', 'anual'),
  ob('CIU-02', 'ciudadania', BP, '—', 'Sistema de quejas y sugerencias', 'servicios', 'publicado', 'cuando_cambie'),
  ob('CAR-01', 'cargos', L19, 'art. 6.1', 'Identificación, perfil y trayectoria de los responsables', 'cargos', 'publicado', 'cuando_cambie', 'cargos'),
  ob('CAR-02', 'cargos', L19, 'art. 8.1.f', 'Retribuciones de cargos electos y personal directivo', 'cargos', 'publicado', 'anual', 'cargos'),
  ob('CAR-03', 'cargos', LBRL, 'art. 75.5', 'Régimen de dedicación y asistencias', 'cargos', 'publicado', 'anual', 'cargos'),
  ob('CAR-04', 'cargos', L19, 'art. 8.1.h', 'Declaraciones anuales de bienes y actividades', 'cargos', 'parcial', 'anual', 'cargos'),
  ob('CAR-05', 'cargos', L19, 'art. 8.1.g', 'Resoluciones de compatibilidad de cargos', 'compatibilidades', 'parcial', 'cuando_cambie'),
  ob('CAR-06', 'cargos', CV, 'grupos de interés', 'Agenda institucional y reuniones con grupos de interés', 'agenda', 'publicado', 'semanal', 'agenda'),
  ob('JUR-01', 'juridica', L19, 'art. 7.a', 'Directrices, instrucciones y circulares', 'normativa', 'publicado', 'cuando_cambie', 'normativa'),
  ob('JUR-02', 'juridica', L19, 'art. 7.c', 'Proyectos de ordenanzas y reglamentos', 'proyectos-normativos', 'parcial', 'continua'),
  ob('JUR-05', 'juridica', 'Ley 39/2015', 'art. 133', 'Consulta pública previa en la elaboración de normas', 'proyectos-normativos', 'publicado', 'continua'),
  ob('JUR-06', 'juridica', BP, '—', 'Sentencias y resoluciones judiciales firmes', 'sentencias', 'parcial', 'cuando_cambie'),
  ob('JUR-03', 'juridica', L19, 'art. 7.e', 'Documentos sometidos a información pública', 'proyectos-normativos', 'publicado', 'continua'),
  ob('JUR-04', 'juridica', LBRL, 'art. 70.2', 'Ordenanzas y reglamentos vigentes', 'normativa', 'publicado', 'cuando_cambie', 'normativa'),
  ob('CON-01', 'contratacion', L19, 'art. 8.1.a', 'Contratos: objeto, duración, importe, procedimiento, ofertas y adjudicatario', 'contratos', 'publicado', 'continua', 'contratos'),
  ob('CON-02', 'contratacion', L19, 'art. 8.1.a', 'Contratos menores (trimestral)', 'contratos', 'publicado', 'trimestral', 'contratos'),
  ob('CON-03', 'contratacion', L19, 'art. 8.1.a', 'Estadística por procedimiento de contratación', 'contratos', 'publicado', 'anual', 'contratos'),
  ob('CON-04', 'contratacion', L19, 'art. 8.1.a', 'Modificaciones y desistimientos', 'contratos', 'parcial', 'continua'),
  ob('CON-05', 'contratacion', LCSP, 'art. 63.6', 'Encargos a medios propios', 'encargos', 'publicado', 'continua', 'encargos'),
  ob('SUB-01', 'convenios_subvenciones', L19, 'art. 8.1.b', 'Convenios suscritos', 'convenios', 'publicado', 'trimestral', 'convenios'),
  ob('SUB-02', 'convenios_subvenciones', L19, 'art. 8.1.c', 'Subvenciones y ayudas concedidas', 'subvenciones', 'publicado', 'trimestral', 'subvenciones'),
  ob('SUB-03', 'convenios_subvenciones', L19, 'art. 8.1.b', 'Encomiendas de gestión', 'convenios', 'parcial', 'trimestral'),
  ob('SUB-04', 'convenios_subvenciones', BP, '—', 'Subvenciones y ayudas recibidas', 'subvenciones-recibidas', 'parcial', 'anual'),
  ob('SUB-05', 'convenios_subvenciones', 'Ley 38/2003', 'art. 8.1', 'Plan estratégico de subvenciones', 'plan-estrategico-subvenciones', 'publicado', 'anual'),
  ob('ECO-01', 'economica', L19, 'art. 8.1.d', 'Presupuesto y estado de ejecución', 'presupuesto', 'publicado', 'trimestral', 'presupuesto'),
  ob('ECO-02', 'economica', L19, 'art. 8.1.d', 'Cumplimiento de estabilidad presupuestaria', 'economia', 'publicado', 'trimestral'),
  ob('ECO-03', 'economica', L19, 'art. 8.1.e', 'Cuentas anuales e informes de auditoría y fiscalización', 'economia', 'parcial', 'anual'),
  ob('ECO-04', 'economica', 'RD 635/2014', 'art. 6', 'Periodo medio de pago a proveedores', 'economia', 'publicado', 'mensual', 'pmp'),
  ob('ECO-05', 'economica', 'LO 2/2012', 'art. 13', 'Deuda pública', 'economia', 'publicado', 'anual', 'deuda'),
  ob('PAT-01', 'patrimonio', L19, 'art. 8.3', 'Relación de bienes inmuebles', 'patrimonio', 'publicado', 'anual', 'inmuebles'),
  ob('PAT-02', 'patrimonio', CV, 'patrimonio', 'Vehículos oficiales', 'patrimonio', 'pendiente', 'anual'),
  ob('PER-01', 'personal', CV, 'personal', 'Relación de puestos de trabajo y plantilla', 'personal', 'publicado', 'anual', 'plantilla'),
  ob('PER-02', 'personal', CV, 'personal', 'Ofertas de empleo público y procesos selectivos', 'procesos-selectivos', 'parcial', 'continua'),
  ob('PER-03', 'personal', L19, 'art. 8.1.g', 'Resoluciones de compatibilidad del personal', 'compatibilidades', 'publicado', 'cuando_cambie'),
  ob('URB-01', 'urbanismo', LBRL, 'art. 70 ter', 'Instrumentos de planeamiento urbanístico', 'planeamiento', 'publicado', 'cuando_cambie'),
  ob('URB-02', 'urbanismo', 'Ley 27/2006', 'art. 7', 'Información ambiental', 'medio-ambiente', 'parcial', 'anual'),
  ob('PAR-01', 'participacion', BP, '—', 'Procesos de participación ciudadana', 'participacion', 'parcial', 'continua'),
  ob('ACC-01', 'acceso', L19, 'art. 17', 'Procedimiento de solicitud de acceso', 'derecho-acceso', 'publicado', 'cuando_cambie'),
  ob('ACC-02', 'acceso', CV, 'derecho de acceso', 'Estadística de solicitudes y resoluciones', 'derecho-acceso', 'publicado', 'trimestral', 'solicitudes-acceso'),
  ob('DAT-01', 'datos', L19, 'art. 5.4', 'Información en formatos reutilizables', 'datos-abiertos', 'publicado', 'continua'),
];
save('obligaciones', 'manual', obligaciones, { marco: 'Ley 19/2013, Ley 7/1985, Ley 9/2017 y Ley 1/2022 de la Comunitat Valenciana' });
console.log('Hecho.');
