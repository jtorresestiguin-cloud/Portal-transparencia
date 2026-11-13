/**
 * Editor visual del portal (admin/).
 *
 * - Páginas: árbol de categorías y páginas; lienzo con los bloques («cajitas»)
 *   que se arrastran desde la paleta, se reordenan y se configuran en el panel
 *   de propiedades, con vista previa real (mismo código que el portal).
 * - Datos: edición de registros con formularios generados desde el esquema
 *   (data/metadata/datasets.json): altos cargos, agenda, normativa, convenios…
 * - Entidad: datos de la administración, colores y fuentes automáticas.
 * - Fuentes: estado de la sincronización con PLACSP y BDNS y lanzamiento manual.
 * - Publicar: confirma los cambios en el repositorio de GitHub con un solo commit
 *   (o los descarga como ficheros si no se usa GitHub).
 *
 * - Inicio: panel de gestión (estado, obligaciones calculadas, fuentes, avisos,
 *   primeros pasos e historial) — ver gestion.js.
 * - Modo sencillo / avanzado: el sencillo oculta nombres técnicos y filtros en bruto.
 *
 * Flujo: editar → revisar cambios → comprobaciones → vista previa → publicar
 * (directamente o como propuesta de revisión en GitHub).
 *
 * Todo cambio se guarda como borrador en el navegador hasta que se publica.
 */
import { setLang, setCodelists, pick, label } from '../assets/js/i18n.js';
import { h, esc, icon, ICONS, flushCharts, download, modal, fmt } from '../assets/js/ui.js';
import * as store from '../assets/js/store.js';
import { BLOCKS, loadAdvanced, renderBlock } from '../assets/js/blocks/index.js';
import * as G from './gestion.js';
import * as A from './archivos.js';
import * as Z from './sesion.js';

const S = { snap: new Map(), work: new Map(), orig: new Map(), dirty: new Set(), hist: [], lang: 'es', tab: 'inicio', view: null, sel: null, insertAt: null, rec: null, mode: 'simple', pick: new Set(), ds: null, uploads: new Map() };
try { S.mode = localStorage.getItem('ed-mode') || 'simple'; } catch { /* */ }
const simple = () => S.mode === 'simple';
// Propiedades que en modo sencillo se agrupan en «Configuración avanzada».
const ADV_KEYS = new Set(['series', 'referencia', 'orden', 'descendente', 'por_pagina', 'limite', 'nivel', 'ancho', 'campo_titulo']);
const isAdv = (p) => p.avanzado ?? (p.tipo === 'filtro' || ADV_KEYS.has(p.clave) || (p.clave === 'pagina' && p.tipo === 'texto_simple'));
const OPS_TXT = { '=': 'es', '!=': 'no es', '>=': 'desde', '<=': 'hasta', '>': 'mayor que', '<': 'menor que' };
const OP_TXT = { contar: 'Número de registros', sumar: 'Suma', media: 'Media', max: 'Máximo', min: 'Mínimo', ultimo: 'Último valor' };
const LANGS = { es: 'ES', va: 'VA', en: 'EN' };
const INDENT = (p) => (p.startsWith('config/') ? 2 : 1);
const $ = (s, r = document) => r.querySelector(s);
const today = () => new Date().toISOString().slice(0, 10);
const clone = (o) => JSON.parse(JSON.stringify(o));
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'pagina';

