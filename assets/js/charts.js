/**
 * charts.js — Llibreria mínima de gràfics SVG, sense dependències.
 *
 * Principis (vegeu docs/ARQUITECTURA.md):
 *  - Colors per rol via variables CSS (--s1…--s8, --seq-*), validats per a
 *    daltonisme i amb versió específica per al mode fosc.
 *  - Marques fines: barres ≤ 24px amb extrem arrodonit, línies de 2px.
 *  - Sempre hi ha un tooltip en passar el ratolí / focus de teclat, i cada
 *    gràfic té una vista de taula alternativa (la proporciona ui.js).
 *  - Responsius: es tornen a dibuixar quan canvia l'amplada del contenidor.
 */

const NS = 'http://www.w3.org/2000/svg';
export const SERIES = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)', 'var(--s7)', 'var(--s8)'];

// ---------------------------------------------------------------------------
// Utilitats
// ---------------------------------------------------------------------------
function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null) continue;
    if (k === 'style') el.setAttribute('style', v);
    else if (k === 'text') el.textContent = v;
    else el.setAttribute(k, v);
  }
  if (parent) parent.appendChild(el);
  return el;
}

function niceStep(range, count) {
  const raw = range / Math.max(1, count);
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}
export function niceScale(min, max, count = 5) {
  if (min === max) { max = min + 1; }
  const step = niceStep(max - min, count);
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min: lo, max: hi, ticks };
}

/** Text measurement for collision-aware labels */
let measureCtx;
function textWidth(str, size = 12) {
  measureCtx ||= document.createElement('canvas').getContext('2d');
  measureCtx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  return measureCtx.measureText(String(str)).width;
}

/** Rounded-top bar path (4px radius at data end, square at baseline). */
function barPath(x, y, w, h, horizontal = false, r = 4) {
  if (w <= 0 || h <= 0) return '';
  if (!horizontal) {
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  }
  r = Math.min(r, h / 2, w);
  return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
}

// ---------------------------------------------------------------------------
// Tooltip compartit
// ---------------------------------------------------------------------------
let tipEl;
function tip() {
  if (!tipEl) {
    tipEl = document.createElement('div');
    tipEl.className = 'chart-tooltip';
    tipEl.setAttribute('role', 'status');
    tipEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(tipEl);
  }
  return tipEl;
}
export function showTip(html, evt, anchorEl) {
  const t = tip();
  t.innerHTML = html;
  t.style.display = 'block';
  let x, y;
  if (evt && evt.clientX !== undefined && evt.type !== 'focus') { x = evt.clientX; y = evt.clientY; }
  else if (anchorEl) { const r = anchorEl.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top; }
  const tw = t.offsetWidth, th = t.offsetHeight;
  let left = x + 14, top = y - th - 12;
  if (left + tw > window.innerWidth - 8) left = x - tw - 14;
  if (top < 8) top = y + 18;
  t.style.left = `${Math.max(8, left)}px`;
  t.style.top = `${top}px`;
}
export function hideTip() { if (tipEl) tipEl.style.display = 'none'; }

function tipRow(color, label, value) {
  return `<div class="tt-row"><span class="tt-key" style="background:${color}"></span><span class="tt-label">${label}</span><span class="tt-val">${value}</span></div>`;
}
function bindTip(el, htmlFn) {
  el.setAttribute('tabindex', '0');
  el.addEventListener('pointermove', (e) => showTip(htmlFn(), e));
  el.addEventListener('pointerleave', hideTip);
  el.addEventListener('focus', (e) => showTip(htmlFn(), e, el));
  el.addEventListener('blur', hideTip);
}

// ---------------------------------------------------------------------------
// Muntatge responsiu
// ---------------------------------------------------------------------------
const observers = new WeakMap();
function mount(container, draw, ariaLabel) {
  container.classList.add('chart');
  container.innerHTML = '';
  const plot = document.createElement('div');
  plot.className = 'chart-plot';
  container.appendChild(plot);
  const render = () => {
    const width = Math.max(260, container.clientWidth || 600);
    const svg = draw(width);
    svg.setAttribute('role', 'img');
    const name = ariaLabel || container.closest('[data-chart-label]')?.dataset.chartLabel;
    if (name) svg.setAttribute('aria-label', name);
    plot.replaceChildren(svg);
  };
  render();
  if (observers.has(container)) observers.get(container).disconnect();
  let last = container.clientWidth;
  const ro = new ResizeObserver(() => {
    if (Math.abs(container.clientWidth - last) > 4) { last = container.clientWidth; render(); }
  });
  ro.observe(container);
  observers.set(container, ro);
}

