# Portal de Transparència · Consorci de Turisme de Barcelona

Prototipo funcional de un portal de transparencia **interoperable, visual, intuitivo y basado en el dato** para el Consorci de Turisme de Barcelona.

> ⚠️ **Datos de ejemplo.** Todas las cifras, contratos, empresas y beneficiarios son **sintéticos** (generados por `scripts/generate-data.mjs`) y sirven para validar diseño, modelo de datos e interoperabilidad. Antes de publicar deben conectarse las fuentes oficiales (ver [Hoja de ruta](#hoja-de-ruta)).

## Qué incluye

| Sección | Qué muestra | Visualizaciones |
|---|---|---|
| **Inicio** | Cifras clave, índice de cumplimiento, accesos por tema, novedades | KPI con variación, *sparkline*, anillo de cumplimiento |
| **Institución** | Entidades consorciadas, órganos de gobierno, organigrama, normativa (enlaces ELI) | Organigrama |
| **Presupuesto y economía** | Ingresos/gastos por capítulo y programa, ejecución, evolución 2021–2026 | Sankey de flujos, treemap, columnas, tabla detallada |
| **Contratación** | 296 contratos con filtros compartibles por URL, ficha con exportación **OCDS** | Barras, columnas apiladas, ranking de adjudicatarios, competencia, CPV, **indicadores de riesgo** (oferta única, posible fraccionamiento, modificados, concentración) |
| **Subvenciones y convenios** | Ayudas por línea y distrito, convenios vigentes | Columnas apiladas, barras por distrito |
| **Personal** | Plantilla, igualdad, temporalidad, bandas retributivas y brecha salarial | Pirámide edad×sexo, columnas, *range plot*, línea |
| **Buen gobierno** | Retribuciones y declaraciones de la dirección, agenda, grupos de interés, regalos | Calendario de actividad, barras, tablas filtrables |
| **Actividad y turismo** | Objetivos estratégicos con grado de avance, 9 indicadores turísticos mensuales desde 2019, mercados de origen, oficinas | Medidores, serie temporal, estacionalidad, mapa de calor, mapa (Leaflet) |
| **Derecho de acceso** | Cómo solicitar, estadísticas de solicitudes y plazos | Columnas apiladas, histograma, barras |
| **Índice de cumplimiento** | Autoevaluación de 42 obligaciones de la Ley 19/2014, con detección de información desactualizada | Anillo, columnas por bloque, medidores |
| **Datos abiertos** | Catálogo, ficha por conjunto, diccionario de datos, vista previa, ejemplos de código | — |

Funciones transversales: **buscador global** (`/` o `Ctrl+K`) sobre secciones, conjuntos, obligaciones, contratos, subvenciones y convenios; **tres idiomas** (ca/es/en); **modo claro/oscuro**; cada gráfico con **vista de tabla**, descarga **CSV** y **SVG**; filtros en la URL para compartir consultas exactas; diseño *responsive*.

## Interoperabilidad

| Estándar | Fichero | Uso |
|---|---|---|
| DCAT-AP 3 (JSON-LD) | `data/catalog.jsonld` | Federación con data.europa.eu |
| DCAT-AP-ES / NTI-RISP (RDF/XML) | `data/catalog.rdf` | Federación con datos.gob.es |
| DCAT-AP (Turtle) | `data/catalog.ttl` | Herramientas de web semántica |
| Frictionless Data Package + Table Schema | `datapackage.json` | Validación y carga automática (tipos, enumeraciones, claves) |
| OpenAPI 3.1 | `api/openapi.json` | Descripción formal de la API REST estática |
| Índice de API | `api/v1/index.json` | Descubrimiento de endpoints |
| OCDS (Open Contracting) | Exportación por contrato | Contratación pública |
| Listas de códigos multilingües | `data/codelists.json` | Vocabularios controlados ca/es/en |
| Atom | `feed.xml` | Suscripción a novedades |
| schema.org `Dataset` / `GovernmentOrganization` | Inyectado en las páginas | Google Dataset Search |
| CPV, ELI, ISO 8601, ISO 3166, ISO 4217, WGS84 | En los datos | Códigos estándar |

Cada conjunto se publica en **CSV** (RFC 4180, UTF-8) y **JSON**, con licencia **CC BY 4.0**. Los tres serializadores RDF se validan con `rdflib`.

## Uso

Requisitos: Node.js ≥ 18. Sin dependencias de npm.

```bash
npm start            # servidor local en http://localhost:8080
npm run data         # regenera los datos de ejemplo (deterministas)
npm run build        # valida datos y genera CSV, DCAT, Data Package, OpenAPI, Atom y sitemap
npm test             # build + prueba de humo en navegador (Playwright, si está disponible)
```

`build` falla si un registro no cumple su esquema (tipo incorrecto, campo no declarado o código fuera de su lista), de modo que sirve como control de calidad en la integración continua.

### Despliegue

El *workflow* `.github/workflows/pages.yml` valida los datos en cada *push* y, en `main`, regenera el catálogo con la URL pública y publica en **GitHub Pages** (activar en *Settings → Pages → Source: GitHub Actions*). Al ser un sitio estático, también puede servirse desde cualquier servidor o CDN.

## Estructura

```
index.html                 Shell de la aplicación (SPA con rutas hash)
assets/css/portal.css      Estilos y tokens (claro/oscuro, paleta validada para daltonismo)
assets/js/app.js           Router, carga de datos, navegación, buscador, idioma, tema
assets/js/charts.js        Librería de gráficos SVG propia (sin dependencias)
assets/js/ui.js            Componentes: KPI, tarjetas de gráfico, tablas, modales, formatos
assets/js/i18n.js          Traducciones de interfaz y etiquetas de listas de códigos
assets/js/views/*.js       Una vista por sección
assets/vendor/leaflet/     Leaflet 1.9.4 (BSD-2) servido localmente
data/*.json                Datos fuente (un fichero por conjunto)
data/metadata/datasets.json Metadatos del catálogo y esquema de cada conjunto
data/codelists.json        Vocabularios controlados
scripts/                   Generador de datos, build del catálogo, servidor y pruebas
docs/                      Arquitectura, modelo de datos y hoja de ruta
```

Más detalle en [`docs/ARQUITECTURA.md`](docs/ARQUITECTURA.md) y [`docs/MODELO-DATOS.md`](docs/MODELO-DATOS.md).

## Hoja de ruta

1. **Conectar fuentes oficiales**, sustituyendo `generate-data.mjs` por extractores: ERP económico-financiero (presupuesto y ejecución trimestral), PSCP / API de contratación pública de Catalunya (contratos, en OCDS), BDNS (subvenciones), RRHH (plantilla y retribuciones), registro y seu electrònica (derecho de acceso), agenda y registro de grupos de interés, Observatori del Turisme a Barcelona y fuentes estadísticas (indicadores).
2. **Validar contenidos institucionales** (órganos, composición nominal, actas, estatutos, código DIR3) con el Consorci.
3. **Federar el catálogo** con datos.gob.es y el portal de datos abiertos de la Generalitat / Ajuntament.
4. **Auditoría de accesibilidad** WCAG 2.1 AA externa y pruebas con personas usuarias.
5. Ampliaciones: periodo medio de pago a proveedores, inventario patrimonial, cartas de servicio, histórico de versiones de cada conjunto, alertas por correo.

## Licencia

Propuesta: código bajo **EUPL-1.2** y contenidos/datos bajo **CC BY 4.0** (pendiente de confirmación por el Consorci). Leaflet se distribuye bajo licencia BSD-2-Clause (`assets/vendor/leaflet/LICENSE`).