// ------------------------------------------------------------------ almacén de trabajo
async function load(path) {
  if (!S.work.has(path)) {
    const o = await store.getJSON(path);
    S.orig.set(path, JSON.stringify(o));
    S.work.set(path, clone(o));
    S.snap.set(path, JSON.stringify(o));
    store.setOverride(path, S.work.get(path));
  }
  return S.work.get(path);
}
const W = (path) => S.work.get(path);
function change(path, fn, { silent = false } = {}) {
  const data = W(path);
  const before = S.snap.get(path) ?? JSON.stringify(data);
  const last = S.hist.at(-1), now = Date.now();
  if (!(last && last.path === path && now - last.t < 900)) S.hist.push({ path, before, t: now });
  else last.t = now;
  if (S.hist.length > 80) S.hist.shift();
  fn(data);
  if (path.startsWith('content/paginas/')) data.actualizado = today();
  if (path.startsWith('data/') && path !== 'data/sync/estado.json' && data && 'datos' in data) { data.actualizado = today(); delete data.ejemplo; data.fuente = data.fuente === 'ejemplo' ? 'manual' : data.fuente; }
  S.snap.set(path, JSON.stringify(data));
  markDirty(path);
  if (!silent) refreshCounters();
}
function markDirty(path) {
  if (JSON.stringify(W(path)) === S.orig.get(path)) S.dirty.delete(path); else S.dirty.add(path);
  store.setOverride(path, W(path));
  saveDraft();
}
function undo() {
  const last = S.hist.pop();
  if (!last) return;
  S.work.set(last.path, JSON.parse(last.before));
  S.snap.set(last.path, last.before);
  markDirty(last.path);
  refreshCounters(); rerender();
  toast('Cambio deshecho');
}
function saveDraft() {
  try { localStorage.setItem('ed-draft', JSON.stringify(Object.fromEntries([...S.dirty].map((p) => [p, W(p)])))); } catch { /* sin almacenamiento */ }
}
function refreshCounters() {
  $('#ed-count').textContent = S.dirty.size + S.uploads.size;
  $('#ed-undo').disabled = !S.hist.length;
  document.querySelectorAll('[data-dirty-path]').forEach((el) => (el.hidden = !S.dirty.has(el.dataset.dirtyPath)));
}
let toastT;
function toast(msg, ms = 2600) { const t = $('#ed-toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

// ------------------------------------------------------------------ campos de formulario
const i18nVal = (o) => (o && typeof o === 'object' ? o[S.lang] || '' : o || '');
const setI18n = (obj, key, v) => { if (!obj[key] || typeof obj[key] !== 'object') obj[key] = { es: '', va: '', en: '' }; obj[key][S.lang] = v; };
const missing = (o) => (o && typeof o === 'object' ? Object.keys(LANGS).filter((l) => !o[l]) : []);
const missingTag = (o) => { const m = missing(o).filter((l) => l !== S.lang); return m.length ? `<span class="ed-missing" title="Falta traducción">falta ${m.map((l) => LANGS[l]).join(', ')}</span>` : ''; };

/**
 * Construye un formulario a partir de un esquema de propiedades.
 * @param {HTMLElement} host
 * @param {object[]} props esquema [{clave, tipo, etiqueta, opciones, campos, ayuda}]
 * @param {object} obj objeto a editar (se modifica en sitio)
 * @param {(clave:string)=>void} onChange
 */
async function buildForm(host, props, obj, onChange) {
  host.innerHTML = '';
  const m = await store.meta();
  const dsFields = (id) => m.conjuntos.find((d) => d.id === id)?.campos || [];
  // Resumen guiado: «Muestra: suma de «Importe» de Contratos donde…»
  if (props.some((p) => p.tipo === 'conjunto')) {
    const sum = h('<p class="ed-summary" aria-live="polite"></p>');
    host.appendChild(sum);
    const upd = () => describeConfig(obj, m).then((t) => { sum.innerHTML = t; sum.hidden = !t; });
    let deb; const later = () => { clearTimeout(deb); deb = setTimeout(upd, 200); };
    host.addEventListener('input', later); host.addEventListener('change', later); host.addEventListener('ed-cond', later);
    upd();
  }
  let advBox = null;
  const target = (p) => {
    if (!(simple() && isAdv(p))) return host;
    if (!advBox) { const d = h('<details class="ed-adv"><summary>Configuración avanzada</summary><div></div></details>'); advBox = d.querySelector('div'); host._adv = d; }
    return advBox;
  };
  for (const p of props) {
    const wrap = h(`<label class="ed-field"><span>${esc(pick(p.etiqueta) || p.clave)}${['texto', 'texto_largo'].includes(p.tipo) ? missingTag(obj[p.clave]) : ''}</span></label>`);
    let input;
    const v = obj[p.clave];
    switch (p.tipo) {
      case 'texto': input = h(`<input type="text" value="${esc(i18nVal(v))}">`); input.addEventListener('input', () => { setI18n(obj, p.clave, input.value); onChange(p.clave); }); break;
      case 'texto_largo': input = h(`<textarea>${esc(i18nVal(v))}</textarea>`); input.addEventListener('input', () => { setI18n(obj, p.clave, input.value); onChange(p.clave); }); wrap.append(input); input = null; wrap.append(h('<small>Admite **negrita**, *cursiva*, listas con «- » y [enlaces](https://…)</small>')); break;
      case 'texto_simple': case 'url': case 'fecha': case 'numero': case 'color': {
        const type = { texto_simple: 'text', url: 'text', fecha: 'date', numero: 'number', color: 'color' }[p.tipo];
        input = h(`<input type="${type}" value="${esc(v ?? '')}">`);
        input.addEventListener('input', () => { obj[p.clave] = p.tipo === 'numero' ? (input.value === '' ? undefined : Number(input.value)) : input.value; onChange(p.clave); });
        break;
      }
      case 'bool': wrap.classList.add('ed-check'); input = h(`<input type="checkbox"${v ? ' checked' : ''}>`); input.addEventListener('change', () => { obj[p.clave] = input.checked; onChange(p.clave); }); wrap.prepend(input); input = null; break;
      case 'select': input = h(`<select><option value="">—</option>${p.opciones.map(([k, l]) => `<option value="${esc(k)}"${String(v) === String(k) ? ' selected' : ''}>${esc(pick(l))}</option>`).join('')}</select>`); input.addEventListener('change', () => { obj[p.clave] = input.value || undefined; onChange(p.clave); }); break;
      case 'pagina': {
        const portal = W('content/portal.json') || await store.portal();
        const ids = [...new Set([...portal.categorias.flatMap((c) => c.paginas), 'accesibilidad', 'sobre-los-datos'])];
        input = h(`<select><option value="">—</option>${ids.map((id) => `<option value="${id}"${id === v ? ' selected' : ''}>${id}</option>`).join('')}</select>`);
        input.addEventListener('change', () => { obj[p.clave] = input.value || undefined; onChange(p.clave); });
        break;
      }
      case 'icono': input = h(`<select>${Object.keys(ICONS).map((k) => `<option${k === v ? ' selected' : ''}>${k}</option>`).join('')}</select>`); input.addEventListener('change', () => { obj[p.clave] = input.value; onChange(p.clave); }); break;
      case 'conjunto': input = h(`<select><option value="">—</option>${m.conjuntos.map((d) => `<option value="${d.id}"${d.id === v ? ' selected' : ''}>${esc(pick(d.titulo))}</option>`).join('')}</select>`); input.addEventListener('change', () => { obj[p.clave] = input.value; onChange(p.clave, true); }); break;
      case 'campo': {
        const fs = dsFields(obj.conjunto || 'cargos');
        const opts = fs.flatMap((f) => [[f.nombre, simple() ? f.descripcion : `${f.descripcion} (${f.nombre})`], ...(p.permite_fecha && f.tipo === 'date' ? [[`${f.nombre}:anio`, `${f.descripcion} → por año`], [`${f.nombre}:mes`, `${f.descripcion} → por mes`]] : [])]);
        input = h(`<select><option value="">—</option>${opts.map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`);
        input.addEventListener('change', () => { obj[p.clave] = input.value || undefined; onChange(p.clave); });
        break;
      }
      case 'campos': {
        const fs = dsFields(obj.conjunto);
        const sel = new Set(v || []);
        input = h(`<div class="ed-checks">${fs.map((f) => `<label><input type="checkbox" value="${f.nombre}"${sel.has(f.nombre) ? ' checked' : ''}> ${esc(f.descripcion)}</label>`).join('') || '<span class="ed-hint">Elige antes un conjunto de datos</span>'}</div>`);
        input.addEventListener('change', (e) => { const cur = obj[p.clave] || []; obj[p.clave] = e.target.checked ? [...cur, e.target.value] : cur.filter((x) => x !== e.target.value); onChange(p.clave); });
        break;
      }
      case 'filtro': {
        const fin = h(`<input type="text" value="${esc(v || '')}" placeholder="campo=valor;otro!=x;importe>=1000">`);
        input = fin;
        const info = h('<small class="ed-hint"></small>');
        const count = async () => { if (!obj.conjunto) { info.textContent = ''; return; } const all = await store.rows(obj.conjunto); const n = store.applyFilter(all, fin.value).length; info.innerHTML = `<span class="ed-count-ok">${n}</span> de ${all.length} registros cumplen el filtro`; };
        fin.addEventListener('input', () => { obj[p.clave] = fin.value || undefined; onChange(p.clave); count(); });
        wrap.append(input, info); input = null; count();
        if (simple()) host.appendChild(await guidedFilter(p, obj, onChange, dsFields, () => { fin.value = obj[p.clave] || ''; count(); host.dispatchEvent(new Event('ed-cond')); }));
        break;
      }
      case 'lista': {
        const list = h('<div class="ed-list"></div>');
        const items = obj[p.clave] || (obj[p.clave] = []);
        const draw = () => {
          list.innerHTML = '';
          items.forEach((it, i) => {
            const det = h(`<details class="ed-list-item"${i === items.length - 1 && draw.added ? ' open' : ''}><summary>${esc(i18nVal(it.titulo || it.etiqueta || it.texto) || `Elemento ${i + 1}`)}<span class="ed-bactions">
              <button type="button" class="ed-mini" data-a="up" title="Subir">${icon('up', 14)}</button><button type="button" class="ed-mini" data-a="down" title="Bajar">${icon('down', 14)}</button><button type="button" class="ed-mini" data-a="del" title="Eliminar">${icon('trash', 14)}</button></span></summary><div></div></details>`);
            det.querySelector('summary').addEventListener('click', (e) => {
              const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return; e.preventDefault();
              if (a === 'del') items.splice(i, 1); else { const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= items.length) return; [items[i], items[j]] = [items[j], items[i]]; }
              draw(); onChange(p.clave);
            });
            const sub = (k, rebuild) => { onChange(p.clave); if (rebuild) buildForm(det.querySelector('div'), p.campos, it, sub); };
            buildForm(det.querySelector('div'), p.campos, it, sub);
            list.appendChild(det);
          });
          const add = h(`<button type="button" class="ed-add">${icon('plus', 14)} Añadir</button>`);
          add.addEventListener('click', () => { items.push(Object.fromEntries(p.campos.map((c) => [c.clave, ['texto', 'texto_largo'].includes(c.tipo) ? { es: '', va: '', en: '' } : c.tipo === 'conjunto' ? obj.conjunto || 'contratos' : undefined]))); draw.added = true; draw(); onChange(p.clave); });
          list.appendChild(add);
        };
        draw();
        wrap.append(list); input = null;
        break;
      }
      default: input = h(`<input type="text" value="${esc(v ?? '')}">`); input.addEventListener('input', () => { obj[p.clave] = input.value; onChange(p.clave); });
    }
    if (input) wrap.append(input);
    if (input && (p.tipo === 'url' || p.subir || p.clave === 'escudo')) A.attachUploader(S, input, { kind: p.clave === 'escudo' ? 'entidad' : 'documentos', image: p.clave === 'escudo' || p.imagen, toast });
    if (p.ayuda) wrap.append(h(`<small class="ed-hint">${esc(pick(p.ayuda))}</small>`));
    target(p).appendChild(wrap);
  }
  if (host._adv) host.appendChild(host._adv);
}

/** Descripción en lenguaje natural de la configuración de un componente de datos. */
async function describeConfig(obj, m) {
  const ds = m.conjuntos.find((d) => d.id === obj.conjunto);
  if (!ds) return obj.conjunto === undefined ? '' : '<strong>Elige un conjunto de datos.</strong>';
  const fd = (n) => ds.campos.find((c) => c.nombre === String(n).split(':')[0]);
  const fl = (n) => { const f = fd(n); const mod = String(n).split(':')[1]; return f ? `«${esc(f.descripcion)}»${mod === 'anio' ? ' por año' : mod === 'mes' ? ' por mes' : ''}` : `«${esc(n)}»`; };
  const parts = [];
  const op = obj.operacion;
  const campo = obj.campo || obj.valor;
  if (op) parts.push(`${OP_TXT[op] || op}${campo && op !== 'contar' ? ` de ${fl(campo)}` : ''} de <strong>${esc(pick(ds.titulo))}</strong>`);
  else parts.push(`<strong>${esc(pick(ds.titulo))}</strong>`);
  if (obj.agrupar) parts.push(`agrupado por ${fl(obj.agrupar)}`);
  if (Array.isArray(obj.columnas) && obj.columnas.length) parts.push(`${obj.columnas.length} columnas`);
  const conds = store.parseFilter(obj.filtro);
  if (conds.length) parts.push(`donde ${conds.map((c) => `${fl(c.k)} ${OPS_TXT[c.op]} «${esc(store.valueLabel(fd(c.k), c.v))}»`).join(' y ')}`);
  let n = '';
  try { const all = await store.rows(ds.id); n = ` · <span class="ed-count-ok">${fmt.int(store.applyFilter(all, obj.filtro).length)}</span> de ${fmt.int(all.length)} registros`; } catch { /* */ }
  return `Muestra: ${parts.join(', ')}${n}`;
}

/** Constructor de condiciones de filtro sin escribir expresiones (modo sencillo). */
async function guidedFilter(p, obj, onChange, dsFields, synced) {
  const box = h('<div class="ed-field ed-guided"><span>Condiciones (qué registros se tienen en cuenta)</span><div class="ed-conds"></div><div class="ed-cond-add"></div></div>');
  const cl = await store.getJSON('data/codelists.json');
  const conds = () => store.parseFilter(obj[p.clave]);
  const save = (list) => { obj[p.clave] = list.map((c) => `${c.k}${c.op}${c.v}`).join(';') || undefined; onChange(p.clave); synced(); draw(); };
  const draw = () => {
    const fs = dsFields(obj.conjunto);
    const fd = (n) => fs.find((f) => f.nombre === n);
    const list = conds();
    box.querySelector('.ed-conds').innerHTML = list.length ? list.map((c, i) => `<span class="ed-chip">«${esc(fd(c.k)?.descripcion || c.k)}» ${OPS_TXT[c.op]} «${esc(store.valueLabel(fd(c.k), c.v))}»<button type="button" class="ed-mini" data-rm="${i}" aria-label="Quitar condición">${icon('x', 12)}</button></span>`).join('') : '<span class="ed-hint">Sin condiciones: se tienen en cuenta todos los registros.</span>';
    box.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => { const l = conds(); l.splice(Number(b.dataset.rm), 1); save(l); }));
    const add = box.querySelector('.ed-cond-add');
    if (!fs.length) { add.innerHTML = ''; return; }
    add.innerHTML = `<select data-k aria-label="Campo"><option value="">Añadir condición…</option>${fs.filter((f) => f.nombre !== 'id').map((f) => `<option value="${f.nombre}">${esc(f.descripcion)}</option>`).join('')}</select><span data-rest></span>`;
    add.querySelector('[data-k]').addEventListener('change', (e) => {
      const f = fd(e.target.value); const rest = add.querySelector('[data-rest]');
      if (!f) { rest.innerHTML = ''; return; }
      const vals = f.lista ? f.lista.split('|').flatMap((l) => Object.keys(cl[l] || {}).map((k) => [k, label(l, k)])) : f.tipo === 'boolean' ? [['true', 'Sí'], ['false', 'No']] : null;
      const ops = f.tipo === 'date' ? [['anio', 'en el año'], ['>=', 'desde'], ['<=', 'hasta']] : ['number', 'integer'].includes(f.tipo) ? [['>=', 'como mínimo'], ['<=', 'como máximo'], ['=', 'es'], ['!=', 'no es']] : [['=', 'es'], ['!=', 'no es']];
      const years = Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - i);
      rest.innerHTML = `<select data-op aria-label="Operador">${ops.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
        <span data-vbox>${vals ? `<select data-v aria-label="Valor">${vals.map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join('')}</select>` : f.tipo === 'date' ? `<select data-v aria-label="Año">${years.map((y) => `<option>${y}</option>`).join('')}</select>` : `<input data-v type="${['number', 'integer'].includes(f.tipo) ? 'number' : 'text'}" aria-label="Valor">`}</span>
        <button type="button" class="btn-ghost" data-ok>Añadir</button>`;
      rest.querySelector('[data-op]').addEventListener('change', (ev) => { if (f.tipo === 'date') rest.querySelector('[data-vbox]').innerHTML = ev.target.value === 'anio' ? `<select data-v aria-label="Año">${years.map((y) => `<option>${y}</option>`).join('')}</select>` : '<input data-v type="date" aria-label="Fecha">'; });
      rest.querySelector('[data-ok]').addEventListener('click', () => {
        const op = rest.querySelector('[data-op]').value, v = rest.querySelector('[data-v]').value;
        if (v === '') return;
        const l = conds();
        if (op === 'anio') l.push({ k: f.nombre, op: '>=', v: `${v}-01-01` }, { k: f.nombre, op: '<=', v: `${v}-12-31` });
        else l.push({ k: f.nombre, op, v });
        save(l);
      });
    });
  };
  draw();
  return box;
}

