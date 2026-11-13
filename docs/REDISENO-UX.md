# Rediseño UX del Portal de Transparencia

Auditoría y propuesta de un equipo multidisciplinar (diseño de servicios públicos, investigación de usuarios, UI, arquitectura de información, front-end, accesibilidad WCAG 2.2 AA, visualización de datos y gobierno abierto). Se audita la versión `3b10a0f` (publicada en `main`).

**Método.** Revisión del código (arquitectura, componentes, CSS), recorrido de todas las rutas en Chromium a 320, 375, 768, 1024, 1440 y 1920 px, en claro y oscuro y en tres idiomas, auditoría automática con axe-core 4.10 (WCAG 2.0/2.1/2.2 A y AA y buenas prácticas), recorrido con teclado y medición de peso y tiempos. Se han hecho recorridos con tareas reales de los tres perfiles: ciudadano, periodista y perfil técnico.

---

## 1. Diagnóstico inicial

### Evidencias medidas (antes)

| Medida | Resultado |
|---|---|
| Peso de la portada | 3 KB HTML · 37 KB CSS · 153 KB JS · **412 KB JSON** (42 peticiones) |
| Altura de la cabecera | **250 px** en móvil y a 1024 px (barra institucional + aviso + cabecera + menú en 2–3 líneas); 164 px en tableta |
| Altura de la portada en móvil | 6.118 px a 375 px |
| axe-core | 5 tipos de incidencia: `aria-meter-name` (52 nodos, grave), `svg-img-alt` (24, grave), `color-contrast` (15, grave en modo oscuro), `heading-order` (6), `region` (72) |
| Objetivos táctiles < 24 px (WCAG 2.5.8) | 53 en *Cargos*; entre 6 y 12 en el resto |
| Teclado | Para llegar al buscador hacen falta **9 tabulaciones** (6 enlaces y botones de la barra institucional antes) |
| Desbordamiento horizontal | Ninguno en los 6 anchos ✓ |

### B. Fortalezas (se conservan)

- Arquitectura estática, ligera y sin dependencias: rápida (contenido visible en 0,4 s en local) y barata de alojar.
- Modelo de datos con esquema único → validación, formularios del editor, DCAT-AP, Data Package y OpenAPI salen del mismo sitio.
- Páginas por componentes, editables visualmente con vista previa real.
- Sincronización con PLACSP y BDNS; exportación OCDS; catálogo federable.
- Cada gráfico tiene tabla alternativa y descargas CSV/SVG; la paleta está validada para daltonismo.
- Filtros en la URL, tres idiomas, modo oscuro diseñado.

### A. Problemas principales (PROBLEMA → IMPACTO → PROPUESTA → PRIORIDAD)

