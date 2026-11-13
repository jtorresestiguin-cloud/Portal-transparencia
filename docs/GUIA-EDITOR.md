# Guía del editor de contenidos

El editor está en `/admin/` del portal (por ejemplo, `https://…/Portal-transparencia/admin/`). Funciona en el navegador: no hay que instalar nada.

## Pantalla

```
┌───────────────────────────────────────────────────────────────────────────┐
│ Gestión de contenidos   Idioma de edición [ES]  Ver portal  Deshacer  Publicar (3) │
├──────────────┬──────────────────────────────────────────┬────────────────┤
│ Páginas      │  Título · Entradilla · Icono             │ Componentes    │
│ Datos        │  ┌──────────── bloque ────────────┐ ↑↓⧉🗑 │  (paleta) o    │
│ Entidad      │  │  vista previa real             │       │ Propiedades    │
│ Fuentes      │  └────────────────────────────────┘       │ del bloque     │
│ (árbol)      │              ＋                            │ seleccionado   │
└──────────────┴──────────────────────────────────────────┴────────────────┘
```

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
4. Los conjuntos con ⟳ (contratos, encargos, subvenciones) se actualizan solos; lo que añadas a mano se marca como «carga manual» y la sincronización lo conserva.

## Entidad

Nombre en los tres idiomas, NIF, DIR3, dirección, sede electrónica, escudo y **colores corporativos** (se aplican a todo el portal). También los identificadores del órgano para la Plataforma de Contratación y la BDNS.

## Portada y categorías

- **Portada** (botón «Portada» bajo el árbol): título, frase de bienvenida, *Lo más consultado* (preguntas en lenguaje ciudadano y la página que las responde), *Datos destacados* (se calculan solos y muestran fuente y fecha) y el menú principal.
- **Categoría** (lápiz junto a su nombre): título, descripción breve, icono y **cifras clave** que aparecen en la página de la categoría.
- **Página**: además del título y la entradilla, indica el **responsable** de la información. La fecha de actualización se pone sola al publicar; la fuente se toma de los conjuntos de datos que usan sus bloques.
- **Documentos**: añade a cada documento su tipo (Acta, Informe…), fecha, formato y tamaño. Con «Agrupar por años», el último año queda visible y los anteriores en «Histórico».
- **Buscador**: el vocabulario ciudadano («sueldos» → retribuciones) está en `content/sinonimos.json`.

## Publicar

**Publicar** muestra los ficheros modificados y permite:

- **Publicar en GitHub:** crea un único commit en el repositorio; el portal se actualiza en 1–2 minutos. Necesita un *token de acceso de grano fino* de GitHub limitado al repositorio, con permiso **Contents: Read and write** (y **Actions: Read and write** para lanzar la sincronización desde la pestaña *Fuentes*). El token se guarda solo en el navegador.
- **Descargar ficheros:** para entregarlos a quien mantenga el repositorio.
- **Descartar:** todo o fichero a fichero.

Los cambios se guardan como borrador en el navegador hasta que se publican; si se cierra la pestaña, al volver se ofrece recuperarlos. **Deshacer** (o Ctrl+Z) revierte el último cambio.

## Recomendaciones

- Mantén el bloque *Obligaciones de la página* al final de cada página: muestra al ciudadano qué exige la ley y si se cumple.
- Tras cambiar datos, revisa la pestaña *Índice de transparencia* del portal y actualiza en *Datos → Cumplimiento de las obligaciones* el estado y la fecha de las obligaciones afectadas.
- No publiques datos personales de personas físicas fuera de los supuestos legales (altos cargos y cargos electos).
