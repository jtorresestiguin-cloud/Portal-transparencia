/**
 * Conector con la Base de Datos Nacional de Subvenciones (BDNS / SNPSAP).
 *
 * Usa la API REST pública (sin clave): GET {api}/concesiones/busqueda
 * con paginación (page, pageSize), fechas en formato DD/MM/AAAA y filtro por
 * órgano concedente. La respuesta se interpreta de forma tolerante porque los
 * nombres de algunos campos pueden variar entre versiones de la API.
 * Documentación oficial: https://www.infosubvenciones.es/bdnstrans/doc/swagger
 */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const pickF = (o, ...keys) => { for (const k of keys) if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k]; return null; };
const toISO = (s) => {
  if (!s) return null;
  const str = String(s);
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : str.slice(0, 10);
};
const toDMY = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const FINALIDAD = [[/cultur|music|teatr|patrimon/, 'cultura'], [/deport|club|atlet/, 'deporte'], [/social|mayores|vulnerab|emergencia social|dependen/, 'servicios_sociales'],
  [/educa|escolar|ampa|beca|estudi/, 'educacion'], [/comerc|empleo|empresa|emprend|contrataci/, 'comercio'], [/fiest|festej|tradici/, 'fiestas'],
  [/ambient|energ|sostenib|clima/, 'medio_ambiente'], [/cooperaci|humanitari/, 'cooperacion']];
export const finalidad = (txt) => (FINALIDAD.find(([re]) => re.test(norm(txt))) || [null, 'otros'])[1];

/** Separa «B12345678 NOMBRE» en NIF y nombre; solo se conserva el NIF de personas jurídicas. */
export function splitBeneficiario(b) {
  const s = String(b || '').trim();
  const m = s.match(/^([A-Z0-9]{8,9}[A-Z0-9]?)\s+(.+)$/i);
  if (!m) return { nombre: s, nif: null };
  const nif = m[1].toUpperCase();
  return { nombre: m[2].trim(), nif: /^[ABCDEFGHJNPQRSUVW]/.test(nif) ? nif : null };
}

export function mapConcesion(c) {
  const { nombre, nif } = splitBeneficiario(pickF(c, 'beneficiario', 'beneficiarioNombre', 'nombreBeneficiario'));
  const conv = pickF(c, 'convocatoria', 'descripcionConvocatoria', 'tituloConvocatoria', 'descripcion') || '';
  return {
    id: `bdns-${pickF(c, 'codConcesion', 'idConcesion', 'id')}`,
    codigo_bdns: String(pickF(c, 'numeroConvocatoria', 'codigoBDNS', 'codConvocatoria') ?? ''),
    convocatoria: conv,
    finalidad: finalidad(`${conv} ${pickF(c, 'finalidad', 'descripcionFinalidad') || ''}`),
    modalidad: null,
    beneficiario: nombre,
    beneficiario_nif: nif,
    fecha_concesion: toISO(pickF(c, 'fechaConcesion', 'fecha')),
    importe: Math.round(Number(pickF(c, 'importe', 'importeTotal', 'ayudaEquivalente') || 0) * 100) / 100,
    fuente: 'bdns',
    _organo: [pickF(c, 'nivel1'), pickF(c, 'nivel2'), pickF(c, 'nivel3'), pickF(c, 'organo', 'organoConvocante')].filter(Boolean).join(' / '),
  };
}

/**
 * @param {object} cfg config.fuentes.bdns
 * @param {(url:string)=>Promise<any>} fetchJSON
 */
export async function syncBdns(cfg, fetchJSON, { maxPages = 200, pageSize = 200 } = {}) {
  if (!cfg.organos?.length) throw new Error('Falta configurar el identificador del órgano concedente en la BDNS (config/entidad.json → fuentes.bdns.organos).');
  const out = new Map();
  let page = 0, total = 1;
  const want = norm(cfg.nombre_organo);
  while (page < total && page < maxPages) {
    const q = new URLSearchParams({ vpd: 'GE', page: String(page), pageSize: String(pageSize), order: 'fechaConcesion', direccion: 'desc' });
    if (cfg.desde) q.set('fechaDesde', toDMY(cfg.desde));
    if (cfg.organos?.length) q.set('organos', cfg.organos.join(','));
    const res = await fetchJSON(`${cfg.api.replace(/\/$/, '')}/concesiones/busqueda?${q}`);
    const items = res.content || res.contenido || res.items || (Array.isArray(res) ? res : []);
    total = res.totalPages ?? res.totalPaginas ?? (items.length < pageSize ? page + 1 : page + 2);
    for (const c of items) {
      const r = mapConcesion(c);
      if (cfg.filtrar_por_nombre && want && !norm(r._organo).includes(want)) continue;
      const { _organo, ...rec } = r;
      out.set(rec.id, rec);
    }
    if (!items.length) break;
    page++;
  }
  return { subvenciones: [...out.values()].sort((a, b) => String(b.fecha_concesion).localeCompare(String(a.fecha_concesion))), pages: page };
}