| # | Problema | Impacto en el usuario | Propuesta | Prioridad |
|---|---|---|---|---|
| A1 | La portada es un **índice de 14 categorías** con sublistas: el paradigma es «navega por la estructura administrativa». | Quien no sabe que el sueldo del alcalde está en «Información institucional» no lo encuentra. | Portada orientada a tareas: buscador protagonista, preguntas frecuentes en lenguaje ciudadano y temas como orientación, no como repositorio. | P0 |
| A2 | El buscador es un **modal** que se abre desde un botón; no tiene página de resultados, ni agrupación con recuentos, ni sinónimos, ni historial. | «sueldos», «alcalde» o «deuda» no devuelven lo esperado; no se puede compartir una búsqueda. | Caja de búsqueda real en la cabecera y la portada, con autocompletado, búsquedas recientes, sinónimos ciudadanos, página `#/buscar?q=` con grupos, recuentos, filtro por tipo y resaltado. | P0 |
| A3 | **Fecha y fuente** no se ven al entrar: solo algunas páginas tienen el bloque «Origen de los datos» y la fecha de los documentos está dispersa. | El usuario no sabe si el dato es fiable ni de cuándo es. | Banda de metadatos homogénea bajo el título de cada página: *Actualizado · Fuente · Responsable · Descargar datos*. | P0 |
| A4 | El **grado de cumplimiento** aparece en la portada (anillo grande), en cada caja de categoría (barra) y en cada página (lista desplegada). | Domina la experiencia y usa jerga jurídica («art. 8.1.a», «publicidad activa»). | Moverlo a una sección técnica; en las páginas, un resumen plegado en lenguaje claro («✓ Disponible», «◷ Pendiente de actualizar»…). | P1 |
| A5 | El derecho de acceso está enterrado en la categoría 12. | Quien no encuentra algo abandona sin saber que puede pedirlo. | Llamada a la acción fija: «¿No encuentras lo que buscas? Solicita información» en portada, resultados vacíos, pie y cabecera. | P0 |
| A6 | Los documentos son una lista plana sin tipo, tamaño ni año; no hay histórico. | Con decenas de PDF por página, la lista es ilegible. | Componente de documento con título, tipo, año, formato, tamaño, fecha, *Ver* y *Descargar*; último año abierto e histórico plegado. | P1 |
| A7 | La tabla genérica no muestra filtros activos, recuento ni «limpiar», y sus filtros no se guardan en la URL; en móvil se reduce la tabla de escritorio. | Imposible compartir una consulta; en móvil hay que desplazarse en horizontal. | Barra de filtros con *chips*, recuento, limpiar y estado en URL; filas como tarjetas en móvil. | P1 |
| A8 | El explorador de contratación muestra a la vez 5 KPI, 4 gráficos, alertas y tabla. | Sobrecarga; el ciudadano que solo quiere ver contratos tiene que desplazarse por gráficos. | Vistas por pestañas: **Contratos** (lista, por defecto) · **Estadísticas** · **Indicadores de riesgo**; ficha de contrato estructurada y compartible. | P1 |
| A9 | El presupuesto no permite bajar de nivel. | No se puede responder «¿cuánto se gasta en servicios sociales y en qué?». | Navegación progresiva *Resumen → Área → Capítulo* (programa y partida requieren ampliar el modelo de datos: ver hoja de ruta). | P1 |
| A10 | En *Agenda* la columna «Cargo» muestra códigos internos (`C01`). | Ilegible para cualquiera. | Referencias entre conjuntos: el campo `cargo_id` se resuelve al nombre del cargo; enlace «Agenda» desde cada ficha de cargo. | P1 |

### C. Arquitectura de información

| Problema | Impacto | Propuesta | Prioridad |
|---|---|---|---|
| 14 categorías al mismo nivel, nombradas como la ley y no como las preguntas de la gente. | Carga cognitiva alta. | Mantener las 14 (cumplimiento y compatibilidad con el editor) pero presentarlas en dos niveles: **preguntas frecuentes** y **temas** con descripción breve y nº de contenidos. | P1 |
| «Índice de transparencia» y «Datos abiertos» compiten con temas ciudadanos. | Mezcla de recorridos ciudadano y técnico. | Agruparlos en un área «Sobre los datos y la transparencia» en portada y pie. | P1 |
| No existe una explicación de procedencia, metodología y licencias. | No se transmite «sé de dónde sale este dato». | Nueva página **Sobre los datos** con tabla viva de fuentes, fechas y periodicidades. | P1 |

### D. Navegación

| Problema | Impacto | Propuesta | Prioridad |
|---|---|---|---|
| Tres navegaciones compiten: barra institucional, menú superior (2 líneas), menú lateral con las 14 categorías. | Desorientación; ruido. | Cabecera de una línea; menú «Temas» desplegable; navegación lateral **contextual** (solo la categoría actual). | P0 |
| En móvil el menú lateral desaparece y no hay forma de ver las páginas hermanas. | Hay que volver a la portada. | «En esta sección» plegable en móvil. | P1 |

### E. Visual

| Problema | Impacto | Propuesta | Prioridad |
|---|---|---|---|
| El color corporativo se aplica a todo (barra, bordes de cajas, KPI, iconos, enlaces activos). | Sin jerarquía; aspecto pesado. | Color primario solo para acciones principales, estado activo y marca; neutros para estructura; semánticos solo para estados. | P1 |
| Cuadrícula uniforme de cajas iguales con sublistas. | Monotonía; aspecto de «colección de enlaces». | Lista de temas en dos columnas, con jerarquía tipográfica y aire. | P1 |
| Escala tipográfica implícita (muchos tamaños sueltos de 0,72 a 0,92 rem). | Textos demasiado pequeños; poca jerarquía. | Escala definida (Display, H1, H2, H3, Cuerpo, Pequeño, Etiqueta, Metadato); mínimo 14 px. | P1 |

