/**
 * archivos.js — Subida de archivos desde el editor (PDF, imágenes, ofimática…).
 *
 * - El archivo se guarda como borrador (memoria + IndexedDB, para no perderlo si se cierra
 *   la pestaña) con una ruta pública definitiva: archivos/<tipo>/<año>/<nombre>.<ext>
 * - Mientras no se publica, el portal y la vista previa lo muestran desde el navegador.
 * - Al publicar, viaja en el mismo commit (o propuesta de revisión) que el resto de cambios.
 * - Las fotos de cargos se reducen a 800 px y las imágenes grandes a 2000 px.
 */
import { esc, icon, fmt } from '../assets/js/ui.js';
import * as store from '../assets/js/store.js';

export const MAX_MB = 25;
export const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.gif,.svg,.doc,.docx,.odt,.xls,.xlsx,.ods,.ppt,.pptx,.odp,.csv,.txt,.zip';
const IMG = /^image\/(jpeg|png|webp|gif)$/;
const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'archivo';

// ---------------------------------------------------------------- IndexedDB (borradores)
const DB = 'ed-archivos';
const idb = () => new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore('f'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const tx = async (mode, fn) => { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('f', mode); const out = fn(t.objectStore('f')); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error); }); };
export const idbPut = (path, rec) => tx('readwrite', (s) => s.put(rec, path)).catch(() => {});
export const idbDel = (path) => tx('readwrite', (s) => s.delete(path)).catch(() => {});
export const idbClear = () => tx('readwrite', (s) => s.clear()).catch(() => {});
export async function idbAll() {
  try { const db = await idb(); return await new Promise((res) => { const out = new Map(); const c = db.transaction('f').objectStore('f').openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.set(cur.key, cur.value); cur.continue(); } else res(out); }; c.onerror = () => res(out); }); } catch { return new Map(); }
}

async function shrink(file, max) {
  try {
    const bmp = await createImageBitmap(file);
    if (Math.max(bmp.width, bmp.height) <= max && file.size < 1.5e6) return file;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob = await new Promise((r) => cv.toBlob(r, type, 0.86));
    return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, type === 'image/png' ? '.png' : '.jpg'), { type }) : file;
  } catch { return file; }
}

/** Registra un archivo subido y devuelve su ruta pública. */
export async function addUpload(S, file, kind = 'documentos') {
  if (file.size > MAX_MB * 1e6) throw new Error(`El archivo supera ${MAX_MB} MB.`);
  if (IMG.test(file.type)) file = await shrink(file, kind === 'cargos' ? 800 : 2000);
  const ext = (file.name.match(/\.([a-z0-9]+)$/i)?.[1] || 'bin').toLowerCase();
  const base = slug(file.name.replace(/\.[^.]+$/, ''));
  const path = `archivos/${kind}/${new Date().getFullYear()}/${base}-${Date.now().toString(36).slice(-4)}.${ext}`;
  const rec = { blob: file, type: file.type || 'application/octet-stream', name: file.name, size: file.size };
  S.uploads.set(path, rec);
  store.setAsset(path, URL.createObjectURL(file));
  idbPut(path, rec);
  return path;
}
export function removeUpload(S, path) {
  const u = store.asset(path); if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
  store.setAsset(path, null); S.uploads.delete(path); idbDel(path);
}
export async function restoreUploads(S) {
  const all = await idbAll();
  for (const [path, rec] of all) { S.uploads.set(path, rec); store.setAsset(path, URL.createObjectURL(rec.blob)); }
  return all.size;
}
export const toBase64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

/**
 * Añade junto a un campo de texto los controles «Subir archivo», «Ver» y vista en miniatura.
 * @param {HTMLInputElement} input campo con la ruta o URL (se dispara su evento input al subir)
 */
export function attachUploader(S, input, { kind = 'documentos', image = false, toast } = {}) {
  const box = document.createElement('div');
  box.className = 'ed-upload';
  box.innerHTML = `<label class="btn-ghost ed-up-btn">${icon('download', 14)} ${image ? 'Subir imagen' : 'Subir archivo'}<input type="file" class="sr-only" accept="${image ? 'image/*' : ACCEPT}"></label>
    <a class="link-btn ed-up-view" target="_blank" rel="noopener" hidden>${icon('eye', 14)} Ver</a><span class="ed-hint ed-up-info"></span>`;
  const view = box.querySelector('.ed-up-view'), info = box.querySelector('.ed-up-info');
  const thumb = image ? Object.assign(document.createElement('img'), { className: 'ed-up-thumb', alt: '' }) : null;
  if (thumb) box.prepend(thumb);
  const refresh = () => {
    const v = input.value.trim();
    view.hidden = !v; if (v) view.href = store.asset(v);
    const up = S.uploads.get(v);
    info.innerHTML = up ? `Pendiente de publicar · ${esc(up.name)} · ${fmt.dec(up.size / 1e6, 1)} MB` : '';
    if (thumb) { thumb.hidden = !v; if (v) thumb.src = store.asset(v); }
  };
  box.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const path = await addUpload(S, f, kind);
      input.value = path;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      toast?.(`Archivo preparado: ${f.name}. Se publicará con el resto de cambios.`);
    } catch (err) { toast?.(err.message, 5000); }
    e.target.value = '';
    refresh();
  });
  input.addEventListener('input', refresh);
  refresh();
  input.after(box);
  return box;
}
