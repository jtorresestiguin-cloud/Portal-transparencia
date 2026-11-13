/**
 * sesion.js — Inicio de sesión del panel de gestión.
 *
 * El portal es estático (GitHub Pages): no hay servidor que guarde contraseñas. La identidad
 * la valida GitHub. Para entrar hace falta un token de acceso de una cuenta con permiso de
 * escritura en el repositorio del portal (y, si se configura, estar en la lista de personas
 * autorizadas de config/entidad.json → github.usuarios_autorizados).
 *
 * - Rol según el permiso en GitHub: admin → Administración; maintain → Publicación;
 *   write → Edición (en este caso se propone «Enviar a revisión» al publicar).
 * - La sesión caduca tras 8 horas sin actividad. «Recordar» la guarda en este navegador;
 *   si no, se borra al cerrar la pestaña.
 * - En un servidor local (localhost) se ofrece «Entrar en modo de prueba» sin publicar.
 */
import { esc } from '../assets/js/ui.js';

const KEY = 'ed-gh';
const IDLE_MS = 8 * 3600e3;
const ROLES = { admin: 'Administración', maintain: 'Publicación', push: 'Edición' };
const LOCAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
const remembered = () => { try { return !!localStorage.getItem(KEY); } catch { return false; } };
function write(s, remember) {
  try {
    const v = JSON.stringify(s);
    if (remember) { localStorage.setItem(KEY, v); sessionStorage.removeItem(KEY); } else { sessionStorage.setItem(KEY, v); localStorage.removeItem(KEY); }
  } catch { /* sin almacenamiento */ }
}
export function logout() { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* */ } location.reload(); }
export function touch() { const s = read(); if (s?.user) { s.last = Date.now(); write(s, remembered()); } }
export const current = () => read();

async function gh(token, path) {
  const r = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } });
  if (r.status === 401) throw new Error('El token no es válido o ha caducado.');
  if (r.status === 404) throw new Error('No se encuentra el repositorio o el token no tiene acceso a él.');
  if (!r.ok) throw new Error(`GitHub respondió ${r.status}.`);
  return r.json();
}

/** Valida el token contra GitHub y devuelve la sesión. */
async function verify(token, cfg) {
  const repo = cfg.github?.repositorio;
  if (!repo) throw new Error('Falta el repositorio en config/entidad.json (github.repositorio).');
  const [user, rp] = await Promise.all([gh(token, '/user'), gh(token, `/repos/${repo}`)]);
  const perm = rp.permissions || {};
  const nivel = perm.admin ? 'admin' : perm.maintain ? 'maintain' : perm.push ? 'push' : null;
  if (!nivel) throw new Error(`La cuenta ${user.login} no tiene permiso de escritura en ${repo}. Pide a quien administre el repositorio que te añada como colaborador.`);
  const lista = (cfg.github?.usuarios_autorizados || []).map((x) => String(x).toLowerCase());
  if (lista.length && !lista.includes(user.login.toLowerCase())) throw new Error(`La cuenta ${user.login} no está en la lista de personas autorizadas del portal.`);
  return { repo, branch: cfg.github?.rama || 'main', token, user: { login: user.login, name: user.name || user.login, avatar: user.avatar_url }, nivel, rol: ROLES[nivel], modo: nivel === 'push' ? 'revision' : undefined, last: Date.now() };
}

/**
 * Muestra la pantalla de acceso si no hay una sesión válida. Resuelve con la sesión.
 * @param {object} cfg config/entidad.json
 */