### F. Funcionales

| Problema | Impacto | Propuesta | Prioridad |
|---|---|---|---|
| La portada descarga 412 KB de datos (todas las páginas y conjuntos grandes) solo para pintar listas. | Lentitud en móvil y redes lentas. | La portada usa el índice ligero `api/v1/index.json`; los conjuntos grandes se cargan después y solo para las cifras. | P1 |
| Errores muestran el mensaje técnico (`HTTP 404…`). | Confusión. | Estados humanos y accionables (*Reintentar*, *Volver*), detalle técnico plegado. | P1 |
| Carga con un *spinner* central. | Percepción de lentitud. | Esqueletos de la página. | P2 |

### G. Accesibilidad (WCAG 2.2 AA)

| Problema | Criterio | Propuesta | Prioridad |
|---|---|---|---|
| Medidores sin nombre accesible (52). | 4.1.2 | `aria-label` con el texto del medidor. | P0 |
| Gráficos SVG con `role="img"` sin texto alternativo (24). | 1.1.1 | Etiqueta automática con el título del gráfico; tabla alternativa ya existente. | P0 |
| Contraste insuficiente de etiquetas de estado en modo oscuro (15). | 1.4.3 | Tintas semánticas específicas para oscuro. | P0 |
| Saltos de nivel de encabezado (h1 → h3). | 1.3.1 | Títulos de gráfico como h2 en páginas. | P1 |
| Contenido fuera de *landmarks* (barra institucional y aviso). | 1.3.1 / buena práctica | Integrar en `header` o `region` etiquetada. | P1 |
| Objetivos táctiles < 24 px. | 2.5.8 (nuevo en 2.2) | Mínimo 24 × 24 px (44 px en controles principales). | P1 |
| Foco: 9 tabulaciones hasta el buscador. | 2.4.1 / 2.4.3 | Cabecera reducida; buscador como primer control tras el escudo. | P1 |

### H. Responsive

| Problema | Impacto | Propuesta | Prioridad |
|---|---|---|---|
| Cabecera de 250 px en móvil (1/3 de la pantalla). | El contenido empieza «bajo el pliegue». | Cabecera de ~64 px en móvil y menú en panel. | P0 |
| Tablas reducidas a scroll horizontal. | Difícil de leer. | Filas como tarjetas por debajo de 640 px. | P1 |
| A 1920 px el contenido se limita a 1280 px, pero el texto largo no tiene medida de línea. | Líneas demasiado largas en páginas de texto. | Anchos máximos por tipo: texto 72ch, página 1200 px, exploradores 1360 px. | P2 |

### I. Oportunidades

Preguntas frecuentes configurables; datos destacados con fuente; últimas actualizaciones reales (a partir de las fechas de los conjuntos); búsqueda con sinónimos; vistas por pestañas en exploradores; página *Sobre los datos*; navegación entre conjuntos (cargo → agenda).

---

## 2. Principios de diseño

1. **Responde preguntas, no muestres estructura.** Lenguaje ciudadano primero; la terminología legal, después y opcional.
2. **Buscar es la puerta principal**; navegar por temas, la segunda.
3. **Todo dato con fecha y fuente**, arriba y siempre en el mismo sitio.
4. **Revelación progresiva**: resumen → detalle → datos técnicos.
5. **Un gráfico solo si explica más que una cifra o una tabla.**
6. **Institucional pero amable**: color corporativo con moderación, neutros, aire y tipografía legible.
7. **Todo editable**: cada mejora se expresa como componente o propiedad del editor.
8. **Ligero**: sin frameworks; HTML, CSS y JS nativos.

## 3. Arquitectura de información

```
Inicio
├── Buscar (#/buscar?q=…)                  ← puerta principal
├── Preguntas frecuentes (configurables)  ← atajos a respuestas
├── Temas (14 categorías, sin cambios de URL)
│   └── Categoría → páginas (navegación contextual)
├── Solicitar información (#/derecho-acceso) ← siempre visible
└── Sobre los datos y la transparencia
    ├── Sobre los datos (#/sobre-los-datos)      ← nuevo
    ├── Datos abiertos y API (#/datos-abiertos)
    └── Índice de cumplimiento (#/indice)        ← técnico
```

Las URL existentes no cambian (compatibilidad con enlaces ya compartidos).

