/**
 * i18n.js — Internacionalització (català, castellà, anglès).
 *  - t(key): textos de la interfície comuna.
 *  - tr(ca, es, en): textos específics d'una vista, escrits al costat del codi.
 *  - label(llista, codi): etiquetes de les llistes de codis (data/codelists.json).
 */
export const LANGS = ['ca', 'es', 'en'];
let current = 'ca';
let codelists = {};

export const lang = () => current;
export const setLang = (l) => { current = LANGS.includes(l) ? l : 'ca'; document.documentElement.lang = current; };
export const setCodelists = (c) => { codelists = c; };
export const getCodelists = () => codelists;
export const pick = (obj) => (obj ? obj[current] ?? obj.ca ?? Object.values(obj)[0] : '');
export const tr = (ca, es, en) => (current === 'es' ? es : current === 'en' ? en : ca) ?? ca;
export const label = (list, code) => {
  const entry = codelists[list]?.[code];
  return entry ? pick(entry) : String(code ?? '—');
};
export const codes = (list) => Object.keys(codelists[list] || {});

const S = {
  site_title: ['Portal de Transparència · Consorci de Turisme de Barcelona', 'Portal de Transparencia · Consorci de Turisme de Barcelona', 'Transparency Portal · Barcelona Tourism Consortium'],
  org_name: ['Consorci de Turisme de Barcelona', 'Consorci de Turisme de Barcelona', 'Barcelona Tourism Consortium'],
  portal_name: ['Portal de Transparència', 'Portal de Transparencia', 'Transparency Portal'],
  skip: ['Salta al contingut', 'Saltar al contenido', 'Skip to content'],
  menu: ['Menú', 'Menú', 'Menu'],
  search: ['Cerca', 'Buscar', 'Search'],
  search_placeholder: ['Cerca contractes, dades, obligacions…', 'Busca contratos, datos, obligaciones…', 'Search contracts, data, obligations…'],
  search_hint: ['Fes servir les fletxes per moure’t pels resultats i Retorn per obrir-ne un.', 'Usa las flechas para moverte por los resultados e Intro para abrir uno.', 'Use arrow keys to move through results and Enter to open one.'],
  search_results: ['Resultats de la cerca', 'Resultados de la búsqueda', 'Search results'],
  search_suggest: ['Escriu almenys dues lletres. Prova «publicitat», «congressos» o un NIF.', 'Escribe al menos dos letras. Prueba «publicidad», «congresos» o un NIF.', 'Type at least two letters. Try “marketing”, “conference” or a tax ID.'],
  search_type_section: ['Secció', 'Sección', 'Section'],
  search_type_dataset: ['Conjunt de dades', 'Conjunto de datos', 'Dataset'],
  search_type_obligation: ['Obligació', 'Obligación', 'Obligation'],
  search_type_contract: ['Contracte', 'Contrato', 'Contract'],
  search_type_grant: ['Subvenció', 'Subvención', 'Grant'],
  search_type_agreement: ['Conveni', 'Convenio', 'Agreement'],
  toggle_theme: ['Canvia entre tema clar i fosc', 'Cambiar entre tema claro y oscuro', 'Toggle light/dark theme'],
  language: ['Idioma', 'Idioma', 'Language'],
  lang_ca: ['Català', 'Catalán', 'Catalan'],
  lang_es: ['Castellà', 'Castellano', 'Spanish'],
  lang_en: ['Anglès', 'Inglés', 'English'],
  demo_banner: ['Prototip: les dades mostrades són d’exemple i no són xifres oficials.', 'Prototipo: los datos mostrados son de ejemplo y no son cifras oficiales.', 'Prototype: data shown is sample data, not official figures.'],
  demo_more: ['Més informació', 'Más información', 'Learn more'],
  nav_institucio: ['Institució', 'Institución', 'Organisation'],
  nav_economia: ['Pressupost i economia', 'Presupuesto y economía', 'Budget & finance'],
  nav_contractacio: ['Contractació', 'Contratación', 'Procurement'],
  nav_subvencions: ['Subvencions i convenis', 'Subvenciones y convenios', 'Grants & agreements'],
  nav_personal: ['Personal', 'Personal', 'Staff'],
  'nav_bon-govern': ['Bon govern', 'Buen gobierno', 'Good governance'],
  nav_activitat: ['Activitat i turisme', 'Actividad y turismo', 'Activity & tourism'],
  'nav_dret-acces': ['Dret d’accés', 'Derecho de acceso', 'Right of access'],
  nav_compliment: ['Índex de compliment', 'Índice de cumplimiento', 'Compliance index'],
  'nav_dades-obertes': ['Dades obertes', 'Datos abiertos', 'Open data'],
  nav_accessibilitat: ['Sobre el portal i accessibilitat', 'Sobre el portal y accesibilidad', 'About & accessibility'],
  intro_institucio: ['Qui som, qui ens governa, com ens organitzem i quines normes ens regeixen.', 'Quiénes somos, quién nos gobierna, cómo nos organizamos y qué normas nos rigen.', 'Who we are, who governs us, how we are organised and which rules apply.'],
  intro_economia: ['D’on surten els ingressos, en què es gasten i quin grau d’execució té el pressupost.', 'De dónde salen los ingresos, en qué se gastan y qué grado de ejecución tiene el presupuesto.', 'Where revenue comes from, what it is spent on and how the budget is executed.'],
  intro_contractacio: ['Tots els contractes adjudicats, amb indicadors de competència i integritat.', 'Todos los contratos adjudicados, con indicadores de competencia e integridad.', 'All contracts awarded, with competition and integrity indicators.'],
  intro_subvencions: ['Ajuts atorgats, beneficiaris, retorn als barris i convenis de col·laboració.', 'Ayudas concedidas, beneficiarios, retorno a los barrios y convenios de colaboración.', 'Grants awarded, beneficiaries, neighbourhood returns and collaboration agreements.'],
  intro_personal: ['Plantilla, igualtat de gènere, temporalitat i retribucions.', 'Plantilla, igualdad de género, temporalidad y retribuciones.', 'Workforce, gender equality, temporary contracts and pay.'],
  'intro_bon-govern': ['Retribucions i declaracions de la direcció, agenda, grups d’interès i regals.', 'Retribuciones y declaraciones de la dirección, agenda, grupos de interés y regalos.', 'Management pay and declarations, diary, lobby meetings and gifts.'],
  intro_activitat: ['Objectius estratègics, indicadors turístics de la ciutat i serveis al visitant.', 'Objetivos estratégicos, indicadores turísticos de la ciudad y servicios al visitante.', 'Strategic goals, city tourism indicators and visitor services.'],
  'intro_dret-acces': ['Com demanar informació i com responem les sol·licituds.', 'Cómo pedir información y cómo respondemos las solicitudes.', 'How to request information and how we respond.'],
  intro_compliment: ['Autoavaluació pública de cada obligació de la Llei de transparència.', 'Autoevaluación pública de cada obligación de la Ley de transparencia.', 'Public self-assessment of every transparency obligation.'],
  'intro_dades-obertes': ['Catàleg de dades descarregables, API i estàndards d’interoperabilitat.', 'Catálogo de datos descargables, API y estándares de interoperabilidad.', 'Downloadable data catalogue, API and interoperability standards.'],
  footer_about: ['Portal de transparència i dades obertes. Informació publicada d’acord amb la Llei 19/2014.', 'Portal de transparencia y datos abiertos. Información publicada de acuerdo con la Ley 19/2014.', 'Transparency and open data portal. Published under Catalan Law 19/2014.'],
  footer_license: ['Continguts i dades sota llicència', 'Contenidos y datos bajo licencia', 'Content and data licensed under'],
  footer_interop: ['Dades i API', 'Datos y API', 'Data & API'],
  footer_portal: ['El portal', 'El portal', 'The portal'],
  footer_tc: ['Transparència Catalunya', 'Transparència Catalunya', 'Transparency Catalonia'],
  feed: ['Novetats (Atom)', 'Novedades (Atom)', 'Updates (Atom)'],
  filters: ['Filtres', 'Filtros', 'Filters'],
  all: ['Tots', 'Todos', 'All'],
  yes: ['Sí', 'Sí', 'Yes'],
  no: ['No', 'No', 'No'],
  source: ['Font', 'Fuente', 'Source'],
  dataset: ['conjunt de dades', 'conjunto de datos', 'dataset'],
  records: ['registres', 'registros', 'records'],
  no_results: ['No hi ha resultats amb aquests criteris.', 'No hay resultados con estos criterios.', 'No results match these criteria.'],
  data_table: ['Taula de dades', 'Tabla de datos', 'Data table'],
  pagination: ['Paginació', 'Paginación', 'Pagination'],
  prev: ['Anterior', 'Anterior', 'Previous'],
  next: ['Següent', 'Siguiente', 'Next'],
  page: ['Pàgina', 'Página', 'Page'],
  close: ['Tanca', 'Cerrar', 'Close'],
  chart_actions: ['Accions del gràfic', 'Acciones del gráfico', 'Chart actions'],
  view_table: ['Mostra com a taula', 'Mostrar como tabla', 'Show as table'],
  view_chart: ['Mostra el gràfic', 'Mostrar el gráfico', 'Show chart'],
  download_csv: ['Descarrega les dades (CSV)', 'Descargar los datos (CSV)', 'Download data (CSV)'],
  download_svg: ['Descarrega el gràfic (SVG)', 'Descargar el gráfico (SVG)', 'Download chart (SVG)'],
  not_found: ['No hem trobat aquesta pàgina', 'No hemos encontrado esta página', 'Page not found'],
  back_home: ['Torna a l’inici', 'Volver al inicio', 'Back to home'],
  error_title: ['No s’han pogut carregar les dades', 'No se han podido cargar los datos', 'Data could not be loaded'],
  error_hint: ['Si obres el portal com a fitxer local, cal servir-lo amb un servidor web (p. ex. «npm start»).', 'Si abres el portal como fichero local, hay que servirlo con un servidor web (p. ej. «npm start»).', 'If you opened the portal as a local file, serve it with a web server (e.g. “npm start”).'],
};

export function t(key) {
  const e = S[key];
  if (!e) { console.warn('[i18n] clau sense traducció:', key); return key; }
  return e[LANGS.indexOf(current)] ?? e[0];
}
