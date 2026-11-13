/**
 * ui.js — Components d'interfície reutilitzables i formatadors.
 */
import { t, lang, label } from './i18n.js';
import { exportSVG, sparkline, hideTip } from './charts.js';

// ---------------------------------------------------------------------------
// Formatadors dependents de l'idioma
// ---------------------------------------------------------------------------
const LOCALE = { es: 'es-ES', va: 'ca-ES', en: 'en-GB' };
const nf = (o) => new Intl.NumberFormat(LOCALE[lang()], o);
export const fmt = {
  int: (n) => nf({ maximumFractionDigits: 0 }).format(n),
  dec: (n, d = 1) => nf({ minimumFractionDigits: d, maximumFractionDigits: d }).format(n),
  eur: (n) => nf({ style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n),
  eur2: (n) => nf({ style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n),
  eurC: (n) => nf({ style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: Math.abs(n) >= 1e6 ? 1 : 0 }).format(n),
  compact: (n) => nf({ notation: 'compact', maximumFractionDigits: Math.abs(n) >= 1e6 ? 1 : 0 }).format(n),
  pct: (n, d = 1) => nf({ style: 'percent', minimumFractionDigits: d, maximumFractionDigits: d }).format(n / 100),
  dias: (n) => `${nf({ maximumFractionDigits: 1 }).format(n)} ${lang() === 'en' ? 'days' : lang() === 'va' ? 'dies' : 'días'}`,
  m2: (n) => `${nf({ maximumFractionDigits: 0 }).format(n)} m²`,
  date: (s) => s ? new Intl.DateTimeFormat(LOCALE[lang()], { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z')) : '—',
  dateLong: (s) => new Intl.DateTimeFormat(LOCALE[lang()], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(s + 'T00:00:00Z')),
  month: (ym, long = false) => {
    const [y, m] = ym.split('-').map(Number);
    return new Intl.DateTimeFormat(LOCALE[lang()], { month: long ? 'long' : 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1)));
  },
  monthName: (m, style = 'short') => new Intl.DateTimeFormat(LOCALE[lang()], { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2020, m - 1, 1))),
  bool: (b) => (b ? t('yes') : t('no')),
};

// ---------------------------------------------------------------------------
// Helpers DOM
// ---------------------------------------------------------------------------
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function h(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}
export const sum = (arr, f = (x) => x) => arr.reduce((s, d) => s + (f(d) || 0), 0);
export const groupBy = (arr, f) => arr.reduce((m, d) => { const k = f(d); (m.get(k) || m.set(k, []).get(k)).push(d); return m; }, new Map());
export const uniq = (arr) => [...new Set(arr)];

export const ICONS = {
  building: '<path d="M4 21V5l8-3 8 3v16M9 21v-4h6v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01"/>',
  euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/>',
  file: '<path d="M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6"/>',
  hand: '<path d="M7 11V6a2 2 0 1 1 4 0v4m0-1V4a2 2 0 1 1 4 0v6m0-3a2 2 0 1 1 4 0v7a7 7 0 0 1-7 7h-1a7 7 0 0 1-6-3.5L3 14a2 2 0 0 1 3-2l1 1"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4"/>',
  chart: '<path d="M3 3v18h18M7 15l4-4 3 3 6-6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7H2v-7z"/>',
  check: '<path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  download: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/>',
  table: '<path d="M3 4h18v16H3zM3 10h18M3 15h18M9 4v16"/>',
  bars: '<path d="M6 20V10M12 20V4M18 20v-7"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  ok: '<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',
  warn: '<path d="M12 3l10 18H2zM12 10v5M12 18h.01"/>',
  x: '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  map: '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  gift: '<path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 1 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 1 0 0-5C13 2 12 7 12 7z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  flag: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
  code: '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>',
  rss: '<path d="M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19h.01"/>',
  external: '<path d="M14 3h7v7M21 3l-9 9M19 14v6H4V5h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18"/>',
  scale: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a4 4 0 0 0 6 0zM19 7l-3 7a4 4 0 0 0 6 0z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  home: '<path d="M3 11l9-8 9 8M5 9.5V21h14V9.5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  save: '<path d="M5 3h11l3 3v15H5zM8 3v5h7V3M8 21v-7h8v7"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  text: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
};
export const icon = (name, size = 20) => `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

// ---------------------------------------------------------------------------
// Descàrregues
// ---------------------------------------------------------------------------
export function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 100);
}
export function toCSV(columns, rows) {
  const cell = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\r\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [columns.map((c) => cell(c.label)).join(','), ...rows.map((r) => columns.map((c) => cell(c.raw ? c.raw(r) : r[c.key])).join(','))].join('\r\n');
}

// ---------------------------------------------------------------------------
// Targetes de gràfic: títol + accions (taula, CSV, SVG) + font
// ---------------------------------------------------------------------------
const pending = [];
let cardSeq = 0;
/**
 * @param {{title:string, subtitle?:string, draw:(el:HTMLElement)=>void, table:{columns:any[], rows:any[]}, file:string, dataset?:string, wide?:boolean, note?:string}} o
 */
export function chartCard(o) {
  const id = `cc-${++cardSeq}`;
  const card = h(`
    <figure class="card chart-card${o.wide ? ' wide' : ''}${o.full ? ' full' : ''}" id="${id}">
      <figcaption class="chart-head">
        <div>
          <h3 class="chart-title">${o.title}</h3>
          ${o.subtitle ? `<p class="chart-sub">${o.subtitle}</p>` : ''}
        </div>
        <div class="chart-actions" role="group" aria-label="${esc(t('chart_actions'))}">
          <button type="button" class="icon-btn" data-act="toggle" aria-pressed="false" title="${esc(t('view_table'))}">${icon('table', 18)}<span class="sr-only">${t('view_table')}</span></button>
          <button type="button" class="icon-btn" data-act="csv" title="${esc(t('download_csv'))}">${icon('download', 18)}<span class="btn-text">CSV</span></button>
          <button type="button" class="icon-btn" data-act="svg" title="${esc(t('download_svg'))}"><span class="btn-text">SVG</span></button>
        </div>
      </figcaption>
      <div class="chart-body"></div>
      <div class="chart-table" hidden></div>
      <p class="chart-source">${o.note ? `${o.note} · ` : ''}${o.dataset ? `${t('source')}: <a href="#/datos/${o.dataset}">${t('dataset')} «${esc(o.datasetTitle || o.dataset)}»</a>` : ''}</p>
    </figure>`);
  const body = card.querySelector('.chart-body');
  const tableWrap = card.querySelector('.chart-table');
  card.querySelector('[data-act="toggle"]').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const showTable = btn.getAttribute('aria-pressed') !== 'true';
    btn.setAttribute('aria-pressed', String(showTable));
    btn.innerHTML = showTable ? `${icon('bars', 18)}<span class="sr-only">${t('view_chart')}</span>` : `${icon('table', 18)}<span class="sr-only">${t('view_table')}</span>`;
    btn.title = showTable ? t('view_chart') : t('view_table');
    if (showTable && !tableWrap.childElementCount) tableWrap.appendChild(dataTable({ columns: o.table.columns, rows: o.table.rows, pageSize: 12, compact: true }));
    tableWrap.hidden = !showTable;
    body.hidden = showTable;
  });
  card.querySelector('[data-act="csv"]').addEventListener('click', () => download(`${o.file}.csv`, '﻿' + toCSV(o.table.columns, o.table.rows), 'text/csv;charset=utf-8'));
  card.querySelector('[data-act="svg"]').addEventListener('click', () => {
    const s = exportSVG(body);
    if (s) download(`${o.file}.svg`, s, 'image/svg+xml');
  });
  pending.push(() => o.draw(body));
  return card;
}
/** Dibuixa els gràfics pendents (cal que ja siguin al DOM per conèixer l'amplada). */
export function flushCharts() {
  hideTip();
  while (pending.length) {
    const f = pending.shift();
    try { f(); } catch (err) { console.error(err); }
  }
}

// ---------------------------------------------------------------------------
// KPI / xifres destacades
// ---------------------------------------------------------------------------
export function kpi({ label: lbl, value, delta, deltaGood, context, spark, href }) {
  const tag = href ? 'a' : 'div';
  const el = h(`<${tag} class="kpi"${href ? ` href="${href}"` : ''}>
      <span class="kpi-label">${lbl}</span>
      <span class="kpi-value">${value}</span>
      ${delta !== undefined && delta !== null ? `<span class="kpi-delta ${deltaGood === undefined ? '' : deltaGood ? 'good' : 'bad'}">${delta}</span>` : ''}
      ${context ? `<span class="kpi-context">${context}</span>` : ''}
    </${tag}>`);
  if (spark) el.appendChild(sparkline(spark));
  return el;
}
export function kpiRow(items) {
  const row = h('<div class="kpi-row"></div>');
  items.forEach((i) => row.appendChild(kpi(i)));
  return row;
}
export function delta(cur, prev, { invert = false, pp = false } = {}) {
  if (prev === undefined || prev === null || prev === 0) return { delta: null };
  const d = pp ? cur - prev : ((cur - prev) / Math.abs(prev)) * 100;
  const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
  const txt = pp ? `${sign}${fmt.dec(Math.abs(d))} p.p.` : `${sign}${fmt.dec(Math.abs(d))} %`;
  return { delta: `${d > 0 ? '▲' : d < 0 ? '▼' : '■'} ${txt}`, deltaGood: d === 0 ? undefined : invert ? d < 0 : d > 0 };
}

// ---------------------------------------------------------------------------
// Barra de progrés/compliment
// ---------------------------------------------------------------------------
export function meter(pct, { labelText, status } = {}) {
  const p = Math.max(0, Math.min(100, pct));
  const s = status || (p >= 85 ? 'good' : p >= 60 ? 'warning' : 'critical');
  return `<div class="meter meter-${s}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p)}"${labelText ? ` aria-label="${esc(labelText)}"` : ''}><span style="width:${p}%"></span></div>`;
}

export function statusBadge(code) {
  const map = { publicado: ['ok', 'good'], parcial: ['warn', 'warning'], pendiente: ['x', 'critical'] };
  const [ic, cls] = map[code] || ['info', 'neutral'];
  return `<span class="badge badge-${cls}">${icon(ic, 14)}${label('estado_obligacion', code)}</span>`;
}

// ---------------------------------------------------------------------------
// Taula de dades ordenable i paginada
// ---------------------------------------------------------------------------
/**
 * @param {{columns:{key:string,label:string,format?:(v,row)=>string,html?:boolean,align?:'right'|'left',raw?:(row)=>any,sortValue?:(row)=>any,width?:string}[], rows:any[], pageSize?:number, compact?:boolean, caption?:string, onRow?:(row)=>void, rowKey?:string, emptyText?:string}} o
 */
export function dataTable(o) {
  let sortKey = o.sortKey || null, sortDir = o.sortDir || 1, page = 0;
  const ps = o.pageSize || 15;
  const wrap = h(`<div class="table-wrap${o.compact ? ' compact' : ''}"></div>`);
  const render = () => {
    let rows = o.rows.slice();
    if (sortKey) {
      const col = o.columns.find((c) => c.key === sortKey);
      const val = col.sortValue || col.raw || ((r) => r[sortKey]);
      rows.sort((a, b) => {
        const va = val(a), vb = val(b);
        if (va == null) return 1; if (vb == null) return -1;
        return (typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), lang())) * sortDir;
      });
    }
    const pages = Math.max(1, Math.ceil(rows.length / ps));
    page = Math.min(page, pages - 1);
    const slice = rows.slice(page * ps, page * ps + ps);
    wrap.innerHTML = `
      <div class="table-scroll" tabindex="0" role="region" aria-label="${esc(o.caption || t('data_table'))}">
      <table>
        ${o.caption ? `<caption class="sr-only">${esc(o.caption)}</caption>` : ''}
        <thead><tr>${o.columns.map((c) => `<th scope="col" class="${c.align === 'right' ? 'num' : ''}"${c.width ? ` style="width:${c.width}"` : ''} aria-sort="${sortKey === c.key ? (sortDir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-sort="${c.key}">${c.label}<span class="sort-ind" aria-hidden="true">${sortKey === c.key ? (sortDir > 0 ? '↑' : '↓') : '↕'}</span></button></th>`).join('')}</tr></thead>
        <tbody>${slice.length ? slice.map((r, i) => `<tr${o.onRow ? ` class="clickable" tabindex="0" data-i="${page * ps + i}"` : ''}>${o.columns.map((c) => {
          const v = c.format ? c.format(r[c.key], r) : r[c.key];
          return `<td class="${c.align === 'right' ? 'num' : ''}">${c.html ? (v ?? '') : esc(v ?? '—')}</td>`;
        }).join('')}</tr>`).join('') : `<tr><td colspan="${o.columns.length}" class="empty">${o.emptyText || t('no_results')}</td></tr>`}</tbody>
      </table></div>
      ${pages > 1 ? `<nav class="pager" aria-label="${esc(t('pagination'))}">
        <button type="button" data-page="prev" ${page === 0 ? 'disabled' : ''}>‹ ${t('prev')}</button>
        <span>${t('page')} ${page + 1} / ${pages} · ${fmt.int(rows.length)} ${t('records')}</span>
        <button type="button" data-page="next" ${page >= pages - 1 ? 'disabled' : ''}>${t('next')} ›</button>
      </nav>` : `<p class="table-count">${fmt.int(rows.length)} ${t('records')}</p>`}`;
    wrap._sorted = rows;
  };
  wrap.addEventListener('click', (e) => {
    const sb = e.target.closest('[data-sort]');
    if (sb) { const k = sb.dataset.sort; sortDir = sortKey === k ? -sortDir : 1; sortKey = k; render(); wrap.querySelector(`[data-sort="${k}"]`)?.focus(); return; }
    const pb = e.target.closest('[data-page]');
    if (pb) { page += pb.dataset.page === 'next' ? 1 : -1; render(); wrap.querySelector(`[data-page="${pb.dataset.page}"]`)?.focus(); return; }
    const tr = e.target.closest('tr[data-i]');
    if (tr && o.onRow) o.onRow(wrap._sorted[+tr.dataset.i]);
  });
  wrap.addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (tr && o.onRow && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); o.onRow(wrap._sorted[+tr.dataset.i]); }
  });
  render();
  return wrap;
}

// ---------------------------------------------------------------------------
// Diàleg modal accessible
// ---------------------------------------------------------------------------
export function modal(title, bodyHtml) {
  const dlg = h(`<dialog class="modal" aria-labelledby="modal-title">
      <div class="modal-head"><h2 id="modal-title">${title}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(t('close'))}">${icon('x', 20)}</button></div>
      <div class="modal-body">${bodyHtml}</div></dialog>`);
  document.body.appendChild(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) dlg.close(); });
  dlg.showModal();
  return dlg;
}

export function definitionList(pairs) {
  return `<dl class="deflist">${pairs.filter(([, v]) => v !== undefined).map(([k, v]) => `<div><dt>${k}</dt><dd>${v ?? '—'}</dd></div>`).join('')}</dl>`;
}

// ---------------------------------------------------------------------------
// Controls de filtre (una sola fila sobre els gràfics)
// ---------------------------------------------------------------------------
export function selectControl(id, lbl, options, value) {
  return `<label class="control" for="${id}"><span>${lbl}</span><select id="${id}">${options.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
}
export function sectionHeader({ kicker, title, intro, iconName }) {
  return `<header class="page-head">
    <div class="page-head-inner">
      ${kicker ? `<p class="kicker">${iconName ? icon(iconName, 18) : ''}${kicker}</p>` : ''}
      <h1 id="page-title" tabindex="-1">${title}</h1>
      ${intro ? `<p class="lead">${intro}</p>` : ''}
    </div>
  </header>`;
}