function newSvg(width, height) {
  return svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'chart-svg', preserveAspectRatio: 'xMinYMin meet' });
}

function legend(container, items) {
  if (items.length < 2) return;
  const lg = document.createElement('ul');
  lg.className = 'chart-legend';
  lg.innerHTML = items.map((it) => `<li><span class="lg-key${it.line ? ' lg-line' : ''}" style="background:${it.color}"></span>${it.name}</li>`).join('');
  container.prepend(lg);
}

// ---------------------------------------------------------------------------
// Barres horitzontals (rànquings, categories amb etiquetes llargues)
// ---------------------------------------------------------------------------
/**
 * @param {HTMLElement} container
 * @param {{data:{label:string,value:number,color?:string,note?:string}[], format:(n)=>string, color?:string, ariaLabel?:string, onClick?:(d)=>void, maxLabel?:number}} o
 */
export function hBar(container, o) {
  const data = o.data;
  const fmt = o.format || String;
  mount(container, (W) => {
    const barH = 18, gap = 12, row = barH + gap;
    const labelW = Math.min(o.maxLabel || 220, Math.max(...data.map((d) => textWidth(d.label))) + 12, W * 0.42);
    const valueW = Math.max(...data.map((d) => textWidth(fmt(d.value)))) + 12;
    const H = data.length * row + 8;
    const svg = newSvg(W, H);
    const x0 = labelW, plotW = W - labelW - valueW;
    const max = Math.max(...data.map((d) => d.value), 0) || 1;
    data.forEach((d, i) => {
      const y = 4 + i * row;
      const g = svgEl('g', { class: 'mark-group' + (o.onClick ? ' clickable' : '') }, svg);
      let label = d.label;
      while (textWidth(label) > labelW - 12 && label.length > 4) label = label.slice(0, -2);
      if (label !== d.label) label = label.trimEnd() + '…';
      svgEl('text', { x: labelW - 10, y: y + barH / 2 + 4, 'text-anchor': 'end', class: 'tick-label', text: label }, g);
      const w = Math.max(1, (d.value / max) * plotW);
      svgEl('rect', { x: x0, y: y - gap / 2, width: plotW + valueW, height: row, class: 'hit' }, g);
      svgEl('path', { d: barPath(x0, y, w, barH, true), style: `fill:${d.color || o.color || SERIES[0]}`, class: 'bar' }, g);
      svgEl('text', { x: x0 + w + 6, y: y + barH / 2 + 4, class: 'value-label', text: fmt(d.value) }, g);
      bindTip(g, () => `<strong>${d.label}</strong>${tipRow(d.color || o.color || SERIES[0], o.valueName || '', fmt(d.value))}${d.note ? `<div class="tt-note">${d.note}</div>` : ''}`);
      if (o.onClick) g.addEventListener('click', () => o.onClick(d));
    });
    return svg;
  }, o.ariaLabel);
}

// ---------------------------------------------------------------------------
// Columnes (simples, agrupades o apilades)
// ---------------------------------------------------------------------------
/**
 * @param {{categories:string[], series:{name:string,values:number[],color?:string}[], stacked?:boolean, format:(n)=>string, axisFormat?:(n)=>string, height?:number, refLine?:{value:number,label:string}, ariaLabel?:string, highlightLast?:boolean}} o
 */