// ------------------------------------------------------------------ barra lateral
async function renderSide() {
  const body = $('#ed-side-body');
  document.querySelectorAll('.ed-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  if (S.tab === 'inicio') {
    body.innerHTML = `<p class="ed-hint">Estado del portal, avisos que necesitan atención, fuentes automáticas e historial de publicaciones.</p><button type="button" class="ed-item" aria-current="true">${icon('home', 14)} Inicio de gestión</button>`;
    S.view = { kind: 'dash' };
    G.dashboard(CTX);
  } else if (S.tab === 'paginas') {
    const portal = W('content/portal.json');
    const titles = Object.fromEntries(await Promise.all(portal.categorias.flatMap((c) => c.paginas).concat(['accesibilidad']).map(async (id) => [id, pick((await load(`content/paginas/${id}.json`)).titulo)])));
    body.innerHTML = `<ul class="ed-tree">${portal.categorias.map((c, ci) => `<li><div class="ed-cat">${icon(c.icono, 16)}<span>${esc(i18nVal(c.titulo))}</span><span class="ed-cat-actions">
        <button type="button" class="ed-mini" data-cat-edit="${ci}" title="Editar categoría">${icon('edit', 14)}</button></span></div>
        <ul>${c.paginas.map((p) => `<li><button type="button" class="ed-item" data-page="${p}" aria-current="${S.view?.kind === 'page' && S.view.id === p}">${icon('file', 14)}<span>${esc(titles[p] || p)}</span><span class="ed-dirty" data-dirty-path="content/paginas/${p}.json" hidden></span></button></li>`).join('')}
        <li><button type="button" class="ed-add" data-new-page="${ci}">${icon('plus', 14)} Nueva página</button></li></ul></li>`).join('')}
      <li><div class="ed-cat">${icon('info', 16)}<span>Otras páginas</span></div><ul><li><button type="button" class="ed-item" data-page="accesibilidad" aria-current="${S.view?.id === 'accesibilidad'}">${icon('file', 14)}<span>${esc(titles.accesibilidad)}</span></button></li></ul></li></ul>
      <button type="button" class="ed-add" id="ed-new-cat">${icon('plus', 14)} Nueva categoría</button>
      <button type="button" class="ed-add" id="ed-home">${icon('home', 14)} Portada</button>`;
    body.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => openPage(b.dataset.page)));
    body.querySelectorAll('[data-cat-edit]').forEach((b) => b.addEventListener('click', () => openCategory(Number(b.dataset.catEdit))));
    body.querySelectorAll('[data-new-page]').forEach((b) => b.addEventListener('click', () => newPage(Number(b.dataset.newPage))));
    $('#ed-new-cat').addEventListener('click', newCategory);
    $('#ed-home').addEventListener('click', openHome);
  } else if (S.tab === 'datos') {
    const m = await store.meta();
    body.innerHTML = `<p class="ed-hint">Los conjuntos marcados con ${icon('sync', 12)} se actualizan solos desde su fuente oficial; aquí solo se añaden registros complementarios.</p>
      <ul class="ed-tree"><li><ul style="padding:0">${m.conjuntos.map((d) => `<li><button type="button" class="ed-item" data-ds="${d.id}" aria-current="${S.view?.kind === 'data' && S.view.id === d.id}">${icon(['placsp', 'bdns'].includes(d.fuente.tipo) ? 'sync' : 'table', 14)}<span>${esc(pick(d.titulo))}</span><span class="ed-dirty" data-dirty-path="data/${d.id}.json" hidden></span></button></li>`).join('')}</ul></li></ul>`;
    body.querySelectorAll('[data-ds]').forEach((b) => b.addEventListener('click', () => openData(b.dataset.ds)));
  } else if (S.tab === 'entidad') {
    body.innerHTML = `<p class="ed-hint">Nombre, identificadores, colores corporativos y configuración de las fuentes automáticas. Es lo único que hay que cambiar para usar el portal en otra administración.</p><button type="button" class="ed-item" aria-current="true">${icon('settings', 14)} Configuración de la entidad</button>`;
    openEntity();
  } else {
    body.innerHTML = `<p class="ed-hint">Estado de la conexión con la Plataforma de Contratación del Sector Público y la Base de Datos Nacional de Subvenciones.</p><button type="button" class="ed-item" aria-current="true">${icon('sync', 14)} Sincronización</button>`;
    openSync();
  }
  refreshCounters();
}

