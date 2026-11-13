#!/usr/bin/env node
/**
 * Prueba de humo en navegador real (Playwright): recorre todas las páginas del
 * portal en los tres idiomas y en móvil, y abre el editor visual. Comprueba que
 * no hay errores de JavaScript, claves sin traducir ni desbordamiento horizontal.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try { ({ chromium } = await import('playwright')); } catch { try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { /* */ } }
if (!chromium) { console.log('Playwright no disponible: se omite la prueba de navegador.'); process.exit(0); }
const PORT = 8765;
const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const portal = JSON.parse(readFileSync(join(ROOT, 'content/portal.json'), 'utf8'));
const ROUTES = ['', ...portal.categorias.map((c) => `categoria/${c.id}`), ...portal.categorias.flatMap((c) => c.paginas), 'accesibilidad', 'datos/contratos', 'contratos?anio=2025&proc=9', 'contratos?vista=estadisticas', 'contratos?vista=riesgo', 'presupuesto?area=1', 'agenda?cargo_id=C01', 'buscar?q=sueldos', 'buscar?q=zzzz', 'buscar', 'pagina-inexistente'];
const browser = await chromium.launch();
let fails = 0;
const watch = (page, errors) => {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { const tx = m.text(); if ((m.type() === 'error' && !/tile\.openstreetmap|Failed to load resource/i.test(tx)) || tx.includes('[i18n]')) errors.push(tx); });
};
for (const lang of ['es', 'va', 'en']) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const errors = []; watch(page, errors);
  await page.addInitScript((l) => localStorage.setItem('lang', l), lang);
  for (const r of ROUTES) {
    await page.goto(`http://localhost:${PORT}/#/${r}`);
    await page.waitForFunction(() => document.querySelector('#main .view h1'), null, { timeout: 15000 }).catch(() => errors.push('sin título'));
    await page.waitForTimeout(120);
    const info = await page.evaluate(() => ({ h1: document.querySelector('#main h1')?.textContent?.trim(), charts: document.querySelectorAll('#main svg.chart-svg').length, overflow: document.documentElement.scrollWidth > innerWidth + 1, unknown: document.body.innerText.includes('Componente desconocido') }));
    const ok = info.h1 && !errors.length && !info.overflow && !info.unknown;
    if (!ok) fails++;
    console.log(`${ok ? '✓' : '✗'} [${lang}] #/${r.padEnd(30)} «${info.h1}» gráficos=${info.charts}${info.overflow ? ' DESBORDA' : ''}`);
    errors.splice(0).forEach((e) => console.log('    ⚠ ' + e));
  }
  await page.close();
}
for (const width of [320, 375, 768]) {
const mob = await browser.newPage({ viewport: { width, height: 800 } });
for (const r of ['', 'categoria/contratacion', 'contratos', 'cargos', 'presupuesto', 'datos/cargos', 'buscar?q=contratos', 'normativa', 'sobre-los-datos']) {
  await mob.goto(`http://localhost:${PORT}/#/${r}`);
  await mob.waitForSelector('#main .view h1');
  await mob.waitForTimeout(150);
  const o = await mob.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  if (o) fails++;
  console.log(`${o ? '✗' : '✓'} [${width}px] #/${r}${o ? ' DESBORDA' : ''}`);
}
await mob.close();
}
// Editor visual
const ed = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const edErr = []; watch(ed, edErr);
ed.on('dialog', (d) => d.dismiss());
await ed.goto(`http://localhost:${PORT}/admin/`);
await ed.waitForSelector('.ed-block', { timeout: 15000 }).catch(() => edErr.push('el editor no muestra bloques'));
await ed.click('[data-page="subvenciones"]'); await ed.waitForTimeout(800);
await ed.click('.ed-block[data-i="3"]'); await ed.waitForTimeout(400);
await ed.click('[data-tab="datos"]'); await ed.click('[data-ds="cargos"]'); await ed.waitForTimeout(400); await ed.click('tr[data-r="0"]');
await ed.click('[data-tab="entidad"]'); await ed.waitForTimeout(400);
await ed.click('[data-tab="sync"]'); await ed.waitForTimeout(400);
const nb = await ed.evaluate(() => document.querySelectorAll('.ed-block').length);
if (edErr.length) fails++;
console.log(`${edErr.length ? '✗' : '✓'} [editor] carga, edición de página, datos, entidad y fuentes`);
edErr.forEach((e) => console.log('    ⚠ ' + e));
void nb;
await browser.close();
server.kill();
if (fails) { console.error(`\n✗ ${fails} fallos`); process.exit(1); }
console.log('\n✓ Todas las comprobaciones superadas');