export function columns(container, o) {
  const fmt = o.format || String;
  const axisFmt = o.axisFormat || fmt;
  const series = o.series.map((s, i) => ({ ...s, color: s.color || SERIES[i] }));
  mount(container, (W) => {
    const H = o.height || 280;
    const svg = newSvg(W, H);
    const cats = o.categories;
    const totals = cats.map((_, ci) => o.stacked ? series.reduce((s, se) => s + (se.values[ci] || 0), 0) : Math.max(...series.map((se) => se.values[ci] || 0)));
    const sc = niceScale(0, Math.max(...totals, o.refLine?.value || 0) || 1, 5);
    const leftW = Math.max(...sc.ticks.map((t) => textWidth(axisFmt(t), 11))) + 10;
    const bandEst = (W - leftW - 8) / cats.length;
    const wrapLbl = (c) => {
      if (textWidth(c, 11) <= bandEst - 6 || !c.includes(' ')) return [c];
      const words = c.split(' ');
      let best = [c], bestW = Infinity;
      for (let i = 1; i < words.length; i++) {
        const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
        const w = Math.max(textWidth(a, 11), textWidth(b, 11));
        if (w < bestW) { bestW = w; best = [a, b]; }
      }
      return best;
    };
    const wrapped = cats.map(wrapLbl);
    const twoLines = wrapped.some((l) => l.length > 1);
    const m = { t: 14, r: 8, b: twoLines ? 40 : 26, l: leftW };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const y = (v) => m.t + ph - (v / sc.max) * ph;
    // grid
    sc.ticks.forEach((t) => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'baseline' : 'grid' }, svg);
      svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'axis-label', text: axisFmt(t) }, svg);
    });
    const band = pw / cats.length;
    const groupW = Math.min(band * 0.72, o.stacked ? 28 : 24 * series.length + 2 * (series.length - 1));
    const barW = o.stacked ? groupW : Math.min(24, (groupW - 2 * (series.length - 1)) / series.length);
    // x labels: skip to avoid collisions
    const maxLabelW = Math.max(...wrapped.flat().map((c) => textWidth(c, 11))) + 2;
    const every = Math.max(1, Math.ceil(maxLabelW / band));
    cats.forEach((c, ci) => {
      const cx = m.l + band * ci + band / 2;
      if (ci % every === 0 || ci === cats.length - 1 && (cats.length - 1) % every > every / 2) {
        const tx = svgEl('text', { x: cx, y: H - m.b + 18, 'text-anchor': 'middle', class: 'axis-label' }, svg);
        wrapped[ci].forEach((ln, li) => svgEl('tspan', { x: cx, dy: li ? 13 : 0, text: ln }, tx));
      }
      const g = svgEl('g', { class: 'mark-group' }, svg);
      svgEl('rect', { x: m.l + band * ci, y: m.t, width: band, height: ph, class: 'hit' }, g);
      if (o.stacked) {
        let acc = 0;
        const nonZero = series.map((s, si) => ({ s, si, v: s.values[ci] || 0 })).filter((d) => d.v > 0);
        nonZero.forEach(({ s, v }, k) => {
          const y1 = y(acc + v), y0 = y(acc);
          const top = k === nonZero.length - 1;
          const hgt = Math.max(0, y0 - y1 - (k > 0 ? 2 : 0));
          const yy = y1;
          if (top) svgEl('path', { d: barPath(cx - barW / 2, yy, barW, hgt), style: `fill:${s.color}`, class: 'bar' }, g);
          else svgEl('rect', { x: cx - barW / 2, y: yy, width: barW, height: hgt, style: `fill:${s.color}`, class: 'bar' }, g);
          acc += v;
        });
      } else {
        series.forEach((s, si) => {
          const v = s.values[ci] || 0;
          const x = cx - (barW * series.length + 2 * (series.length - 1)) / 2 + si * (barW + 2);
          const isLast = o.highlightLast && ci === cats.length - 1;
          svgEl('path', { d: barPath(x, y(v), barW, y(0) - y(v)), style: `fill:${s.color}${o.highlightLast && !isLast ? ';opacity:.55' : ''}`, class: 'bar' }, g);
        });
      }
      bindTip(g, () => `<strong>${c}</strong>` + series.map((s) => tipRow(s.color, s.name, fmt(s.values[ci] || 0))).join('') +
        (o.stacked && series.length > 1 ? `<div class="tt-total">Total <b>${fmt(totals[ci])}</b></div>` : ''));
    });
    if (o.refLine) {
      const yy = y(o.refLine.value);
      svgEl('line', { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: 'ref-line' }, svg);
      svgEl('text', { x: W - m.r, y: yy - 6, 'text-anchor': 'end', class: 'ref-label', text: o.refLine.label }, svg);
    }
    return svg;
  }, o.ariaLabel);
  legend(container, series.map((s) => ({ name: s.name, color: s.color })));
}

// ---------------------------------------------------------------------------
// Línies (sèries temporals) amb creu i tooltip
// ---------------------------------------------------------------------------
/**
 * @param {{x:string[], series:{name:string,values:(number|null)[],color?:string}[], format, axisFormat?, xLabel?:(s)=>string, height?:number, area?:boolean, ariaLabel?:string, zeroBased?:boolean}} o
 */