// ------------------------------------------------------------------ páginas
async function openPage(id) {
  S.view = { kind: 'page', id }; S.sel = null; S.insertAt = null;
  await load(`content/paginas/${id}.json`);
  renderSide();
  renderPage();
  showPalette();
}
const PATH = () => `content/paginas/${S.view.id}.json`;
async function renderPage() {
  const pg = W(PATH());
  const main = $('#ed-main');
  main.innerHTML = '';
  const head = h(`<section class="ed-pagehead"><div class="ed-row"><label class="ed-field"><span>Título de la página ${missingTag(pg.titulo)}</span><input type="text" id="pg-t" value="${esc(i18nVal(pg.titulo))}"></label>
    <label class="ed-field"><span>Icono</span><select id="pg-i">${Object.keys(ICONS).map((k) => `<option${k === pg.icono ? ' selected' : ''}>${k}</option>`).join('')}</select></label></div>
    <label class="ed-field"><span>Entradilla (explicación breve, en lenguaje claro) ${missingTag(pg.intro)}</span><input type="text" id="pg-d" value="${esc(i18nVal(pg.intro))}"></label>
    <label class="ed-field"><span>Responsable de la información ${missingTag(pg.responsable)}</span><input type="text" id="pg-r" value="${esc(i18nVal(pg.responsable))}" placeholder="p. ej. Secretaría General"></label>
    <p class="ed-hint">La fecha de actualización se pone sola al publicar cambios${pg.actualizado ? ` (ahora: ${esc(pg.actualizado)})` : ''}; la fuente se toma de los conjuntos de datos que usan los bloques. Dirección pública: <a href="../#/${pg.id}" target="_blank" rel="noopener">#/${pg.id}</a> · <button type="button" class="link-btn" id="pg-prev">Vista previa (escritorio, tableta y móvil)</button> · Arrastra componentes desde el panel derecho o pulsa <strong>+</strong> entre bloques.</p></section>`);
  head.querySelector('#pg-t').addEventListener('input', (e) => change(PATH(), (p) => setI18n(p, 'titulo', e.target.value)));
  head.querySelector('#pg-d').addEventListener('input', (e) => change(PATH(), (p) => setI18n(p, 'intro', e.target.value)));
  head.querySelector('#pg-r').addEventListener('input', (e) => change(PATH(), (p) => setI18n(p, 'responsable', e.target.value)));
  head.querySelector('#pg-i').addEventListener('change', (e) => change(PATH(), (p) => (p.icono = e.target.value)));
  head.querySelector('#pg-prev').addEventListener('click', () => G.preview(CTX, pg.id));
  main.appendChild(head);
  const canvas = h('<div class="ed-canvas portal-preview"></div>');
  main.appendChild(canvas);
  const blocks = pg.bloques || (pg.bloques = []);
  const drop = (i) => {
    const d = h(`<div class="ed-drop" data-at="${i}"><button type="button" class="ed-insert" title="Insertar componente aquí" aria-label="Insertar componente en la posición ${i + 1}">${icon('plus', 14)}</button></div>`);
    d.addEventListener('dragover', (e) => { e.preventDefault(); d.classList.add('active'); });
    d.addEventListener('dragleave', () => d.classList.remove('active'));
    d.addEventListener('drop', (e) => {
      e.preventDefault(); d.classList.remove('active');
      const comp = e.dataTransfer.getData('text/x-comp'), from = e.dataTransfer.getData('text/x-block');
      if (comp) insertBlock(comp, i);
      else if (from !== '') moveBlock(Number(from), i);
    });
    d.querySelector('button').addEventListener('click', () => { S.insertAt = i; showPalette(); });
    return d;
  };
  if (!blocks.length) canvas.appendChild(h('<div class="ed-empty">Esta página está vacía. Arrastra aquí un componente del panel derecho.</div>'));
  canvas.appendChild(drop(0));
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const def = BLOCKS[b.tipo];
    const box = h(`<div class="ed-block${S.sel === i ? ' selected' : ''}" draggable="true" tabindex="0" data-i="${i}" aria-label="Bloque ${i + 1}: ${esc(pick(def?.nombre) || b.tipo)}">
      <div class="ed-block-bar"><span class="ed-grip" title="Arrastrar para mover">${icon('grip', 14)}</span><span class="ed-bname">${icon(def?.icono || 'layout', 13)} ${esc(pick(def?.nombre) || b.tipo)}</span>
      <span class="ed-bactions"><button type="button" class="ed-mini" data-a="up" title="Subir">${icon('up', 14)}</button><button type="button" class="ed-mini" data-a="down" title="Bajar">${icon('down', 14)}</button>
      <button type="button" class="ed-mini" data-a="dup" title="Duplicar">${icon('copy', 14)}</button><button type="button" class="ed-mini" data-a="del" title="Eliminar">${icon('trash', 14)}</button></span></div>
      <div class="ed-block-preview"></div></div>`);
    box.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/x-block', String(i)); box.classList.add('dragging'); });
    box.addEventListener('dragend', () => box.classList.remove('dragging'));
    box.addEventListener('click', (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'up') return moveBlock(i, i - 1);
      if (a === 'down') return moveBlock(i, i + 2);
      if (a === 'dup') { change(PATH(), (p) => p.bloques.splice(i + 1, 0, clone(p.bloques[i]))); S.sel = i + 1; renderPage(); return selectBlock(i + 1); }
      if (a === 'del') { if (!confirm('¿Eliminar este bloque?')) return; change(PATH(), (p) => p.bloques.splice(i, 1)); S.sel = null; renderPage(); return showPalette(); }
      selectBlock(i);
    });
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target === box) selectBlock(i); });
    canvas.appendChild(box);
    canvas.appendChild(drop(i + 1));
    previewBlock(box.querySelector('.ed-block-preview'), b);
  }
}
async function previewBlock(el, b) {
  el.innerHTML = '';
  const inner = document.createElement('div');
  el.appendChild(inner);
  await renderBlock(inner, b, { pageId: S.view.id, query: new URLSearchParams(), flush: flushCharts });
  flushCharts();
}
function insertBlock(tipo, at) {
  const def = BLOCKS[tipo];
  const nb = { tipo, ...def.nuevo() };
  at = at ?? W(PATH()).bloques.length;
  change(PATH(), (p) => p.bloques.splice(at, 0, nb));
  S.insertAt = null;
  renderPage(); selectBlock(at);
  toast(`Añadido: ${pick(def.nombre)}`);
}
function moveBlock(from, to) {
  const arr = W(PATH()).bloques;
  if (to < 0 || to > arr.length || to === from || to === from + 1) return;
  change(PATH(), (p) => { const [b] = p.bloques.splice(from, 1); p.bloques.splice(to > from ? to - 1 : to, 0, b); });
  S.sel = to > from ? to - 1 : to;
  renderPage(); selectBlock(S.sel);
}
function selectBlock(i) {
  S.sel = i;
  document.querySelectorAll('.ed-block').forEach((x) => x.classList.toggle('selected', Number(x.dataset.i) === i));
  const b = W(PATH()).bloques[i];
  const def = BLOCKS[b.tipo];
  const panel = $('#ed-props');
  panel.classList.add('open');
  panel.innerHTML = `<h2>${icon(def.icono, 18)} ${esc(pick(def.nombre))}</h2><div class="ed-form"></div>
    <button type="button" class="ed-add" id="ed-back">${icon('plus', 14)} Añadir otro componente</button>`;
  $('#ed-back').addEventListener('click', () => { S.sel = null; document.querySelectorAll('.ed-block').forEach((x) => x.classList.remove('selected')); showPalette(); });
  if (!def.props.length) panel.querySelector('.ed-form').innerHTML = '<p class="ed-hint">Este componente no necesita configuración: muestra automáticamente los datos de su conjunto.</p>';
  let deb;
  const onChange = (key, rebuild) => {
    change(PATH(), () => {}, { silent: true }); refreshCounters();
    clearTimeout(deb);
    deb = setTimeout(() => { const box = document.querySelector(`.ed-block[data-i="${i}"] .ed-block-preview`); if (box) previewBlock(box, b); }, 250);
    if (rebuild) buildForm(panel.querySelector('.ed-form'), def.props, b, onChange);
  };
  buildForm(panel.querySelector('.ed-form'), def.props, b, onChange);
}
function showPalette() {
  const panel = $('#ed-props');
  const groups = { contenido: 'Contenido', datos: 'Datos y gráficos', avanzado: 'Componentes avanzados' };
  panel.innerHTML = `<h2>${icon('layout', 18)} Componentes</h2><p class="ed-hint">${S.insertAt !== null ? `Elige un componente para insertarlo en la posición ${S.insertAt + 1}.` : 'Arrastra un componente al lienzo o púlsalo para añadirlo al final.'}</p>
    ${Object.entries(groups).map(([g, n]) => `<p class="ed-palette-group">${n}</p><ul class="ed-palette">${Object.entries(BLOCKS).filter(([, d]) => d.grupo === g).map(([k, d]) => `<li><button type="button" class="ed-comp" draggable="true" data-comp="${k}">${icon(d.icono, 22)}${esc(pick(d.nombre))}</button></li>`).join('')}</ul>`).join('')}`;
  panel.querySelectorAll('[data-comp]').forEach((b) => {
    b.addEventListener('dragstart', (e) => e.dataTransfer.setData('text/x-comp', b.dataset.comp));
    b.addEventListener('click', () => { if (S.view?.kind === 'page') insertBlock(b.dataset.comp, S.insertAt); });
  });
}
async function newPage(ci) {
  const title = prompt('Título de la nueva página');
  if (!title) return;
  const portal = W('content/portal.json');
  let id = slug(title), n = 2;
  const exists = async (x) => S.work.has(`content/paginas/${x}.json`) || (await fetch(store.url(`content/paginas/${x}.json`), { method: 'HEAD' })).ok;
  while (await exists(id)) id = `${slug(title)}-${n++}`;
  const path = `content/paginas/${id}.json`;
  S.work.set(path, { id, icono: 'file', titulo: { es: title, va: title, en: title }, intro: { es: '', va: '', en: '' }, bloques: [{ tipo: 'texto', ...BLOCKS.texto.nuevo() }, { tipo: 'indicadores' }] });
  S.orig.set(path, 'null');
  markDirty(path);
  change('content/portal.json', (p) => p.categorias[ci].paginas.push(id));
  openPage(id);
  toast('Página creada. Recuerda traducir el título.');
}
function openCategory(ci) {
  const portal = W('content/portal.json');
  const c = portal.categorias[ci];
  const outer = $('#ed-props');
  outer.classList.add('open');
  outer.innerHTML = '';
  const panel = h('<div></div>');
  outer.appendChild(panel);
  panel.innerHTML = `<h2>${icon('layout', 18)} Categoría</h2><div class="ed-form"></div>
    <div class="ed-bactions" style="display:flex;gap:6px;flex-wrap:wrap">
      <button type="button" class="btn-ghost" data-a="up">${icon('up', 14)} Subir</button><button type="button" class="btn-ghost" data-a="down">${icon('down', 14)} Bajar</button>
      <button type="button" class="btn-ghost" data-a="del">${icon('trash', 14)} Eliminar</button></div>
    <p class="ed-hint">Las categorías son las «cajitas» de la portada y el menú lateral. Para cambiar el orden de sus páginas, usa las flechas.</p><ul class="ed-files">${c.paginas.map((p, i) => `<li><code>${p}</code><button class="ed-mini" data-pu="${i}" title="Subir">${icon('up', 14)}</button><button class="ed-mini" data-pr="${i}" title="Quitar de la categoría">${icon('trash', 14)}</button></li>`).join('')}</ul>`;
  buildForm(panel.querySelector('.ed-form'), [
    { clave: 'titulo', tipo: 'texto', etiqueta: { es: 'Título' } }, { clave: 'descripcion', tipo: 'texto', etiqueta: { es: 'Descripción breve (qué encontrará el ciudadano)' } }, { clave: 'icono', tipo: 'icono', etiqueta: { es: 'Icono' } },
    { clave: 'cifras', tipo: 'lista', etiqueta: { es: 'Cifras clave de la categoría' }, campos: [{ clave: 'etiqueta', tipo: 'texto', etiqueta: { es: 'Etiqueta' } }, { clave: 'conjunto', tipo: 'conjunto', etiqueta: { es: 'Conjunto de datos' } },
      { clave: 'operacion', tipo: 'select', etiqueta: { es: 'Cálculo' }, opciones: [['contar', { es: 'Contar registros' }], ['sumar', { es: 'Sumar' }], ['media', { es: 'Media' }], ['max', { es: 'Máximo' }], ['ultimo', { es: 'Último valor' }]] },
      { clave: 'campo', tipo: 'campo', etiqueta: { es: 'Campo' } }, { clave: 'filtro', tipo: 'filtro', etiqueta: { es: 'Filtro' } },
      { clave: 'formato', tipo: 'select', etiqueta: { es: 'Formato' }, opciones: [['entero', { es: 'Número' }], ['euros', { es: 'Euros' }], ['euros_compacto', { es: 'Euros (abreviado)' }], ['porcentaje', { es: 'Porcentaje' }], ['dias', { es: 'Días' }], ['m2', { es: 'm²' }], ['decimal', { es: 'Decimal' }]] }] }],
  c, () => { change('content/portal.json', () => {}); renderSide(); });
  panel.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a, pu = e.target.closest('[data-pu]')?.dataset.pu, pr = e.target.closest('[data-pr]')?.dataset.pr;
    if (a === 'up' && ci > 0) { change('content/portal.json', (p) => p.categorias.splice(ci - 1, 0, p.categorias.splice(ci, 1)[0])); renderSide(); openCategory(ci - 1); }
    if (a === 'down' && ci < portal.categorias.length - 1) { change('content/portal.json', (p) => p.categorias.splice(ci + 1, 0, p.categorias.splice(ci, 1)[0])); renderSide(); openCategory(ci + 1); }
    if (a === 'del') { if (c.paginas.length) return toast('Solo se pueden eliminar categorías vacías.'); change('content/portal.json', (p) => p.categorias.splice(ci, 1)); renderSide(); showPalette(); }
    if (pu !== undefined && Number(pu) > 0) { change('content/portal.json', (p) => { const arr = p.categorias[ci].paginas; const i = Number(pu); [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; }); renderSide(); openCategory(ci); }
    if (pr !== undefined && confirm('¿Quitar esta página de la categoría? El fichero se conserva.')) { change('content/portal.json', (p) => p.categorias[ci].paginas.splice(Number(pr), 1)); renderSide(); openCategory(ci); }
  });
}
function newCategory() {
  const title = prompt('Nombre de la nueva categoría');
  if (!title) return;
  change('content/portal.json', (p) => p.categorias.push({ id: slug(title), icono: 'layout', titulo: { es: title, va: title, en: title }, descripcion: { es: '', va: '', en: '' }, paginas: [] }));
  renderSide(); openCategory(W('content/portal.json').categorias.length - 1);
}
function openHome() {
  S.view = { kind: 'home' };
  const portal = W('content/portal.json');
  $('#ed-main').innerHTML = `<section class="ed-card"><h2>Portada</h2><div class="ed-form"></div></section>`;
  buildForm($('#ed-main .ed-form'), [{ clave: 'titulo', tipo: 'texto', etiqueta: { es: 'Título' } }, { clave: 'intro', tipo: 'texto', etiqueta: { es: 'Frase de bienvenida (una línea)' } },
    { clave: 'preguntas', tipo: 'lista', etiqueta: { es: 'Lo más consultado (preguntas en lenguaje ciudadano)' }, campos: [{ clave: 'texto', tipo: 'texto', etiqueta: { es: 'Pregunta' } }, { clave: 'pagina', tipo: 'pagina', etiqueta: { es: 'Página que la responde' } }] },
    { clave: 'datos_destacados', tipo: 'lista', etiqueta: { es: 'Datos destacados (se calculan solos y muestran fuente y fecha)' }, campos: [...[{ clave: 'etiqueta', tipo: 'texto', etiqueta: { es: 'Etiqueta' } }, { clave: 'conjunto', tipo: 'conjunto', etiqueta: { es: 'Conjunto de datos' } },
      { clave: 'operacion', tipo: 'select', etiqueta: { es: 'Cálculo' }, opciones: [['contar', { es: 'Contar registros' }], ['sumar', { es: 'Sumar' }], ['media', { es: 'Media' }], ['max', { es: 'Máximo' }], ['ultimo', { es: 'Último valor' }]] },
      { clave: 'campo', tipo: 'campo', etiqueta: { es: 'Campo' } }, { clave: 'filtro', tipo: 'filtro', etiqueta: { es: 'Filtro' } },
      { clave: 'formato', tipo: 'select', etiqueta: { es: 'Formato' }, opciones: [['entero', { es: 'Número' }], ['euros', { es: 'Euros' }], ['euros_compacto', { es: 'Euros (abreviado)' }], ['porcentaje', { es: 'Porcentaje' }], ['dias', { es: 'Días' }], ['m2', { es: 'm²' }], ['decimal', { es: 'Decimal' }]] }], { clave: 'pagina', tipo: 'pagina', etiqueta: { es: 'Página de detalle' } }] }],
    portal.portada, () => change('content/portal.json', () => {}));
  const menuBox = h('<section class="ed-card"><h2>Menú principal y accesos rápidos</h2><div class="ed-form"></div></section>');
  $('#ed-main').appendChild(menuBox);
  buildForm(menuBox.querySelector('.ed-form'), [{ clave: 'menu', tipo: 'lista', etiqueta: { es: 'Enlaces (texto corto)' }, campos: [{ clave: 'texto', tipo: 'texto', etiqueta: { es: 'Texto' } }, { clave: 'pagina', tipo: 'pagina', etiqueta: { es: 'Página' } }] }], portal, () => change('content/portal.json', () => {}));
  const all = portal.categorias.flatMap((c) => c.paginas);
  const box = h(`<section class="ed-card"><h2>Accesos destacados (compatibilidad)</h2><div class="ed-checks">${all.map((p) => `<label><input type="checkbox" value="${p}"${portal.portada.destacados.includes(p) ? ' checked' : ''}> ${p}</label>`).join('')}</div></section>`);
  box.addEventListener('change', (e) => change('content/portal.json', (p) => { p.portada.destacados = e.target.checked ? [...p.portada.destacados, e.target.value] : p.portada.destacados.filter((x) => x !== e.target.value); }));
  $('#ed-main').appendChild(box);
  showPalette();
}

