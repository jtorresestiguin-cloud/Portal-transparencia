/**
 * i18n.js — Internacionalización: castellano (es), valenciano (va) e inglés (en).
 *  - t(clave): textos comunes de la interfaz.
 *  - tr(es, va, en): textos de una vista, escritos junto al código.
 *  - pick({es, va, en}): textos multilingües que vienen de contenidos o configuración.
 *  - label(lista, código): etiquetas de las listas de códigos (data/codelists.json).
 */
export const LANGS = ['es', 'va', 'en'];
export const HTML_LANG = { es: 'es', va: 'ca-ES-valencia', en: 'en' };
let current = 'es';
let codelists = {};

export const lang = () => current;
export const setLang = (l) => { current = LANGS.includes(l) ? l : 'es'; document.documentElement.lang = HTML_LANG[current]; };
export const setCodelists = (c) => { codelists = c; };
export const getCodelists = () => codelists;
export const pick = (obj) => {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return String(obj);
  return obj[current] || obj.es || obj.va || Object.values(obj).find(Boolean) || '';
};
export const tr = (es, va, en) => (current === 'va' ? va : current === 'en' ? en : es) ?? es;
export const label = (list, code) => {
  if (code === null || code === undefined || code === '') return '—';
  const entry = codelists[list]?.[code];
  return entry ? pick(entry) : String(code);
};
export const codes = (list) => Object.keys(codelists[list] || {});

const S = {
  portal_name: ['Portal de Transparencia', 'Portal de Transparència', 'Transparency Portal'],
  skip: ['Saltar al contenido', 'Salta al contingut', 'Skip to content'],
  home: ['Inicio', 'Inici', 'Home'],
  menu: ['Menú', 'Menú', 'Menu'],
  topics: ['Temas', 'Temes', 'Topics'],
  search: ['Buscar', 'Cerca', 'Search'],
  search_placeholder: ['Busca contratos, cargos, subvenciones, datos…', 'Cerca contractes, càrrecs, subvencions, dades…', 'Search contracts, officials, grants, data…'],
  search_hint: ['Usa las flechas para moverte por los resultados e Intro para abrir uno.', 'Usa les fletxes per a moure’t pels resultats i Intro per a obrir-ne un.', 'Use arrow keys to move through results and Enter to open one.'],
  search_results: ['Resultados de la búsqueda', 'Resultats de la cerca', 'Search results'],
  search_suggest: ['Escribe al menos dos letras. Prueba «limpieza», «alcaldía» o un NIF.', 'Escriu almenys dues lletres. Prova «neteja», «alcaldia» o un NIF.', 'Type at least two letters. Try “cleaning”, “mayor” or a tax ID.'],
  type_page: ['Página', 'Pàgina', 'Page'],
  type_category: ['Categoría', 'Categoria', 'Category'],
  type_dataset: ['Conjunto de datos', 'Conjunt de dades', 'Dataset'],
  type_obligation: ['Obligación', 'Obligació', 'Obligation'],
  type_record: ['Registro', 'Registre', 'Record'],
  toggle_theme: ['Cambiar entre tema claro y oscuro', 'Canviar entre tema clar i fosc', 'Toggle light/dark theme'],
  language: ['Idioma', 'Idioma', 'Language'],
  lang_es: ['Castellano', 'Castellà', 'Spanish'],
  lang_va: ['Valenciano', 'Valencià', 'Valencian'],
  lang_en: ['Inglés', 'Anglés', 'English'],
  demo_banner: ['Prototipo: los datos mostrados son de ejemplo y no son cifras oficiales.', 'Prototip: les dades mostrades són d’exemple i no són xifres oficials.', 'Prototype: data shown is sample data, not official figures.'],
  demo_more: ['Más información', 'Més informació', 'Learn more'],
  categories: ['Categorías', 'Categories', 'Categories'],
  pages: ['páginas', 'pàgines', 'pages'],
  see: ['Ver', 'Veure', 'See'],
  footer_license: ['Contenidos y datos bajo licencia', 'Continguts i dades sota llicència', 'Content and data licensed under'],
  footer_interop: ['Datos y API', 'Dades i API', 'Data & API'],
  footer_portal: ['El portal', 'El portal', 'The portal'],
  feed: ['Novedades (Atom)', 'Novetats (Atom)', 'Updates (Atom)'],
  editor: ['Gestión de contenidos', 'Gestió de continguts', 'Content management'],
  filters: ['Filtros', 'Filtres', 'Filters'],
  all: ['Todos', 'Tots', 'All'],
  yes: ['Sí', 'Sí', 'Yes'],
  no: ['No', 'No', 'No'],
  source: ['Fuente', 'Font', 'Source'],
  dataset: ['conjunto de datos', 'conjunt de dades', 'dataset'],
  records: ['registros', 'registres', 'records'],
  record: ['registro', 'registre', 'record'],
  updated: ['Actualizado', 'Actualitzat', 'Updated'],
  no_results: ['No hay resultados con estos criterios.', 'No hi ha resultats amb aquests criteris.', 'No results match these criteria.'],
  data_table: ['Tabla de datos', 'Taula de dades', 'Data table'],
  pagination: ['Paginación', 'Paginació', 'Pagination'],
  prev: ['Anterior', 'Anterior', 'Previous'],
  next: ['Siguiente', 'Següent', 'Next'],
  page: ['Página', 'Pàgina', 'Page'],
  close: ['Cerrar', 'Tancar', 'Close'],
  chart_actions: ['Acciones del gráfico', 'Accions del gràfic', 'Chart actions'],
  view_table: ['Mostrar como tabla', 'Mostrar com a taula', 'Show as table'],
  view_chart: ['Mostrar el gráfico', 'Mostrar el gràfic', 'Show chart'],
  download_csv: ['Descargar los datos (CSV)', 'Descarregar les dades (CSV)', 'Download data (CSV)'],
  download_svg: ['Descargar el gráfico (SVG)', 'Descarregar el gràfic (SVG)', 'Download chart (SVG)'],
  not_found: ['No hemos encontrado esta página', 'No hem trobat aquesta pàgina', 'Page not found'],
  back_home: ['Volver al inicio', 'Tornar a l’inici', 'Back to home'],
  error_title: ['No se han podido cargar los datos', 'No s’han pogut carregar les dades', 'Data could not be loaded'],
  error_hint: ['Si abres el portal como fichero local, sírvelo con un servidor web («npm start»).', 'Si obris el portal com a fitxer local, serveix-lo amb un servidor web («npm start»).', 'If you opened the portal as a local file, serve it with a web server (“npm start”).'],
  obligations_here: ['Obligaciones de publicidad activa de esta página', 'Obligacions de publicitat activa d’aquesta pàgina', 'Disclosure obligations on this page'],
};

export function t(key) {
  const e = S[key];
  if (!e) { console.warn('[i18n] clave sin traducción:', key); return key; }
  return e[LANGS.indexOf(current)] ?? e[0];
}
