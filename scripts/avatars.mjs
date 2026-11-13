/**
 * Genera retratos ilustrados de ejemplo (SVG) para los cargos de los datos de demostración.
 * Son ilustraciones deterministas por identificador, no fotografías: sirven para ver el diseño
 * y se sustituyen por las fotos oficiales desde el editor (Datos → Cargos → Subir imagen).
 *
 *   node scripts/avatars.mjs            → assets/img/cargos/<id>.svg y actualiza data/cargos.json
 */
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets/img/cargos');

function rng(seed) { let h = 2166136261; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h += 0x6d2b79f5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const SKIN = ['#f6d7c3', '#eac0a1', '#d9a47f', '#c18a63', '#9c6a48', '#74492f'];
const HAIR = ['#2b1d16', '#4a3123', '#6b4a2f', '#a5764b', '#d8b46a', '#8c8c8c', '#1c1c1c'];
const BG = ['#e8eef7', '#eef3ea', '#f6ece6', '#efe9f5', '#e6f1f2', '#f4efe2'];
const CLOTH = ['#2f3e56', '#5b2a35', '#33524a', '#4a4a4a', '#6d5a3a', '#264c7a', '#7a2f2f'];

export function avatarSVG(id) {
  const r = rng(id); const p = (a) => a[Math.floor(r() * a.length)];
  const skin = p(SKIN), hair = p(HAIR), bg = p(BG), cloth = p(CLOTH);
  const style = Math.floor(r() * 5), glasses = r() < 0.3, beard = r() < 0.2, shirt = r() < 0.5 ? '#ffffff' : '#e9e4d8';
  const hairBack = style === 2 ? `<path d="M52 78c-6 30 0 58 6 66h84c6-8 12-36 6-66-6-26-26-40-48-40s-42 14-48 40z" fill="${hair}"/>` : style === 4 ? `<path d="M56 74c-4 22-2 40 4 50h80c6-10 8-28 4-50-6-22-24-34-44-34S62 52 56 74z" fill="${hair}"/>` : '';
  const hairTop = [
    `<path d="M62 84c0-26 16-40 38-40s38 14 38 40c-8-12-22-18-38-18s-30 6-38 18z" fill="${hair}"/>`,
    `<path d="M60 88c-2-30 16-46 40-46s42 16 40 46c-6-16-12-20-18-22-10 6-30 8-48 2-6 4-10 10-14 20z" fill="${hair}"/>`,
    `<path d="M60 92c-4-32 14-50 40-50s44 18 40 50c-10-20-26-28-40-28s-30 8-40 28z" fill="${hair}"/>`,
    `<path d="M66 70c8-18 22-24 34-24s26 6 34 24c-12-6-22-8-34-8s-22 2-34 8z" fill="${hair}"/>`,
    `<path d="M60 90c-2-30 16-48 40-48s42 18 40 48c-14-14-26-20-40-20-10 0-20 4-26 10-4-4-8-4-14 10z" fill="${hair}"/>`,
  ][style];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="Retrato ilustrado de ejemplo">
<title>Retrato ilustrado de ejemplo (no es una fotografía)</title>
<rect width="200" height="200" fill="${bg}"/>${hairBack}
<path d="M30 200c4-36 32-56 70-56s66 20 70 56z" fill="${cloth}"/>
<path d="M86 146l14 22 14-22-14-6z" fill="${shirt}"/>
<rect x="88" y="120" width="24" height="28" rx="10" fill="${skin}"/>
<ellipse cx="100" cy="94" rx="36" ry="42" fill="${skin}"/>
<ellipse cx="64" cy="98" rx="6" ry="9" fill="${skin}"/><ellipse cx="136" cy="98" rx="6" ry="9" fill="${skin}"/>
${hairTop}
<ellipse cx="86" cy="96" rx="3.6" ry="4.2" fill="#2a2522"/><ellipse cx="114" cy="96" rx="3.6" ry="4.2" fill="#2a2522"/>
<path d="M79 86q7-4 14 0M107 86q7-4 14 0" stroke="${hair}" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M100 100q-3 10 2 12" stroke="#00000033" stroke-width="2.4" fill="none" stroke-linecap="round"/>
<path d="M88 118q12 8 24 0" stroke="#8a4b3c" stroke-width="3" fill="none" stroke-linecap="round"/>
${beard ? `<path d="M70 108c4 22 16 30 30 30s26-8 30-30c-6 10-16 14-30 14s-24-4-30-14z" fill="${hair}" opacity=".85"/>` : ''}
${glasses ? '<g fill="none" stroke="#2a2522" stroke-width="2.6"><circle cx="86" cy="96" r="11"/><circle cx="114" cy="96" r="11"/><path d="M97 96h6"/></g>' : ''}
</svg>
`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  mkdirSync(OUT, { recursive: true });
  const path = join(ROOT, 'data/cargos.json');
  const env = JSON.parse(readFileSync(path, 'utf8'));
  let n = 0;
  for (const c of env.datos) {
    if (c.foto && !c.foto.startsWith('assets/img/cargos/')) continue; // respeta las fotos reales ya subidas
    writeFileSync(join(OUT, `${c.id}.svg`), avatarSVG(c.id));
    c.foto = `assets/img/cargos/${c.id}.svg`; n++;
  }
  writeFileSync(path, JSON.stringify(env, null, 1) + '\n');
  console.log(`✓ ${n} retratos ilustrados en assets/img/cargos/`);
}
