# Arquitectura

## Principios

1. **El dato es la fuente única.** Ninguna cifra del portal está escrita a mano en el HTML: todas se calculan en el navegador a partir de los mismos ficheros que se ofrecen para descargar. Lo que se ve es exactamente lo que se puede reutilizar.
2. **Estático y soberano.** Sin servidor de aplicaciones, base de datos, cookies de seguimiento ni dependencias de pago. Se puede alojar en GitHub Pages, un bucket o el servidor web del Consorci.
3. **Interoperable por construcción.** Los metadatos (`data/metadata/datasets.json`) generan a la vez el catálogo DCAT-AP, el Data Package, la especificación OpenAPI y la validación. Un solo origen, varios estándares.
4. **Accesible por defecto.** Alternativa en tabla para cada gráfico, navegación por teclado, estado nunca comunicado solo con color, modo oscuro diseñado (no invertido) y paleta validada para daltonismo.

## Flujo de datos

```
fuentes oficiales ──► extractores (futuro) ──► data/<conjunto>.json
                                                    │
data/metadata/datasets.json ─┐                      │
data/codelists.json ─────────┼──► scripts/build-catalog.mjs ──► validación (falla si hay errores)
                             │                      ├─► data/csv/*.csv
                             │                      ├─► data/catalog.{jsonld,ttl,rdf}
                             │                      ├─► datapackage.json
                             │                      ├─► api/openapi.json, api/v1/index.json
                             │                      └─► feed.xml, sitemap.xml
                             ▼
             navegador: assets/js/app.js carga JSON + listas de códigos ► vistas ► gráficos SVG
```

## Frontend

- **Módulos ES nativos**, sin compilación. Cada sección es un módulo en `assets/js/views/` cargado bajo demanda (`import()`), de modo que la portada no descarga el código de las demás.
- **Rutas hash** (`#/contractacio?any=2025&proc=obert`): funcionan en cualquier alojamiento estático y hacen que cada consulta filtrada sea un enlace compartible.
- **i18n** en tres capas: textos comunes (`t()`), textos de una vista junto a su código (`tr(ca, es, en)`) y etiquetas de datos desde `codelists.json` (`label()`), de forma que los ficheros de datos guardan códigos estables y no texto traducido.
- **Gráficos** (`charts.js`): barras horizontales, columnas agrupadas/apiladas, líneas con cruceta y navegación por teclado, sankey, treemap *squarified*, mapa de calor, pirámide, *range plot*, calendario y *sparkline*. Todos responsivos (`ResizeObserver`), con tooltip accesible y exportables a SVG con los colores resueltos.

## Diseño de visualizaciones

- Paleta categórica de 8 tonos en **orden fijo** validada (separación ΔE para protanopia, deuteranopia y tritanopia; contraste respecto a la superficie) con versión específica para modo oscuro. Los tonos con contraste < 3:1 se compensan con la vista de tabla y etiquetas directas.
- **El color sigue a la entidad**: un programa presupuestario o un procedimiento de contratación tiene siempre el mismo color, aunque cambien los filtros.
- Colores de estado (bueno/aviso/grave/crítico) **reservados** para el cumplimiento y acompañados siempre de icono y texto.
- Nunca doble eje Y; marcas finas (barras ≤ 24 px con extremo redondeado, líneas de 2 px), rejilla discreta, leyenda siempre que haya ≥ 2 series.

## Pruebas

`scripts/smoke-test.mjs` abre todas las rutas en los tres idiomas y en móvil (375 px) con Chromium y comprueba: ausencia de errores de JavaScript, claves de traducción resueltas, presencia del título y ausencia de desbordamiento horizontal.