// ------------------------------------------------------------------ datos
const PAGE_SIZE = 100;
async function openData(id) {
  if (S.view?.kind !== 'data' || S.view.id !== id) { S.pick = new Set(); S.ds = { q: '', sort: null, desc: false, fv: '', page: 0 }; }
  S.view = { kind: 'data', id }; S.rec = null;
  const path = `data/${id}.json`;
  const env = await load(path);
  const ds = (await store.meta()).conjuntos.find((d) => d.id === id);
  renderSide();
  const auto = ['placsp', 'bdns'].includes(ds.fuente.tipo);
  const locked = (r) => auto && r.fuente !== 'manual';
  const cols = ds.campos.filter((c) => !(simple() && c.nombre === 'id')).slice(0, 7);
  const facet = ds.campos.find((c) => c.lista && c.nombre !== 'fuente');
  const cl = await store.getJSON('data/codelists.json');
  const facetVals = facet ? [...new Set(env.datos.map((r) => r[facet.nombre]).filter((v) => v !== null && v !== undefined && v !== ''))].sort() : [];
  const st = S.ds;
  const main = $('#ed-main');
  main.innerHTML = `<div class="ed-data-head"><h1>${esc(pick(ds.titulo))}</h1>
      <div class="ed-data-tools">
        <input type="search" id="dq" placeholder="Buscar…" aria-label="Buscar en los registros" value="${esc(st.q)}">
        ${facet ? `<select id="dfv" aria-label="${esc(facet.descripcion)}"><option value="">${esc(facet.descripcion)}: todos</option>${facetVals.map((v) => `<option value="${esc(v)}"${String(v) === st.fv ? ' selected' : ''}>${esc(store.valueLabel(facet, v))}</option>`).join('')}</select>` : ''}
        ${auto ? '' : `<button type="button" class="btn-ghost" id="d-imp">${icon('download', 16)} Importar CSV</button>`}
        <button type="button" class="btn-ghost" id="d-exp">Exportar CSV</button>
        <button type="button" class="btn" id="d-add">${icon('plus', 16)} Nuevo registro</button></div></div>
    ${auto ? `<div class="callout callout-info">${icon('sync', 20)}<div><p><strong>Se actualiza solo desde ${esc(ds.fuente.nombre)}.</strong> Aquí puedes consultar y comprobar los registros importados (no se editan: se corrigen en la fuente oficial). Los que añadas a mano se marcan como «carga manual» y la sincronización los conserva.</p></div></div>` : ''}
    ${env.ejemplo ? `<div class="callout callout-advertencia">${icon('warn', 20)}<div><p>Este conjunto contiene <strong>datos de ejemplo</strong>. Sustitúyelos por los reales (por ejemplo, con «Importar CSV» → «Sustituir todos los registros»).</p></div></div>` : ''}
    <div class="ed-data-info"><p class="ed-hint" id="d-count"></p><div class="ed-bulk" id="d-bulk" hidden><span></span><button type="button" class="btn-ghost" id="d-bulk-del">${icon('trash', 14)} Eliminar seleccionados</button><button type="button" class="btn-ghost" id="d-bulk-none">Quitar selección</button></div></div>
    <div class="ed-grid-wrap"><table class="ed-grid"><thead><tr><th class="ed-ck"><input type="checkbox" id="d-all" aria-label="Seleccionar los registros visibles"></th>${cols.map((c) => `<th aria-sort="${st.sort === c.nombre ? (st.desc ? 'descending' : 'ascending') : 'none'}"><button type="button" class="ed-sort" data-sort="${c.nombre}">${esc(c.descripcion)}${st.sort === c.nombre ? (st.desc ? ' ▼' : ' ▲') : ''}</button></th>`).join('')}</tr></thead><tbody></tbody></table></div>
    <div class="ed-pager" id="d-pager"></div>`;
  const tbody = main.querySelector('tbody');
  const f = (c, v) => (c.lista ? store.valueLabel(c, v) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v ?? '—');
  let visible = [];
  const draw = () => {
    const q = st.q.toLowerCase();
    let list = W(path).datos.map((r, i) => [r, i]).filter(([r]) => (!q || JSON.stringify(r).toLowerCase().includes(q)) && (!st.fv || String(r[facet.nombre]) === st.fv));
    if (st.sort) list.sort(([a], [b]) => { const x = a[st.sort], y = b[st.sort]; const r = x === y ? 0 : x === null || x === undefined ? 1 : y === null || y === undefined ? -1 : typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'es'); return st.desc ? -r : r; });
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE)); st.page = Math.min(st.page, pages - 1);
    visible = list.slice(st.page * PAGE_SIZE, (st.page + 1) * PAGE_SIZE);
    tbody.innerHTML = visible.map(([r, i]) => `<tr data-r="${i}" class="${S.rec === i ? 'sel' : ''}${locked(r) ? ' locked' : ''}" tabindex="0"><td class="ed-ck">${locked(r) ? `<span title="Procede de ${esc(ds.fuente.nombre)}">${icon('sync', 12)}</span>` : `<input type="checkbox" data-pick="${i}" aria-label="Seleccionar"${S.pick.has(i) ? ' checked' : ''}>`}</td>${cols.map((c) => `<td>${esc(f(c, r[c.nombre]))}</td>`).join('')}</tr>`).join('');
    main.querySelector('#d-count').textContent = `${fmt.int(W(path).datos.length)} registros${list.length !== W(path).datos.length ? ` · ${fmt.int(list.length)} con los filtros` : ''}${auto ? ` · ${fmt.int(W(path).datos.filter((r) => !locked(r)).length)} de carga manual` : ''}`;
    main.querySelector('#d-pager').innerHTML = pages > 1 ? `<button type="button" class="btn-ghost" data-pg="-1"${st.page === 0 ? ' disabled' : ''}>Anterior</button><span class="ed-hint">Página ${st.page + 1} de ${pages}</span><button type="button" class="btn-ghost" data-pg="1"${st.page >= pages - 1 ? ' disabled' : ''}>Siguiente</button>` : '';
    const bulk = main.querySelector('#d-bulk'); bulk.hidden = !S.pick.size; bulk.querySelector('span').textContent = `${S.pick.size} seleccionado${S.pick.size === 1 ? '' : 's'}`;
  };
  draw();
  let deb; main.querySelector('#dq').addEventListener('input', (e) => { clearTimeout(deb); deb = setTimeout(() => { st.q = e.target.value; st.page = 0; draw(); }, 150); });
  main.querySelector('#dfv')?.addEventListener('change', (e) => { st.fv = e.target.value; st.page = 0; draw(); });
  main.querySelector('thead').addEventListener('click', (e) => { const b = e.target.closest('[data-sort]'); if (!b) return; if (st.sort === b.dataset.sort) st.desc = !st.desc; else { st.sort = b.dataset.sort; st.desc = false; } openData(id); });
  main.querySelector('#d-all').addEventListener('change', (e) => { visible.forEach(([r, i]) => { if (!locked(r)) (e.target.checked ? S.pick.add(i) : S.pick.delete(i)); }); draw(); });
  main.querySelector('#d-pager').addEventListener('click', (e) => { const b = e.target.closest('[data-pg]'); if (b) { st.page += Number(b.dataset.pg); draw(); } });
  main.querySelector('#d-bulk-none').addEventListener('click', () => { S.pick.clear(); draw(); });
  main.querySelector('#d-bulk-del').addEventListener('click', () => {
    if (!confirm(`¿Eliminar ${S.pick.size} registro(s)?`)) return;
    const del = new Set(S.pick); change(path, (e) => { e.datos = e.datos.filter((_, i) => !del.has(i)); }); S.pick.clear(); S.rec = null; openData(id); toast(`${del.size} registro(s) eliminados`);
  });
  const open = (tr) => { S.rec = Number(tr.dataset.r); draw(); openRecord(ds, path, draw, locked(W(path).datos[S.rec])); };
  tbody.addEventListener('change', (e) => { const c = e.target.closest('[data-pick]'); if (c) { const i = Number(c.dataset.pick); c.checked ? S.pick.add(i) : S.pick.delete(i); draw(); } });
  tbody.addEventListener('click', (e) => { if (e.target.closest('.ed-ck')) return; const tr = e.target.closest('tr[data-r]'); if (tr) open(tr); });
  tbody.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-r]'); if (tr && e.key === 'Enter') open(tr); });
  main.querySelector('#d-imp')?.addEventListener('click', () => G.importCSV(CTX, ds, path));
  main.querySelector('#d-exp').addEventListener('click', () => G.exportCSV(ds, W(path).datos));
  main.querySelector('#d-add').addEventListener('click', () => {
    const blank = Object.fromEntries(ds.campos.map((c) => [c.nombre, c.tipo === 'boolean' ? false : c.nombre === 'fuente' ? 'manual' : c.nombre === 'id' ? `${id.slice(0, 3).toUpperCase()}-${Date.now().toString(36)}` : null]));
    change(path, (e) => e.datos.unshift(blank));
    S.pick = new Set([...S.pick].map((i) => i + 1));
    S.rec = 0; st.page = 0; draw(); openRecord(ds, path, draw);
  });
  $('#ed-props').innerHTML = `<h2>${icon('table', 18)} Registro</h2><p class="ed-hint">Selecciona un registro de la tabla o crea uno nuevo.${auto ? '' : ' Para cargas masivas, usa «Importar CSV»: verás una vista previa con la validación de cada fila antes de importar.'}</p>`;
  void cl;
}
async function openRecord(ds, path, redraw, readOnly = false) {
  const r = W(path).datos[S.rec];
  const panel = $('#ed-props');
  panel.classList.add('open');
  const codelists = await store.getJSON('data/codelists.json');
  if (readOnly) {
    panel.innerHTML = `<h2>${icon('sync', 18)} Registro importado</h2><div class="callout callout-info"><div><p>Procede de <strong>${esc(ds.fuente.nombre)}</strong>. Si hay un error, corrígelo en la fuente oficial: la próxima sincronización lo actualizará.</p></div></div>
      <dl class="ed-ro">${ds.campos.map((c) => `<dt>${esc(c.descripcion)}${simple() ? '' : ` <code>${c.nombre}</code>`}</dt><dd>${c.formato === 'uri' && r[c.nombre] ? `<a href="${esc(r[c.nombre])}" target="_blank" rel="noopener">${esc(r[c.nombre])}</a>` : esc(store.valueLabel(c, r[c.nombre]))}</dd>`).join('')}</dl>
      ${(() => { const e = G.validateRecord(ds, r, codelists); return e.length ? `<p class="ed-chk-error">⚠ ${esc(e.join(' · '))}</p>` : '<p class="ed-hint">✓ Conforme al esquema.</p>'; })()}`;
    return;
  }
  panel.innerHTML = `<h2>${icon('edit', 18)} Registro</h2><p class="ed-rec-check" aria-live="polite"></p><form class="ed-form" onsubmit="return false"></form>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn-ghost" id="r-dup">${icon('copy', 14)} Duplicar</button><button type="button" class="btn-ghost" id="r-del">${icon('trash', 14)} Eliminar</button></div>`;
  const form = panel.querySelector('form');
  const check = () => { const e = G.validateRecord(ds, W(path).datos[S.rec], codelists); panel.querySelector('.ed-rec-check').innerHTML = e.length ? `<span class="ed-chk-error">⚠ ${esc(e.join(' · '))}</span>` : ''; };
  for (const c of ds.campos) {
    const v = r[c.nombre];
    const wrap = h(`<label class="ed-field"><span>${esc(c.descripcion)}${simple() ? '' : ` <code>${c.nombre}</code>`}</span></label>`);
    let input;
    if (c.lista) {
      const lists = c.lista.split('|');
      input = h(`<select><option value="">—</option>${lists.flatMap((l) => Object.keys(codelists[l] || {}).map((k) => `<option value="${esc(k)}"${String(v) === k ? ' selected' : ''}>${esc(label(l, k))}</option>`)).join('')}</select>`);
    } else if (c.referencia) {
      // Campo que apunta a otro conjunto (p. ej. grupo municipal del cargo): desplegable con sus registros
      const refRows = (await load(`data/${c.referencia.conjunto}.json`).catch(() => ({ datos: [] }))).datos || [];
      input = h(`<select><option value="">—</option>${refRows.map((x) => `<option value="${esc(x.id)}"${String(v) === String(x.id) ? ' selected' : ''}>${esc(x[c.referencia.campo] ?? x.id)}</option>`).join('')}${v && !refRows.some((x) => String(x.id) === String(v)) ? `<option value="${esc(v)}" selected>${esc(v)} (no existe)</option>` : ''}</select>`);
      wrap.append(h(`<small class="ed-hint">Se gestiona en <button type="button" class="link-btn" data-goto-ds="${c.referencia.conjunto}">Datos → ${esc(c.referencia.conjunto)}</button></small>`));
    } else if (c.formato === 'color') {
      input = h(`<input type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(v || '') ? v : '#777777')}">`);
    } else if (c.tipo === 'boolean') input = h(`<select><option value="true"${v === true ? ' selected' : ''}>Sí</option><option value="false"${v !== true ? ' selected' : ''}>No</option></select>`);
    else if (c.tipo === 'date') input = h(`<input type="date" value="${esc(v || '')}">`);
    else if (c.tipo === 'yearmonth') input = h(`<input type="month" value="${esc(v || '')}">`);
    else if (c.tipo === 'number' || c.tipo === 'integer') input = h(`<input type="number" step="${c.tipo === 'integer' ? 1 : 'any'}" value="${v ?? ''}">`);
    else if (c.formato === 'uri' || c.nombre === 'foto') input = h(`<input type="text" inputmode="url" value="${esc(v || '')}" placeholder="https://… o sube un archivo">`);
    else input = h(`<input type="text" value="${esc(v ?? '')}">`);
    if (c.nombre === 'id' && simple()) { input.readOnly = true; wrap.append(h('<small class="ed-hint">Identificador interno (se asigna solo).</small>')); }
    input.addEventListener('input', () => {
      let nv = input.value;
      if (c.tipo === 'boolean') nv = nv === 'true';
      else if (c.tipo === 'number') nv = nv === '' ? null : Number(nv);
      else if (c.tipo === 'integer') nv = nv === '' ? null : parseInt(nv, 10);
      else if (nv === '') nv = null;
      change(path, (e) => { e.datos[S.rec][c.nombre] = nv; if ('fuente' in e.datos[S.rec] && ['ejemplo'].includes(e.datos[S.rec].fuente)) e.datos[S.rec].fuente = 'manual'; });
      redraw(); check();
    });
    wrap.append(input);
    if (c.formato === 'uri' || c.nombre === 'foto') A.attachUploader(S, input, { kind: ds.id === 'cargos' ? 'cargos' : ds.id, image: ['foto', 'logo'].includes(c.nombre), toast });
    wrap.querySelector('[data-goto-ds]')?.addEventListener('click', (e) => { e.preventDefault(); go({ tipo: 'datos', id: e.currentTarget.dataset.gotoDs }); });
    form.appendChild(wrap);
  }
  check();
  $('#r-dup').addEventListener('click', () => { change(path, (e) => e.datos.splice(S.rec + 1, 0, { ...clone(e.datos[S.rec]), ...(e.datos[S.rec].id ? { id: `${e.datos[S.rec].id}-copia` } : {}) })); S.rec++; redraw(); openRecord(ds, path, redraw); });
  $('#r-del').addEventListener('click', () => { if (!confirm('¿Eliminar este registro?')) return; change(path, (e) => e.datos.splice(S.rec, 1)); S.rec = null; S.pick.clear(); redraw(); panel.innerHTML = '<p class="ed-hint">Registro eliminado.</p>'; });
}