export async function gate(cfg) {
  const s = read();
  if (s?.user && s.token && Date.now() - (s.last || 0) < IDLE_MS) {
    // Revalida en segundo plano (token revocado, permisos retirados…)
    verify(s.token, cfg).then((n) => write({ ...s, ...n, modo: s.modo ?? n.modo }, remembered())).catch((e) => { if (/válido|permiso|autorizadas|repositorio/.test(e.message)) logout(); });
    return s;
  }
  if (s?.local && LOCAL) return s;
  if (s) { try { localStorage.removeItem(KEY); sessionStorage.removeItem(KEY); } catch { /* */ } }
  return new Promise((resolve) => {
    document.body.classList.add('ed-locked');
    const box = document.createElement('div');
    box.className = 'ed-login';
    box.innerHTML = `<main class="ed-login-card" aria-labelledby="lg-t">
      <img src="${esc(new URL('../' + (cfg.escudo || 'assets/img/escudo.svg'), location.href).href)}" alt="" width="48" height="58">
      <h1 id="lg-t">Gestión del Portal de Transparencia</h1>
      <p class="ed-hint">${esc(cfg.nombre?.es || '')}</p>
      <form id="lg-f" novalidate>
        <label class="ed-field"><span>Token de acceso de GitHub</span><input type="password" id="lg-tok" autocomplete="current-password" required aria-describedby="lg-help lg-err" placeholder="github_pat_…"></label>
        <label class="ed-check-line"><input type="checkbox" id="lg-rem"> Mantener la sesión en este navegador (no en equipos compartidos)</label>
        <p id="lg-err" class="ed-chk-error" role="alert"></p>
        <button type="submit" class="btn" id="lg-go">Entrar</button>
        ${LOCAL ? '<button type="button" class="btn-ghost" id="lg-local">Entrar en modo de prueba (solo en este equipo, sin publicar)</button>' : ''}
      </form>
      <details id="lg-help" class="ed-login-help"><summary>¿Cómo obtengo el token?</summary>
        <ol><li>Entra en GitHub con tu cuenta (debe ser colaboradora del repositorio <strong>${esc(cfg.github?.repositorio || '')}</strong>).</li>
        <li>Abre <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Crear token de grano fino</a>.</li>
        <li>En <em>Repository access</em> elige solo este repositorio y en <em>Permissions</em>: <strong>Contents: Read and write</strong>, <strong>Pull requests: Read and write</strong> y, para lanzar la sincronización, <strong>Actions: Read and write</strong>.</li>
        <li>Genera el token, cópialo y pégalo aquí. Caduca en la fecha que elijas; después, crea otro igual.</li></ol>
        <p>Tu identidad y tus permisos los comprueba GitHub: el portal no guarda contraseñas. La sesión se cierra tras 8 horas sin actividad.</p></details>
    </main>`;
    document.body.appendChild(box);
    const tok = box.querySelector('#lg-tok'), err = box.querySelector('#lg-err'), go = box.querySelector('#lg-go');
    tok.focus();
    box.querySelector('#lg-f').addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      if (!tok.value.trim()) { err.textContent = 'Introduce el token.'; tok.focus(); return; }
      go.disabled = true; go.textContent = 'Comprobando con GitHub…';
      try {
        const ses = await verify(tok.value.trim(), cfg);
        write(ses, box.querySelector('#lg-rem').checked);
        box.remove(); document.body.classList.remove('ed-locked');
        resolve(ses);
      } catch (ex) { err.textContent = ex.message; go.disabled = false; go.textContent = 'Entrar'; tok.select(); }
    });
    box.querySelector('#lg-local')?.addEventListener('click', () => {
      const ses = { local: true, user: { login: 'prueba', name: 'Modo de prueba local' }, rol: 'Prueba local', repo: cfg.github?.repositorio, branch: cfg.github?.rama || 'main', token: '' };
      write(ses, false); box.remove(); document.body.classList.remove('ed-locked'); resolve(ses);
    });
  });
}

/** Indicador de usuario en la barra superior con «Cerrar sesión». */
export function userBadge(host, ses, hasChanges = () => false) {
  const el = document.createElement('div');
  el.className = 'ed-user';
  el.innerHTML = `${ses.user?.avatar ? `<img src="${esc(ses.user.avatar)}" alt="" width="26" height="26">` : ''}<span><strong>${esc(ses.user?.name || '')}</strong><small>${esc(ses.rol || '')}</small></span><button type="button" class="btn-ghost" id="ed-logout">Cerrar sesión</button>`;
  el.querySelector('#ed-logout').addEventListener('click', () => { if (!hasChanges() || confirm('Tienes cambios sin publicar. Se conservarán como borrador en este navegador. ¿Cerrar sesión?')) logout(); });
  host.appendChild(el);
  ['click', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { clearTimeout(userBadge.t); userBadge.t = setTimeout(touch, 2000); }));
  setInterval(() => { const s = read(); if (s && !s.local && Date.now() - (s.last || 0) > IDLE_MS) logout(); }, 60e3);
}
