# Portal de Transparencia municipal

Portal de transparencia **genérico, interoperable, visual y basado en el dato**, pensado para entidades locales (con el marco de la Comunitat Valenciana preconfigurado). Se adapta a cualquier administración editando un único fichero (`config/entidad.json`) o desde el editor visual.

> ⚠️ **Datos de ejemplo.** La entidad («Ayuntamiento de Ejemplo»), las personas, empresas y cifras son ficticias. Los contratos y subvenciones se sustituyen por datos reales en cuanto se configura el órgano y se ejecuta la sincronización con PLACSP y BDNS.

## Tres piezas

### 1. Portal público (`/`)
Estructura habitual de los portales municipales: barra institucional, cabecera con escudo, **portada con «cajitas» por categorías** (con el grado de cumplimiento de cada una), menú lateral y migas de pan.

| Categoría | Subapartados |
|---|---|
| Información institucional | Organización y funciones · Cargos electos y personal directivo · Agenda institucional |
| Personal y empleo | Plantilla y RPT · Oferta de empleo y procesos selectivos · Compatibilidades |
| Información jurídica | Proyectos normativos y participación · Normativa municipal · Sentencias |
| Patrimonio | Bienes inmuebles (con mapa) |
| Presupuesto y economía | Presupuesto y ejecución · Estabilidad, pago a proveedores y deuda |
| Ayudas y subvenciones | Concedidas (BDNS) · Recibidas · Plan estratégico |
| Contratación | Contratos (PLACSP, con indicadores de riesgo y exportación OCDS) · Encargos a medios propios |
| Convenios | Convenios suscritos |
| Urbanismo y medio ambiente | Planeamiento urbanístico · Medio ambiente |
| Información y atención a la ciudadanía | Servicios, cartas de servicios, sede y sugerencias |
| Participación | Participación ciudadana (preparada para la valoración de servicios y los presupuestos participativos) |
| Acceso a la información pública · Índice de transparencia · Datos abiertos | |

La portada funciona como **directorio**: cada categoría es una caja con sus subapartados enlazados y su grado de cumplimiento.

Castellano, valenciano e inglés; modo oscuro; buscador global (`/`); cada gráfico con vista de tabla y descarga CSV/SVG; filtros en la URL; diseño adaptable a móvil.

### 2. Editor visual por componentes (`/admin/`)
Al estilo de Adobe Experience Manager: las páginas se componen con **bloques** («cajitas») que se arrastran desde una paleta, se reordenan y se configuran en un panel de propiedades con **vista previa real**.

- **Componentes de contenido:** texto, aviso, lista de documentos, tarjetas de enlace.
- **Componentes de datos** (siempre conectados a un conjunto de datos): cifras clave, gráfico configurable (barras, columnas, apiladas, líneas, mapa de árbol), tabla con filtros y buscador, fichas de cargos, mapa, origen de los datos, obligaciones legales de la página.
- **Componentes avanzados:** explorador del presupuesto, explorador de contratación, índice de transparencia, catálogo de datos, solicitud de información.
- **Datos:** formularios generados desde el esquema para dar de alta y modificar **altos cargos**, agenda, normativa, convenios, inmuebles, etc. (con listas desplegables de códigos y validación de tipos).
- **Entidad:** nombre, NIF, DIR3, colores corporativos, escudo y configuración de fuentes automáticas.
- **Publicar:** un solo commit en GitHub con todos los cambios (token de grano fino) o descarga de ficheros. Borrador automático en el navegador, deshacer y aviso de traducciones pendientes.

Guía de uso: [`docs/GUIA-EDITOR.md`](docs/GUIA-EDITOR.md).

### 3. Sincronización automática con fuentes oficiales
Una tarea diaria de GitHub Actions (`.github/workflows/sync.yml`):

| Fuente | Qué trae | Cómo |
|---|---|---|
| **Plataforma de Contratación del Sector Público** | Contratos (licitaciones y menores) y encargos a medios propios | Feeds Atom de sindicación en formato CODICE, filtrados por el NIF/DIR3 del órgano de contratación, incrementales |
| **Base de Datos Nacional de Subvenciones** | Subvenciones concedidas | API REST pública (`/concesiones/busqueda`) filtrada por el órgano concedente |

Conserva siempre los registros cargados a mano, elimina los de ejemplo al llegar el primer dato real, valida y publica. Detalles y carga histórica: [`docs/SINCRONIZACION.md`](docs/SINCRONIZACION.md).

## Interoperabilidad

| Estándar | Fichero |
|---|---|
| DCAT-AP (JSON-LD, Turtle) — data.europa.eu | `data/catalog.jsonld`, `data/catalog.ttl` |
| DCAT-AP-ES / NTI-RISP (RDF/XML) — datos.gob.es | `data/catalog.rdf` |
| Frictionless Data Package (esquema de cada tabla) | `datapackage.json` |
| OpenAPI 3.1 (API REST estática) | `api/openapi.json`, `api/v1/index.json` |
| OCDS (Open Contracting) | exportación por contrato |
| CODICE / CPV / ELI / ISO 8601 / DIR3 | en los datos y la configuración |
| Atom | `feed.xml` |

## Uso

Node.js ≥ 18, sin dependencias de npm.

```bash
npm start          # portal en http://localhost:8080 y editor en http://localhost:8080/admin/
npm run sync       # sincroniza con PLACSP y BDNS (necesita acceso a Internet y la configuración del órgano)
npm run build      # valida datos y páginas y regenera CSV, DCAT, Data Package, OpenAPI y Atom
npm test           # pruebas de los conectores + validación + prueba de humo en navegador
npm run data       # regenera los datos de ejemplo
```

## Adaptarlo a una entidad

1. En el editor, pestaña **Entidad** (o en `config/entidad.json`): nombre, NIF, DIR3, colores, escudo (`assets/img/escudo.svg`), sede electrónica.
2. En **Entidad → Plataforma de Contratación** y **BDNS**: identificadores del órgano. Lanza la sincronización desde la pestaña **Fuentes**.
3. Sustituye los datos de ejemplo del resto de conjuntos desde la pestaña **Datos** (altos cargos, presupuesto, etc.) y desactiva el aviso de datos de ejemplo.
4. Activa GitHub Pages (*Settings → Pages → Source: GitHub Actions*) y añade la rama `main` en *Settings → Environments → github-pages*.

## Estructura

```
config/entidad.json         Configuración de la entidad (único fichero a adaptar)
content/portal.json         Categorías y páginas (portada y menú)
content/paginas/*.json      Cada página como lista de bloques
data/*.json                 Conjuntos de datos; data/metadata/datasets.json = esquemas; data/codelists.json = vocabularios
data/sync/estado.json       Estado de la última sincronización
assets/js/                  Portal: app.js, page.js, store.js, blocks/ (componentes), charts.js, ui.js, i18n.js
admin/                      Editor visual
scripts/sync/               Conectores PLACSP (CODICE) y BDNS, analizador XML y orquestador
scripts/                    Generador de datos de ejemplo, build del catálogo, servidor local, prueba de humo
tests/                      Pruebas de los conectores con ficheros de ejemplo
docs/                       Arquitectura, modelo de datos, guía del editor y sincronización
```

## Licencia

Propuesta: código bajo **EUPL-1.2** y contenidos/datos bajo **CC BY 4.0** (a decidir por la entidad). Leaflet 1.9.4 se distribuye bajo BSD-2-Clause (`assets/vendor/leaflet/LICENSE`).