## 4. Home propuesta (wireframe)

```
┌────────────────────────────────────────────────────────────────┐
│ ⓘ Prototipo con datos de ejemplo · Más información            │  ← aviso fino (configurable)
├────────────────────────────────────────────────────────────────┤
│ [Escudo] Transparencia      [ Buscar…            🔍]  ES ▾ ◐ ☰ │  ← 1 línea, ~72 px
│          Ayuntamiento de…   Temas ▾ · Contratos · Presupuesto · │
│                             Cargos · Subvenciones · Solicitar → │
├────────────────────────────────────────────────────────────────┤
│  Portal de Transparencia                                       │
│  Toda la información pública del Ayuntamiento, clara y         │
│  accesible.                                                    │
│  [ ¿Qué información buscas?                         Buscar ]   │
│  Contratos · Presupuesto · Sueldos de cargos · Subvenciones    │
├────────────────────────────────────────────────────────────────┤
│  LO MÁS CONSULTADO                                             │
│  › ¿Cuánto cobran el alcalde y los concejales?                 │
│  › ¿Qué contratos se han adjudicado?                           │
│  › ¿En qué se gasta el presupuesto?   (6 preguntas, 2 col.)    │
├────────────────────────────────────────────────────────────────┤
│  DATOS DESTACADOS                                              │
│  17,8 M€ presupuesto 2026 │ 366 contratos │ 2,9 M€ deuda viva  │
│  Fuente · actualizado      Fuente · act.   Fuente · act.       │
├────────────────────────────────────────────────────────────────┤
│  EXPLORA POR TEMAS (2 columnas, filas, no tarjetas)            │
│  [ic] Información institucional — Organización, cargos… 3 →    │
│  [ic] Personal y empleo — Plantilla, oposiciones…        3 →   │
├────────────────────────────────────────────────────────────────┤
│  ÚLTIMAS ACTUALIZACIONES          │ ¿NO ENCUENTRAS ALGO?       │
│  Contratos · 12 nov               │ Solicita información       │
│  Subvenciones · 12 nov            │ pública [Solicitar →]      │
├────────────────────────────────────────────────────────────────┤
│  Sobre los datos · Datos abiertos y API · Índice de cumplim.   │
└────────────────────────────────────────────────────────────────┘
```

Página de categoría: título + explicación → *cifras clave* (configurables) → *Explorar* (páginas con descripción) → *Últimas actualizaciones* de la categoría → estado de la información (plegado).

Página de datos: migas → título → explicación → **banda de metadatos** (actualizado, fuente, responsable, descargar) → contenido → «¿No encuentras…?».

## 10. Sistema de diseño (tokens)

| Grupo | Tokens |
|---|---|
| Color | `--brand`, `--brand-strong`, `--brand-soft` (de la configuración) · neutros `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--ink`, `--ink-2`, `--muted`, `--line`, `--line-strong` · semánticos `--ok`, `--warn`, `--err`, `--info` (+ `-ink` y `-bg`) · paleta de datos `--s1…--s8`, `--seq-1…7` |
| Tipografía | `--fs-display` 2.5rem · `--fs-h1` 2rem · `--fs-h2` 1.5rem · `--fs-h3` 1.2rem · `--fs-body` 1rem (16 px) · `--fs-small` .9rem · `--fs-label` .875rem · `--fs-meta` .875rem; alturas de línea 1.2 / 1.6 |
| Espaciado | `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 24 · `--sp-6` 32 · `--sp-7` 48 · `--sp-8` 64 px |
| Radios | `--r-sm` 6 · `--r-md` 10 · `--r-lg` 16 · `--r-pill` 999 px |
| Sombras | `--sh-1` (reposo), `--sh-2` (hover, desplegables), `--sh-3` (modales) |
| Bordes | 1 px `--line`; 2 px para foco y selección |
| Estados | foco 3 px `--focus` con separación de 2 px; hover con `--surface-2`; activo con `--brand-soft` |
| Anchos | `--w-text` 72ch · `--w-page` 1200 px · `--w-wide` 1360 px |
| Breakpoints | 480 · 768 · 1024 · 1280 px (móvil primero) |

## Hoja de ruta

| Fase | Contenido |
|---|---|
| **Fase 1 — impacto alto, esfuerzo bajo** | Tokens; cabecera de una línea; correcciones de accesibilidad (medidores, SVG, contraste, encabezados, landmarks, objetivos táctiles); metadatos de fecha y fuente en cada página; CTA de solicitud de información; cumplimiento como información secundaria; nombres de cargo en la agenda. |
| **Fase 2 — UX estructural** | Nueva portada; buscador con página de resultados, sinónimos e historial; navegación contextual; página de categoría; componente de documentos con histórico; tabla con chips, URL y tarjetas en móvil; explorador de contratación por pestañas y nueva ficha; presupuesto por niveles; *Sobre los datos*; esqueletos y errores humanos; impresión. |
| **Fase 3 — funciones avanzadas** | Páginas estáticas pre-renderizadas por ruta para buscadores (SEO real; hoy el enrutado con `#` limita la indexación); columnas configurables en tablas; comparativa entre años; programa y partida en el presupuesto (requiere ampliar el modelo de datos); alertas por correo o RSS por tema. |
| **Futuro** | Valoración de servicios y presupuestos participativos (pendiente de decisión); pruebas con usuarios reales (5 por perfil) para validar las tareas clave. |

