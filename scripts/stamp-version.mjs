// Añade ?v=<versión> a los módulos JS y hojas de estilo propios para que, tras
// publicar, el navegador no mezcle ficheros nuevos con otros guardados en caché.
// Se ejecuta solo en el despliegue (no modifica el repositorio).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const v = (process.env.VERSION || Date.now().toString(36)).slice(0, 12);
const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) { if (f !== 'vendor') walk(p); } else if (extname(p) === '.js') files.push(p); } };
walk('assets/js'); walk('admin');
files.push('index.html', 'admin/index.html');

const rel = String.raw`(\.{1,2}\/[^'"?#]+?\.(?:js|css))`;
const rules = [
  new RegExp(String.raw`(\bfrom\s*['"])${rel}(['"])`, 'g'),
  new RegExp(String.raw`(\bimport\(\s*['"])${rel}(['"])`, 'g'),
  new RegExp(String.raw`(\b(?:src|href)=")((?:\.{1,2}\/)?(?:assets\/|editor)[^"?#]*?\.(?:js|css))(")`, 'g'),
];
let n = 0;
for (const f of files) {
  let s = readFileSync(f, 'utf8');
  for (const re of rules) s = s.replace(re, (_, a, p, b) => { n++; return `${a}${p}?v=${v}${b}`; });
  writeFileSync(f, s);
}
console.log(`Versión ${v}: ${n} referencias en ${files.length} ficheros`);
