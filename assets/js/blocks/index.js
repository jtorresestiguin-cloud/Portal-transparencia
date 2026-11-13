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
import { h, esc, icon, fmt, chartCard, dataTable, kpiRow, meter, statusBadge, selectControl } from '../ui.js';
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
    props: [{ clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'items', tipo: 'lista', etiqueta: L('Documentos', 'Documents', 'Documents'), campos: [
      { clave: 'titulo', tipo: 'texto', etiqueta: L('Título', 'Títol', 'Title') }, { clave: 'fecha', tipo: 'fecha', etiqueta: L('Fecha', 'Data', 'Date') },
      { clave: 'url', tipo: 'url', etiqueta: L('Enlace', 'Enllaç', 'Link') }, { clave: 'formato', tipo: 'select', etiqueta: L('Formato', 'Format', 'Format'), opciones: [['PDF', 'PDF'], ['XLSX', 'XLSX'], ['CSV', 'CSV'], ['DOCX', 'DOCX'], ['HTML', 'HTML']] }] }],
    nuevo: () => ({ titulo: L('Documentos', 'Documents', 'Documents'), items: [{ titulo: L('Nuevo documento', 'Nou document', 'New document'), fecha: new Date().toISOString().slice(0, 10), url: '#', formato: 'PDF' }] }),
    render: (el, p) => {
      el.innerHTML = `<section class="card">${blockTitle(p)}<ul class="doc-list">${(p.items || []).map((d) => `<li>${icon('file', 20)}<div class="doc-main"><a href="${esc(d.url || '#')}" rel="noopener">${esc(pick(d.titulo))}</a><span class="muted small">${d.fecha ? fmt.date(d.fecha) : ''}</span></div><span class="chip">${esc(d.formato || '')}</span></li>`).join('') || `<li class="muted">${tr('Sin documentos', 'Sense documents', 'No documents')}</li>`}</ul></section>`;
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
      { clave: 'columnas', tipo: 'campos', etiqueta: L('Columnas', 'Columnes', 'Columns') }, { clave: 'filtros', tipo: 'campos', etiqueta: L('Desplegables de filtro', 'Desplegables de filtre', 'Filter dropdowns') },
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
      const cols = await Promise.all(colNames.map(async (n) => { const f = await fieldFormatter(p.conjunto, n); return { key: n, label: f.label, format: (v) => f.fmt(v), align: f.align, html: f.html }; }));
      const filterFields = await Promise.all((p.filtros || []).map((n) => store.field(p.conjunto, n)));
      const q0 = ctx?.query?.get('q') || '';
      const card = h(`<section class="card">${blockTitle(p)}
        <form class="filters inline" onsubmit="return false">
          ${filterFields.filter(Boolean).map((f) => selectControl(`tf-${f.nombre}`, f.descripcion, [['', t('all')], ...[...new Set(all.map((r) => r[f.nombre]).filter((v) => v !== null && v !== ''))].sort().map((v) => [v, store.valueLabel(f, v)])], '')).join('')}
          ${p.busqueda ? `<label class="control grow"><span>${t('search')}</span><input type="search" class="tf-q" value="${esc(q0)}" placeholder="${esc(tr('Escribe para filtrar…', 'Escriu per a filtrar…', 'Type to filter…'))}"></label>` : ''}
        </form><div class="tf-out"></div>
        <p class="chart-source">${t('source')}: <a href="#/datos/${p.conjunto}">${t('dataset')} «${esc(pick(ds.titulo))}»</a> · <a href="data/csv/${p.conjunto}.csv" download>CSV</a> · <a href="data/${p.conjunto}.json">JSON</a></p></section>`);
      const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      const draw = () => {
        const sel = Object.fromEntries(filterFields.filter(Boolean).map((f) => [f.nombre, card.querySelector(`#tf-${f.nombre}`).value]));
        const q = norm(card.querySelector('.tf-q')?.value || '');
        const rowsF = all.filter((r) => Object.entries(sel).every(([k, v]) => !v || String(r[k]) === v) && (!q || norm(Object.values(r).join(' ')).includes(q)));
        card.querySelector('.tf-out').replaceChildren(dataTable({ caption: pick(p.titulo) || pick(ds.titulo), columns: cols, rows: rowsF, pageSize: Number(p.por_pagina) || 15, sortKey: p.orden || null, sortDir: p.descendente ? -1 : 1 }));
      };
      card.querySelectorAll('select').forEach((s) => s.addEventListener('change', draw));
      let deb; card.querySelector('.tf-q')?.addEventListener('input', () => { clearTimeout(deb); deb = setTimeout(draw, 200); });
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
      const ini = (n) => String(n).split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
      const doc = (u, txt) => (u ? `<a href="${esc(u)}" rel="noopener">${icon('file', 14)} ${txt}</a>` : '');
      el.innerHTML = `<section>${blockTitle(p)}<ul class="people-grid">${data.map((c) => `<li class="person card">
        <div class="person-head">${c.foto ? `<img src="${esc(c.foto)}" alt="" class="avatar">` : `<span class="avatar" aria-hidden="true">${esc(ini(c.nombre))}</span>`}
          <div><strong class="person-name">${esc(c.nombre)}</strong><span class="person-role">${esc(c.cargo)}</span>${c.grupo_politico ? `<span class="muted small">${esc(c.grupo_politico)}</span>` : ''}</div></div>
        <dl class="person-facts">
          <div><dt>${tr('Áreas', 'Àrees', 'Areas')}</dt><dd>${esc(c.areas || '—')}</dd></div>
          <div><dt>${tr('Dedicación', 'Dedicació', 'Dedication')}</dt><dd>${label('dedicacion', c.dedicacion)}</dd></div>
          ${p.mostrar_retribucion ? `<div><dt>${tr('Retribución anual', 'Retribució anual', 'Annual pay')}</dt><dd>${c.retribucion_anual ? fmt.eur(c.retribucion_anual) : '—'}</dd></div>${c.indemnizaciones_anuales ? `<div><dt>${tr('Asistencias', 'Assistències', 'Attendance fees')}</dt><dd>${fmt.eur(c.indemnizaciones_anuales)}</dd></div>` : ''}` : ''}
          <div><dt>${tr('Desde', 'Des de', 'Since')}</dt><dd>${fmt.date(c.fecha_nombramiento)}</dd></div>
        </dl>
        <div class="person-links">${doc(c.declaracion_bienes_url, tr('Declaración de bienes', 'Declaració de béns', 'Assets declaration'))}${doc(c.declaracion_actividades_url, tr('Declaración de actividades', 'Declaració d’activitats', 'Activities declaration'))}${doc(c.cv_url, tr('Trayectoria', 'Trajectòria', 'Career'))}${c.email ? `<a href="mailto:${esc(c.email)}">${icon('mail', 14)} ${esc(c.email)}</a>` : ''}</div>
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
    nombre: L('Obligaciones de la página', 'Obligacions de la pàgina', 'Page obligations'), icono: 'check', grupo: 'datos',
    props: [{ clave: 'pagina', tipo: 'texto_simple', etiqueta: L('Página (vacío = actual)', 'Pàgina (buit = actual)', 'Page (empty = current)') }],
    nuevo: () => ({}),
    render: async (el, p, ctx) => {
      const pid = p.pagina || ctx?.pageId;
      const obl = (await store.rows('obligaciones')).filter((o) => o.pagina === pid);
      if (!obl.length) { el.innerHTML = ''; return; }
      el.innerHTML = `<details class="card obligations" open><summary><span class="block-title">${icon('check', 18)} ${t('obligations_here')}</span><span class="muted small">${obl.filter((o) => o.estado === 'publicado').length}/${obl.length}</span></summary>
        <ul class="obl-list">${obl.map((o) => `<li>${statusBadge(o.estado)}<span class="obl-title">${esc(o.titulo)}</span><span class="muted small">${esc(o.norma)}, ${esc(o.articulo)} · ${label('periodicidad', o.periodicidad)}${o.ultima_actualizacion ? ` · ${t('updated')} ${fmt.date(o.ultima_actualizacion)}` : ''}</span></li>`).join('')}</ul></details>`;
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
