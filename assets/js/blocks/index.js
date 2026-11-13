/**
 * Registro de componentes (bloques) del portal — al estilo de los gestores de
 * contenidos por componentes (AEM, Drupal Layout Builder…).
 *
 * Cada componente declara:
 *   nombre, icono, grupo           → cómo aparece en la paleta del editor
 *   props: [{clave, tipo, …}]      → formulario de propiedades que genera el editor
 *   nuevo(): props por defecto     → al arrastrarlo a una página
 *   render(el, props, ctx)         → cómo se pinta en el portal (y en la vista previa)
 *
 * Tipos de propiedad: texto (i18n), texto_largo (i18n, admite **negrita**, listas y [enlaces](url)),
 * conjunto, campo, campos, select, numero, bool, filtro, lista (subformulario repetible).
 */
import { tr, t, pick, label, lang } from '../i18n.js';
import { h, esc, icon, fmt, chartCard, dataTable, kpiRow, meter, statusBadge, selectControl, filterSummary, download, toCSV } from '../ui.js';
import { hBar, columns, lines, treemap, SERIES } from '../charts.js';
import * as store from '../store.js';

export const L = (es, va, en) => ({ es, va, en });

// ---------------------------------------------------------------------------
// Utilidades compartidas
// ---------------------------------------------------------------------------
export const FORMATS = {
  entero: (n) => fmt.int(n), decimal: (n) => fmt.dec(n, 1), euros: (n) => fmt.eur(n), euros_compacto: (n) => fmt.eurC(n),
  porcentaje: (n) => fmt.pct(n), dias: (n) => fmt.dias(n), m2: (n) => fmt.m2(n),
};
const fmtOf = (k) => FORMATS[k] || FORMATS.entero;
const axisOf = (k) => (k === 'euros' || k === 'euros_compacto' ? fmt.eurC : k === 'entero' || !k ? fmt.compact : fmtOf(k));

