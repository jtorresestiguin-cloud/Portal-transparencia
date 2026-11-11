#!/usr/bin/env node
/**
 * Generador de DADES D'EXEMPLE per al prototip del Portal de Transparència
 * del Consorci de Turisme de Barcelona.
 *
 * IMPORTANT: totes les xifres que produeix aquest script són sintètiques i
 * il·lustratives. Serveixen per demostrar el model de dades, les
 * visualitzacions i la interoperabilitat. S'han de substituir per les dades
 * oficials (ERP economicofinancer, PSCP, RRHH, registre, etc.) abans de
 * qualsevol publicació real. Vegeu docs/MODELO-DATOS.md.
 *
 * Ús:  node scripts/generate-data.mjs
 * Resultat: data/*.json (format font). Després cal executar
 *           node scripts/build-catalog.mjs per generar CSV, DCAT i API.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');
mkdirSync(DATA, { recursive: true });

// ---------------------------------------------------------------------------
// PRNG determinista (mulberry32) perquè el resultat sigui reproduïble
// ---------------------------------------------------------------------------
let seed = 19930401; // any de constitució del Consorci
function rnd() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a, b) => a + (b - a) * rnd();
const int = (a, b) => Math.floor(between(a, b + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) { if ((r -= w) <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const round2 = (n) => Math.round(n * 100) / 100;
const pad = (n, l = 2) => String(n).padStart(l, '0');
const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
const addDays = (dateStr, days) => {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const META = {
  generat: '2026-11-11',
  avis: "Dades d'exemple generades sintèticament per al prototip. No són xifres oficials.",
};
function save(name, payload) {
  const file = join(DATA, `${name}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  const n = Array.isArray(payload.dades) ? payload.dades.length : '-';
  console.log(`  ✓ data/${name}.json (${n} registres)`);
}

console.log('Generant dades d\'exemple…');

// ---------------------------------------------------------------------------
// 1. PRESSUPOST (ingressos i despeses per capítol i programa, 2021-2026)
// ---------------------------------------------------------------------------
const ANYS_PRESSUPOST = [2021, 2022, 2023, 2024, 2025, 2026];
const recuperacio = { 2021: 0.52, 2022: 0.86, 2023: 1.0, 2024: 1.07, 2025: 1.12, 2026: 1.16 };
const BASE_TOTAL = 78_000_000;

const ingressosEstructura = [
  { capitol: '3', pes: 0.71 }, // vendes i prestació de serveis (productes turístics)
  { capitol: '4', pes: 0.24 }, // transferències corrents (impost estades turístiques, aportacions)
  { capitol: '5', pes: 0.02 }, // ingressos patrimonials
  { capitol: '7', pes: 0.03 }, // transferències de capital
];
const despesesProgrames = [
  { programa: 'P1', pes: 0.22 }, // promoció i màrqueting
  { programa: 'P2', pes: 0.06 }, // convention bureau
  { programa: 'P3', pes: 0.09 }, // informació i atenció al visitant
  { programa: 'P4', pes: 0.43 }, // productes turístics
  { programa: 'P5', pes: 0.08 }, // turisme sostenible i territori
  { programa: 'P6', pes: 0.12 }, // estructura i serveis generals
];
const capitolsPerPrograma = {
  P1: { '1': 0.18, '2': 0.72, '4': 0.08, '6': 0.02 },
  P2: { '1': 0.35, '2': 0.55, '4': 0.08, '6': 0.02 },
  P3: { '1': 0.55, '2': 0.35, '6': 0.10 },
  P4: { '1': 0.16, '2': 0.78, '6': 0.06 },
  P5: { '1': 0.20, '2': 0.35, '4': 0.42, '6': 0.03 },
  P6: { '1': 0.48, '2': 0.38, '3': 0.04, '6': 0.10 },
};

const pressupost = [];
for (const any of ANYS_PRESSUPOST) {
  const total = BASE_TOTAL * recuperacio[any] * between(0.98, 1.02);
  const enCurs = any === 2026;
  const grauExecIng = enCurs ? 0.74 : between(0.95, 1.06);
  const grauExecDesp = enCurs ? 0.69 : between(0.9, 0.98);
  for (const { capitol, pes } of ingressosEstructura) {
    const inicial = total * pes * between(0.96, 1.04);
    const definitiu = inicial * between(1.0, 1.06);
    pressupost.push({
      any, tipus: 'ingres', capitol, programa: null,
      inicial: round2(inicial), definitiu: round2(definitiu),
      executat: round2(definitiu * grauExecIng * between(0.97, 1.03)),
      estat: enCurs ? 'en_execucio' : 'liquidat',
    });
  }
  for (const { programa, pes } of despesesProgrames) {
    for (const [capitol, pc] of Object.entries(capitolsPerPrograma[programa])) {
      const inicial = total * pes * pc * between(0.95, 1.05);
      const definitiu = inicial * between(0.99, 1.07);
      pressupost.push({
        any, tipus: 'despesa', capitol, programa,
        inicial: round2(inicial), definitiu: round2(definitiu),
        executat: round2(definitiu * grauExecDesp * between(0.94, 1.03)),
        estat: enCurs ? 'en_execucio' : 'liquidat',
      });
    }
  }
}
save('pressupost', { ...META, unitat: 'EUR', data_tall_execucio_2026: '2026-09-30', dades: pressupost });

// ---------------------------------------------------------------------------
// 2. CONTRACTACIÓ (2022-2026)
// ---------------------------------------------------------------------------
const CPV = [
  ['79341000', 'serveis', 'P1', 12], ['79342000', 'serveis', 'P1', 10],
  ['79952000', 'serveis', 'P2', 8], ['72000000', 'serveis', 'P6', 9],
  ['79810000', 'serveis', 'P3', 5], ['90910000', 'serveis', 'P6', 4],
  ['79710000', 'serveis', 'P4', 4], ['60100000', 'serveis', 'P4', 6],
  ['79530000', 'serveis', 'P3', 4], ['39294100', 'subministrament', 'P3', 4],
  ['48000000', 'subministrament', 'P6', 5], ['79311000', 'serveis', 'P5', 5],
  ['79400000', 'serveis', 'P6', 4], ['30213000', 'subministrament', 'P6', 3],
  ['45400000', 'obres', 'P3', 2], ['45310000', 'obres', 'P6', 1],
  ['92312000', 'serveis', 'P5', 4], ['79822500', 'serveis', 'P1', 3],
];
const CPV_OBJECTES = {
  '79341000': ['Campanya de publicitat internacional als mercats emissors', 'Compra de mitjans per a campanya de promoció de la destinació', 'Publicitat digital segmentada per a mercats de llarga distància'],
  '79342000': ['Serveis de màrqueting de continguts de la destinació', 'Gestió de xarxes socials en mercats internacionals', 'Accions de màrqueting amb operadors turístics'],
  '79952000': ['Organització de viatges de familiarització per a premsa', 'Producció d\'estand en fira professional internacional', 'Organització de jornades professionals MICE'],
  '72000000': ['Manteniment evolutiu del web de la destinació', 'Servei de núvol i infraestructura de sistemes', 'Desenvolupament de la plataforma de dades turístiques'],
  '79810000': ['Impressió de material informatiu per a oficines de turisme', 'Impressió de plànols de la ciutat'],
  '90910000': ['Servei de neteja d\'oficines i punts d\'informació'],
  '79710000': ['Servei de seguretat i vigilància en punts de venda'],
  '60100000': ['Servei de transport per a viatges de familiarització', 'Servei de transport de material promocional'],
  '79530000': ['Servei de traducció i interpretació multilingüe', 'Traducció de continguts web a 10 idiomes'],
  '39294100': ['Subministrament de material de marxandatge de la destinació', 'Subministrament de fullets i material de difusió'],
  '48000000': ['Llicències de programari de gestió', 'Subministrament de llicències CRM'],
  '79311000': ['Estudi de perfil i hàbits de la demanda turística', 'Enquesta de satisfacció de visitants', 'Estudi d\'impacte econòmic d\'esdeveniments'],
  '79400000': ['Assessorament en compliment normatiu i protecció de dades', 'Consultoria de pla estratègic de turisme'],
  '30213000': ['Subministrament d\'equips informàtics portàtils'],
  '45400000': ['Obres de reforma d\'oficina d\'informació turística'],
  '45310000': ['Obres d\'adequació d\'instal·lacions elèctriques'],
  '92312000': ['Programació cultural en barris i territori', 'Activitats de dinamització de destinacions de proximitat'],
  '79822500': ['Disseny gràfic de campanyes i materials'],
};
const ARRELS = ['Àgora', 'Lumen', 'Nexe', 'Llevant', 'Ponent', 'Tramuntana', 'Garbí', 'Mestral', 'Xaloc', 'Migjorn',
  'Brúixola', 'Fanal', 'Mosaic', 'Trencadís', 'Vela', 'Far', 'Atles', 'Ràdium', 'Cobalt', 'Òliba',
  'Fusta', 'Ciment', 'Argila', 'Seda', 'Cotó', 'Coure', 'Granit', 'Marbre'];
const SECTORS = ['Comunicació', 'Digital', 'Serveis', 'Esdeveniments', 'Mitjans', 'Consultoria', 'Logística', 'Gràfiques'];
const empreses = ARRELS.map((a, i) => ({
  nom: `Empresa Demo ${a} ${SECTORS[i % SECTORS.length]}, SL`,
  nif: `B0${pad(9000000 + i * 137, 7)}`,
  pime: rnd() < 0.72,
}));

const contractes = [];
let seq = 1;
for (const any of [2022, 2023, 2024, 2025, 2026]) {
  const n = any === 2026 ? int(42, 48) : int(55, 68);
  for (let i = 0; i < n; i++) {
    const [cpv, tipus, programa] = weighted(CPV.map((c) => [c, c[3]]));
    const procediment = weighted([
      ['obert', 30], ['obert_simplificat', 22], ['simplificat_abreujat', 10],
      ['menor', 28], ['negociat_sense_publicitat', 4], ['basat_acord_marc', 6],
    ]);
    let pressupostLicitacio;
    switch (procediment) {
      case 'menor': pressupostLicitacio = tipus === 'obres' ? between(8000, 39000) : between(3000, 14900); break;
      case 'simplificat_abreujat': pressupostLicitacio = between(15000, 59000); break;
      case 'obert_simplificat': pressupostLicitacio = between(40000, 139000); break;
      case 'negociat_sense_publicitat': pressupostLicitacio = between(20000, 180000); break;
      case 'basat_acord_marc': pressupostLicitacio = between(10000, 250000); break;
      default: pressupostLicitacio = between(140000, 2400000);
    }
    const licitadors = procediment === 'menor' ? int(1, 3)
      : procediment === 'negociat_sense_publicitat' ? 1
      : weighted([[1, 2], [2, 4], [3, 6], [4, 6], [5, 4], [6, 3], [8, 2], [11, 1]]);
    const baixa = licitadors === 1 ? between(0, 0.03) : Math.min(0.32, between(0.02, 0.06) * Math.sqrt(licitadors) * between(0.7, 1.5));
    const adjudicacio = pressupostLicitacio * (1 - baixa);
    const empresa = pick(rnd() < 0.35 ? empreses.slice(0, 8) : empreses);
    const maxMes = any === 2026 ? 10 : 12;
    const mes = int(1, maxMes);
    const dataAdj = iso(any, mes, int(1, 28));
    const objecte = pick(CPV_OBJECTES[cpv]);
    contractes.push({
      id: `CTB-${any}-${pad(seq++, 4)}`,
      expedient: `${any}/${pad(i + 1, 3)}`,
      objecte,
      tipus,
      procediment,
      cpv,
      programa,
      data_adjudicacio: dataAdj,
      data_formalitzacio: procediment === 'menor' ? null : addDays(dataAdj, int(10, 35)),
      durada_mesos: procediment === 'menor' ? int(1, 12) : weighted([[6, 1], [12, 4], [24, 3], [36, 1], [48, 1]]),
      pressupost_licitacio_sense_iva: round2(pressupostLicitacio),
      import_adjudicacio_sense_iva: round2(adjudicacio),
      import_adjudicacio_amb_iva: round2(adjudicacio * 1.21),
      nombre_licitadors: licitadors,
      adjudicatari: empresa.nom,
      adjudicatari_nif: empresa.nif,
      adjudicatari_pime: empresa.pime,
      clausules_socials: procediment !== 'menor' && rnd() < 0.78,
      clausules_ambientals: procediment !== 'menor' && rnd() < 0.64,
      lots: procediment === 'obert' && rnd() < 0.3 ? int(2, 5) : 1,
      modificat: procediment !== 'menor' && rnd() < 0.06,
      enllac_pscp: 'https://contractaciopublica.cat/ca/perfils-contractant',
    });
  }
}
contractes.sort((a, b) => b.data_adjudicacio.localeCompare(a.data_adjudicacio));
save('contractes', { ...META, unitat: 'EUR', dades: contractes });

// ---------------------------------------------------------------------------
// 3. SUBVENCIONS ATORGADES I AJUTS + CONVENIS
// ---------------------------------------------------------------------------
const LINIES_SUBV = [
  ['L1', 'concurrencia', [8000, 45000]],  // dinamització turística de barris
  ['L2', 'concurrencia', [5000, 30000]],  // esdeveniments i congressos
  ['L3', 'directa', [20000, 150000]],     // projectes singulars
  ['L4', 'nominativa', [40000, 250000]],  // entitats del sector
];
const BENEFICIARIS = ['Associació Demo de Comerciants', 'Fundació Demo Cultural', 'Federació Demo d\'Entitats', 'Associació Demo Gastronòmica',
  'Gremi Demo de Serveis Turístics', 'Fundació Demo Esportiva', 'Associació Demo de Veïns', 'Entitat Demo de Festes Populars',
  'Associació Demo Congressos', 'Fundació Demo Patrimoni'];
const DISTRICTES = ['Ciutat Vella', 'Eixample', 'Sants-Montjuïc', 'Les Corts', 'Sarrià-Sant Gervasi', 'Gràcia', 'Horta-Guinardó', 'Nou Barris', 'Sant Andreu', 'Sant Martí'];
const subvencions = [];
let sseq = 1;
for (const any of [2022, 2023, 2024, 2025, 2026]) {
  const n = int(14, 22);
  for (let i = 0; i < n; i++) {
    const [linia, modalitat, [a, b]] = weighted(LINIES_SUBV.map((l) => [l, l[0] === 'L1' ? 5 : l[0] === 'L2' ? 3 : 1]));
    const sol = between(a, b);
    const districte = linia === 'L1' ? pick(DISTRICTES) : weighted([['Ciutat', 3], [pick(DISTRICTES), 1]]);
    const benef = `${pick(BENEFICIARIS)} ${districte === 'Ciutat' ? 'de Barcelona' : districte}`;
    subvencions.push({
      id: `SUB-${any}-${pad(sseq++, 3)}`,
      any,
      linia,
      modalitat,
      beneficiari: benef,
      beneficiari_nif: `G0${pad(8000000 + int(1, 99999), 7)}`,
      districte: districte === 'Ciutat' ? null : districte,
      import_sollicitat: round2(sol),
      import_atorgat: round2(sol * between(0.6, 1)),
      data_concessio: iso(any, int(any === 2026 ? 2 : 3, any === 2026 ? 9 : 11), int(1, 28)),
      estat_justificacio: any >= 2026 ? 'pendent' : weighted([['justificada', 8], ['en_revisio', 1], ['reintegrament_parcial', 0.4]]),
      bdns: `${700000 + int(1, 99999)}`,
    });
  }
}
save('subvencions', { ...META, unitat: 'EUR', dades: subvencions });

const CONVENIS_OBJ = [
  ['Col·laboració per a la promoció conjunta de la destinació', 'administracio'],
  ['Col·laboració en la gestió del servei d\'informació turística', 'administracio'],
  ['Patrocini d\'esdeveniment internacional', 'privat'],
  ['Col·laboració en recerca i dades turístiques amb universitat', 'universitat'],
  ['Promoció de la destinació Barcelona en mercats internacionals amb aerolínia', 'privat'],
  ['Col·laboració per al desenvolupament del turisme de proximitat', 'administracio'],
  ['Atracció de congressos científics', 'entitat'],
  ['Projecte europeu de turisme sostenible', 'internacional'],
];
const convenis = [];
let cseq = 1;
for (const any of [2022, 2023, 2024, 2025, 2026]) {
  for (let i = 0; i < int(7, 12); i++) {
    const [obj, tipusPart] = pick(CONVENIS_OBJ);
    const signatura = iso(any, int(1, any === 2026 ? 10 : 12), int(1, 28));
    const durada = pick([12, 24, 36, 48]);
    convenis.push({
      id: `CNV-${any}-${pad(cseq++, 3)}`,
      objecte: obj,
      tipus_part: tipusPart,
      part_signant: `Entitat Demo ${pick(ARRELS)} (${tipusPart})`,
      data_signatura: signatura,
      data_fi: addDays(signatura, durada * 30),
      durada_mesos: durada,
      obligacions_economiques_ctb: round2(rnd() < 0.3 ? 0 : between(10000, 400000)),
      aportacio_altra_part: round2(rnd() < 0.5 ? 0 : between(10000, 300000)),
    });
  }
}
save('convenis', { ...META, unitat: 'EUR', dades: convenis });

// ---------------------------------------------------------------------------
// 4. PERSONAL: plantilla, retribucions
// ---------------------------------------------------------------------------
const CATEGORIES = [
  ['direccio', 8, 0.45], ['comandament', 28, 0.55], ['tecnic_superior', 70, 0.63],
  ['tecnic', 62, 0.58], ['administratiu', 34, 0.74], ['informacio_turistica', 88, 0.66],
  ['operacions', 46, 0.41],
];
const FRANGES = [['<30', 0.16], ['30-39', 0.27], ['40-49', 0.3], ['50-59', 0.2], ['>=60', 0.07]];
const plantilla = [];
const efectiusAny = { 2021: 0.82, 2022: 0.9, 2023: 0.97, 2024: 1.0, 2025: 1.03, 2026: 1.05 };
for (const any of Object.keys(efectiusAny).map(Number)) {
  for (const [cat, base, pctDona] of CATEGORIES) {
    const total = Math.round(base * efectiusAny[any] * between(0.95, 1.05));
    for (const [sexe, pct] of [['dona', pctDona + (any - 2021) * 0.004], ['home', 1 - pctDona - (any - 2021) * 0.004]]) {
      const nSexe = Math.round(total * pct);
      for (const [franja, pf] of FRANGES) {
        const nf = Math.round(nSexe * pf);
        if (!nf) continue;
        const temporal = cat === 'informacio_turistica' || cat === 'operacions' ? Math.round(nf * (any >= 2023 ? 0.12 : 0.24)) : Math.round(nf * 0.05);
        const fixDisc = cat === 'informacio_turistica' ? Math.round(nf * 0.15) : 0;
        const indef = nf - temporal - fixDisc;
        for (const [relacio, n] of [['indefinit', indef], ['temporal', temporal], ['fix_discontinu', fixDisc]]) {
          if (n > 0) plantilla.push({ any, data_referencia: `${any}-12-31`, categoria: cat, sexe, franja_edat: franja, tipus_relacio: relacio, efectius: n });
        }
      }
    }
  }
}
save('plantilla', { ...META, dades: plantilla });

const retribucions = [];
const BANDES = {
  direccio: [78000, 112000], comandament: [56000, 76000], tecnic_superior: [41000, 55000],
  tecnic: [33000, 42000], administratiu: [27000, 34000], informacio_turistica: [24500, 31000], operacions: [23500, 30500],
};
for (const any of [2022, 2023, 2024, 2025, 2026]) {
  const inc = { 2022: 1, 2023: 1.025, 2024: 1.045, 2025: 1.07, 2026: 1.09 }[any];
  for (const [cat, [mn, mx]] of Object.entries(BANDES)) {
    const mitjanaD = between(mn, mx) * inc;
    const bretxa = cat === 'direccio' ? between(0.02, 0.07) : between(-0.01, 0.045);
    retribucions.push({
      any, categoria: cat,
      retribucio_minima: round2(mn * inc), retribucio_maxima: round2(mx * inc),
      retribucio_mitjana_dones: round2(mitjanaD * (1 - bretxa / 2)),
      retribucio_mitjana_homes: round2(mitjanaD * (1 + bretxa / 2)),
    });
  }
}
save('retribucions', { ...META, unitat: 'EUR bruts anuals', dades: retribucions });

// Alts càrrecs i personal directiu (per lloc, sense dades personals en el prototip)
const altsCarrecs = [
  { lloc: 'direccio_general', organ: 'Direcció General', tipus_vinculacio: 'alta_direccio', retribucio_fixa: 128500, retribucio_variable_maxima: 0, data_nomenament: '2023-03-01', declaracio_interessos: true, declaracio_patrimonial: true, compatibilitat: 'no_consta_activitat' },
  { lloc: 'direccio_promocio', organ: 'Direcció de Promoció i Màrqueting', tipus_vinculacio: 'personal_directiu', retribucio_fixa: 98200, retribucio_variable_maxima: 0, data_nomenament: '2021-09-15', declaracio_interessos: true, declaracio_patrimonial: false, compatibilitat: 'no_consta_activitat' },
  { lloc: 'direccio_convention_bureau', organ: 'Direcció del Barcelona Convention Bureau', tipus_vinculacio: 'personal_directiu', retribucio_fixa: 92400, retribucio_variable_maxima: 0, data_nomenament: '2020-02-01', declaracio_interessos: true, declaracio_patrimonial: false, compatibilitat: 'docencia_autoritzada' },
  { lloc: 'direccio_productes', organ: 'Direcció de Productes Turístics', tipus_vinculacio: 'personal_directiu', retribucio_fixa: 95800, retribucio_variable_maxima: 0, data_nomenament: '2022-05-09', declaracio_interessos: true, declaracio_patrimonial: false, compatibilitat: 'no_consta_activitat' },
  { lloc: 'direccio_economica', organ: 'Direcció Economicofinancera i de Serveis Generals', tipus_vinculacio: 'personal_directiu', retribucio_fixa: 94100, retribucio_variable_maxima: 0, data_nomenament: '2019-11-04', declaracio_interessos: true, declaracio_patrimonial: false, compatibilitat: 'no_consta_activitat' },
  { lloc: 'direccio_sostenibilitat', organ: 'Direcció de Turisme Sostenible i Territori', tipus_vinculacio: 'personal_directiu', retribucio_fixa: 89600, retribucio_variable_maxima: 0, data_nomenament: '2024-01-08', declaracio_interessos: true, declaracio_patrimonial: false, compatibilitat: 'no_consta_activitat' },
];
save('alts-carrecs', { ...META, unitat: 'EUR bruts anuals', dades: altsCarrecs });

// Agenda institucional (darrers 12 mesos)
const ACTIVITATS = [
  ['reunio', 'Reunió amb representants del sector hoteler'], ['reunio', 'Reunió de coordinació amb l\'Ajuntament de Barcelona'],
  ['fira', 'Assistència a fira professional internacional de turisme'], ['acte', 'Presentació de dades del balanç turístic'],
  ['reunio', 'Reunió amb associació veïnal sobre gestió de fluxos'], ['viatge', 'Missió comercial a mercat emissor'],
  ['acte', 'Lliurament de premis de congressos de la ciutat'], ['reunio', 'Reunió amb operador de creuers'],
  ['reunio', 'Reunió amb grup d\'interès inscrit al registre'], ['organ', 'Sessió del Comitè Executiu'],
  ['organ', 'Sessió del Consell General'], ['acte', 'Jornada sobre turisme sostenible i ciutat'],
];
const agenda = [];
let d = new Date('2025-11-03T00:00:00Z');
const fi = new Date('2026-11-06T00:00:00Z');
while (d <= fi) {
  if (d.getUTCDay() > 0 && d.getUTCDay() < 6 && rnd() < 0.42) {
    const [tipus, activitat] = pick(ACTIVITATS);
    const lloc = weighted([['direccio_general', 5], ['direccio_promocio', 2], ['direccio_convention_bureau', 2], ['direccio_productes', 1], ['direccio_sostenibilitat', 1]]);
    agenda.push({
      data: d.toISOString().slice(0, 10), carrec: lloc, tipus, activitat,
      grup_interes_registrat: tipus === 'reunio' ? rnd() < 0.55 : false,
      codi_registre_gi: null,
      lloc_activitat: tipus === 'viatge' || tipus === 'fira' ? pick(['Londres', 'Nova York', 'Berlín', 'Tòquio', 'Madrid', 'Seül', 'Milà', 'Dubai']) : 'Barcelona',
    });
    const last = agenda[agenda.length - 1];
    if (last.grup_interes_registrat) last.codi_registre_gi = `RGI-${int(1000, 9999)}`;
  }
  d.setUTCDate(d.getUTCDate() + 1);
}
agenda.sort((a, b) => b.data.localeCompare(a.data));
save('agenda', { ...META, dades: agenda });

const regals = [];
for (let i = 0; i < 26; i++) {
  const y = pick([2024, 2025, 2026]);
  regals.push({
    data: iso(y, int(1, y === 2026 ? 10 : 12), int(1, 28)),
    carrec: pick(Object.values(altsCarrecs).map((a) => a.lloc)),
    descripcio: pick(['Llibre institucional', 'Obsequi protocol·lari d\'una delegació estrangera', 'Entrades a esdeveniment cultural', 'Producte gastronòmic', 'Peça d\'artesania']),
    valor_estimat: round2(between(15, 240)),
    destinacio: pick(['fons_patrimonial', 'retornat', 'donacio_entitat_social', 'fons_patrimonial']),
  });
}
regals.sort((a, b) => b.data.localeCompare(a.data));
save('regals', { ...META, unitat: 'EUR', dades: regals });

// ---------------------------------------------------------------------------
// 5. INDICADORS TURÍSTICS (sèrie mensual 2019-01 → 2026-09)
// ---------------------------------------------------------------------------
const estac = [0.68, 0.72, 0.86, 0.99, 1.06, 1.12, 1.18, 1.17, 1.13, 1.08, 0.83, 0.78];
const covid = (y, m) => {
  if (y === 2020) return [1, 0.95, 0.42, 0.01, 0.02, 0.08, 0.28, 0.33, 0.22, 0.18, 0.1, 0.12][m - 1];
  if (y === 2021) return [0.1, 0.11, 0.14, 0.17, 0.22, 0.35, 0.5, 0.58, 0.55, 0.63, 0.66, 0.6][m - 1];
  if (y === 2022) return [0.55, 0.66, 0.78, 0.86, 0.9, 0.94, 0.96, 0.96, 0.97, 0.98, 0.95, 0.97][m - 1];
  return { 2019: 1, 2023: 1.02, 2024: 1.05, 2025: 1.07, 2026: 1.085 }[y];
};
const indicadors = [];
for (let y = 2019; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    if (y === 2026 && m > 9) break;
    const f = covid(y, m) * estac[m - 1];
    const noise = () => between(0.97, 1.03);
    const pernoctacions = Math.round(1_720_000 * f * noise());
    const turistes = Math.round(pernoctacions / between(2.45, 2.7));
    const ocupacio = Math.min(94, Math.max(3, 79 * Math.pow(f, 0.85) * noise()));
    const preuBase = 128 * Math.pow(1.045, Math.max(0, y - 2019));
    const adr = Math.max(55, preuBase * (0.78 + 0.28 * estac[m - 1]) * (f < 0.5 ? 0.72 : 1) * noise());
    const creuers = Math.round((y === 2020 && m > 3) || (y === 2021 && m < 7) ? 0 : 260_000 * covid(y, m) * [0.25, 0.22, 0.45, 1.05, 1.25, 1.3, 1.35, 1.3, 1.35, 1.4, 0.95, 0.55][m - 1] * noise());
    indicadors.push({
      periode: `${y}-${pad(m)}`,
      any: y, mes: m,
      pernoctacions_hoteleres: pernoctacions,
      turistes_hotelers: turistes,
      ocupacio_hotelera_pct: round2(ocupacio),
      preu_mitja_habitacio_eur: round2(adr),
      passatgers_aeroport: Math.round(4_400_000 * f * noise()),
      creueristes: creuers,
      consultes_oficines_informacio: Math.round(210_000 * Math.pow(f, 1.1) * noise() * (y >= 2024 ? 0.9 : 1)),
      vendes_targeta_turistica: Math.round(36_000 * f * noise()),
      usuaris_bus_turistic: Math.round(205_000 * Math.pow(f, 1.15) * noise()),
    });
  }
}
save('indicadors-turisme', { ...META, ambit: 'Barcelona ciutat', dades: indicadors });

const MERCATS = [['ES', 0.19], ['US', 0.13], ['GB', 0.08], ['FR', 0.07], ['IT', 0.06], ['DE', 0.055], ['NL', 0.03], ['CN', 0.025], ['JP', 0.018], ['KR', 0.02], ['LATAM', 0.07], ['ALTRES_EU', 0.12], ['ALTRES', 0.112]];
const mercats = [];
for (const y of [2019, 2022, 2023, 2024, 2025]) {
  let parts = MERCATS.map(([codi, p]) => {
    let adj = p * between(0.9, 1.1);
    if (y === 2022 && ['CN', 'JP', 'KR'].includes(codi)) adj *= 0.3;
    if (y === 2022 && codi === 'ES') adj *= 1.35;
    if (y >= 2024 && codi === 'US') adj *= 1.15;
    return [codi, adj];
  });
  const s = parts.reduce((a, [, p]) => a + p, 0);
  for (const [codi, p] of parts) mercats.push({ any: y, mercat: codi, quota_pct: round2((p / s) * 100) });
}
save('mercats-origen', { ...META, base: 'turistes allotjats en establiments hotelers', dades: mercats });

// Oficines i punts d'informació turística (coordenades aproximades)
const oficines = [
  { id: 'OIT-01', nom: 'Plaça de Catalunya', districte: 'Eixample', lat: 41.3870, lon: 2.1700, visites_2025: 0, accessible: true },
  { id: 'OIT-02', nom: 'Plaça de Sant Jaume', districte: 'Ciutat Vella', lat: 41.3826, lon: 2.1771, visites_2025: 0, accessible: true },
  { id: 'OIT-03', nom: 'Estació de Sants', districte: 'Sants-Montjuïc', lat: 41.3792, lon: 2.1404, visites_2025: 0, accessible: true },
  { id: 'OIT-04', nom: 'Aeroport T1', districte: 'Fora del municipi (El Prat)', lat: 41.2885, lon: 2.0733, visites_2025: 0, accessible: true },
  { id: 'OIT-05', nom: 'Aeroport T2', districte: 'Fora del municipi (El Prat)', lat: 41.3036, lon: 2.0767, visites_2025: 0, accessible: true },
  { id: 'OIT-06', nom: 'Mirador de Colom', districte: 'Ciutat Vella', lat: 41.3758, lon: 2.1778, visites_2025: 0, accessible: false },
  { id: 'OIT-07', nom: 'Sagrada Família (punt d\'informació)', districte: 'Eixample', lat: 41.4036, lon: 2.1744, visites_2025: 0, accessible: true },
  { id: 'OIT-08', nom: 'Terminal de creuers (punt d\'informació)', districte: 'Sants-Montjuïc', lat: 41.3681, lon: 2.1795, visites_2025: 0, accessible: true },
  { id: 'OIT-09', nom: 'Park Güell (punt d\'informació)', districte: 'Gràcia', lat: 41.4135, lon: 2.1527, visites_2025: 0, accessible: false },
];
for (const o of oficines) o.visites_2025 = int(60_000, 650_000);
save('oficines-informacio', { ...META, avis_coordenades: 'Coordenades aproximades (WGS84) per a la demo.', dades: oficines });

// ---------------------------------------------------------------------------
// 6. DRET D'ACCÉS A LA INFORMACIÓ PÚBLICA
// ---------------------------------------------------------------------------
const TEMES = [['contractacio', 4], ['dades_turistiques', 5], ['pressupost', 2], ['personal', 2], ['activitat', 3], ['bon_govern', 1], ['altres', 1]];
const dretAcces = [];
let dseq = 1;
for (const any of [2021, 2022, 2023, 2024, 2025, 2026]) {
  const n = { 2021: 24, 2022: 31, 2023: 38, 2024: 47, 2025: 56, 2026: 44 }[any];
  for (let i = 0; i < n; i++) {
    const entrada = iso(any, int(1, any === 2026 ? 10 : 12), int(1, 28));
    const sentit = weighted([['estimacio', 58], ['estimacio_parcial', 16], ['desestimacio', 8], ['inadmissio', 10], ['desistiment', 4], ['en_tramit', any === 2026 ? 6 : 0]]);
    const dies = sentit === 'en_tramit' ? null : Math.max(3, Math.round(between(6, 30) * (rnd() < 0.08 ? 1.6 : 1)));
    dretAcces.push({
      id: `DAIP-${any}-${pad(dseq++, 3)}`,
      data_entrada: entrada,
      canal: weighted([['seu_electronica', 7], ['correu_electronic', 2], ['presencial', 1]]),
      tipus_sollicitant: weighted([['persona_fisica', 6], ['mitja_comunicacio', 2], ['entitat', 1.5], ['empresa', 1], ['grup_politic', 0.5]]),
      tema: weighted(TEMES),
      sentit_resolucio: sentit,
      data_resolucio: dies === null ? null : addDays(entrada, dies),
      dies_resolucio: dies,
      reclamacio_gaip: sentit === 'desestimacio' || sentit === 'estimacio_parcial' ? rnd() < 0.3 : false,
    });
  }
}
save('dret-acces', { ...META, termini_legal_dies: 30, dades: dretAcces });

// ---------------------------------------------------------------------------
// 7. PLA D'ACTUACIÓ / OBJECTIUS ESTRATÈGICS
// ---------------------------------------------------------------------------
const objectius = [
  { id: 'OE1', eix: 'sostenibilitat', objectiu: 'Desconcentrar fluxos: augmentar la quota de visites fora dels 5 punts més visitats', indicador: 'Quota de visites fora d\'espais de màxima afluència (%)', valor_base: 18, valor_actual: 23.4, valor_objectiu: 28, any_objectiu: 2027, unitat: '%' },
  { id: 'OE2', eix: 'sostenibilitat', objectiu: 'Reduir la petjada de carboni de les operacions pròpies', indicador: 'Emissions abast 1+2 (tCO₂e)', valor_base: 2140, valor_actual: 1630, valor_objectiu: 1070, any_objectiu: 2030, unitat: 'tCO₂e' },
  { id: 'OE3', eix: 'valor', objectiu: 'Atreure congressos internacionals d\'alt valor', indicador: 'Congressos internacionals captats (ICCA)', valor_base: 142, valor_actual: 168, valor_objectiu: 180, any_objectiu: 2027, unitat: 'congressos' },
  { id: 'OE4', eix: 'valor', objectiu: 'Augmentar la despesa mitjana per visitant', indicador: 'Despesa mitjana diària per turista (€)', valor_base: 182, valor_actual: 204, valor_objectiu: 215, any_objectiu: 2027, unitat: '€' },
  { id: 'OE5', eix: 'ciutadania', objectiu: 'Millorar la percepció ciutadana del turisme', indicador: 'Residents que consideren el turisme beneficiós (%)', valor_base: 59, valor_actual: 63, valor_objectiu: 70, any_objectiu: 2028, unitat: '%' },
  { id: 'OE6', eix: 'ciutadania', objectiu: 'Retornar valor als barris amb el programa de territori', indicador: 'Districtes amb projectes actius', valor_base: 4, valor_actual: 9, valor_objectiu: 10, any_objectiu: 2026, unitat: 'districtes' },
  { id: 'OE7', eix: 'governanca', objectiu: 'Obrir les dades: publicar conjunts reutilitzables', indicador: 'Conjunts de dades publicats en format obert', valor_base: 3, valor_actual: 16, valor_objectiu: 25, any_objectiu: 2027, unitat: 'conjunts' },
  { id: 'OE8', eix: 'governanca', objectiu: 'Reduir el termini mitjà de resposta del dret d\'accés', indicador: 'Dies mitjans de resolució', valor_base: 24, valor_actual: 16.8, valor_objectiu: 12, any_objectiu: 2027, unitat: 'dies' },
];
save('objectius', { ...META, dades: objectius });

// ---------------------------------------------------------------------------
// 8. OBLIGACIONS DE PUBLICITAT ACTIVA (autoavaluació Llei 19/2014)
// ---------------------------------------------------------------------------
const ob = (id, bloc, article, titol, seccio, estat, periodicitat, conjunt = null) =>
  ({ id, bloc, article, titol, seccio, estat, periodicitat, conjunt_dades: conjunt, darrera_actualitzacio: estat === 'pendent' ? null : addDays('2026-11-11', -int(1, 75)) });
const obligacions = [
  ob('INS-01', 'institucional', 'art. 9.1.a', 'Funcions, competències i normativa aplicable', 'institucio', 'publicat', 'quan_canvii'),
  ob('INS-02', 'institucional', 'art. 9.1.b', 'Estructura organitzativa i organigrama', 'institucio', 'publicat', 'quan_canvii'),
  ob('INS-03', 'institucional', 'art. 9.1.c', 'Òrgans de govern: composició i funcions', 'institucio', 'publicat', 'quan_canvii'),
  ob('INS-04', 'institucional', 'art. 9.1.d', 'Ens dependents i participats', 'institucio', 'publicat', 'anual'),
  ob('INS-05', 'institucional', 'art. 9.1.e', 'Ubicació i horaris d\'oficines', 'activitat', 'publicat', 'quan_canvii', 'oficines-informacio'),
  ob('INS-06', 'institucional', 'art. 9.1.f', 'Inventari d\'ens i entitats vinculades', 'institucio', 'parcial', 'anual'),
  ob('INS-07', 'institucional', 'art. 9.1.g', 'Alts càrrecs: identificació, perfil i trajectòria', 'bon-govern', 'publicat', 'quan_canvii', 'alts-carrecs'),
  ob('INS-08', 'institucional', 'art. 11.1.b', 'Retribucions d\'alts càrrecs i personal directiu', 'bon-govern', 'publicat', 'anual', 'alts-carrecs'),
  ob('INS-09', 'institucional', 'art. 9.1.i', 'Relació de llocs de treball i plantilla', 'personal', 'publicat', 'anual', 'plantilla'),
  ob('INS-10', 'institucional', 'art. 9.1.j', 'Taules retributives del personal', 'personal', 'publicat', 'anual', 'retribucions'),
  ob('INS-11', 'institucional', 'art. 9.1.l', 'Processos de selecció i provisió de llocs', 'personal', 'parcial', 'continua'),
  ob('INS-12', 'institucional', 'art. 11.1.c', 'Declaracions d\'activitats i béns', 'bon-govern', 'parcial', 'anual', 'alts-carrecs'),
  ob('INS-13', 'institucional', 'art. 55', 'Agenda pública dels alts càrrecs', 'bon-govern', 'publicat', 'setmanal', 'agenda'),
  ob('INS-14', 'institucional', 'art. 55', 'Registre de regals institucionals', 'bon-govern', 'publicat', 'trimestral', 'regals'),
  ob('ECO-01', 'economica', 'art. 11.1.a', 'Pressupost i execució trimestral', 'economia', 'publicat', 'trimestral', 'pressupost'),
  ob('ECO-02', 'economica', 'art. 11.1.c', 'Comptes anuals i informes d\'auditoria', 'economia', 'publicat', 'anual'),
  ob('ECO-03', 'economica', 'art. 11.1.d', 'Informes de control financer i de la Sindicatura', 'economia', 'parcial', 'quan_canvii'),
  ob('ECO-04', 'economica', 'art. 11.1.e', 'Període mitjà de pagament a proveïdors', 'economia', 'publicat', 'mensual'),
  ob('ECO-05', 'economica', 'art. 11.1.f', 'Endeutament i estabilitat pressupostària', 'economia', 'publicat', 'trimestral'),
  ob('ECO-06', 'economica', 'art. 11.1.g', 'Inventari de béns i drets (patrimoni)', 'economia', 'pendent', 'anual'),
  ob('CON-01', 'contractacio', 'art. 13.1.a', 'Perfil de contractant i licitacions en curs', 'contractacio', 'publicat', 'continua'),
  ob('CON-02', 'contractacio', 'art. 13.1.b', 'Contractes adjudicats: objecte, import, adjudicatari', 'contractacio', 'publicat', 'continua', 'contractes'),
  ob('CON-03', 'contractacio', 'art. 13.1.c', 'Contractes menors (relació trimestral)', 'contractacio', 'publicat', 'trimestral', 'contractes'),
  ob('CON-04', 'contractacio', 'art. 13.1.d', 'Modificacions, pròrrogues i resolucions', 'contractacio', 'publicat', 'continua', 'contractes'),
  ob('CON-05', 'contractacio', 'art. 13.1.e', 'Estadístiques de contractació per procediment', 'contractacio', 'publicat', 'anual', 'contractes'),
  ob('CON-06', 'contractacio', 'art. 13.1.f', 'Composició de les meses de contractació', 'contractacio', 'parcial', 'continua'),
  ob('CNV-01', 'convenis', 'art. 14.1', 'Relació de convenis vigents i signats', 'subvencions', 'publicat', 'trimestral', 'convenis'),
  ob('CNV-02', 'convenis', 'art. 14.2', 'Text íntegre dels convenis', 'subvencions', 'parcial', 'trimestral', 'convenis'),
  ob('SUB-01', 'subvencions', 'art. 15.1.a', 'Línies i bases reguladores de subvencions', 'subvencions', 'publicat', 'anual'),
  ob('SUB-02', 'subvencions', 'art. 15.1.c', 'Subvencions i ajuts atorgats amb beneficiaris', 'subvencions', 'publicat', 'trimestral', 'subvencions'),
  ob('SUB-03', 'subvencions', 'art. 15.1.d', 'Justificació i control de subvencions', 'subvencions', 'parcial', 'anual', 'subvencions'),
  ob('PLA-01', 'planificacio', 'art. 12', 'Plans i programes anuals i plurianuals', 'activitat', 'publicat', 'anual', 'objectius'),
  ob('PLA-02', 'planificacio', 'art. 12', 'Grau de compliment i indicadors dels plans', 'activitat', 'publicat', 'semestral', 'objectius'),
  ob('PLA-03', 'planificacio', 'art. 11.1.i', 'Estadístiques i dades d\'activitat (indicadors turístics)', 'activitat', 'publicat', 'mensual', 'indicadors-turisme'),
  ob('PLA-04', 'planificacio', 'art. 12', 'Cartes de serveis i avaluació de la qualitat', 'activitat', 'pendent', 'anual'),
  ob('DAC-01', 'dret_acces', 'art. 18', 'Procediment per exercir el dret d\'accés', 'dret-acces', 'publicat', 'quan_canvii'),
  ob('DAC-02', 'dret_acces', 'art. 14.4', 'Estadístiques de sol·licituds i resolucions', 'dret-acces', 'publicat', 'trimestral', 'dret-acces'),
  ob('DAC-03', 'dret_acces', 'art. 8.1.m', 'Resolucions estimatòries de la GAIP', 'dret-acces', 'parcial', 'continua'),
  ob('NOR-01', 'normativa', 'art. 10.1', 'Estatuts, reglaments i instruccions interpretatives', 'institucio', 'publicat', 'quan_canvii'),
  ob('NOR-02', 'normativa', 'art. 10.1.c', 'Codi ètic i de conducta', 'bon-govern', 'publicat', 'quan_canvii'),
  ob('NOR-03', 'normativa', 'art. 10.1.f', 'Canal intern d\'informació (Llei 2/2023) i mesures antifrau', 'bon-govern', 'publicat', 'quan_canvii'),
  ob('DAT-01', 'dades_obertes', 'art. 17', 'Catàleg de dades obertes reutilitzables (DCAT-AP)', 'dades-obertes', 'publicat', 'continua'),
];
save('obligacions', { ...META, marc_normatiu: 'Llei 19/2014, del 29 de desembre, de transparència, accés a la informació pública i bon govern', dades: obligacions });

console.log('Fet.');
