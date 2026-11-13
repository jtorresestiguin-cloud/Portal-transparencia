# Guía del editor de contenidos

El editor está en `/admin/` del portal (por ejemplo, `https://…/Portal-transparencia/admin/`). Funciona en el navegador: no hay que instalar nada.

## Pantalla

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Gestión   Idioma [ES]  Modo [Sencillo]  Vista previa  Ver portal  Deshacer  Revisar y publicar (3) │
├──────────────┬──────────────────────────────────────────┬────────────────┤
│ Inicio       │  Título · Entradilla · Icono             │ Componentes    │
│ Datos        │  ┌──────────── bloque ────────────┐ ↑↓⧉🗑 │  (paleta) o    │
│ Entidad      │  │  vista previa real             │       │ Propiedades    │
│ Fuentes      │  └────────────────────────────────┘       │ del bloque     │
│ (árbol)      │              ＋                            │ seleccionado   │
└──────────────┴──────────────────────────────────────────┴────────────────┘
```

## Inicio de sesión

Al abrir `/admin/` se pide **iniciar sesión con un token de acceso de GitHub**. Como el portal es estático, no guarda contraseñas: es GitHub quien comprueba la identidad y los permisos.

- Solo entran las cuentas con **permiso de escritura** en el repositorio del portal. Si en *Entidad → Acceso y publicación* se rellena la lista de **personas autorizadas**, solo esas cuentas.
- El rol se toma del permiso en GitHub: *Administración* (admin), *Publicación* (maintain) o *Edición* (write; se le propone «Enviar a revisión»).
- La sesión se cierra tras **8 horas sin actividad** o con **Cerrar sesión**. «Mantener la sesión» la recuerda en ese navegador; si no, se borra al cerrar la pestaña. Si se revoca el token o se retira el permiso, la sesión se cierra en el siguiente acceso.
- Para dar acceso a una persona: *Settings → Collaborators* del repositorio → *Add people*; ella crea su propio token (ver «¿Cómo obtengo el token?» en la pantalla de acceso).
- En un servidor local (`npm start`) aparece además «Entrar en modo de prueba», sin publicar.

Los ficheros del editor son públicos (como todo el portal), pero sin sesión no se puede usar ni publicar nada, y los datos que muestra son los mismos que el portal público.

## Inicio de gestión

Es la pantalla de entrada. Resume:

- **Estado del portal:** índice de cumplimiento y obligaciones al día, pendientes de actualizar, incompletas y pendientes de publicar. El estado **se calcula solo**: obligación → página o conjunto de datos → periodicidad exigida → fecha de la última actualización (de la página, del conjunto, de sus registros o de la última sincronización). Si se supera el plazo, pasa a «pendiente de actualizar»; si la página no existe o el conjunto está vacío, a «pendiente».
- **Pendiente de publicación:** cambios sin publicar y textos sin traducir.
- **Fuentes automáticas:** última sincronización con la Plataforma de Contratación y la BDNS.
- **Necesitan atención:** obligaciones vencidas, datos que superan su periodicidad, datos de ejemplo, traducciones que faltan, páginas sin responsable, documentos sin fecha y colores sin contraste suficiente. Cada aviso tiene un botón «Abrir».
- **Primeros pasos** y **Historial de publicaciones** (con «Recuperar la versión anterior» de cualquier fichero, que se carga como borrador para revisarlo y publicarlo).

## Modo sencillo y modo avanzado

Selector **Modo** en la barra superior. El **sencillo** (por defecto) muestra solo lenguaje funcional: los componentes de datos incluyen un resumen («Muestra: suma de «Importe» de Contratos donde «Tipo de contrato» es «Obras» · 42 de 366 registros») y las condiciones se añaden con desplegables («en el año 2026», «es Obras»…). Los nombres técnicos de campo, el filtro en bruto y las opciones de detalle quedan en «Configuración avanzada». El **avanzado** lo muestra todo.

## Editar una página

1. Pestaña **Páginas** → elige la página en el árbol (categoría → página).
2. **Añadir un bloque:** arrastra un componente desde el panel derecho al lugar deseado del lienzo, o pulsa **＋** entre dos bloques y luego el componente.
3. **Configurar:** pulsa el bloque; sus propiedades aparecen a la derecha y la vista previa se actualiza al momento.
4. **Mover, duplicar o borrar:** botones ↑ ↓ ⧉ 🗑 de la barra del bloque, o arrastrándolo.
5. **Idiomas:** elige el *Idioma de edición* arriba. Los campos sin traducir muestran «falta VA, EN».

### Componentes de datos: cómo se configuran

| Componente | Propiedades clave |
|---|---|
| **Cifras clave** | Para cada cifra: conjunto de datos, cálculo (contar, sumar, media, último valor), campo y filtro. |
| **Gráfico** | Conjunto, tipo, *Agrupar por* (en fechas se puede elegir «por año» o «por mes»), *Series* opcional, cálculo y campo, filtro, formato, línea de referencia. |
| **Tabla** | Conjunto, columnas a mostrar, desplegables de filtro, buscador, orden. |
| **Fichas de cargos** | Filtro (por ejemplo `tipo_cargo!=eventual`) y si se muestran las retribuciones. |
| **Mapa** | Conjunto con campos `lat`/`lon` (por ejemplo, inmuebles). |

**Filtros:** `campo=valor`, `campo!=valor`, `importe>=1000`; varios separados por `;`. Debajo del campo se indica cuántos registros lo cumplen.

## Editar datos (altos cargos, agenda, normativa…)

1. Pestaña **Datos** → conjunto (por ejemplo, *Cargos electos y personal directivo*).
2. Pulsa una fila para editarla en el panel derecho, o **Nuevo registro**.
3. Los campos con lista de códigos se eligen en un desplegable; las fechas e importes se validan.
4. Los conjuntos con ⟳ (contratos, encargos, subvenciones) se actualizan solos: sus registros importados se consultan pero no se editan (se corrigen en la fuente oficial). Lo que añadas a mano se marca como «carga manual» y la sincronización lo conserva.
5. La tabla permite buscar, filtrar, ordenar por columna, paginar y seleccionar varios registros para eliminarlos.
6. **Importar CSV** (conjuntos manuales): reconoce las columnas por nombre o descripción, convierte fechas DD/MM/AAAA, importes con coma decimal y valores de las listas, y muestra una **vista previa con la validación de cada fila** antes de añadir, sustituir o importar solo las filas válidas. Desde Excel: *Guardar como → CSV UTF-8*. **Exportar CSV** descarga el conjunto.

## Subir archivos (PDF, fotos, documentos)

Junto a cada campo de enlace (documentos de una página, foto y declaraciones de un cargo, escudo de la entidad…) aparece **Subir archivo** o **Subir imagen**:

- Formatos: PDF, imágenes (JPG, PNG, WebP, GIF, SVG), Word/Writer, Excel/Calc, PowerPoint/Impress, CSV, TXT y ZIP. Máximo 25 MB.
- Las fotos de cargos se reducen automáticamente a 800 px y las imágenes grandes a 2000 px.
- El archivo recibe una dirección pública definitiva (`archivos/<tipo>/<año>/<nombre>`) y se ve al momento en la vista previa y con el botón **Ver**, aunque todavía no esté publicado.
- Se publica junto con el resto de cambios (también en «Enviar a revisión»). Mientras tanto se guarda como borrador en el navegador.
- Las comprobaciones previas avisan si un contenido enlaza un archivo que no existe o si un archivo es muy pesado.

En el portal, cada documento se puede **ver** (se abre en una pestaña nueva) o **descargar**.

## Entidad

Nombre en los tres idiomas, NIF, DIR3, dirección, sede electrónica, escudo y **colores corporativos** (se aplican a todo el portal). Junto a los colores se muestra su **contraste WCAG** sobre blanco: el color principal necesita al menos 4,5:1 (si no, la publicación se bloquea); el secundario avisa si no sirve para texto. También los identificadores del órgano para la Plataforma de Contratación y la BDNS y el **modo de publicación por defecto**.

## Portada y categorías

- **Portada** (botón «Portada» bajo el árbol): título, frase de bienvenida, *Lo más consultado* (preguntas en lenguaje ciudadano y la página que las responde), *Datos destacados* (se calculan solos y muestran fuente y fecha) y el menú principal.
- **Categoría** (lápiz junto a su nombre): título, descripción breve, icono y **cifras clave** que aparecen en la página de la categoría.
- **Página**: además del título y la entradilla, indica el **responsable** de la información. La fecha de actualización se pone sola al publicar; la fuente se toma de los conjuntos de datos que usan sus bloques.
- **Documentos**: añade a cada documento su tipo (Acta, Informe…), fecha, formato y tamaño. Con «Agrupar por años», el último año queda visible y los anteriores en «Histórico».
- **Buscador**: el vocabulario ciudadano («sueldos» → retribuciones) está en `content/sinonimos.json`.

## Revisar y publicar

**Revisar y publicar** sigue cuatro pasos:

1. **Cambios preparados:** cada fichero con un resumen («Página «Contratos»: 2 bloques modificados», «Datos «Agenda»: 3 registros nuevos») y una tabla **antes / después**. Se puede descartar fichero a fichero.
2. **Comprobaciones:** datos conformes al esquema (tipos, listas de valores, identificadores repetidos), enlaces internos y páginas inexistentes, configuración de los componentes de datos (conjuntos, campos y filtros que existan), traducciones, documentos sin fecha o sin enlace, contraste de colores y fuentes de datos. Los **errores bloquean** la publicación; los avisos no. Cada incidencia tiene un botón «Corregir».
3. **Vista previa** del portal con los cambios sin publicar, en escritorio, tableta y móvil, y en modo oscuro (también con el botón «Vista previa» de la barra superior).
4. **Publicar**, de dos maneras:
   - **Enviar a revisión** (recomendado en producción): crea una rama y una *propuesta de cambios* (pull request) en GitHub con el resumen y el resultado de las comprobaciones. Al aprobarla y fusionarla, el portal se publica solo. El token necesita además *Pull requests: Read and write*.
   - **Publicar directamente:** un único commit en la rama publicada; el portal se actualiza en 1–2 minutos.

**Descargar ficheros** sigue disponible para entregarlos a quien mantenga el repositorio.

### Conexión con GitHub y seguridad

Token de grano fino limitado al repositorio con *Contents: Read and write* (y *Actions: Read and write* para lanzar la sincronización). Se guarda solo durante la sesión salvo que se marque «Recordar»; «Olvidar el token» lo borra del navegador.

Para un despliegue en producción se recomienda:

- sustituir el token personal por una **GitHub App u OAuth** con un pequeño servicio intermedio, para que nadie maneje tokens;
- **proteger la rama publicada** (*Settings → Branches*): exigir pull request y aprobación, y dejar el editor en «Enviar a revisión».

### Roles editoriales

Con la revisión activada, los roles se apoyan en los permisos de GitHub:

| Rol | Qué hace | Cómo se configura |
|---|---|---|
| Editor de contenido | Modifica páginas y datos manuales y envía a revisión | Colaborador con permiso *Write* (crea ramas, no puede fusionar en la rama protegida) |
| Responsable de área | Valida los contenidos de su área | Revisor obligatorio por ruta (`CODEOWNERS`, p. ej. `data/presupuesto.json @intervencion`) |
| Administrador de transparencia | Configuración, conjuntos de datos y obligaciones | Propietario de `config/`, `data/metadata/` y `data/obligaciones.json` en `CODEOWNERS` |
| Publicador | Aprueba y fusiona: publica | *Maintain* o regla de protección que exija su aprobación |

Los cambios se guardan como borrador en el navegador hasta que se publican; si se cierra la pestaña, al volver se ofrece recuperarlos. **Deshacer** (o Ctrl+Z) revierte el último cambio.

## Recomendaciones

- Mantén el bloque *Obligaciones de la página* al final de cada página: muestra al ciudadano qué exige la ley y si se cumple.
- El estado de las obligaciones se recalcula solo con las fechas de actualización. Solo hace falta anotar a mano en *Datos → Cumplimiento de las obligaciones* lo que no se puede deducir: si una obligación «no aplica», si está «incompleta» o la fecha de una publicación hecha fuera del portal.
- No publiques datos personales de personas físicas fuera de los supuestos legales (altos cargos y cargos electos).