/** Markdown mínimo y seguro: párrafos, **negrita**, *cursiva*, listas "- " y [texto](url). */
export function md(src) {
  const inline = (s) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|#|mailto:)[^)\s]+)\)/g, '<a href="$2">$1</a>');
  return String(src || '').split(/\n{2,}/).map((block) => {
    const lines_ = block.split('\n');
    if (lines_.every((l) => /^\s*-\s+/.test(l))) return `<ul>${lines_.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ''))}</li>`).join('')}</ul>`;
    return `<p>${lines_.map(inline).join('<br>')}</p>`;
  }).join('');
}
const blockTitle = (p) => (p.titulo && pick(p.titulo) ? `<h2 class="block-title">${esc(pick(p.titulo))}</h2>` : '');

async function fieldFormatter(dsId, name) {
  const f = await store.field(dsId, name);
  if (!f) return { label: name, fmt: (v) => v ?? '—', align: 'left' };
  if (f.referencia) {
    const ref = Object.fromEntries((await store.rows(f.referencia.conjunto)).map((r) => [r.id, r[f.referencia.campo]]));
    return { label: f.descripcion, fmt: (v) => ref[v] || v || '—', align: 'left', meta: f, ref };
  }
  const isMoney = /importe|presupuesto|retribucion|indemnizacion|obligaciones|deuda|ingresos|inicial|definitivo|ejecutado/.test(name);
  let fn;
  if (f.lista) fn = (v) => store.valueLabel(f, v);
  else if (f.tipo === 'date') fn = (v) => fmt.date(v);
  else if (f.tipo === 'boolean') fn = (v) => (v === null || v === undefined ? '—' : fmt.bool(v));
  else if (f.tipo === 'number' || f.tipo === 'integer') fn = (v) => (v === null || v === undefined ? '—' : isMoney ? fmt.eur(v) : fmt.dec(v, Number.isInteger(v) ? 0 : 2));
  else if (f.formato === 'uri') fn = (v) => (v ? `<a href="${esc(v)}" rel="noopener">${icon('external', 14)} ${tr('Ver', 'Veure', 'Open')}</a>` : '—');
  else fn = (v) => (v === null || v === undefined || v === '' ? '—' : v);
  return { label: f.descripcion, fmt: fn, align: f.tipo === 'number' || f.tipo === 'integer' ? 'right' : 'left', html: f.formato === 'uri', meta: f };
}

// ---------------------------------------------------------------------------
// Componentes
// ---------------------------------------------------------------------------
export const BLOCKS = {
  texto: {
    nombre: L('Texto', 'Text', 'Text'), icono: 'text', grupo: 'contenido',
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'contenido', tipo: 'texto_largo', etiqueta: L('Contenido', 'Contingut', 'Content') }],
    nuevo: () => ({ titulo: L('Nuevo apartado', 'Nou apartat', 'New section'), contenido: L('Escribe aquí el texto.', 'Escriu ací el text.', 'Write your text here.') }),
    render: (el, p) => { el.innerHTML = `<section class="card prose">${blockTitle(p)}${md(pick(p.contenido))}</section>`; },
  },
  aviso: {
    nombre: L('Aviso destacado', 'Avís destacat', 'Notice'), icono: 'info', grupo: 'contenido',
    props: [{ clave: 'nivel', tipo: 'select', etiqueta: L('Tipo', 'Tipus', 'Type'), opciones: [['info', L('Información', 'Informació', 'Info')], ['exito', L('Positivo', 'Positiu', 'Success')], ['advertencia', L('Advertencia', 'Advertència', 'Warning')]] }, { clave: 'contenido', tipo: 'texto_largo', etiqueta: L('Texto', 'Text', 'Text') }],
    nuevo: () => ({ nivel: 'info', contenido: L('Texto del aviso.', 'Text de l’avís.', 'Notice text.') }),
    render: (el, p) => { el.innerHTML = `<div class="callout callout-${p.nivel || 'info'}">${icon(p.nivel === 'advertencia' ? 'warn' : p.nivel === 'exito' ? 'ok' : 'info', 20)}<div>${md(pick(p.contenido))}</div></div>`; },
  },
  documentos: {
    nombre: L('Lista de documentos', 'Llista de documents', 'Document list'), icono: 'file', grupo: 'contenido',
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') },
      { clave: 'agrupar_por_anio', tipo: 'bool', etiqueta: L('Agrupar por años (el último visible, el resto en «Histórico»)', 'Agrupar per anys (l’últim visible, la resta en «Històric»)', 'Group by year (latest shown, rest under “History”)') },
      { clave: 'items', tipo: 'lista', etiqueta: L('Documentos', 'Documents', 'Documents'), campos: [
      { clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'tipo', tipo: 'texto', etiqueta: L('Tipo de documento (p. ej. Acta, Informe)', 'Tipus de document (p. ex. Acta, Informe)', 'Document type (e.g. Minutes, Report)') },
      { clave: 'fecha', tipo: 'fecha', etiqueta: L('Fecha', 'Data', 'Date') }, { clave: 'url', tipo: 'url', etiqueta: L('Enlace al fichero', 'Enllaç al fitxer', 'File link') },
      { clave: 'formato', tipo: 'select', etiqueta: L('Formato', 'Format', 'Format'), opciones: [['PDF', 'PDF'], ['XLSX', 'XLSX'], ['CSV', 'CSV'], ['DOCX', 'DOCX'], ['ODT', 'ODT'], ['HTML', 'HTML'], ['ZIP', 'ZIP']] },
      { clave: 'tamano', tipo: 'texto_simple', etiqueta: L('Tamaño (p. ej. 1,2 MB)', 'Grandària (p. ex. 1,2 MB)', 'Size (e.g. 1.2 MB)') }] }],
    nuevo: () => ({ titulo: L('Documentos', 'Documents', 'Documents'), agrupar_por_anio: true, items: [{ titulo: L('Nuevo documento', 'Nou document', 'New document'), fecha: new Date().toISOString().slice(0, 10), url: '#', formato: 'PDF' }] }),
    render: (el, p) => {
      const items = (p.items || []).slice().sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
      const row = (d) => {
        const has = d.url && d.url !== '#';
        const year = d.fecha ? String(d.fecha).slice(0, 4) : '';
        const meta = [pick(d.tipo), year, d.formato, d.tamano, d.fecha ? fmt.date(d.fecha) : ''].filter(Boolean);
        return `<li class="doc">
          <span class="doc-icon" aria-hidden="true">${icon('file', 22)}<span class="doc-format">${esc(d.formato || '')}</span></span>
          <div class="doc-body"><p class="doc-title">${esc(pick(d.titulo))}</p><p class="doc-meta">${meta.map(esc).join('<span aria-hidden="true"> · </span>')}</p></div>
          <div class="doc-actions">${has ? `<a class="btn-ghost btn-sm" href="${esc(d.url)}" rel="noopener">${icon('eye', 16)}${tr('Ver', 'Veure', 'View')}<span class="sr-only">: ${esc(pick(d.titulo))}</span></a><a class="btn-ghost btn-sm" href="${esc(d.url)}" download>${icon('download', 16)}${tr('Descargar', 'Descarregar', 'Download')}<span class="sr-only">: ${esc(pick(d.titulo))}</span></a>` : `<span class="muted small">${tr('Documento pendiente de enlazar', 'Document pendent d’enllaçar', 'Document link pending')}</span>`}</div></li>`;
      };
      let body;
      if (!items.length) body = `<p class="muted">${tr('Todavía no hay documentos publicados en este apartado.', 'Encara no hi ha documents publicats en aquest apartat.', 'No documents have been published here yet.')}</p>`;
      else if (p.agrupar_por_anio !== false && new Set(items.map((d) => String(d.fecha || '').slice(0, 4))).size > 1) {
        const years = [...new Set(items.map((d) => String(d.fecha || '').slice(0, 4) || '—'))];
        const [latest, ...older] = years;
        body = `<p class="doc-group-title">${tr('Última información disponible', 'Última informació disponible', 'Latest information')} · ${esc(latest)}</p><ul class="doc-list">${items.filter((d) => String(d.fecha || '').slice(0, 4) === latest).map(row).join('')}</ul>
          <details class="doc-history"><summary>${tr('Histórico', 'Històric', 'History')} ${esc(older.at(-1))}–${esc(older[0])} <span class="count">${items.length - items.filter((d) => String(d.fecha || '').slice(0, 4) === latest).length}</span></summary>
          ${older.map((y) => `<p class="doc-group-title">${esc(y)}</p><ul class="doc-list">${items.filter((d) => String(d.fecha || '').slice(0, 4) === y).map(row).join('')}</ul>`).join('')}</details>`;
      } else body = `<ul class="doc-list">${items.map(row).join('')}</ul>`;
      el.innerHTML = `<section class="card">${blockTitle(p)}${body}</section>`;
    },
  },
  enlaces: {
    nombre: L('Tarjetas de enlace', 'Targetes d’enllaç', 'Link cards'), icono: 'link', grupo: 'contenido',
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'items', tipo: 'lista', etiqueta: L('Tarjetas', 'Targetes', 'Cards'), campos: [
      { clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'texto', tipo: 'texto', etiqueta: L('Descripción', 'Descripció', 'Description') },
      { clave: 'url', tipo: 'url', etiqueta: L('Enlace', 'Enllaç', 'Link') }, { clave: 'icono', tipo: 'icono', etiqueta: L('Icono', 'Icona', 'Icon') }] }],
    nuevo: () => ({ titulo: L('Enlaces', 'Enllaços', 'Links'), items: [{ titulo: L('Enlace', 'Enllaç', 'Link'), texto: L('Descripción', 'Descripció', 'Description'), url: '#', icono: 'link' }] }),
    render: (el, p) => {
      el.innerHTML = `<section>${blockTitle(p)}<ul class="link-grid">${(p.items || []).map((d) => `<li><a class="link-card" href="${esc(d.url || '#')}">${icon(d.icono || 'link', 22)}<span><strong>${esc(pick(d.titulo))}</strong><span>${esc(pick(d.texto))}</span></span></a></li>`).join('')}</ul></section>`;
    },
  },
  cifras: {
    nombre: L('Cifras clave', 'Xifres clau', 'Key figures'), icono: 'chart', grupo: 'datos',
    props: [{ clave: 'items', tipo: 'lista', etiqueta: L('Cifras', 'Xifres', 'Figures'), campos: [
      { clave: 'etiqueta', tipo: 'texto', etiqueta: L('Etiqueta', 'Etiqueta', 'Label') }, { clave: 'conjunto', tipo: 'conjunto', etiqueta: L('Conjunto de datos', 'Conjunt de dades', 'Dataset') },
      { clave: 'operacion', tipo: 'select', etiqueta: L('Cálculo', 'Càlcul', 'Calculation'), opciones: [['contar', L('Contar registros', 'Comptar registres', 'Count')], ['sumar', L('Sumar', 'Sumar', 'Sum')], ['media', L('Media', 'Mitjana', 'Average')], ['max', L('Máximo', 'Màxim', 'Max')], ['ultimo', L('Último valor', 'Últim valor', 'Latest value')]] },
      { clave: 'campo', tipo: 'campo', etiqueta: L('Campo', 'Camp', 'Field') }, { clave: 'filtro', tipo: 'filtro', etiqueta: L('Filtro', 'Filtre', 'Filter') },
      { clave: 'formato', tipo: 'select', etiqueta: L('Formato', 'Format', 'Format'), opciones: Object.keys(FORMATS).map((k) => [k, k]) }] }],
    nuevo: () => ({ items: [{ etiqueta: L('Registros', 'Registres', 'Records'), conjunto: 'contratos', operacion: 'contar', formato: 'entero' }] }),
    render: async (el, p) => {
      const items = await Promise.all((p.items || []).map(async (it) => {
        try {
          const data = store.applyFilter(await store.rows(it.conjunto), it.filtro);
          const v = store.aggregate(data, it.operacion, it.campo);
          return { label: esc(pick(it.etiqueta)), value: v === null ? '—' : fmtOf(it.formato)(v) };
        } catch { return { label: esc(pick(it.etiqueta)), value: '—' }; }
      }));
      el.replaceChildren(kpiRow(items));
    },
  },
  grafico: {
    nombre: L('Gráfico', 'Gràfic', 'Chart'), icono: 'bars', grupo: 'datos',
    props: [
      { clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'subtitulo', tipo: 'texto', etiqueta: L('Subtítulo', 'Subtítol', 'Subtitle') },
      { clave: 'conjunto', tipo: 'conjunto', etiqueta: L('Conjunto de datos', 'Conjunt de dades', 'Dataset') },
      { clave: 'tipo_grafico', tipo: 'select', etiqueta: L('Tipo de gráfico', 'Tipus de gràfic', 'Chart type'), opciones: [['barras', L('Barras horizontales', 'Barres horitzontals', 'Horizontal bars')], ['columnas', L('Columnas', 'Columnes', 'Columns')], ['columnas_apiladas', L('Columnas apiladas', 'Columnes apilades', 'Stacked columns')], ['lineas', L('Líneas', 'Línies', 'Lines')], ['mapa_arbol', L('Mapa de árbol', 'Mapa d’arbre', 'Treemap')]] },
      { clave: 'agrupar', tipo: 'campo', etiqueta: L('Agrupar por', 'Agrupar per', 'Group by'), ayuda: L('Para fechas puedes añadir «:anio» o «:mes».', 'Per a dates pots afegir «:anio» o «:mes».', 'For dates add “:anio” or “:mes”.'), permite_fecha: true },
      { clave: 'series', tipo: 'campo', etiqueta: L('Series (opcional)', 'Sèries (opcional)', 'Series (optional)') },
      { clave: 'operacion', tipo: 'select', etiqueta: L('Cálculo', 'Càlcul', 'Calculation'), opciones: [['contar', L('Contar registros', 'Comptar registres', 'Count')], ['sumar', L('Sumar', 'Sumar', 'Sum')], ['media', L('Media', 'Mitjana', 'Average')]] },
      { clave: 'valor', tipo: 'campo', etiqueta: L('Campo a calcular', 'Camp a calcular', 'Value field') },
      { clave: 'filtro', tipo: 'filtro', etiqueta: L('Filtro', 'Filtre', 'Filter') },
      { clave: 'formato', tipo: 'select', etiqueta: L('Formato', 'Format', 'Format'), opciones: Object.keys(FORMATS).map((k) => [k, k]) },
      { clave: 'orden', tipo: 'select', etiqueta: L('Orden', 'Ordre', 'Sort'), opciones: [['valor', L('Por valor', 'Per valor', 'By value')], ['etiqueta', L('Por etiqueta', 'Per etiqueta', 'By label')]] },
      { clave: 'limite', tipo: 'numero', etiqueta: L('Máximo de categorías', 'Màxim de categories', 'Max categories') },
      { clave: 'referencia', tipo: 'numero', etiqueta: L('Línea de referencia', 'Línia de referència', 'Reference line') },
      { clave: 'ancho', tipo: 'select', etiqueta: L('Ancho', 'Amplada', 'Width'), opciones: [['normal', L('Media columna', 'Mitja columna', 'Half')], ['completo', L('Completo', 'Complet', 'Full')]] },
    ],
    nuevo: () => ({ titulo: L('Nuevo gráfico', 'Nou gràfic', 'New chart'), conjunto: 'contratos', tipo_grafico: 'barras', agrupar: 'procedimiento', operacion: 'contar', formato: 'entero', orden: 'valor' }),
    render: async (el, p, ctx) => {
      const ds = await store.dsMeta(p.conjunto);
      if (!ds) { el.innerHTML = `<div class="callout callout-advertencia">${tr('Elige un conjunto de datos.', 'Tria un conjunt de dades.', 'Choose a dataset.')}</div>`; return; }
      const data = store.applyFilter(await store.rows(p.conjunto), p.filtro);
      const gField = ds.campos.find((c) => c.nombre === String(p.agrupar || '').split(':')[0]);
      const sField = p.series ? ds.campos.find((c) => c.nombre === p.series) : null;
      const gk = store.groupKey(p.agrupar || 'id');
      const isDate = /:(anio|mes)$/.test(p.agrupar || '');
      const lab = (k) => (isDate ? (k.length === 7 ? fmt.month(k) : k) : store.valueLabel(gField, k));
      const groups = new Map();
      data.forEach((r) => { const k = gk(r); if (k === null) return; (groups.get(k) || groups.set(k, []).get(k)).push(r); });
      let cats = [...groups.keys()];
      const val = (set) => store.aggregate(set, p.operacion || 'contar', p.valor);
      if ((p.orden || 'valor') === 'etiqueta') cats.sort();
      else cats.sort((a, b) => val(groups.get(b)) - val(groups.get(a)));
      if (p.limite) cats = cats.slice(0, Number(p.limite));
      const F = fmtOf(p.formato), A = axisOf(p.formato);
      const type = p.tipo_grafico || 'barras';
      let seriesKeys = [];
      if (sField) seriesKeys = [...new Set(data.map((r) => r[p.series]).filter((v) => v !== null && v !== undefined))].sort();
      const tableCols = [{ key: 'k', label: gField?.descripcion || p.agrupar }, ...(sField ? seriesKeys.map((s, i) => ({ key: 's' + i, label: store.valueLabel(sField, s), align: 'right', format: F })) : [{ key: 'v', label: tr('Valor', 'Valor', 'Value'), align: 'right', format: F }])];
      const tableRows = cats.map((c) => sField ? Object.fromEntries([['k', lab(c)], ...seriesKeys.map((s, i) => ['s' + i, val(groups.get(c).filter((r) => r[p.series] === s))])]) : { k: lab(c), v: val(groups.get(c)) });
      const card = chartCard({
        title: esc(pick(p.titulo) || ds.titulo[lang()]), subtitle: p.subtitulo ? esc(pick(p.subtitulo)) : '', file: `${p.conjunto}-${String(p.agrupar).replace(/:/g, '-')}`,
        dataset: p.conjunto, datasetTitle: pick(ds.titulo), wide: p.ancho === 'completo',
        table: { columns: tableCols, rows: tableRows },
        draw: (body) => {
          if (!cats.length) { body.innerHTML = `<p class="muted">${t('no_results')}</p>`; return; }
          const series = sField ? seriesKeys.map((s, i) => ({ name: store.valueLabel(sField, s), color: SERIES[i % SERIES.length], values: cats.map((c) => val(groups.get(c).filter((r) => r[p.series] === s))) })) : [{ name: pick(p.titulo) || '', values: cats.map((c) => val(groups.get(c))), color: SERIES[0] }];
          if (type === 'barras' && !sField) hBar(body, { data: cats.map((c) => ({ label: lab(c), value: val(groups.get(c)) })), format: F, color: SERIES[0], valueName: pick(p.titulo) || '' });
          else if (type === 'mapa_arbol') treemap(body, { data: cats.map((c, i) => ({ name: lab(c), value: val(groups.get(c)), color: SERIES[i % SERIES.length], ink: i === 3 ? '#0b0b0b' : undefined })), format: F });
          else if (type === 'lineas') lines(body, { x: cats.map(lab), series, format: F, axisFormat: A, area: !sField, height: 280 });
          else columns(body, { categories: cats.map(lab), series, stacked: type === 'columnas_apiladas', format: F, axisFormat: A, refLine: p.referencia ? { value: Number(p.referencia), label: `${tr('Referencia', 'Referència', 'Reference')}: ${F(Number(p.referencia))}` } : undefined });
        },
      });
      el.replaceChildren(card);
      el.classList.toggle('span-full', p.ancho === 'completo');
      ctx?.flush?.();
    },
  },
  tabla: {
    nombre: L('Tabla de datos', 'Taula de dades', 'Data table'), icono: 'table', grupo: 'datos',
    props: [
      { clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'conjunto', tipo: 'conjunto', etiqueta: L('Conjunto de datos', 'Conjunt de dades', 'Dataset') },
      { clave: 'columnas', tipo: 'campos', etiqueta: L('Columnas (máximo recomendado: 6)', 'Columnes (màxim recomanat: 6)', 'Columns (recommended max: 6)') }, { clave: 'filtros', tipo: 'campos', etiqueta: L('Desplegables de filtro', 'Desplegables de filtre', 'Filter dropdowns') },
      { clave: 'busqueda', tipo: 'bool', etiqueta: L('Mostrar buscador', 'Mostrar cercador', 'Show search') }, { clave: 'filtro', tipo: 'filtro', etiqueta: L('Filtro fijo', 'Filtre fix', 'Fixed filter') },
      { clave: 'orden', tipo: 'campo', etiqueta: L('Ordenar por', 'Ordenar per', 'Sort by') }, { clave: 'descendente', tipo: 'bool', etiqueta: L('Orden descendente', 'Ordre descendent', 'Descending') },
      { clave: 'por_pagina', tipo: 'numero', etiqueta: L('Filas por página', 'Files per pàgina', 'Rows per page') },
    ],
    nuevo: () => ({ conjunto: 'contratos', columnas: ['fecha_adjudicacion', 'objeto', 'adjudicatario', 'importe_adjudicacion_sin_iva'], filtros: [], busqueda: true, por_pagina: 15 }),
    render: async (el, p, ctx) => {
      const ds = await store.dsMeta(p.conjunto);
      if (!ds) { el.innerHTML = `<div class="callout callout-advertencia">${tr('Elige un conjunto de datos.', 'Tria un conjunt de dades.', 'Choose a dataset.')}</div>`; return; }
      const all = store.applyFilter(await store.rows(p.conjunto), p.filtro);
      const colNames = (p.columnas?.length ? p.columnas : ds.campos.slice(0, 6).map((c) => c.nombre));
      const fmts = Object.fromEntries(await Promise.all([...new Set([...colNames, ...(p.filtros || [])])].map(async (n) => [n, await fieldFormatter(p.conjunto, n)])));
      const cols = colNames.map((n) => ({ key: n, label: fmts[n].label, format: (v) => fmts[n].fmt(v), align: fmts[n].align, html: fmts[n].html }));
      const filterFields = (p.filtros || []).map((n) => ds.campos.find((c) => c.nombre === n)).filter(Boolean);
      const q = ctx?.query || new URLSearchParams();
      // estado inicial desde la URL: ?q=texto&campo=valor (compartible)
      const st = { q: q.get('q') || '', ...Object.fromEntries(filterFields.map((f) => [f.nombre, q.get(f.nombre) || ''])) };
      const nounAll = pick(ds.titulo).toLowerCase();
      const card = h(`<section class="card table-card">${blockTitle(p)}
        <form class="filter-bar" onsubmit="return false" aria-label="${esc(t('filters'))}">
          ${p.busqueda ? `<label class="control grow"><span>${t('search')}</span><input type="search" class="tf-q" value="${esc(st.q)}" placeholder="${esc(tr('Escribe para filtrar…', 'Escriu per a filtrar…', 'Type to filter…'))}"></label>` : ''}
          ${filterFields.length ? `<details class="more-filters"><summary class="btn-ghost btn-sm">${icon('layout', 16)}${tr('Filtros', 'Filtres', 'Filters')}</summary><div class="more-filters-body">` : ''}${filterFields.map((f) => selectControl(`tf-${f.nombre}-${ctx?.blockIndex ?? 0}`, f.descripcion, [['', t('all')], ...[...new Set(all.map((r) => r[f.nombre]).filter((v) => v !== null && v !== '' && v !== undefined))].map(String).sort().map((v) => [v, fmts[f.nombre].fmt(v)])], st[f.nombre])).join('')}${filterFields.length ? '</div></details>' : ''}
        </form><div class="tf-summary"></div><div class="tf-out"></div>
        <p class="table-foot">${t('source')}: <a href="#/datos/${p.conjunto}">${esc(pick(ds.titulo))}</a> · <button type="button" class="link-btn" data-export>${icon('download', 14)} ${tr('Descargar esta selección (CSV)', 'Descarregar aquesta selecció (CSV)', 'Download this selection (CSV)')}</button> · <a href="data/csv/${p.conjunto}.csv" download>${tr('Conjunto completo', 'Conjunt complet', 'Full dataset')} (CSV)</a></p></section>`);
      const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const mf = card.querySelector(".more-filters"); if (mf) mf.open = matchMedia("(min-width: 768px)").matches || filterFields.some((f) => st[f.nombre]);
      let current = all;
      const sync = () => {
        const [path, qs] = location.hash.replace(/^#/, '').split('?');
        const u = new URLSearchParams(qs || '');
        for (const [k, v] of Object.entries(st)) { if (v) u.set(k, v); else u.delete(k); }
        history.replaceState(null, '', `#${path}${u.toString() ? '?' + u : ''}`);
      };
      const draw = () => {
        const nq = norm(st.q);
        current = all.filter((r) => filterFields.every((f) => !st[f.nombre] || String(r[f.nombre]) === st[f.nombre]) && (!nq || norm(Object.values(r).join(' ') + ' ' + colNames.map((n) => fmts[n].ref ? fmts[n].fmt(r[n]) : '').join(' ')).includes(nq)));
        const chips = [...(st.q ? [{ label: `«${st.q}»`, onRemove: () => { st.q = ''; card.querySelector('.tf-q').value = ''; update(); } }] : []),
          ...filterFields.filter((f) => st[f.nombre]).map((f) => ({ label: `${f.descripcion}: ${fmts[f.nombre].fmt(st[f.nombre])}`, onRemove: () => { st[f.nombre] = ''; card.querySelector(`#tf-${f.nombre}-${ctx?.blockIndex ?? 0}`).value = ''; update(); } }))];
        const clearAll = () => { Object.keys(st).forEach((k) => (st[k] = '')); card.querySelectorAll('select').forEach((s) => (s.value = '')); const qi = card.querySelector('.tf-q'); if (qi) qi.value = ''; update(); };
        card.querySelector('.tf-summary').replaceChildren(filterSummary({ count: current.length, noun: current.length === 1 ? t('record') : t('records'), chips, onClear: clearAll, clearAlways: true }));
        card.querySelector('.tf-out').replaceChildren(dataTable({ caption: pick(p.titulo) || pick(ds.titulo), columns: cols, rows: current, pageSize: Number(p.por_pagina) || 15, sortKey: p.orden || null, sortDir: p.descendente ? -1 : 1,
          emptyHtml: `${esc(tr(`No hay ${nounAll} con estos filtros.`, `No hi ha ${nounAll} amb aquests filtres.`, `No ${nounAll} match these filters.`))} <button type="button" class="link-btn" data-clear>${esc(tr('Limpiar filtros', 'Netejar filtres', 'Clear filters'))}</button>` }));
        card.querySelector('[data-clear]')?.addEventListener('click', clearAll);
      };
      const update = () => { sync(); draw(); };
      card.querySelectorAll('select').forEach((s) => s.addEventListener('change', () => { const f = filterFields.find((x) => s.id.startsWith(`tf-${x.nombre}-`)); st[f.nombre] = s.value; update(); }));
      let deb; card.querySelector('.tf-q')?.addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value.trim(); update(); }, 200); });
      card.querySelector('[data-export]').addEventListener('click', () => download(`${p.conjunto}-seleccion.csv`, '﻿' + toCSV(ds.campos.map((c) => ({ key: c.nombre, label: c.nombre })), current), 'text/csv;charset=utf-8'));
      draw();
      el.replaceChildren(card);
    },
  },
  personas: {
    nombre: L('Fichas de cargos', 'Fitxes de càrrecs', 'People cards'), icono: 'users', grupo: 'datos',
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'filtro', tipo: 'filtro', etiqueta: L('Filtro', 'Filtre', 'Filter') }, { clave: 'mostrar_retribucion', tipo: 'bool', etiqueta: L('Mostrar retribuciones', 'Mostrar retribucions', 'Show pay') }],
    nuevo: () => ({ titulo: L('Corporación', 'Corporació', 'Council'), conjunto: 'cargos', mostrar_retribucion: true }),
    render: async (el, p) => {
      const data = store.applyFilter(await store.rows(p.conjunto || 'cargos'), p.filtro);
      const agenda = await store.rows('agenda').catch(() => []);
      const nAg = (id) => agenda.filter((a) => a.cargo_id === id).length;
      const ini = (n) => String(n).split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
      const doc = (u, txt) => (u ? `<li><a href="${esc(u)}" rel="noopener">${icon('file', 16)}${txt}</a></li>` : '');
      el.innerHTML = `<section>${blockTitle(p)}<ul class="people-grid">${data.map((c) => `<li class="person card">
        <div class="person-head">${c.foto ? `<img src="${esc(c.foto)}" alt="" class="avatar">` : `<span class="avatar" aria-hidden="true">${esc(ini(c.nombre))}</span>`}
          <div><h3 class="person-name">${esc(c.nombre)}</h3><p class="person-role">${esc(c.cargo)}</p>${c.grupo_politico ? `<p class="person-group">${esc(c.grupo_politico)}</p>` : ''}</div></div>
        ${p.mostrar_retribucion ? `<p class="person-pay"><span class="person-pay-value">${c.retribucion_anual ? fmt.eur(c.retribucion_anual) : tr('Sin retribución fija', 'Sense retribució fixa', 'No fixed salary')}</span><span class="person-pay-label">${c.retribucion_anual ? tr('brutos al año', "bruts a l'any", 'gross per year') : ''}${c.indemnizaciones_anuales ? ` · ${fmt.eur(c.indemnizaciones_anuales)} ${tr('en asistencias', 'en assistències', 'attendance fees')}` : ''}</span></p>` : ''}
        <dl class="person-facts">
          <div><dt>${tr('Responsabilidades', 'Responsabilitats', 'Responsibilities')}</dt><dd>${esc(c.areas || '—')}</dd></div>
          <div><dt>${tr('Dedicación', 'Dedicació', 'Dedication')}</dt><dd>${label('dedicacion', c.dedicacion)}</dd></div>
          <div><dt>${tr('En el cargo desde', 'En el càrrec des de', 'In office since')}</dt><dd>${fmt.full(c.fecha_nombramiento)}</dd></div>
        </dl>
        <ul class="person-links">${doc(c.declaracion_bienes_url, tr('Declaración de bienes', 'Declaració de béns', 'Assets declaration'))}${doc(c.declaracion_actividades_url, tr('Declaración de actividades', 'Declaració d’activitats', 'Activities declaration'))}${doc(c.cv_url, tr('Trayectoria', 'Trajectòria', 'Career'))}
          ${nAg(c.id) ? `<li><a href="#/agenda?cargo_id=${encodeURIComponent(c.id)}">${icon('calendar', 16)}${tr('Agenda', 'Agenda', 'Diary')} (${nAg(c.id)})</a></li>` : ''}
          ${c.email ? `<li><a href="mailto:${esc(c.email)}">${icon('mail', 16)}${tr('Contacto institucional', 'Contacte institucional', 'Official contact')}</a></li>` : ''}</ul>
      </li>`).join('')}</ul></section>`;
    },
  },
  mapa: {
    nombre: L('Mapa', 'Mapa', 'Map'), icono: 'map', grupo: 'datos',
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'conjunto', tipo: 'conjunto', etiqueta: L('Conjunto (con lat/lon)', 'Conjunt (amb lat/lon)', 'Dataset (with lat/lon)') }, { clave: 'campo_titulo', tipo: 'campo', etiqueta: L('Campo del nombre', 'Camp del nom', 'Name field') }, { clave: 'filtro', tipo: 'filtro', etiqueta: L('Filtro', 'Filtre', 'Filter') }],
    nuevo: () => ({ titulo: L('Mapa', 'Mapa', 'Map'), conjunto: 'inmuebles', campo_titulo: 'denominacion' }),
    render: async (el, p) => {
      const data = store.applyFilter(await store.rows(p.conjunto), p.filtro).filter((r) => typeof r.lat === 'number' && typeof r.lon === 'number');
      const card = h(`<section class="card">${blockTitle(p)}<div class="map" role="region" aria-label="${esc(pick(p.titulo) || 'Mapa')}"></div><p class="chart-source">© <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> · ${fmt.int(data.length)} ${t('records')}</p></section>`);
      el.replaceChildren(card);
      const box = card.querySelector('.map');
      try {
        const Lf = await loadLeaflet();
        for (let i = 0; i < 40 && !box.isConnected; i++) await new Promise((r) => setTimeout(r, 100));
        const map = Lf.map(box, { scrollWheelZoom: false });
        Lf.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
        const color = getComputedStyle(document.documentElement).getPropertyValue('--brand').trim() || '#7a1f2b';
        const pts = data.map((r) => Lf.circleMarker([r.lat, r.lon], { radius: 8, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.9 }).bindPopup(`<strong>${esc(r[p.campo_titulo] || r.id || '')}</strong>${r.direccion ? `<br>${esc(r.direccion)}` : ''}`).addTo(map));
        if (pts.length) map.fitBounds(Lf.featureGroup(pts).getBounds().pad(0.2)); else map.setView([40.4, -3.7], 5);
      } catch { box.classList.add('map-fallback'); box.textContent = tr('No se ha podido cargar el mapa.', 'No s’ha pogut carregar el mapa.', 'The map could not be loaded.'); }
    },
  },
  fuente: {
    nombre: L('Origen de los datos', 'Origen de les dades', 'Data source'), icono: 'sync', grupo: 'datos',
    props: [{ clave: 'conjunto', tipo: 'conjunto', etiqueta: L('Conjunto de datos', 'Conjunt de dades', 'Dataset') }],
    nuevo: () => ({ conjunto: 'contratos' }),
    render: async (el, p) => {
      const [ds, env, st] = await Promise.all([store.dsMeta(p.conjunto), store.dataset(p.conjunto), store.syncStatus()]);
      if (!ds) return;
      const src = st?.fuentes?.[ds.fuente.tipo];
      const auto = ['placsp', 'bdns'].includes(ds.fuente.tipo);
      const when = src?.fecha || env.actualizado || env.generado;
      const realOk = src && src.estado === 'ok' && !env.ejemplo;
      el.innerHTML = `<div class="source-strip">
        <span class="source-icon">${icon(auto ? 'sync' : 'edit', 18)}</span>
        <div><strong>${auto ? tr('Actualización automática', 'Actualització automàtica', 'Automatic update') : tr('Actualización manual', 'Actualització manual', 'Manual update')}</strong>
        <span>${t('source')}: ${ds.fuente.url ? `<a href="${esc(ds.fuente.url)}" rel="noopener">${esc(ds.fuente.nombre)}</a>` : esc(ds.fuente.nombre)} · ${t('updated')}: ${fmt.date(String(when).slice(0, 10))} · ${fmt.int((env.datos || []).length)} ${t('records')}</span>
        ${env.ejemplo ? `<span class="badge badge-warning">${icon('warn', 12)}${tr('Datos de ejemplo: pendiente de la primera sincronización', 'Dades d’exemple: pendent de la primera sincronització', 'Sample data: awaiting first sync')}</span>` : realOk ? `<span class="badge badge-good">${icon('ok', 12)}${tr('Sincronizado', 'Sincronitzat', 'Synced')}</span>` : ''}</div>
        <a class="link-btn" href="#/datos/${p.conjunto}">${tr('Datos y API', 'Dades i API', 'Data & API')} →</a></div>`;
    },
  },
  indicadores: {
    nombre: L('Qué exige la ley en esta página', 'Què exigeix la llei en aquesta pàgina', 'What the law requires on this page'), icono: 'check', grupo: 'datos',
    props: [{ clave: 'pagina', tipo: 'texto_simple', etiqueta: L('Página (vacío = actual)', 'Pàgina (buit = actual)', 'Page (empty = current)') }],
    nuevo: () => ({}),
    render: async (el, p, ctx) => {
      const C = await import('../compliance.js');
      const pages = p.lista || [p.pagina || ctx?.pageId];
      const obl = await C.obligaciones(pages);
      if (!obl.length) { el.innerHTML = ''; return; }
      const state = (o) => o.estado_calc;
      const list = `<ul class="obl-list">${obl.map((o) => `<li>${statusBadge(state(o))}<span class="obl-title">${esc(o.titulo)}</span><span class="obl-meta">${o.evidencia ? `${t('updated')}: ${fmt.date(o.evidencia)} · ` : ''}${label('periodicidad', o.periodicidad)} · <abbr title="${esc(tr('Fundamento legal', 'Fonament legal', 'Legal basis'))}">${esc(o.norma)}, ${esc(o.articulo)}</abbr></span></li>`).join('')}</ul>`;
      if (p.plano) { el.innerHTML = list; return; }
      const ok = obl.filter((o) => state(o) === 'publicado').length;
      el.innerHTML = `<details class="status-summary"><summary>${icon('check', 18)}<span>${tr(`Qué exige la ley en esta página: <strong>${ok} de ${obl.length}</strong> apartados disponibles y al día`, `Què exigeix la llei en aquesta pàgina: <strong>${ok} de ${obl.length}</strong> apartats disponibles i al dia`, `What the law requires here: <strong>${ok} of ${obl.length}</strong> items available and up to date`)}</span></summary>${list}
        <p class="muted small"><a href="#/indice">${tr('Ver el índice de cumplimiento completo', 'Veure l’índex de compliment complet', 'See the full compliance index')}</a></p></details>`;
    },
  },
  fuentes: {
    nombre: L('Procedencia de los datos', 'Procedència de les dades', 'Data sources'), icono: 'database', grupo: 'datos',
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }],
    nuevo: () => ({ titulo: L('Procedencia de los datos', 'Procedència de les dades', 'Data sources') }),
    render: async (el, p) => {
      const [m, st] = await Promise.all([store.meta(), store.syncStatus()]);
      const rowsData = await Promise.all(m.conjuntos.map(async (d) => { const env = await store.dataset(d.id).catch(() => ({})); return { d, env }; }));
      const FREQ = { CONT: tr('Continua', 'Contínua', 'Continuous'), WEEKLY: tr('Semanal', 'Setmanal', 'Weekly'), MONTHLY: tr('Mensual', 'Mensual', 'Monthly'), QUARTERLY: tr('Trimestral', 'Trimestral', 'Quarterly'), BIANNUAL: tr('Semestral', 'Semestral', 'Half-yearly'), ANNUAL: tr('Anual', 'Anual', 'Annual') };
      const card = h(`<section class="card">${blockTitle(p)}<p class="muted">${tr('Fuente, responsable, frecuencia y fecha de la última actualización de cada conjunto de datos del portal.', 'Font, responsable, freqüència i data de l’última actualització de cada conjunt de dades del portal.', 'Source, owner, frequency and last update of every dataset.')}</p></section>`);
      card.appendChild(dataTable({ caption: pick(p.titulo) || 'fuentes', pageSize: 50, rows: rowsData.map(({ d, env }) => ({
        conjunto: pick(d.titulo), id: d.id, fuente: d.fuente.nombre, url: d.fuente.url, auto: ['placsp', 'bdns'].includes(d.fuente.tipo), responsable: pick(d.responsable), freq: FREQ[d.periodicidad] || d.periodicidad,
        fecha: env.actualizado || env.generado, ejemplo: env.ejemplo, sync: st?.fuentes?.[d.fuente.tipo] })),
        columns: [
          { key: 'conjunto', label: tr('Conjunto de datos', 'Conjunt de dades', 'Dataset'), html: true, format: (v, r) => `<a href="#/datos/${r.id}">${esc(v)}</a>` },
          { key: 'fuente', label: t('source'), html: true, format: (v, r) => `${r.url ? `<a href="${esc(r.url)}" rel="noopener">${esc(v)}</a>` : esc(v)}<br><span class="muted small">${r.auto ? tr('Actualización automática diaria', 'Actualització automàtica diària', 'Daily automatic update') : tr('Carga manual', 'Càrrega manual', 'Manual upload')}</span>` },
          { key: 'responsable', label: tr('Responsable', 'Responsable', 'Owner') },
          { key: 'freq', label: tr('Frecuencia', 'Freqüència', 'Frequency') },
          { key: 'fecha', label: t('updated'), html: true, format: (v, r) => `${v ? fmt.date(String(v).slice(0, 10)) : '—'}${r.ejemplo ? ` <span class="badge badge-warning">${icon('alert', 12)}${tr('Ejemplo', 'Exemple', 'Sample')}</span>` : ''}`, sortValue: (r) => r.fecha },
        ] }));
      el.replaceChildren(card);
    },
  },
};

let leafletPromise;
export function loadLeaflet() {
  leafletPromise ||= new Promise((resolve, reject) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = store.url('assets/vendor/leaflet/leaflet.css'); document.head.appendChild(css);
    const s = document.createElement('script'); s.src = store.url('assets/vendor/leaflet/leaflet.js'); s.onload = () => resolve(window.L); s.onerror = reject; document.head.appendChild(s);
  });
  return leafletPromise;
}

/** Registra los componentes avanzados (se cargan aparte para no penalizar la carga inicial). */
export async function loadAdvanced() {
  const mod = await import('./avanzados.js');
  Object.assign(BLOCKS, mod.ADVANCED);
  return BLOCKS;
}

/** Pinta un bloque en un contenedor. */
export async function renderBlock(el, block, ctx) {
  const def = BLOCKS[block.tipo];
  el.className = `block block-${block.tipo}`;
  if (!def) { el.innerHTML = `<div class="callout callout-advertencia">${tr('Componente desconocido', 'Component desconegut', 'Unknown component')}: ${esc(block.tipo)}</div>`; return; }
  try { await def.render(el, block, ctx); } catch (e) { console.error(e); el.innerHTML = `<div class="callout callout-advertencia">${esc(e.message)}</div>`; }
}
export { meter };