// ------------------------------------------------------------------ entidad
const ENTITY_FORM = [
  { clave: 'nombre', tipo: 'texto', etiqueta: { es: 'Nombre de la entidad' } }, { clave: 'nif', tipo: 'texto_simple', etiqueta: { es: 'NIF' } }, { clave: 'dir3', tipo: 'texto_simple', etiqueta: { es: 'Código DIR3' } },
  { clave: 'codigo_ine', tipo: 'texto_simple', etiqueta: { es: 'Código INE' } }, { clave: 'direccion', tipo: 'texto_simple', etiqueta: { es: 'Dirección' } }, { clave: 'telefono', tipo: 'texto_simple', etiqueta: { es: 'Teléfono' } },
  { clave: 'email_transparencia', tipo: 'texto_simple', etiqueta: { es: 'Correo de transparencia' } }, { clave: 'web', tipo: 'url', etiqueta: { es: 'Web institucional' } }, { clave: 'sede_electronica', tipo: 'url', etiqueta: { es: 'Sede electrónica' } },
  { clave: 'escudo', tipo: 'texto_simple', etiqueta: { es: 'Escudo o logotipo (ruta o URL)' } }, { clave: 'datos_de_ejemplo', tipo: 'bool', etiqueta: { es: 'Mostrar aviso de datos de ejemplo' } },
];
async function openEntity() {
  S.view = { kind: 'entity' };
  const cfg = await load('config/entidad.json');
  const main = $('#ed-main');
  main.innerHTML = `<section class="ed-card"><h2>Datos de la entidad</h2><div id="ent-a"></div></section>
    <section class="ed-card"><h2>Colores corporativos</h2><div id="ent-c"></div></section>
    <section class="ed-card"><h2>Plataforma de Contratación del Sector Público</h2><p class="ed-hint">Identificadores del órgano de contratación tal como aparecen en PLACSP (NIF o DIR3, separados por comas) y nombres alternativos.</p><div id="ent-p"></div></section>
    <section class="ed-card"><h2>Acceso y publicación</h2><p class="ed-hint">Solo pueden entrar en este panel las cuentas de GitHub con permiso de escritura en el repositorio (y, si se rellena la lista, solo esas personas). Con «Enviar a revisión», cada publicación crea una propuesta en GitHub que una persona responsable aprueba. Combínalo con la protección de la rama publicada para separar quien edita de quien publica.</p><div id="ent-g"></div></section>
    <section class="ed-card"><h2>Base de Datos Nacional de Subvenciones</h2><p class="ed-hint">Identificadores del órgano concedente en la BDNS (separados por comas) o, si se desconocen, el nombre exacto del órgano.</p><div id="ent-b"></div></section>`;
  const save = () => { change('config/entidad.json', () => {}); applyColors(); };
  buildForm($('#ent-a'), ENTITY_FORM, cfg, save);
  const contrastBox = () => { const el = $('#ent-cr'); if (el) el.innerHTML = G.colorBox(cfg); };
  buildForm($('#ent-c'), [{ clave: 'principal', tipo: 'color', etiqueta: { es: 'Color principal' }, ayuda: { es: 'Se usa en botones, enlaces y titulares: necesita un contraste mínimo de 4,5:1 sobre blanco.' } }, { clave: 'secundario', tipo: 'color', etiqueta: { es: 'Color secundario' }, ayuda: { es: 'Acento decorativo (líneas, detalles).' } }], cfg.colores, () => { save(); contrastBox(); }).then(() => { $('#ent-c').insertAdjacentHTML('beforeend', '<div id="ent-cr"></div>'); contrastBox(); });
  const csv = (obj, key) => ({ get: () => (obj[key] || []).join(', '), set: (v) => (obj[key] = v.split(',').map((x) => x.trim()).filter(Boolean)) });
  const listField = (host, label_, acc) => { const w = h(`<label class="ed-field"><span>${label_}</span><input type="text" value="${esc(acc.get())}"></label>`); w.querySelector('input').addEventListener('input', (e) => { acc.set(e.target.value); save(); }); host.appendChild(w); };
  cfg.github = cfg.github || {};
  buildForm($('#ent-g'), [{ clave: 'publicacion', tipo: 'select', etiqueta: { es: 'Modo de publicación por defecto' }, opciones: [['revision', { es: 'Enviar a revisión (recomendado)' }], ['directo', { es: 'Publicar directamente' }]] }, { clave: 'repositorio', tipo: 'texto_simple', etiqueta: { es: 'Repositorio (organización/nombre)' } }, { clave: 'rama', tipo: 'texto_simple', etiqueta: { es: 'Rama publicada' } }], cfg.github, save).then(() => listField($('#ent-g'), 'Personas autorizadas a entrar en el panel (usuarios de GitHub separados por comas; vacío = cualquier colaborador con permiso de escritura)', csv(cfg.github, 'usuarios_autorizados')));
  const P = cfg.fuentes.placsp, B = cfg.fuentes.bdns;
  buildForm($('#ent-p'), [{ clave: 'activo', tipo: 'bool', etiqueta: { es: 'Sincronización activa' } }, { clave: 'desde', tipo: 'fecha', etiqueta: { es: 'Importar desde' } }], P, save).then(() => {
    listField($('#ent-p'), 'Identificadores del órgano (NIF, DIR3)', csv(P, 'identificadores_organo'));
    listField($('#ent-p'), 'Nombres del órgano', csv(P, 'nombres_organo'));
  });
  buildForm($('#ent-b'), [{ clave: 'activo', tipo: 'bool', etiqueta: { es: 'Sincronización activa' } }, { clave: 'nombre_organo', tipo: 'texto_simple', etiqueta: { es: 'Nombre del órgano concedente' } }, { clave: 'desde', tipo: 'fecha', etiqueta: { es: 'Importar desde' } }], B, save).then(() => {
    listField($('#ent-b'), 'Identificadores del órgano en la BDNS', csv(B, 'organos'));
  });
  $('#ed-props').innerHTML = `<h2>${icon('info', 18)} Ayuda</h2><p class="ed-hint">Estos datos aparecen en la cabecera, el pie y los metadatos del catálogo DCAT-AP. Los colores se aplican a todo el portal.</p>`;
}
function applyColors() {
  const c = W('config/entidad.json')?.colores; if (!c) return;
  document.documentElement.style.setProperty('--brand', c.principal);
  document.documentElement.style.setProperty('--accent', c.secundario);
}