## Referencias analizadas

| Portal | Buena práctica | Aplicación posible |
|---|---|---|
| [GOV.UK — buscador](https://insidegovuk.blog.gov.uk/2024/12/12/making-it-quicker-and-easier-to-search-on-gov-uk) y [patrones de búsqueda](https://docs.publishing.service.gov.uk/repos/govuk-design-guide/patterns/search-filter.html) | Autocompletado, filtros simplificados, resultados legibles; la búsqueda como puerta de entrada. | Caja de búsqueda con sugerencias y página de resultados con filtros por tipo. |
| [Scottish Government Design System — resultados](https://designsystem.gov.scot/patterns/search-results) | Recuento de resultados, filtros visibles y estados sin resultados útiles. | Recuentos por grupo y estado vacío con alternativas. |
| [USAspending.gov](https://www.everycrsreport.com/files/2025-04-22_IF10231_b2fe32805cf205d79aca214c6ec235146a604949.html) | Explorador de gasto por niveles (gran cuadro → agencia → contrato). | Presupuesto *Resumen → Área → Capítulo*. |
| [Tutkihankintoja.fi](https://data.europa.eu/publications/use-cases/tutkihankintojafi) (Finlandia) | Exploración de compras públicas por comprador, proveedor y tipo. | Pestañas del explorador de contratación (quién, a quién, qué). |
| [Exploreadministration.fi](https://www.exploreadministration.fi/about-the-service/) (Finlandia) | Fuente, periodicidad (mensual) y alcance explicados en «Acerca del servicio». | Página *Sobre los datos* y banda de metadatos. |
| [data.europa.eu](https://data.europa.eu/publications/use-cases/tutkihankintojafi) | Catálogo federado DCAT-AP con casos de reutilización. | Mantener la federación; separar la capa técnica del recorrido ciudadano. |

---

## 13. Cambios implementados (antes → problema → después → beneficio)

| Bloque | Antes | Problema | Después | Beneficio |
|---|---|---|---|---|
| Tokens | Colores y tamaños sueltos; color corporativo en todo | Inconsistencia, sin jerarquía | `portal.css` reescrito sobre tokens (color, tipografía, espaciado, radios, sombras, bordes, estados, anchos); corporativo solo en acciones, activo y marca; semánticos solo para estados | Coherencia, mantenimiento, institucional sin pesadez |
| Cabecera | Barra institucional + aviso + cabecera + menú en 2–3 líneas (250 px en móvil) | Contenido bajo el pliegue; 9 tabulaciones hasta buscar | Una línea: escudo · buscador · idioma · tema · menú; menú «Temas» desplegable y CTA «Solicitar información» (127 px en móvil con aviso de prototipo) | Contenido visible antes; buscador a 3 tabulaciones |
| Navegación | Menú lateral con las 14 categorías | Ruido y competencia entre menús | Navegación contextual (solo la sección actual) + «Ver todos los temas»; migas `Inicio / Tema / Página` | Orientación sin volver a la portada |
| Portada | Índice de 14 cajas con sublistas y anillo de cumplimiento | Paradigma administrativo | Buscador protagonista, *Lo más consultado* (preguntas en lenguaje ciudadano), *Datos destacados* con fuente y fecha, *Explora por temas* en filas, *Últimas actualizaciones*, CTA de solicitud y acceso secundario a datos técnicos | Responde «¿qué quieres saber?» en 5 segundos |
| Buscador | Modal sin página de resultados | Ni compartible ni agrupado; «sueldos» no encontraba nada útil | Caja con autocompletado (patrón *combobox* ARIA), búsquedas recientes, sugerencias, sinónimos ciudadanos editables (`content/sinonimos.json`), página `#/buscar?q=&tipo=` con grupos, recuentos, filtro por tipo, resaltado, página recomendada y estado vacío accionable; indexa documentos de las páginas | Encontrar sin conocer la estructura |
| Procedencia | Fecha y fuente solo en algunas páginas | Desconfianza | Banda homogénea *Actualizado · Fuente · Responsable · Descargar datos* en todas las páginas, calculada desde los conjuntos usados; aviso «Datos de ejemplo» | «Sé de dónde sale este dato» |
| Categoría | Cajas de páginas + lista de obligaciones | Poco orientativa | Explicación, cifras clave configurables, «Qué puedes consultar» con fecha y fuente de cada página, estado de la información plegado | Orientación y contexto |
| Documentos | Lista plana | Ilegible con decenas de PDF | Componente con tipo, año, formato, tamaño, fecha, *Ver* y *Descargar*; último año visible e histórico plegado | Escala a años de documentación |
| Tablas y filtros | Sin chips ni recuento; filtros fuera de la URL; en móvil, scroll horizontal | Consultas no compartibles; móvil incómodo | Recuento, chips de filtros activos, «Limpiar filtros», estado en URL, exportar selección CSV, filtros plegables en móvil, filas como tarjetas por debajo de 640 px, estado vacío con acción, cabecera fija | Compartir, comparar y leer en móvil |
| Contratación | KPI + 4 gráficos + alertas + tabla en una sola vista | Sobrecarga | Pestañas *Contratos · Estadísticas · Indicadores de riesgo* (en URL); gráficos con preguntas («¿A quién se adjudica?»); ficha con importe destacado, hechos clave, fuente oficial, OCDS y «Copiar enlace» | El ciudadano ve contratos; el periodista, análisis |
| Presupuesto | Sankey ingresos→áreas, mapa de árbol, columnas, tabla | El sankey sugería que cada ingreso financia un área concreta (no es así); sin bajar de nivel | Tres preguntas (*¿De dónde viene? ¿En qué se gasta? ¿Cuánto se ha ejecutado?*); navegación *Resumen → Área → Capítulo* con URL (`?area=`) y lista accesible por teclado | Comprensión sin conocimientos contables |
| Cargos | Ficha con datos en filas iguales | Retribución poco visible; agenda desconectada | Retribución destacada, responsabilidades, fecha, declaraciones y enlace a su **agenda filtrada**; la agenda muestra nombres (no códigos `C01`) mediante referencias entre conjuntos | Respuesta directa a «¿cuánto cobra el alcalde?» |
| Cumplimiento | Anillo en portada, barras en cada categoría | Dominaba la experiencia; jerga | Información secundaria: estados en lenguaje claro (✓ Disponible · ◷ Pendiente de actualizar · ! Incompleta/Pendiente · — No aplica); página técnica con fundamento, estado, fecha y evidencia | Control para quien lo necesita, sin ruido para el resto |
| Sobre los datos | No existía | No se explicaba procedencia ni método | Nueva página con tabla viva de fuentes, responsables, frecuencias y fechas, metodología, limitaciones y licencia | Confianza y reutilización |
| Estados | *Spinner* central y mensajes técnicos | Percepción de lentitud y confusión | Esqueletos de carga; errores humanos con *Reintentar*; 404 con buscador | Menos abandono |
| Pie | Enlaces mezclados | Recorridos técnico y ciudadano juntos | Contacto · Transparencia · Datos abiertos y API · legal | Separación de recorridos |
| Impresión | Básica | Páginas con menús y controles | Hoja `print` que oculta navegación y controles, abre desplegables y muestra URLs | Documentos institucionales imprimibles |
| Editor | — | Nuevas piezas debían ser editables | Responsable de página; fecha automática al editar; preguntas frecuentes, datos destacados y menú de la portada; cifras clave por categoría; tipo de campo «página»; nuevas propiedades del componente de documentos; nuevo componente «Procedencia de los datos» | Todo editable sin código |

## 14. Funciones conservadas

Todas: portal público, 14 categorías y sus URL, grado de cumplimiento, buscador (ampliado), tres idiomas, modo oscuro, *responsive*, gráficos con tabla alternativa y descarga CSV/SVG, filtros en URL, contratos con OCDS e indicadores de riesgo, subvenciones, presupuesto, cargos, agenda, patrimonio con mapa y lista, convenios, normativa, participación, derecho de acceso, índice, catálogo DCAT-AP/DCAT-AP-ES, Data Package, OpenAPI, Atom, sincronización con PLACSP y BDNS, editor visual y componentes reutilizables. El componente «Origen de los datos» se mantiene en el editor, pero se ha retirado de las páginas porque la banda de metadatos lo sustituye. El gráfico de flujo (sankey) sigue en la librería, pero el presupuesto ya no lo usa por el motivo indicado.

## 15. Pruebas realizadas

| Prueba | Resultado |
|---|---|
| Prueba de humo automatizada (Chromium): 33 rutas × 3 idiomas, rutas de filtros y vistas, búsqueda con y sin resultados, 404, 9 rutas a 320/375/768 px, editor | **185 comprobaciones superadas**, sin errores de JavaScript ni desbordamiento |
| axe-core 4.10 (WCAG 2.0/2.1/2.2 A-AA + buenas prácticas), 13 rutas en claro y oscuro | Antes: 5 reglas incumplidas, 91 nodos graves. **Después: 0** |
| Objetivos táctiles < 24 px (WCAG 2.5.8) | Antes: hasta 53 por página. Después: 1–2 (enlaces en línea dentro de texto, exentos) |
| Teclado | Orden lógico; buscador en la 3.ª tabulación tras «Saltar al contenido» y el escudo; menú «Temas» con Escape y retorno del foco; pestañas con flechas; foco visible en todos los controles |
| Rendimiento (portada, local) | Antes 42 peticiones / 360 ms; **después 20 peticiones / ~200 ms** hasta contenido |
| Datos de esfuerzo (copia aparte) | 3.000 contratos, nombres de 140 caracteres, 60 documentos en 7 años: sin desbordamiento, ~1,1 s por página |
| Búsqueda en lenguaje ciudadano | «sueldos», «alcalde» → Cargos; «obras» → Contratos; «deuda» → Estabilidad y deuda; «oposiciones» → Procesos selectivos; «zzzz» → estado vacío con CTA |
| Pruebas de conectores (PLACSP, BDNS) | 6/6 |

## 16. Mejoras pendientes

- **SEO real**: el enrutado con `#` impide que los buscadores indexen cada página. Propuesta: generar en el *build* una página HTML estática por ruta (título, descripción, contenido básico y enlace canónico) que cargue la aplicación.
- **Peso de datos en portada**: los datos destacados descargan los conjuntos completos (p. ej. contratos). Propuesta: precalcular las cifras en `api/v1/index.json` durante el *build*.
- **Presupuesto por programa y partida**: requiere ampliar el modelo de datos (`programa`, `subconcepto`) y que la contabilidad lo publique.
- **Columnas configurables** en tablas y comparativa entre años.
- **Pruebas con personas usuarias** (5 por perfil) con las tareas del criterio de éxito.
- Revisar con lector de pantalla real (NVDA/VoiceOver) los gráficos y el *combobox* de búsqueda; axe no sustituye esa prueba.

## 17. Hoja de ruta

| Fase | Estado | Contenido |
|---|---|---|
| Fase 1 — impacto alto, esfuerzo bajo | ✅ Hecha | Tokens, cabecera, accesibilidad, banda de procedencia, CTA de solicitud, cumplimiento secundario, nombres en la agenda |
| Fase 2 — UX estructural | ✅ Hecha | Portada, buscador, navegación contextual, categoría, documentos, tablas y filtros, contratación por pestañas, presupuesto por niveles, *Sobre los datos*, estados, impresión, editor |
| Fase 3 — avanzada | Pendiente | Pre-renderizado para SEO, cifras precalculadas, columnas configurables, comparativas, programa/partida |
| Futuro | Pendiente de decisión | Valoración de servicios, presupuestos participativos, pruebas con usuarios |
