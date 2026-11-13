/**
 * compliance.js — Estado de las obligaciones de transparencia calculado a partir
 * de las evidencias, no solo de lo que anota a mano el gestor.
 *
 *   obligación → página / conjunto de datos → periodicidad → última evidencia → estado
 *
 * Evidencias que se tienen en cuenta (se toma la más reciente):
 *   - la fecha anotada a mano en la obligación (ultima_actualizacion);
 *   - la fecha de la última edición de la página donde se publica;
 *   - la fecha de actualización del conjunto de datos vinculado;
 *   - la última sincronización correcta, si el conjunto se actualiza solo (PLACSP, BDNS);
 *   - la fecha más reciente de sus registros, en obligaciones de periodicidad corta.
 *
 * Reglas:
 *   - «No aplica» se respeta siempre.
 *   - Si la página no existe o el conjunto vinculado está vacío → pendiente (con motivo).
 *   - Si la obligación estaba «pendiente» pero su conjunto se sincroniza solo y tiene
 *     datos al día → disponible (detectado automáticamente).
 *   - Si la última evidencia supera el plazo de su periodicidad → pendiente de actualizar,
 *     con la fecha en que venció.
 *
 * Lo comparten el portal público (índice, páginas, categorías) y el editor (inicio de gestión).
 */
import * as store from './store.js';

/** Días de margen por periodicidad antes de considerar la información desactualizada. */
export const MAX_DIAS = { continua: 15, semanal: 10, mensual: 45, trimestral: 105, semestral: 200, anual: 380, cuando_cambie: 400 };
export const PESO = { publicado: 1, parcial: 0.5, pendiente: 0, desactualizada: 0.75 };
const CORTA = new Set(['continua', 'semanal', 'mensual']);
const AUTO = new Set(['placsp', 'bdns']);

const d10 = (v) => (v ? String(v).slice(0, 10) : null);
const maxDate = (...ds) => ds.map(d10).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1) || null;
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const todayIso = () => new Date().toISOString().slice(0, 10);

/**
 * Evalúa una lista de obligaciones.
 * @param {object[]} obl registros de data/obligaciones.json
 * @param {{hoy?: string}} [opts]
 * @returns {Promise<object[]>} obligaciones con: estado_calc, evidencia, vence, motivo, automatico
 */
export async function evaluate(obl, { hoy = todayIso() } = {}) {
  const [m, sync] = await Promise.all([store.meta(), store.syncStatus()]);
  const dsCache = new Map(), pgCache = new Map();
  const ds = (id) => { if (!dsCache.has(id)) dsCache.set(id, store.dataset(id).catch(() => null)); return dsCache.get(id); };
  const pg = (id) => { if (!pgCache.has(id)) pgCache.set(id, store.page(id).catch(() => null)); return pgCache.get(id); };
  return Promise.all(obl.map(async (o) => {
    const r = { ...o, estado_calc: o.estado, evidencia: d10(o.ultima_actualizacion), vence: null, motivo: '', automatico: false };
    if (o.estado === 'no_aplica') return r;
    const page = o.pagina ? await pg(o.pagina) : null;
    if (o.pagina && !page) return { ...r, estado_calc: 'pendiente', motivo: 'pagina_inexistente', automatico: true };
    let env = null, dm = null, syncDate = null, recDate = null;
    if (o.conjunto) {
      env = await ds(o.conjunto);
      dm = m.conjuntos.find((d) => d.id === o.conjunto);
      if (!env || !(env.datos || []).length) return { ...r, estado_calc: 'pendiente', motivo: 'sin_datos', automatico: true };
      const tipo = dm?.fuente?.tipo;
      if (AUTO.has(tipo)) { const s = sync?.fuentes?.[tipo]; if (s?.estado === 'ok') syncDate = s.fecha; }
      if (CORTA.has(o.periodicidad) && dm) {
        const dateFields = dm.campos.filter((c) => c.tipo === 'date').map((c) => c.nombre);
        for (const row of env.datos) for (const f of dateFields) { const v = d10(row[f]); if (v && v <= hoy && (!recDate || v > recDate)) recDate = v; }
      }
    }
    const evid = maxDate(o.ultima_actualizacion, page?.actualizado, env?.actualizado, AUTO.has(dm?.fuente?.tipo) ? env?.generado : null, syncDate, recDate);
    r.evidencia = evid;
    let estado = o.estado;
    if (estado === 'pendiente' && syncDate && evid) { estado = 'publicado'; r.automatico = true; r.motivo = 'sincronizado'; }
    if ((estado === 'publicado' || estado === 'parcial') && evid) {
      const lim = MAX_DIAS[o.periodicidad] ?? 400;
      const vence = addDays(evid, lim);
      r.vence = vence;
      if (vence < hoy) { estado = 'desactualizada'; r.automatico = true; r.motivo = r.motivo || 'plazo_vencido'; }
    }
    r.estado_calc = estado;
    return r;
  }));
}

/** Obligaciones evaluadas (todas o las de unas páginas). */
export async function obligaciones(pages) {
  const all = await store.rows('obligaciones');
  return evaluate(pages ? all.filter((o) => pages.includes(o.pagina)) : all);
}

/** Índice de cumplimiento: publicada 1 · desactualizada 0,75 · incompleta 0,5 · pendiente 0. */
export function score(ev) {
  const ap = ev.filter((o) => o.estado_calc !== 'no_aplica');
  const s_ = (set) => (set.reduce((a, o) => a + (PESO[o.estado_calc] ?? 0), 0) / (set.length || 1)) * 100;
  const counts = { publicado: 0, desactualizada: 0, parcial: 0, pendiente: 0 };
  ap.forEach((o) => { counts[o.estado_calc] = (counts[o.estado_calc] || 0) + 1; });
  return { total: s_(ap), counts, n: ap.length, byBloque: [...new Set(ap.map((o) => o.bloque))].map((b) => ({ bloque: b, score: s_(ap.filter((o) => o.bloque === b)), n: ap.filter((o) => o.bloque === b).length })) };
}

/** Explicación breve del estado calculado (para el gestor y el detalle técnico). */
export function motivoTexto(o, tr, fdate = (x) => x) {
  switch (o.motivo) {
    case 'pagina_inexistente': return tr('La página donde debe publicarse no existe.', 'La pàgina on s’ha de publicar no existeix.', 'The page where it must be published does not exist.');
    case 'sin_datos': return tr('El conjunto de datos vinculado está vacío.', 'El conjunt de dades vinculat està buit.', 'The linked dataset is empty.');
    case 'sincronizado': return tr('Se actualiza automáticamente desde la fuente oficial.', 'S’actualitza automàticament des de la font oficial.', 'Updated automatically from the official source.');
    case 'plazo_vencido': return tr(`Debía actualizarse antes del ${fdate(o.vence)}.`, `S’havia d’actualitzar abans del ${fdate(o.vence)}.`, `Should have been updated before ${fdate(o.vence)}.`);
    default: return '';
  }
}