// ------------------------------------------------------------------ fuentes / sincronización
async function openSync() {
  S.view = { kind: 'sync' };
  const st = await store.syncStatus();
  const cfg = await load('config/entidad.json');
  const row = (k, n) => { const s = st?.fuentes?.[k] || {}; return `<section class="ed-card"><h2>${icon('sync', 18)} ${n}</h2>
    <p><span class="badge ${s.estado === 'ok' ? 'badge-good' : s.estado === 'error' ? 'badge-critical' : 'badge-warning'}">${esc(s.estado || 'pendiente')}</span> ${s.fecha ? `Última ejecución: ${esc(s.fecha)}` : 'Sin ejecuciones todavía'}</p>
    ${s.registros !== undefined ? `<p>Registros importados: <strong>${s.registros}</strong>${s.nuevos !== undefined ? ` · nuevos: ${s.nuevos}` : ''}${s.paginas ? ` · páginas leídas: ${s.paginas}` : ''}</p>` : ''}
    ${s.mensaje ? `<p class="ed-hint">${esc(s.mensaje)}</p>` : ''}</section>`; };
  $('#ed-main').innerHTML = `${row('placsp', 'Plataforma de Contratación del Sector Público → contratos y encargos')}${row('bdns', 'Base de Datos Nacional de Subvenciones → subvenciones')}
    <section class="ed-card"><h2>Cómo funciona</h2><ol class="ed-hint" style="font-size:.9rem">
      <li>Cada día, una tarea automática de GitHub Actions (<code>.github/workflows/sync.yml</code>) descarga los feeds de PLACSP y la API de la BDNS.</li>
      <li>Filtra las entradas del órgano configurado en la pestaña «Entidad» y las convierte al modelo de datos del portal.</li>
      <li>Conserva los registros cargados a mano, valida todo y, si hay cambios, los publica.</li></ol>
      <button type="button" class="btn" id="run-sync">${icon('sync', 16)} Ejecutar sincronización ahora</button> <span class="ed-hint">Requiere conectar GitHub (botón «Publicar»).</span></section>`;
  $('#run-sync').addEventListener('click', async () => {
    const gh = ghSettings(); if (!gh.token) return openPublish();
    try { await ghApi(gh, `/repos/${gh.repo}/actions/workflows/sync.yml/dispatches`, { method: 'POST', body: JSON.stringify({ ref: gh.branch }) }); toast('Sincronización lanzada. Tardará unos minutos.'); }
    catch (e) { toast(`No se pudo lanzar: ${e.message}`, 5000); }
  });
  void cfg;
  $('#ed-props').innerHTML = `<h2>${icon('info', 18)} Fuentes oficiales</h2><p class="ed-hint">Contratos y encargos: Plataforma de Contratación del Sector Público (formato CODICE/Atom). Subvenciones: BDNS (API pública). No es necesario cargar a mano estos datos.</p>`;
}

