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
 * Todo cambio se guarda como borrador en el navegador hasta que se publica.
 */
import { setLang, setCodelists, pick, label } from '../assets/js/i18n.js';
import { h, esc, icon, ICONS, flushCharts, download, modal } from '../assets/js/ui.js';
import * as store from '../assets/js/store.js';
import { BLOCKS, loadAdvanced, renderBlock } from '../assets/js/blocks/index.js';

const S = { snap: new Map(), work: new Map(), orig: new Map(), dirty: new Set(), hist: [], lang: 'es', tab: 'paginas', view: null, sel: null, insertAt: null, rec: null };
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
  $('#ed-count').textContent = S.dirty.size;
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
  for (const p of props) {
    const wrap = h(`<label class="ed-field"><span>${esc(pick(p.etiqueta) || p.clave)}${['texto', 'texto_largo'].includes(p.tipo) ? missingTag(obj[p.clave]) : ''}</span></label>`);
    let input;
    const v = obj[p.clave];
    switch (p.tipo) {
      case 'texto': input = h(`<input type="text" value="${esc(i18nVal(v))}">`); input.addEventListener('input', () => { setI18n(obj, p.clave, input.value); onChange(p.clave); }); break;
      case 'texto_largo': input = h(`<textarea>${esc(i18nVal(v))}</textarea>`); input.addEventListener('input', () => { setI18n(obj, p.clave, input.value); onChange(p.clave); }); wrap.append(input); input = null; wrap.append(h('<small>Admite **negrita**, *cursiva*, listas con «- » y [enlaces](https://…)</small>')); break;
      case 'texto_simple': case 'url': case 'fecha': case 'numero': case 'color': {
        const type = { texto_simple: 'text', url: 'url', fecha: 'date', numero: 'number', color: 'color' }[p.tipo];
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
        const opts = fs.flatMap((f) => [[f.nombre, `${f.descripcion} (${f.nombre})`], ...(p.permite_fecha && f.tipo === 'date' ? [[`${f.nombre}:anio`, `${f.descripcion} → por año`], [`${f.nombre}:mes`, `${f.descripcion} → por mes`]] : [])]);
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
    if (p.ayuda) wrap.append(h(`<small class="ed-hint">${esc(pick(p.ayuda))}</small>`));
    host.appendChild(wrap);
  }
}

// ------------------------------------------------------------------ barra lateral
async function renderSide() {
  const body = $('#ed-side-body');
  document.querySelectorAll('.ed-tabs [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === S.tab)));
  if (S.tab === 'paginas') {
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
    <p class="ed-hint">La fecha de actualización se pone sola al publicar cambios${pg.actualizado ? ` (ahora: ${esc(pg.actualizado)})` : ''}; la fuente se toma de los conjuntos de datos que usan los bloques. Dirección pública: <a href="../#/${pg.id}" target="_blank" rel="noopener">#/${pg.id}</a> · Arrastra componentes desde el panel derecho o pulsa <strong>+</strong> entre bloques.</p></section>`);
  head.querySelector('#pg-t').addEventListener('input', (e) => change(PATH(), (p) => setI18n(p, 'titulo', e.target.value)));
  head.querySelector('#pg-d').addEventListener('input', (e) => change(PATH(), (p) => setI18n(p, 'intro', e.target.value)));
  head.querySelector('#pg-r').addEventListener('input', (e) => change(PATH(), (p) => setI18n(p, 'responsable', e.target.value)));
  head.querySelector('#pg-i').addEventListener('change', (e) => change(PATH(), (p) => (p.icono = e.target.value)));
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
async function openData(id) {
  S.view = { kind: 'data', id }; S.rec = null;
  const path = `data/${id}.json`;
  const env = await load(path);
  const ds = (await store.meta()).conjuntos.find((d) => d.id === id);
  renderSide();
  const auto = ['placsp', 'bdns'].includes(ds.fuente.tipo);
  const cols = ds.campos.slice(0, 7);
  const main = $('#ed-main');
  main.innerHTML = `<div class="ed-data-head"><h1>${esc(pick(ds.titulo))}</h1>
      <input type="search" id="dq" placeholder="Buscar…" class="ed-field" style="padding:7px 9px;border:1px solid var(--line-strong);border-radius:6px;min-width:220px">
      <button type="button" class="btn" id="d-add">${icon('plus', 16)} Nuevo registro</button></div>
    ${auto ? `<div class="callout callout-info">${icon('sync', 20)}<div><p><strong>Actualización automática desde ${esc(ds.fuente.nombre)}.</strong> La sincronización diaria sustituye los registros procedentes de la fuente; los que añadas aquí se marcan como «carga manual» y se conservan.</p></div></div>` : ''}
    ${env.ejemplo ? `<div class="callout callout-advertencia">${icon('warn', 20)}<div><p>Este conjunto contiene <strong>datos de ejemplo</strong>. Al editar cualquier registro se marcará como dato manual; elimina los registros de ejemplo antes de publicar.</p></div></div>` : ''}
    <p class="ed-hint" style="margin:10px 0">${env.datos.length} registros · Pulsa una fila para editarla en el panel derecho.</p>
    <div class="ed-grid-wrap"><table class="ed-grid"><thead><tr>${cols.map((c) => `<th>${esc(c.descripcion)}</th>`).join('')}</tr></thead><tbody></tbody></table></div>`;
  const tbody = main.querySelector('tbody');
  const f = (c, v) => (c.lista ? store.valueLabel(c, v) : typeof v === 'boolean' ? (v ? 'Sí' : 'No') : v ?? '—');
  const draw = () => {
    const q = main.querySelector('#dq').value.toLowerCase();
    tbody.innerHTML = W(path).datos.map((r, i) => [r, i]).filter(([r]) => !q || JSON.stringify(r).toLowerCase().includes(q)).slice(0, 500)
      .map(([r, i]) => `<tr data-r="${i}" class="${S.rec === i ? 'sel' : ''}" tabindex="0">${cols.map((c) => `<td>${esc(f(c, r[c.nombre]))}</td>`).join('')}</tr>`).join('');
  };
  draw();
  main.querySelector('#dq').addEventListener('input', draw);
  tbody.addEventListener('click', (e) => { const tr = e.target.closest('tr[data-r]'); if (tr) { S.rec = Number(tr.dataset.r); draw(); openRecord(ds, path, draw); } });
  tbody.addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-r]'); if (tr && e.key === 'Enter') { S.rec = Number(tr.dataset.r); draw(); openRecord(ds, path, draw); } });
  main.querySelector('#d-add').addEventListener('click', () => {
    const blank = Object.fromEntries(ds.campos.map((c) => [c.nombre, c.tipo === 'boolean' ? false : c.nombre === 'fuente' ? 'manual' : c.nombre === 'id' ? `${id.slice(0, 3).toUpperCase()}-${Date.now().toString(36)}` : null]));
    change(path, (e) => e.datos.unshift(blank));
    S.rec = 0; draw(); openRecord(ds, path, draw);
  });
  $('#ed-props').innerHTML = `<h2>${icon('table', 18)} Registro</h2><p class="ed-hint">Selecciona un registro de la tabla o crea uno nuevo.</p>`;
}
async function openRecord(ds, path, redraw) {
  const r = W(path).datos[S.rec];
  const panel = $('#ed-props');
  panel.classList.add('open');
  panel.innerHTML = `<h2>${icon('edit', 18)} Registro</h2><form class="ed-form" onsubmit="return false"></form>
    <div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="btn-ghost" id="r-dup">${icon('copy', 14)} Duplicar</button><button type="button" class="btn-ghost" id="r-del">${icon('trash', 14)} Eliminar</button></div>`;
  const form = panel.querySelector('form');
  for (const c of ds.campos) {
    const v = r[c.nombre];
    const wrap = h(`<label class="ed-field"><span>${esc(c.descripcion)} <code>${c.nombre}</code></span></label>`);
    let input;
    if (c.lista) {
      const lists = c.lista.split('|');
      const cl = await store.getJSON('data/codelists.json');
      input = h(`<select><option value="">—</option>${lists.flatMap((l) => Object.keys(cl[l] || {}).map((k) => `<option value="${esc(k)}"${String(v) === k ? ' selected' : ''}>${esc(label(l, k))}</option>`)).join('')}</select>`);
    } else if (c.tipo === 'boolean') input = h(`<select><option value="true"${v === true ? ' selected' : ''}>Sí</option><option value="false"${v !== true ? ' selected' : ''}>No</option></select>`);
    else if (c.tipo === 'date') input = h(`<input type="date" value="${esc(v || '')}">`);
    else if (c.tipo === 'yearmonth') input = h(`<input type="month" value="${esc(v || '')}">`);
    else if (c.tipo === 'number' || c.tipo === 'integer') input = h(`<input type="number" step="${c.tipo === 'integer' ? 1 : 'any'}" value="${v ?? ''}">`);
    else if (c.formato === 'uri') input = h(`<input type="url" value="${esc(v || '')}" placeholder="https://…">`);
    else input = h(`<input type="text" value="${esc(v ?? '')}">`);
    input.addEventListener('input', () => {
      let nv = input.value;
      if (c.tipo === 'boolean') nv = nv === 'true';
      else if (c.tipo === 'number') nv = nv === '' ? null : Number(nv);
      else if (c.tipo === 'integer') nv = nv === '' ? null : parseInt(nv, 10);
      else if (nv === '') nv = null;
      change(path, (e) => { e.datos[S.rec][c.nombre] = nv; if ('fuente' in e.datos[S.rec] && ['ejemplo'].includes(e.datos[S.rec].fuente)) e.datos[S.rec].fuente = 'manual'; });
      redraw();
    });
    wrap.append(input);
    if (c.nombre === 'foto' && v) wrap.append(h(`<img src="${esc(v)}" alt="" style="width:64px;height:64px;border-radius:50%;object-fit:cover">`));
    form.appendChild(wrap);
  }
  $('#r-dup').addEventListener('click', () => { change(path, (e) => e.datos.splice(S.rec + 1, 0, { ...clone(e.datos[S.rec]), ...(e.datos[S.rec].id ? { id: `${e.datos[S.rec].id}-copia` } : {}) })); S.rec++; redraw(); openRecord(ds, path, redraw); });
  $('#r-del').addEventListener('click', () => { if (!confirm('¿Eliminar este registro?')) return; change(path, (e) => e.datos.splice(S.rec, 1)); S.rec = null; redraw(); panel.innerHTML = '<p class="ed-hint">Registro eliminado.</p>'; });
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
    <section class="ed-card"><h2>Base de Datos Nacional de Subvenciones</h2><p class="ed-hint">Identificadores del órgano concedente en la BDNS (separados por comas) o, si se desconocen, el nombre exacto del órgano.</p><div id="ent-b"></div></section>`;
  const save = () => { change('config/entidad.json', () => {}); applyColors(); };
  buildForm($('#ent-a'), ENTITY_FORM, cfg, save);
  buildForm($('#ent-c'), [{ clave: 'principal', tipo: 'color', etiqueta: { es: 'Color principal' } }, { clave: 'secundario', tipo: 'color', etiqueta: { es: 'Color secundario' } }], cfg.colores, save);
  const csv = (obj, key) => ({ get: () => (obj[key] || []).join(', '), set: (v) => (obj[key] = v.split(',').map((x) => x.trim()).filter(Boolean)) });
  const listField = (host, label_, acc) => { const w = h(`<label class="ed-field"><span>${label_}</span><input type="text" value="${esc(acc.get())}"></label>`); w.querySelector('input').addEventListener('input', (e) => { acc.set(e.target.value); save(); }); host.appendChild(w); };
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
  return { repo: saved.repo || cfg?.github?.repositorio || '', branch: saved.branch || cfg?.github?.rama || 'main', token: saved.token || '' };
}
async function ghApi(gh, path, opts = {}) {
  const r = await fetch(`https://api.github.com${path}`, { ...opts, headers: { Authorization: `Bearer ${gh.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } });
  if (!r.ok) throw new Error(`${r.status} ${(await r.json().catch(() => ({}))).message || r.statusText}`);
  return r.status === 204 ? null : r.json();
}
const serialize = (p) => JSON.stringify(W(p), null, INDENT(p)) + '\n';
function openPublish() {
  const gh = ghSettings();
  const files = [...S.dirty];
  const dlg = modal('Publicar cambios', `
    <p>${files.length ? `Hay <strong>${files.length}</strong> fichero(s) modificado(s):` : 'No hay cambios pendientes.'}</p>
    <ul class="ed-files">${files.map((f) => `<li><code>${esc(f)}</code><button type="button" class="ed-mini" data-revert="${esc(f)}" title="Descartar cambios de este fichero">${icon('x', 14)}</button></li>`).join('')}</ul>
    <h3 style="margin-top:16px">Publicar en GitHub</h3>
    <p class="muted small">Se crea un único commit con todos los cambios. El portal se vuelve a publicar automáticamente en 1–2 minutos. Necesitas un <a href="https://github.com/settings/personal-access-tokens/new" rel="noopener" target="_blank">token de acceso de grano fino</a> con permiso <em>Contents: Read and write</em> (y <em>Actions: Read and write</em> para lanzar la sincronización) limitado a este repositorio.</p>
    <div class="ed-field"><span>Repositorio</span><input type="text" id="gh-repo" value="${esc(gh.repo)}" placeholder="organizacion/repositorio"></div>
    <div class="ed-field"><span>Rama</span><input type="text" id="gh-branch" value="${esc(gh.branch)}"></div>
    <div class="ed-field"><span>Token</span><input type="password" id="gh-token" value="${esc(gh.token)}" autocomplete="off"></div>
    <label class="ed-field" style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="gh-remember"> Recordar en este navegador (si no, solo durante la sesión)</label>
    <div class="ed-field"><span>Descripción del cambio</span><input type="text" id="gh-msg" value="Actualización de contenidos del portal de transparencia"></div>
    <div class="modal-actions"><button type="button" class="btn" id="gh-go"${files.length ? '' : ' disabled'}>Publicar en GitHub</button>
      <button type="button" class="btn-ghost" id="dl-go"${files.length ? '' : ' disabled'}>Descargar ficheros</button>
      <button type="button" class="btn-ghost" id="discard"${files.length ? '' : ' disabled'}>Descartar todo</button></div>
    <p id="gh-status" class="muted small" role="status"></p>`);
  dlg.querySelectorAll('[data-revert]').forEach((b) => b.addEventListener('click', () => { revert(b.dataset.revert); dlg.close(); openPublish(); }));
  dlg.querySelector('#dl-go').addEventListener('click', () => files.forEach((f) => download(f.replace(/\//g, '__'), serialize(f), 'application/json')));
  dlg.querySelector('#discard').addEventListener('click', () => { if (confirm('¿Descartar todos los cambios no publicados?')) { files.forEach(revert); dlg.close(); } });
  dlg.querySelector('#gh-go').addEventListener('click', async () => {
    const s = { repo: dlg.querySelector('#gh-repo').value.trim(), branch: dlg.querySelector('#gh-branch').value.trim() || 'main', token: dlg.querySelector('#gh-token').value.trim() };
    try { (dlg.querySelector('#gh-remember').checked ? localStorage : sessionStorage).setItem('ed-gh', JSON.stringify(s)); } catch { /* */ }
    const status = dlg.querySelector('#gh-status');
    try {
      status.textContent = 'Conectando con GitHub…';
      const ref = await ghApi(s, `/repos/${s.repo}/git/ref/heads/${encodeURIComponent(s.branch)}`);
      const base = await ghApi(s, `/repos/${s.repo}/git/commits/${ref.object.sha}`);
      status.textContent = 'Creando commit…';
      const tree = await ghApi(s, `/repos/${s.repo}/git/trees`, { method: 'POST', body: JSON.stringify({ base_tree: base.tree.sha, tree: files.map((f) => ({ path: f, mode: '100644', type: 'blob', content: serialize(f) })) }) });
      const commit = await ghApi(s, `/repos/${s.repo}/git/commits`, { method: 'POST', body: JSON.stringify({ message: dlg.querySelector('#gh-msg').value || 'Actualización de contenidos', tree: tree.sha, parents: [ref.object.sha] }) });
      await ghApi(s, `/repos/${s.repo}/git/refs/heads/${encodeURIComponent(s.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha }) });
      files.forEach((f) => { S.orig.set(f, JSON.stringify(W(f))); S.dirty.delete(f); });
      saveDraft(); refreshCounters(); renderSide();
      status.innerHTML = `✓ Publicado (<a href="https://github.com/${esc(s.repo)}/commit/${commit.sha}" target="_blank" rel="noopener">${commit.sha.slice(0, 7)}</a>). El portal se actualizará en 1–2 minutos.`;
      toast('Cambios publicados');
    } catch (e) { status.textContent = `✗ Error: ${e.message}`; }
  });
}
function revert(path) {
  const o = S.orig.get(path);
  if (o === 'null') { S.work.delete(path); store.clearOverride(path); } else { S.work.set(path, JSON.parse(o)); S.snap.set(path, o); store.setOverride(path, S.work.get(path)); }
  S.dirty.delete(path); saveDraft(); refreshCounters(); rerender();
}

// ------------------------------------------------------------------ arranque
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
  setLang('es');
  // Borrador pendiente
  try {
    const draft = JSON.parse(localStorage.getItem('ed-draft') || '{}');
    const paths = Object.keys(draft);
    if (paths.length && confirm(`Hay ${paths.length} fichero(s) con cambios sin publicar de una sesión anterior. ¿Recuperarlos?`)) {
      for (const p of paths) { try { await load(p); } catch { S.orig.set(p, 'null'); } S.work.set(p, draft[p]); markDirty(p); }
    } else localStorage.removeItem('ed-draft');
  } catch { /* */ }
  $('#ed-edit-lang').addEventListener('change', (e) => { S.lang = e.target.value; setLang(S.lang); rerender(); });
  document.querySelectorAll('.ed-tabs [role="tab"]').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.tab; renderSide(); }));
  $('#ed-undo').addEventListener('click', undo);
  $('#ed-publish').addEventListener('click', openPublish);
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); undo(); } });
  window.addEventListener('beforeunload', (e) => { if (S.dirty.size) { e.preventDefault(); e.returnValue = ''; } });
  await renderSide();
  openPage(W('content/portal.json').categorias[0].paginas[0]);
}
init();
