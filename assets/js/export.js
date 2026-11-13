/**
 * export.js — Exportación de tablas y conjuntos: Excel (.xlsx), CSV, JSON y PDF.
 *
 * - Excel y CSV: con los valores (números y fechas reales), no con el texto formateado.
 * - PDF: se abre en una pestaña nueva una versión imprimible (título, fuente, fecha
 *   y tabla) y el diálogo del navegador permite «Guardar como PDF» o imprimir.
 *
 * exportMenu({ name, title, columns, rows, source }) → elemento con el menú «Descargar».
 */
import { tr } from './i18n.js';
import { h, esc, icon, download, toCSV } from './ui.js';
import { toXLSX, XLSX_MIME } from './xlsx.js';

const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
/** Valor «crudo» de una celda: número/fecha si lo es; si no, el texto formateado. */
const cellValue = (c, r) => {
  const v = c.raw ? c.raw(r) : r[c.key];
  if (typeof v === 'number' || typeof v === 'boolean' || v === null || v === undefined) return v;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return c.format ? strip(c.format(v, r)) : v;
};
const plainCols = (columns) => columns.map((c) => ({ ...c, label: strip(c.label) }));

export function toXlsxBlob({ title, columns, rows, sheet }) {
  const cols = plainCols(columns);
  return new Blob([toXLSX({ sheet: sheet || title, title, columns: cols.map((c) => ({ label: c.label, value: (r) => cellValue(c, r) })), rows })], { type: XLSX_MIME });
}

/** Abre en una pestaña nueva una versión imprimible / guardable como PDF. */
export function openPrintable({ title, subtitle, columns, rows, source }) {
  const cols = plainCols(columns);
  const fmtCell = (c, r) => { const v = r[c.key]; return c.format ? strip(c.format(v, r)) : v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v); };
  const now = new Date();
  const html = `<!doctype html><html lang="${document.documentElement.lang || 'es'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title>
<style>
  @page { size: A4 ${cols.length > 6 ? 'landscape' : 'portrait'}; margin: 14mm; }
  body { font: 10.5pt/1.4 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #111; margin: 24px; }
  h1 { font-size: 16pt; margin: 0 0 4px; } p.meta { color: #555; margin: 0 0 14px; font-size: 9.5pt; }
  table { border-collapse: collapse; width: 100%; } th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 700; } td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  thead { display: table-header-group; } tr { break-inside: avoid; }
  .bar { position: sticky; top: 0; background: #fff; padding: 8px 0 12px; display: flex; gap: 8px; }
  .bar button { font: inherit; padding: 6px 14px; border-radius: 6px; border: 1px solid #888; background: #fff; cursor: pointer; } .bar button.primary { background: #111; color: #fff; border-color: #111; }
  @media print { .bar { display: none; } body { margin: 0; } }
</style></head><body>
<div class="bar"><button class="primary" onclick="print()">${esc(tr('Guardar como PDF o imprimir', 'Desar com a PDF o imprimir', 'Save as PDF or print'))}</button><button onclick="close()">${esc(tr('Cerrar', 'Tancar', 'Close'))}</button></div>
<h1>${esc(title)}</h1><p class="meta">${subtitle ? `${esc(subtitle)} · ` : ''}${source ? `${esc(tr('Fuente', 'Font', 'Source'))}: ${esc(source)} · ` : ''}${rows.length} ${esc(tr('registros', 'registres', 'records'))} · ${esc(tr('Generado el', 'Generat el', 'Generated on'))} ${now.toLocaleDateString()} ${now.toLocaleTimeString().slice(0, 5)} · ${esc(location.origin + location.pathname)}</p>
<table><thead><tr>${cols.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${cols.map((c) => `<td${c.align === 'right' ? ' class="num"' : ''}>${esc(fmtCell(c, r))}</td>`).join('')}</tr>`).join('')}</tbody></table>
<script>addEventListener('load', () => setTimeout(() => print(), 300));<\/script></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const w = window.open(url, '_blank');
  if (!w) location.href = url; // bloqueador de ventanas: se abre en la misma pestaña
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Menú de descarga accesible (details/summary).
 * @param {{name:string, title:string, subtitle?:string, columns:any[], rows:any[]|(()=>any[]), source?:string, label?:string}} o
 */
export function exportMenu(o) {
  const rows = () => (typeof o.rows === 'function' ? o.rows() : o.rows);
  const el = h(`<details class="export-menu"><summary class="link-btn">${icon('download', 14)} ${esc(o.label || tr('Descargar', 'Descarregar', 'Download'))}</summary>
    <ul role="list">
      <li><button type="button" data-f="xlsx">Excel (.xlsx)</button></li>
      <li><button type="button" data-f="csv">CSV</button></li>
      <li><button type="button" data-f="json">JSON</button></li>
      <li><button type="button" data-f="pdf">PDF ${esc(tr('(abre en pestaña nueva)', '(obri en pestanya nova)', '(opens in new tab)'))}</button></li>
    </ul></details>`);
  el.addEventListener('click', (e) => {
    const f = e.target.closest('[data-f]')?.dataset.f; if (!f) return;
    const data = rows();
    const cols = plainCols(o.columns);
    if (f === 'xlsx') download(`${o.name}.xlsx`, toXlsxBlob({ title: o.title, columns: o.columns, rows: data }), XLSX_MIME);
    if (f === 'csv') download(`${o.name}.csv`, '﻿' + toCSV(cols.map((c) => ({ label: c.label, raw: (r) => cellValue(c, r) })), data), 'text/csv;charset=utf-8');
    if (f === 'json') download(`${o.name}.json`, JSON.stringify(data.map((r) => Object.fromEntries(cols.map((c) => [c.key || c.label, cellValue(c, r)]))), null, 2), 'application/json');
    if (f === 'pdf') openPrintable({ title: o.title, subtitle: o.subtitle, columns: o.columns, rows: data, source: o.source });
    el.open = false;
  });
  document.addEventListener('click', (e) => { if (el.open && !el.contains(e.target)) el.open = false; });
  return el;
}