// ------------------------------------------------------------------ publicación
function ghSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('ed-gh') || sessionStorage.getItem('ed-gh') || '{}'); } catch { /* */ }
  const cfg = W('config/entidad.json');
  let remembered = false; try { remembered = !!localStorage.getItem('ed-gh'); } catch { /* */ }
  return { repo: saved.repo || cfg?.github?.repositorio || '', branch: saved.branch || cfg?.github?.rama || 'main', token: saved.token || '', modo: saved.modo, remembered };
}
async function ghApi(gh, path, opts = {}) {
  const r = await fetch(`https://api.github.com${path}`, { ...opts, headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).message || r.statusText}`);
  return r.status === 204 ? null : r.json();
}
const serialize = (p) => JSON.stringify(W(p), null, INDENT(p)) + '\n';
/**
 * Revisar y publicar: 1) cambios preparados (resumen y antes/después), 2) comprobaciones,
 * 3) vista previa, 4) publicar directamente o enviar a revisión (rama + solicitud de cambios).
 */
async function openPublish() {
  const gh = ghSettings();
  const files = [...S.dirty];
  const ups = [...S.uploads.entries()];
  const total = files.length + ups.length;
  const cfg = W('config/entidad.json');
  const modo = gh.modo || cfg?.github?.publicacion || 'directo';
  const dlg = modal('Revisar y publicar', `
    <ol class="ed-steps-head" aria-label="Pasos"><li>Cambios</li><li>Comprobaciones</li><li>Vista previa</li><li>Publicar</li></ol>
    <section class="ed-pub-sec"><h3>1. Cambios preparados <span class="ed-hint">(${total})</span></h3>
      ${total ? '<ul class="ed-changes" id="pub-changes"><li class="ed-hint">Calculando…</li></ul>' : '<p>No hay cambios pendientes.</p>'}</section>
    ${total ? `<section class="ed-pub-sec"><h3>2. Comprobaciones</h3><div id="pub-checks"><p class="ed-hint">Comprobando datos, enlaces, traducciones y accesibilidad…</p></div></section>
    <section class="ed-pub-sec"><h3>3. Vista previa</h3><p class="ed-hint">Revisa cómo quedará el portal con los cambios en escritorio, tableta y móvil.</p><button type="button" class="btn-ghost" id="pub-prev">${icon('eye', 16)} Abrir vista previa</button></section>` : ''}
    <section class="ed-pub-sec"><h3>${total ? '4. ' : ''}Publicar</h3>
      ${total ? `<fieldset class="ed-modes"><legend class="sr-only">Modo de publicación</legend>
        <label><input type="radio" name="pub-mode" value="revision"${modo === 'revision' ? ' checked' : ''}> <span><strong>Enviar a revisión</strong> (recomendado): crea una propuesta de cambios en GitHub; una persona responsable la revisa y la aprueba, y entonces se publica. El token necesita además el permiso <em>Pull requests: Read and write</em>.</span></label>
        <label><input type="radio" name="pub-mode" value="directo"${modo !== 'revision' ? ' checked' : ''}> <span><strong>Publicar directamente</strong>: los cambios se publican en 1–2 minutos.</span></label></fieldset>` : ''}
      <details class="ed-conn"${gh.token ? '' : ' open'}><summary>Conexión con GitHub ${gh.token ? `· <span class="ed-count-ok">sesión de ${esc(S.session?.user?.name || 'usuario')} (${esc(S.session?.rol || '')})</span>` : '· sin conectar (modo de prueba)'}</summary>
        <p class="muted small">Necesitas un <a href="https://github.com/settings/personal-access-tokens/new" rel="noopener" target="_blank">token de acceso de grano fino</a> limitado a este repositorio, con <em>Contents: Read and write</em> (y <em>Actions: Read and write</em> para lanzar la sincronización). Por seguridad, el token se guarda solo durante esta sesión salvo que marques «Recordar».</p>
        <div class="ed-field"><span>Repositorio</span><input type="text" id="gh-repo" value="${esc(gh.repo)}" placeholder="organizacion/repositorio"></div>
        <div class="ed-field"><span>Rama publicada</span><input type="text" id="gh-branch" value="${esc(gh.branch)}"></div>
        <div class="ed-field"><span>Token</span><input type="password" id="gh-token" value="${esc(gh.token)}" autocomplete="off"></div>
        <label class="ed-field" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gh-remember"${gh.remembered ? ' checked' : ''}> Recordar en este navegador (no recomendado en equipos compartidos)</label>
        ${gh.token ? '<button type="button" class="link-btn" id="gh-forget">Cerrar sesión y olvidar el token en este navegador</button>' : ''}
        <details class="ed-hint"><summary>Para un uso en producción</summary><p>El token personal es adecuado para entidades pequeñas. En producción se recomienda una GitHub App u OAuth con un pequeño servicio intermedio, de modo que nadie maneje tokens, y proteger la rama publicada para que solo se publique mediante revisión. Ver docs/GUIA-EDITOR.md.</p></details></details>
      ${total ? `<div class="ed-field"><span>Descripción del cambio</span><input type="text" id="gh-msg" value="Actualización de contenidos del portal de transparencia"></div>` : ''}
      <div class="modal-actions">${total ? '<button type="button" class="btn" id="gh-go" disabled>Comprobando…</button><button type="button" class="btn-ghost" id="dl-go">Descargar ficheros</button><button type="button" class="btn-ghost" id="discard">Descartar todo</button>' : '<button type="button" class="btn" id="gh-save">Guardar conexión</button>'}</div>
      <p id="gh-status" class="muted small" role="status"></p></section>`);
  dlg.classList.add('ed-pub-dlg');
  const creds = () => ({ repo: dlg.querySelector('#gh-repo').value.trim(), branch: dlg.querySelector('#gh-branch').value.trim() || 'main', token: dlg.querySelector('#gh-token').value.trim(), modo: dlg.querySelector('[name="pub-mode"]:checked')?.value || modo });
  const store_ = (s) => { try { const rem = dlg.querySelector('#gh-remember').checked; const cur = Z.current() || {}; (rem ? localStorage : sessionStorage).setItem('ed-gh', JSON.stringify({ ...cur, ...s, last: Date.now() })); if (!rem) localStorage.removeItem('ed-gh'); } catch { /* */ } };
  dlg.querySelector('#gh-forget')?.addEventListener('click', () => { dlg.close(); Z.logout(); });
  dlg.querySelector('#gh-save')?.addEventListener('click', () => { store_(creds()); dlg.close(); toast('Conexión guardada'); });
  if (!total) return;
  // 1. resumen de cambios
  const list = dlg.querySelector('#pub-changes');
  list.innerHTML = (await Promise.all(files.map(async (f) => {
    const before = S.orig.get(f) === 'null' ? null : JSON.parse(S.orig.get(f));
    const d = G.describeChange(f, before, W(f));
    return `<li><div class="ed-ch-head"><strong>${esc(await G.fileLabel(f, W(f)))}</strong><span class="ed-hint">${esc(d.resumen.join(' · '))}</span><button type="button" class="ed-mini" data-revert="${esc(f)}" title="Descartar los cambios de este fichero" aria-label="Descartar los cambios de este fichero">${icon('x', 14)}</button></div>
      ${d.detalle.length ? `<details><summary>Antes / después</summary><table class="ed-diff"><thead><tr><th>Dónde</th><th>Antes</th><th>Después</th></tr></thead><tbody>${d.detalle.map((x) => `<tr><td>${esc(x.ruta)}</td><td><del>${esc(x.antes)}</del></td><td><ins>${esc(x.despues)}</ins></td></tr>`).join('')}</tbody></table></details>` : ''}</li>`;
  }))).join('') + ups.map(([path, u]) => `<li><div class="ed-ch-head"><strong>Archivo nuevo: ${esc(u.name)}</strong><span class="ed-hint">${esc(path)} · ${fmt.dec(u.size / 1e6, 1)} MB · <a href="${esc(store.asset(path))}" target="_blank" rel="noopener">Ver</a></span><button type="button" class="ed-mini" data-revert-up="${esc(path)}" title="Descartar este archivo" aria-label="Descartar este archivo">${icon('x', 14)}</button></div></li>`).join('');
  list.querySelectorAll('[data-revert]').forEach((b) => b.addEventListener('click', () => { revert(b.dataset.revert); dlg.close(); openPublish(); }));
  list.querySelectorAll('[data-revert-up]').forEach((b) => b.addEventListener('click', () => { A.removeUpload(S, b.dataset.revertUp); refreshCounters(); dlg.close(); openPublish(); }));
  dlg.querySelector('#pub-prev').addEventListener('click', () => G.preview(CTX, S.view?.kind === 'page' ? S.view.id : ''));
  dlg.querySelector('#dl-go').addEventListener('click', () => { files.forEach((f) => download(f.replace(/\//g, '__'), serialize(f), 'application/json')); ups.forEach(([p, u]) => download(p.replace(/\//g, '__'), u.blob, u.type)); });
  dlg.querySelector('#discard').addEventListener('click', () => { if (confirm('¿Descartar todos los cambios no publicados (incluidos los archivos subidos)?')) { files.forEach(revert); ups.forEach(([p]) => A.removeUpload(S, p)); refreshCounters(); dlg.close(); } });
  // 2. comprobaciones
  const res = await G.runChecks(CTX, files);
  const box = dlg.querySelector('#pub-checks');
  box.innerHTML = `${G.checksHtml(res)}<p class="ed-hint">${res.errores ? `<strong class="ed-chk-error">${res.errores} error(es) impiden publicar.</strong> Corrígelos y vuelve a abrir «Revisar y publicar».` : res.avisos ? `${res.avisos} aviso(s): puedes publicar, pero conviene revisarlos.` : 'Todo correcto.'}</p>`;
  box.querySelectorAll('[data-accion]').forEach((b) => b.addEventListener('click', () => { dlg.close(); go(JSON.parse(b.dataset.accion)); }));
  const goBtn = dlg.querySelector('#gh-go');
  const label_ = () => (creds().modo === 'revision' ? 'Enviar a revisión' : 'Publicar en GitHub');
  goBtn.disabled = res.errores > 0; goBtn.textContent = res.errores ? 'Corrige los errores para publicar' : label_();
  dlg.querySelectorAll('[name="pub-mode"]').forEach((r) => r.addEventListener('change', () => { if (!res.errores) goBtn.textContent = label_(); }));
  goBtn.addEventListener('click', async () => {
    const s = creds();
    store_(s);
    const status = dlg.querySelector('#gh-status');
    if (!s.repo || !s.token) { status.textContent = 'Indica el repositorio y el token en «Conexión con GitHub».'; dlg.querySelector('.ed-conn').open = true; return; }
    const msg = dlg.querySelector('#gh-msg').value || 'Actualización de contenidos';
    goBtn.disabled = true;
    try {
      status.textContent = 'Conectando con GitHub…';
      const ref = await ghApi(s, `/repos/${s.repo}/git/ref/heads/${encodeURIComponent(s.branch)}`);
      const base = await ghApi(s, `/repos/${s.repo}/git/commits/${ref.object.sha}`);
      status.textContent = 'Preparando los cambios…';
      const blobs = [];
      for (const [i, [p, u]] of ups.entries()) {
        status.textContent = `Subiendo archivos (${i + 1} de ${ups.length}): ${u.name}…`;
        const b = await ghApi(s, `/repos/${s.repo}/git/blobs`, { method: 'POST', body: JSON.stringify({ content: await A.toBase64(u.blob), encoding: 'base64' }) });
        blobs.push({ path: p, mode: '100644', type: 'blob', sha: b.sha });
      }
      status.textContent = 'Preparando los cambios…';
      const tree = await ghApi(s, `/repos/${s.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: [...files.map((f) => ({ path: f, mode: '100644', type: 'blob', content: serialize(f) })), ...blobs] }) });
      const commit = await ghApi(s, `/repos/${s.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: msg, tree: tree.sha, parents: [ref.object.sha] }) });
      let done;
      if (s.modo === 'revision') {
        const br = `revision/${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 6)}`;
        await ghApi(s, `/repos/${s.repo}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${br}`, sha: commit.sha }) });
        const body = `## Cambios\n\n${(await Promise.all(files.map(async (f) => `- **${await G.fileLabel(f, W(f))}** (\`${f}\`): ${G.describeChange(f, S.orig.get(f) === 'null' ? null : JSON.parse(S.orig.get(f)), W(f)).resumen.join(', ')}`))).join('\n')}${ups.map(([p, u]) => `\n- Archivo nuevo: \`${p}\` (${u.name})`).join('')}\n\n## Comprobaciones\n\n${res.grupos.map((gr) => `- ${gr.nivel === 'ok' ? '✅' : gr.nivel === 'aviso' ? '⚠️' : '❌'} ${gr.titulo}${gr.items.length ? `\n${gr.items.map((i) => `  - ${i.texto}`).join('\n')}` : ''}`).join('\n')}\n\nPropuesta enviada desde el editor del portal. Al aprobarla y fusionarla, el portal se publica automáticamente.`;
        const pr = await ghApi(s, `/repos/${s.repo}/pulls`, { method: 'POST', body: JSON.stringify({ title: msg, head: br, base: s.branch, body }) });
        done = `✓ Enviado a revisión: <a href="${esc(pr.html_url)}" target="_blank" rel="noopener">propuesta #${pr.number}</a>. Se publicará cuando la persona responsable la apruebe.`;
        toast('Cambios enviados a revisión');
      } else {
        await ghApi(s, `/repos/${s.repo}/git/refs/heads/${encodeURIComponent(s.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
        done = `✓ Publicado (<a href="https://github.com/${esc(s.repo)}/commit/${commit.sha}" target="_blank" rel="noopener">${commit.sha.slice(0, 7)}</a>). El portal se actualizará en 1–2 minutos.`;
        toast('Cambios publicados');
      }
      files.forEach((f) => { S.orig.set(f, JSON.stringify(W(f))); S.dirty.delete(f); });
      ups.forEach(([p]) => { S.uploads.delete(p); A.idbDel(p); }); // la URL local sigue sirviendo hasta que GitHub Pages publique el archivo
      saveDraft(); refreshCounters(); renderSide();
      status.innerHTML = done;
    } catch (e) {
      goBtn.disabled = false;
      status.textContent = `✗ Error: ${e.message}${/40[34]/.test(e.message) ? ' · Revisa que el token tenga los permisos indicados para este repositorio.' : ''}`;
    }
  });
}
function revert(path) {
  const o = S.orig.get(path);
  if (o === 'null') { S.work.delete(path); store.clearOverride(path); } else { S.work.set(path, JSON.parse(o)); S.snap.set(path, o); store.setOverride(path, S.work.get(path)); }
  S.dirty.delete(path); saveDraft(); refreshCounters(); rerender();
}

// ------------------------------------------------------------------ arranque
// ------------------------------------------------------------------ navegación entre secciones (desde el inicio y las comprobaciones)
function go(a) {
  if (!a) return;
  if (a.tipo === 'abrir') {
    const r = a.ruta || '';
    if (r.startsWith('content/paginas/')) a = { tipo: 'pagina', id: r.slice(16).replace('.json', '') };
    else if (r.startsWith('data/')) a = { tipo: 'datos', id: r.slice(5).replace('.json', '') };
    else if (r === 'content/portal.json') { S.tab = 'paginas'; renderSide(); return openHome(); }
    else a = { tipo: 'entidad' };
  }
  switch (a.tipo) {
    case 'pagina': S.tab = 'paginas'; return openPage(a.id);
    case 'datos': S.tab = 'datos'; return openData(a.id);
    case 'entidad': case 'sync': case 'inicio': S.tab = a.tipo; return renderSide();
    case 'publicar': return openPublish();
    case 'preview': return G.preview(CTX, S.view?.kind === 'page' ? S.view.id : '');
    default: return undefined;
  }
}
async function restore(path, obj) {
  try { await load(path); } catch { S.orig.set(path, 'null'); S.work.set(path, clone(obj)); S.snap.set(path, JSON.stringify(obj)); markDirty(path); refreshCounters(); return; }
  change(path, (d) => { Object.keys(d).forEach((k) => delete d[k]); Object.assign(d, clone(obj)); });
  rerender();
}
const CTX = { S, W, load, change, toast, ghSettings, ghApi, go, restore };

function rerender() {
  renderSide();
  if (S.view?.kind === 'page' && S.work.has(PATH())) { renderPage(); S.sel !== null && W(PATH()).bloques[S.sel] ? selectBlock(S.sel) : showPalette(); }
  else if (S.view?.kind === 'data') openData(S.view.id);
}
async function init() {
  setCodelists(await store.getJSON('data/codelists.json'));
  await loadAdvanced();
  await Promise.all(['config/entidad.json', 'content/portal.json'].map(load));
  applyColors();
  $('#ed-entity').textContent = pick(W('config/entidad.json').nombre);
  // Inicio de sesión: la identidad y los permisos los valida GitHub (ver sesion.js)
  S.session = await Z.gate(W('config/entidad.json'));
  Z.userBadge($('.ed-top-tools'), S.session, () => S.dirty.size + S.uploads.size > 0);
  setLang('es');
  // Borrador pendiente
  try {
    const draft = JSON.parse(localStorage.getItem('ed-draft') || '{}');
    const paths = Object.keys(draft);
    const saved = await A.idbAll();
    if ((paths.length || saved.size) && confirm(`Hay cambios sin publicar de una sesión anterior (${paths.length} fichero(s)${saved.size ? ` y ${saved.size} archivo(s) subido(s)` : ''}). ¿Recuperarlos?`)) {
      for (const p of paths) { try { await load(p); } catch { S.orig.set(p, 'null'); } S.work.set(p, draft[p]); markDirty(p); }
      await A.restoreUploads(S);
    } else { localStorage.removeItem('ed-draft'); A.idbClear(); }
  } catch { /* */ }
  $('#ed-edit-lang').addEventListener('change', (e) => { S.lang = e.target.value; setLang(S.lang); rerender(); });
  $('#ed-mode').value = S.mode;
  $('#ed-mode').addEventListener('change', (e) => { S.mode = e.target.value; try { localStorage.setItem('ed-mode', S.mode); } catch { /* */ } rerender(); toast(S.mode === 'simple' ? 'Modo sencillo: se ocultan los detalles técnicos' : 'Modo avanzado: se muestran nombres de campo, filtros y opciones técnicas'); });
  $('#ed-preview').addEventListener('click', () => G.preview(CTX, S.view?.kind === 'page' ? S.view.id : ''));
  document.querySelectorAll('.ed-tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; renderSide(); }));
  $('#ed-undo').addEventListener('click', undo);
  $('#ed-publish').addEventListener('click', openPublish);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); undo(); } });
  window.addEventListener('beforeunload', (e) => { if (S.dirty.size) { e.preventDefault(); e.returnValue = ''; } });
  await renderSide();
}
init();
