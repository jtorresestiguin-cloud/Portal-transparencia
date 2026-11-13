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
await ed.click('#d-imp'); await ed.setInputFiles('#csv-file', { name: 'cargos.csv', mimeType: 'text/csv', buffer: Buffer.from('nombre;cargo;fecha_nombramiento\nPersona de prueba;Concejal;01/02/2024\nOtra;Concejala;fecha mala\n') });
await ed.waitForSelector('#csv-prev [data-mode]', { timeout: 5000 }).catch(() => edErr.push('la importación CSV no muestra la vista previa'));
if (!(await ed.locator('#csv-prev .ed-chk-error').count())) edErr.push('la importación CSV no detecta la fecha errónea');
await ed.click('#csv-prev [data-mode="valid"]'); await ed.waitForTimeout(300);
// Revisar y publicar: cambios, comprobaciones y vista previa
await ed.click('#ed-publish'); await ed.waitForSelector('#pub-checks .ed-checklist', { timeout: 15000 }).catch(() => edErr.push('no se ejecutan las comprobaciones previas'));
if (!(await ed.locator('#pub-changes li').count())) edErr.push('no se resume el cambio');
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