export function lines(container, o) {
  const fmt = o.format || String;
  const axisFmt = o.axisFormat || fmt;
  const xLabel = o.xLabel || ((s) => s);
  const series = o.series.map((s, i) => ({ ...s, color: s.color || SERIES[i] }));
  mount(container, (W) => {
    const H = o.height || 280;
    const svg = newSvg(W, H);
    const all = series.flatMap((s) => s.values).filter((v) => v !== null && v !== undefined);
    const sc = niceScale(o.zeroBased === false ? Math.min(...all) : 0, Math.max(...all), 5);
    const leftW = Math.max(...sc.ticks.map((t) => textWidth(axisFmt(t), 11))) + 10;
    const m = { t: 14, r: 16, b: 26, l: leftW };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;
    const n = o.x.length;
    const x = (i) => m.l + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
    const y = (v) => m.t + ph - ((v - sc.min) / (sc.max - sc.min)) * ph;
    sc.ticks.forEach((t) => {
      svgEl('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === sc.min ? 'baseline' : 'grid' }, svg);
      svgEl('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end', class: 'axis-label', text: axisFmt(t) }, svg);
    });
    // x ticks: pick ~ every k
    const lw = Math.max(...o.x.map((s) => textWidth(xLabel(s), 11))) + 16;
    const every = o.xEvery || Math.max(1, Math.ceil((lw * n) / pw));
    o.x.forEach((s, i) => {
      if (i % every !== 0) return;
      svgEl('text', { x: x(i), y: H - 8, 'text-anchor': i === 0 ? 'start' : 'middle', class: 'axis-label', text: xLabel(s) }, svg);
    });
    series.forEach((s) => {
      let d = '', started = false;
      s.values.forEach((v, i) => {
        if (v === null || v === undefined) { started = false; return; }
        d += `${started ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        started = true;
      });
      if (o.area && series.length === 1) {
        const firstI = s.values.findIndex((v) => v != null);
        let lastI = s.values.length - 1; while (lastI > 0 && s.values[lastI] == null) lastI--;
        svgEl('path', { d: `${d}L${x(lastI)},${y(sc.min)}L${x(firstI)},${y(sc.min)}Z`, style: `fill:${s.color};opacity:.1` }, svg);
      }
      svgEl('path', { d, class: 'line', style: `stroke:${s.color}` }, svg);
      // end dot
      let li = s.values.length - 1; while (li > 0 && s.values[li] == null) li--;
      if (s.values[li] != null) svgEl('circle', { cx: x(li), cy: y(s.values[li]), r: 4, class: 'dot', style: `fill:${s.color}` }, svg);
    });
    // crosshair layer
    const cross = svgEl('line', { y1: m.t, y2: m.t + ph, class: 'crosshair', style: 'display:none' }, svg);
    const dots = series.map((s) => svgEl('circle', { r: 4, class: 'dot', style: `fill:${s.color};display:none` }, svg));
    const overlay = svgEl('rect', { x: m.l, y: m.t, width: pw, height: ph, class: 'hit', tabindex: 0 }, svg);
    let focusI = n - 1;
    const showAt = (i, evt) => {
      i = Math.max(0, Math.min(n - 1, i));
      focusI = i;
      cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.style.display = '';
      series.forEach((s, si) => {
        const v = s.values[i];
        if (v == null) { dots[si].style.display = 'none'; return; }
        dots[si].setAttribute('cx', x(i)); dots[si].setAttribute('cy', y(v)); dots[si].style.display = '';
      });
      showTip(`<strong>${xLabel(o.x[i], true)}</strong>` + series.map((s) => tipRow(s.color, s.name, s.values[i] == null ? '—' : fmt(s.values[i]))).join(''), evt, dots.find((d) => d.style.display !== 'none') || overlay);
    };
    const hide = () => { cross.style.display = 'none'; dots.forEach((d) => (d.style.display = 'none')); hideTip(); };
    overlay.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      showAt(Math.round(((px - m.l) / pw) * (n - 1)), e);
    });
    overlay.addEventListener('pointerleave', hide);
    overlay.addEventListener('focus', () => showAt(focusI));
    overlay.addEventListener('blur', hide);
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { showAt(focusI - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { showAt(focusI + 1); e.preventDefault(); }
    });
    return svg;
  }, o.ariaLabel);
  legend(container, series.map((s) => ({ name: s.name, color: s.color, line: true })));
}

// ---------------------------------------------------------------------------
// Sankey simplificat: fonts d'ingrés → pressupost → programes de despesa
// ---------------------------------------------------------------------------
export function sankey(container, o) {
  const fmt = o.format || String;
  mount(container, (W) => {
    const narrow = W < 560;
    const H = o.height || (narrow ? 420 : 380);
    const svg = newSvg(W, H);
    const nodeW = 12, gap = 10;
    const leftTotal = o.left.reduce((s, d) => s + d.value, 0);
    const rightTotal = o.right.reduce((s, d) => s + d.value, 0);
    const total = Math.max(leftTotal, rightTotal);
    const labelSpace = narrow ? 0 : Math.min(200, W * 0.24);
    const xL = labelSpace, xC = W / 2 - nodeW / 2, xR = W - labelSpace - nodeW;
    const usableL = H - 20 - gap * (o.left.length - 1);
    const usableR = H - 20 - gap * (o.right.length - 1);
    const k = Math.min(usableL, usableR) / total;
    const centerH = total * k;
    const centerY = (H - centerH) / 2;
    // centre node
    svgEl('rect', { x: xC, y: centerY, width: nodeW, height: centerH, rx: 2, class: 'sankey-center' }, svg);
    const drawSide = (items, side) => {
      let yy = 10, cy = centerY;
      const used = items.reduce((s, d) => s + d.value * k, 0) + gap * (items.length - 1);
      yy = (H - used) / 2;
      items.forEach((d, i) => {
        const h = Math.max(1, d.value * k);
        const color = d.color || SERIES[i % SERIES.length];
        const xn = side === 'L' ? xL : xR;
        const g = svgEl('g', { class: 'mark-group' }, svg);
        // link
        const x1 = side === 'L' ? xL + nodeW : xC + nodeW, x2 = side === 'L' ? xC : xR;
        const ya1 = side === 'L' ? yy : cy, yb1 = side === 'L' ? cy : yy;
        const mx = (x1 + x2) / 2;
        svgEl('path', {
          d: `M${x1},${ya1}C${mx},${ya1} ${mx},${yb1} ${x2},${yb1}L${x2},${yb1 + h}C${mx},${yb1 + h} ${mx},${ya1 + h} ${x1},${ya1 + h}Z`,
          class: 'sankey-link', style: `fill:${color}`,
        }, g);
        svgEl('rect', { x: xn, y: yy, width: nodeW, height: h, rx: 2, style: `fill:${color}`, class: 'bar' }, g);
        if (!narrow) {
          const tx = side === 'L' ? xL - 8 : xR + nodeW + 8;
          const anchor = side === 'L' ? 'end' : 'start';
          let label = d.name;
          while (textWidth(label, 12) > labelSpace - 14 && label.length > 4) label = label.slice(0, -2);
          if (label !== d.name) label = label.trimEnd() + '…';
          svgEl('text', { x: tx, y: yy + h / 2 - (h > 26 ? 3 : -4), 'text-anchor': anchor, class: 'tick-label', text: label }, g);
          if (h > 26) svgEl('text', { x: tx, y: yy + h / 2 + 12, 'text-anchor': anchor, class: 'axis-label', text: fmt(d.value) }, g);
        }
        bindTip(g, () => `<strong>${d.name}</strong>${tipRow(color, o.sideLabels?.[side] || '', fmt(d.value))}<div class="tt-note">${((d.value / (side === 'L' ? leftTotal : rightTotal)) * 100).toFixed(1).replace('.', ',')} %</div>`);
        yy += h + gap; cy += h;
      });
    };
    drawSide(o.left, 'L');
    drawSide(o.right, 'R');
    if (o.centerLabel) {
      const lbl = svgEl('text', { x: xC + nodeW / 2, y: centerY - 6, 'text-anchor': 'middle', class: 'tick-label strong', text: o.centerLabel }, svg);
      lbl.setAttribute('paint-order', 'stroke');
    }
    return svg;
  }, o.ariaLabel);
  if (container.clientWidth < 560) {
    legend(container, [...o.left, ...o.right].map((d, i) => ({ name: d.name, color: d.color || SERIES[i % SERIES.length] })));
  }
}

// ---------------------------------------------------------------------------
// Treemap (algorisme squarified)
// ---------------------------------------------------------------------------
function squarify(items, x, y, w, h) {
  const out = [];
  const total = items.reduce((s, d) => s + d.value, 0);
  const scale = (w * h) / total;
  let rest = items.map((d) => ({ ...d, area: d.value * scale })).sort((a, b) => b.area - a.area);
  const worst = (row, len) => {
    const s = row.reduce((a, d) => a + d.area, 0);
    const mx = Math.max(...row.map((d) => d.area)), mn = Math.min(...row.map((d) => d.area));
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
  };
  while (rest.length) {
    const len = Math.min(w, h);
    let row = [rest[0]], i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) { row.push(rest[i]); i++; }
    const s = row.reduce((a, d) => a + d.area, 0);
    const thick = s / len;
    let off = 0;
    for (const d of row) {
      const l = d.area / thick;
      if (w >= h) out.push({ ...d, x, y: y + off, w: thick, h: l });
      else out.push({ ...d, x: x + off, y, w: l, h: thick });
      off += l;
    }
    if (w >= h) { x += thick; w -= thick; } else { y += thick; h -= thick; }
    rest = rest.slice(i);
  }
  return out;
}
export function treemap(container, o) {
  const fmt = o.format || String;
  mount(container, (W) => {
    const H = o.height || 320;
    const svg = newSvg(W, H);
    const total = o.data.reduce((s, d) => s + d.value, 0);
    const cells = squarify(o.data.map((d, i) => ({ ...d, color: d.color || SERIES[i % SERIES.length] })), 0, 0, W, H);
    for (const c of cells) {
      const g = svgEl('g', { class: 'mark-group' }, svg);
      svgEl('rect', { x: c.x + 1, y: c.y + 1, width: Math.max(0, c.w - 2), height: Math.max(0, c.h - 2), rx: 4, style: `fill:${c.color}`, class: 'bar' }, g);
      const pct = `${((c.value / total) * 100).toFixed(1).replace('.', ',')} %`;
      const ink = c.ink || '#fff';
      if (c.w > 70 && c.h > 40) {
        let label = c.name;
        while (textWidth(label, 13) > c.w - 16 && label.length > 4) label = label.slice(0, -2);
        if (label !== c.name) label = label.trimEnd() + '…';
        svgEl('text', { x: c.x + 9, y: c.y + 20, class: 'cell-label', style: `fill:${ink}`, text: label }, g);
        { const vt = textWidth(`${fmt(c.value)} · ${pct}`, 12) <= c.w - 16 ? `${fmt(c.value)} · ${pct}` : textWidth(fmt(c.value), 12) <= c.w - 16 ? fmt(c.value) : ''; if (vt) svgEl('text', { x: c.x + 9, y: c.y + 37, class: 'cell-value', style: `fill:${ink}`, text: vt }, g); }
      }
      bindTip(g, () => `<strong>${c.name}</strong>${tipRow(c.color, '', fmt(c.value))}<div class="tt-note">${pct}</div>`);
      if (o.onClick) { g.classList.add('clickable'); g.addEventListener('click', () => o.onClick(c)); } // la alternativa de teclado es la lista de áreas bajo el gráfico
    }
    return svg;
  }, o.ariaLabel);
}

// ---------------------------------------------------------------------------
// Mapa de calor (p. ex. any × mes)
// ---------------------------------------------------------------------------
export function heatmap(container, o) {
  const fmt = o.format || String;
  mount(container, (W) => {
    const labelW = Math.max(...o.rows.map((r) => textWidth(r, 11))) + 12;
    const cw = (W - labelW) / o.cols.length;
    const ch = Math.min(34, Math.max(18, cw * 0.7));
    const H = o.rows.length * ch + 24;
    const svg = newSvg(W, H);
    const vals = o.values.flat().filter((v) => v != null);
    const min = Math.min(...vals), max = Math.max(...vals);
    const ramp = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)', 'var(--seq-6)', 'var(--seq-7)'];
    const step = (v) => Math.min(ramp.length - 1, Math.floor(((v - min) / (max - min || 1)) * ramp.length));
    o.cols.forEach((c, ci) => {
      if (cw < 26 && ci % 2) return;
      svgEl('text', { x: labelW + cw * ci + cw / 2, y: 12, 'text-anchor': 'middle', class: 'axis-label', text: c }, svg);
    });
    o.rows.forEach((r, ri) => {
      svgEl('text', { x: labelW - 8, y: 20 + ri * ch + ch / 2 + 4, 'text-anchor': 'end', class: 'axis-label', text: r }, svg);
      o.cols.forEach((c, ci) => {
        const v = o.values[ri][ci];
        if (v == null) return;
        const g = svgEl('g', { class: 'mark-group' }, svg);
        const s = step(v);
        svgEl('rect', { x: labelW + cw * ci + 1, y: 20 + ri * ch + 1, width: cw - 2, height: ch - 2, rx: 3, style: `fill:${ramp[s]}`, class: 'bar' }, g);
        bindTip(g, () => `<strong>${(o.cellLabel || ((a, b) => `${b} ${a}`))(r, c)}</strong>${tipRow(ramp[s], o.valueName || '', fmt(v))}`);
      });
    });
    return svg;
  }, o.ariaLabel);
  const lg = document.createElement('div');
  lg.className = 'ramp-legend';
  lg.innerHTML = `<span>${o.lowLabel || '−'}</span>${[1, 2, 3, 4, 5, 6, 7].map((i) => `<i style="background:var(--seq-${i})"></i>`).join('')}<span>${o.highLabel || '+'}</span>`;
  container.appendChild(lg);
}

// ---------------------------------------------------------------------------
// Piràmide (p. ex. edat × sexe)
// ---------------------------------------------------------------------------
export function pyramid(container, o) {
  const fmt = o.format || String;
  mount(container, (W) => {
    const barH = 20, gap = 10, row = barH + gap;
    const H = o.bands.length * row + 30;
    const svg = newSvg(W, H);
    const mid = W / 2, labelW = 64;
    const max = Math.max(...o.left.values, ...o.right.values) || 1;
    const half = mid - labelW / 2 - 50;
    const cl = o.left.color || SERIES[0], cr = o.right.color || SERIES[1];
    svgEl('text', { x: mid - labelW / 2 - 4, y: 12, 'text-anchor': 'end', class: 'tick-label strong', text: o.left.name }, svg);
    svgEl('text', { x: mid + labelW / 2 + 4, y: 12, class: 'tick-label strong', text: o.right.name }, svg);
    o.bands.slice().reverse().forEach((b, ri) => {
      const i = o.bands.length - 1 - ri;
      const y = 24 + ri * row;
      const g = svgEl('g', { class: 'mark-group' }, svg);
      svgEl('rect', { x: 0, y: y - gap / 2, width: W, height: row, class: 'hit' }, g);
      svgEl('text', { x: mid, y: y + barH / 2 + 4, 'text-anchor': 'middle', class: 'axis-label', text: b }, g);
      const wl = (o.left.values[i] / max) * half, wr = (o.right.values[i] / max) * half;
      const xl = mid - labelW / 2 - wl;
      // left bar: rounded on the left end (data end)
      if (wl > 0) {
        const r = Math.min(4, barH / 2, wl);
        svgEl('path', { d: `M${mid - labelW / 2},${y}H${xl + r}Q${xl},${y} ${xl},${y + r}V${y + barH - r}Q${xl},${y + barH} ${xl + r},${y + barH}H${mid - labelW / 2}Z`, style: `fill:${cl}`, class: 'bar' }, g);
      }
      svgEl('path', { d: barPath(mid + labelW / 2, y, wr, barH, true), style: `fill:${cr}`, class: 'bar' }, g);
      svgEl('text', { x: xl - 6, y: y + barH / 2 + 4, 'text-anchor': 'end', class: 'value-label', text: fmt(o.left.values[i]) }, g);
      svgEl('text', { x: mid + labelW / 2 + wr + 6, y: y + barH / 2 + 4, class: 'value-label', text: fmt(o.right.values[i]) }, g);
      bindTip(g, () => `<strong>${b}</strong>${tipRow(cl, o.left.name, fmt(o.left.values[i]))}${tipRow(cr, o.right.name, fmt(o.right.values[i]))}`);
    });
    return svg;
  }, o.ariaLabel);
  legend(container, [{ name: o.left.name, color: o.left.color || SERIES[0] }, { name: o.right.name, color: o.right.color || SERIES[1] }]);
}

// ---------------------------------------------------------------------------
// Rang (mínim–màxim) amb marcadors per a dues mitjanes
// ---------------------------------------------------------------------------
export function rangeDots(container, o) {
  const fmt = o.format || String;
  mount(container, (W) => {
    const row = 34;
    const labelW = Math.min(200, Math.max(...o.data.map((d) => textWidth(d.label))) + 14);
    const H = o.data.length * row + 34;
    const svg = newSvg(W, H);
    const all = o.data.flatMap((d) => [d.min, d.max]);
    const sc = niceScale(Math.min(...all) * 0.9, Math.max(...all), 5);
    const m = { l: labelW, r: 20 };
    const x = (v) => m.l + ((v - sc.min) / (sc.max - sc.min)) * (W - m.l - m.r);
    sc.ticks.forEach((t) => {
      svgEl('line', { x1: x(t), x2: x(t), y1: 6, y2: H - 22, class: 'grid' }, svg);
      svgEl('text', { x: x(t), y: H - 6, 'text-anchor': 'middle', class: 'axis-label', text: (o.axisFormat || fmt)(t) }, svg);
    });
    const ca = o.markers[0].color || SERIES[0], cb = o.markers[1].color || SERIES[1];
    o.data.forEach((d, i) => {
      const y = 12 + i * row + row / 2 - 6;
      const g = svgEl('g', { class: 'mark-group' }, svg);
      svgEl('rect', { x: 0, y: y - row / 2, width: W, height: row, class: 'hit' }, g);
      svgEl('text', { x: labelW - 10, y: y + 4, 'text-anchor': 'end', class: 'tick-label', text: d.label }, g);
      svgEl('rect', { x: x(d.min), y: y - 4, width: Math.max(2, x(d.max) - x(d.min)), height: 8, rx: 4, class: 'range-track' }, g);
      svgEl('circle', { cx: x(d.a), cy: y, r: 5.5, class: 'dot', style: `fill:${ca}` }, g);
      svgEl('circle', { cx: x(d.b), cy: y, r: 5.5, class: 'dot', style: `fill:${cb}` }, g);
      bindTip(g, () => `<strong>${d.label}</strong>${tipRow('var(--range-track)', o.rangeName || '', `${fmt(d.min)} – ${fmt(d.max)}`)}${tipRow(ca, o.markers[0].name, fmt(d.a))}${tipRow(cb, o.markers[1].name, fmt(d.b))}${d.note ? `<div class="tt-note">${d.note}</div>` : ''}`);
    });
    return svg;
  }, o.ariaLabel);
  legend(container, [{ name: o.markers[0].name, color: o.markers[0].color || SERIES[0] }, { name: o.markers[1].name, color: o.markers[1].color || SERIES[1] }]);
}

// ---------------------------------------------------------------------------
// Sparkline (per a targetes KPI)
// ---------------------------------------------------------------------------
export function sparkline(values, { width = 120, height = 32 } = {}) {
  const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width, height, class: 'sparkline', 'aria-hidden': 'true' });
  const v = values.filter((n) => n != null);
  const min = Math.min(...v), max = Math.max(...v);
  const x = (i) => 2 + (i / (values.length - 1)) * (width - 6);
  const y = (n) => height - 3 - ((n - min) / (max - min || 1)) * (height - 6);
  const d = values.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join('');
  svgEl('path', { d, class: 'spark-line' }, svg);
  svgEl('circle', { cx: x(values.length - 1), cy: y(values[values.length - 1]), r: 3, class: 'spark-dot' }, svg);
  return svg;
}

// ---------------------------------------------------------------------------
// Calendari d'activitat (estil "contribucions")
// ---------------------------------------------------------------------------
export function calendar(container, o) {
  // o.counts: Map 'YYYY-MM-DD' -> n ; o.from, o.to (ISO)
  mount(container, (W) => {
    const start = new Date(o.from + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7)); // dilluns
    const end = new Date(o.to + 'T00:00:00Z');
    const weeks = Math.ceil((end - start) / (7 * 864e5)) + 1;
    const labelW = 26;
    const cell = Math.min(16, Math.max(7, (W - labelW) / weeks - 2));
    const H = 7 * (cell + 2) + 22;
    const svg = newSvg(W, H);
    const max = Math.max(1, ...o.counts.values());
    const ramp = ['var(--cal-0)', 'var(--seq-2)', 'var(--seq-4)', 'var(--seq-6)'];
    (o.dayLabels || ['L', '', 'X', '', 'V', '', '']).forEach((l, i) => l && svgEl('text', { x: 0, y: 20 + i * (cell + 2) + cell - 1, class: 'axis-label', text: l }, svg));
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(start.getTime() + (w * 7 + d) * 864e5);
        if (date > end) break;
        const key = date.toISOString().slice(0, 10);
        const n = o.counts.get(key) || 0;
        if (d === 0 && date.getUTCMonth() !== lastMonth) {
          lastMonth = date.getUTCMonth();
          if (w < weeks - 2) svgEl('text', { x: labelW + w * (cell + 2), y: 11, class: 'axis-label', text: o.monthLabels[lastMonth] }, svg);
        }
        const g = svgEl('g', { class: 'mark-group' }, svg);
        svgEl('rect', { x: labelW + w * (cell + 2), y: 18 + d * (cell + 2), width: cell, height: cell, rx: 2, style: `fill:${ramp[n === 0 ? 0 : Math.min(3, Math.ceil((n / max) * 3))]}`, class: 'bar' }, g);
        if (n) bindTip(g, () => `<strong>${o.dateFormat(key)}</strong><div>${o.itemsFor(key)}</div>`);
      }
    }
    return svg;
  }, o.ariaLabel);
}

// ---------------------------------------------------------------------------
// Exportació SVG amb colors resolts (per descarregar el gràfic)
// ---------------------------------------------------------------------------
export function exportSVG(container) {
  const svg = container.querySelector('svg.chart-svg');
  if (!svg) return null;
  const clone = svg.cloneNode(true);
  const src = svg.querySelectorAll('*');
  const dst = clone.querySelectorAll('*');
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    const props = ['fill', 'stroke', 'stroke-width', 'opacity', 'font-size', 'font-weight', 'font-family', 'fill-opacity'];
    dst[i].setAttribute('style', props.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  clone.setAttribute('xmlns', NS);
  const bg = getComputedStyle(document.body).getPropertyValue('--surface').trim();
  clone.insertBefore(svgEl('rect', { width: '100%', height: '100%', style: `fill:${bg}` }), clone.firstChild);
  return new XMLSerializer().serializeToString(clone);
}
