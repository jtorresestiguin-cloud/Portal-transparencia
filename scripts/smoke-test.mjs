#!/usr/bin/env node
/**
 * Prova de fum: obre totes les seccions en els tres idiomes amb un navegador
 * real (Playwright) i comprova que no hi ha errors de JavaScript, que es
 * dibuixen gràfics i que no hi ha claus de traducció sense resoldre.
 * Requereix Playwright instal·lat (npx playwright install chromium).
 */
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8765;
let chromium;
try { ({ chromium } = await import('playwright')); } catch {
  try { ({ chromium } = createRequire(import.meta.url)('playwright')); } catch { chromium = null; }
}
if (!chromium) {
  console.log('Playwright no disponible: s’omet la prova de navegador.');
  process.exit(0);
}
const server = spawn(process.execPath, [join(ROOT, 'scripts/serve.mjs'), String(PORT)], { stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));

const ROUTES = ['', 'institucio', 'economia', 'contractacio', 'contractacio?any=2025&proc=obert', 'subvencions', 'personal', 'bon-govern', 'activitat', 'dret-acces', 'compliment', 'dades-obertes', 'dades-obertes/contractes', 'accessibilitat'];
const browser = await chromium.launch();
let failures = 0;
for (const lang of ['ca', 'es', 'en']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/tile|leaflet|unpkg|Failed to load resource/i.test(m.text())) errors.push(m.text()); if (m.type() === 'warning' && m.text().includes('[i18n]')) errors.push(m.text()); });
  await page.addInitScript((l) => localStorage.setItem('lang', l), lang);
  for (const r of ROUTES) {
    await page.goto(`http://localhost:${PORT}/#/${r}`);
    await page.waitForFunction(() => document.querySelector('#main .view'), null, { timeout: 10000 }).catch(() => errors.push(`timeout ${r}`));
    await page.waitForTimeout(150);
    const info = await page.evaluate(() => ({
      h1: document.querySelector('#main h1')?.textContent?.trim(),
      charts: document.querySelectorAll('#main svg.chart-svg').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    const ok = info.h1 && !errors.length;
    if (!ok || info.overflow) failures++;
    console.log(`${ok && !info.overflow ? '✓' : '✗'} [${lang}] #/${r.padEnd(34)} h1="${info.h1}" gràfics=${info.charts}${info.overflow ? ' DESBORDAMENT' : ''}`);
    errors.forEach((e) => console.log('    ⚠ ' + e));
    errors.length = 0;
  }
  await page.close();
}
// Mòbil
const mob = await browser.newPage({ viewport: { width: 375, height: 800 } });
for (const r of ['', 'economia', 'contractacio', 'personal', 'activitat', 'dades-obertes/pressupost']) {
  await mob.goto(`http://localhost:${PORT}/#/${r}`);
  await mob.waitForSelector('#main .view');
  await mob.waitForTimeout(150);
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (overflow) failures++;
  console.log(`${overflow ? '✗' : '✓'} [mòbil 375px] #/${r}${overflow ? ' DESBORDAMENT HORITZONTAL' : ''}`);
}
await browser.close();
server.kill();
if (failures) { console.error(`\n✗ ${failures} errors`); process.exit(1); }
console.log('\n✓ Totes les comprovacions superades');
