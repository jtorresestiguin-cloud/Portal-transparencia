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
// Funciones concretas: diagrama de flujos del presupuesto, exportaciones y documentos
{
  const pg = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errs = []; watch(pg, errs);
  await pg.goto(`http://localhost:${PORT}/#/presupuesto`); await pg.waitForSelector('#main .view h1'); await pg.waitForTimeout(800);
  if (!(await pg.locator('[data-chart-label*="De dónde vienen"] svg').count())) errs.push('falta el diagrama de flujos del presupuesto');
  const [dl] = await Promise.all([pg.waitForEvent('download', { timeout: 5000 }).catch(() => null), (async () => { await pg.locator('.chart-actions .export-menu summary').first().click(); await pg.locator('.chart-actions .export-menu [data-f="xlsx"]').first().click(); })()]);
  if (!dl || !(await dl.suggestedFilename()).endsWith('.xlsx')) errs.push('la exportación a Excel no descarga un .xlsx');
  const [pop] = await Promise.all([pg.waitForEvent('popup', { timeout: 5000 }).catch(() => null), (async () => { await pg.locator('.chart-actions .export-menu summary').first().click(); await pg.locator('.chart-actions .export-menu [data-f="pdf"]').first().click(); })()]);
  if (!pop) errs.push('la exportación a PDF no abre una pestaña nueva'); else { await pop.waitForLoadState(); if (!(await pop.locator('table tbody tr').count())) errs.push('la versión PDF no contiene la tabla'); await pop.close(); }
  const xr = await pg.request.get(`http://localhost:${PORT}/data/xlsx/contratos.xlsx`); if (!xr.ok()) errs.push('falta data/xlsx/contratos.xlsx');
  await pg.goto(`http://localhost:${PORT}/#/normativa`); await pg.waitForSelector('#main .view h1'); await pg.waitForTimeout(500);
  const docs = await pg.evaluate(() => [...document.querySelectorAll('.doc-actions a')].map((a) => [a.target, a.hasAttribute('download')]));
  if (docs.length && !docs.some(([t]) => t === '_blank')) errs.push('los documentos no se abren en pestaña nueva');
  if (docs.length && !docs.some(([, d]) => d)) errs.push('los documentos no ofrecen descarga');
  if (errs.length) fails++;
  console.log(`${errs.length ? '✗' : '✓'} [funciones] flujos del presupuesto, Excel, PDF en pestaña nueva, ficheros .xlsx estáticos, documentos (ver/descargar)`);
  errs.forEach((e) => console.log('    ⚠ ' + e));
  await pg.close();
}
// Editor visual
const ed = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const edErr = []; watch(ed, edErr);
ed.on('dialog', (d) => d.dismiss());
await ed.goto(`http://localhost:${PORT}/admin/`);
// Inicio de gestión
await ed.waitForSelector('.ed-dash', { timeout: 15000 }).catch(() => edErr.push('el editor no muestra el inicio de gestión'));
if (!(await ed.locator('.ed-attention li, .ed-dash p').count())) edErr.push('el inicio no muestra avisos');
// Páginas y bloques (modo sencillo: resumen guiado y condiciones)
await ed.click('[data-tab="paginas"]'); await ed.waitForTimeout(300);
await ed.click('[data-page="subvenciones"]'); await ed.waitForSelector('.ed-block', { timeout: 15000 }).catch(() => edErr.push('el editor no muestra bloques'));
const dataBlock = await ed.evaluate(() => [...document.querySelectorAll('.ed-block')].findIndex((b) => /gr[aá]fico|tabla|cifras/i.test(b.querySelector('.ed-bname').textContent)));
await ed.click(`.ed-block[data-i="${Math.max(0, dataBlock)}"]`); await ed.waitForTimeout(600);
if (!(await ed.locator('#ed-props .ed-summary').count())) edErr.push('falta el resumen guiado del componente');
if (await ed.locator('#ed-props .ed-field code').count()) edErr.push('el modo sencillo muestra nombres técnicos');
// Datos: tabla, registro, importación CSV con validación
await ed.click('[data-tab="datos"]'); await ed.click('[data-ds="cargos"]'); await ed.waitForTimeout(400); await ed.click('tr[data-r="0"] td:nth-child(2)');
// Subida de la foto del cargo (imagen PNG generada al vuelo)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
await ed.setInputFiles('#ed-props .ed-upload input[type=file] >> nth=0', { name: 'foto alcaldesa.png', mimeType: 'image/png', buffer: png });
await ed.waitForTimeout(500);
const fotoVal = await ed.evaluate(() => [...document.querySelectorAll('#ed-props input[type=text]')].map((i) => i.value).find((v) => v.startsWith('archivos/cargos/')));
if (!fotoVal) edErr.push('la subida de la foto no asigna la ruta archivos/cargos/…');
await ed.click('#d-imp'); await ed.setInputFiles('#csv-file', { name: 'cargos.csv', mimeType: 'text/csv', buffer: Buffer.from('nombre;cargo;fecha_nombramiento\nPersona de prueba;Concejal;01/02/2024\nOtra;Concejala;fecha mala\n') });
await ed.waitForSelector('#csv-prev [data-mode]', { timeout: 5000 }).catch(() => edErr.push('la importación CSV no muestra la vista previa'));
if (!(await ed.locator('#csv-prev .ed-chk-error').count())) edErr.push('la importación CSV no detecta la fecha errónea');
await ed.click('#csv-prev [data-mode="valid"]'); await ed.waitForTimeout(300);
// Revisar y publicar: cambios, comprobaciones y vista previa
await ed.click('#ed-publish'); await ed.waitForSelector('#pub-checks .ed-checklist', { timeout: 15000 }).catch(() => edErr.push('no se ejecutan las comprobaciones previas'));
if (!(await ed.locator('#pub-changes li').count())) edErr.push('no se resume el cambio');
if (!(await ed.locator('#pub-changes li', { hasText: 'Archivo nuevo' }).count())) edErr.push('el archivo subido no aparece en los cambios a publicar');
await ed.click('#pub-prev'); await ed.waitForTimeout(2500);
const prevOk = await ed.evaluate(() => { const f = document.querySelector('.ed-prev-dlg iframe'); return !!f?.contentDocument?.querySelector('main h1'); });
if (!prevOk) edErr.push('la vista previa no carga el portal');
await ed.keyboard.press('Escape'); await ed.keyboard.press('Escape');
await ed.click('[data-tab="entidad"]'); await ed.waitForTimeout(400);
if (!(await ed.locator('#ent-cr .ed-chk').count())) edErr.push('falta la comprobación de contraste de colores');
await ed.selectOption('#ed-mode', 'avanzado'); await ed.waitForTimeout(300);
await ed.click('[data-tab="sync"]'); await ed.waitForTimeout(400);
const nb = await ed.evaluate(() => document.querySelectorAll('.ed-block').length);
if (edErr.length) fails++;
console.log(`${edErr.length ? '✗' : '✓'} [editor] inicio, páginas (modo sencillo), datos e importación CSV, revisar y publicar, vista previa, contraste y fuentes`);
edErr.forEach((e) => console.log('    ⚠ ' + e));
void nb;
await browser.close();
server.kill();
if (fails) { console.error(`\n✗ ${fails} fallos`); process.exit(1); }
console.log('\n✓ Todas las comprobaciones superadas');
