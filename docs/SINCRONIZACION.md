# Sincronización con fuentes oficiales

## Resumen

| | Plataforma de Contratación del Sector Público | Base de Datos Nacional de Subvenciones |
|---|---|---|
| Conector | `scripts/sync/placsp.mjs` | `scripts/sync/bdns.mjs` |
| Formato | Atom de sindicación + CODICE (XML) | API REST JSON |
| Filtro | NIF/DIR3 o nombre del órgano de contratación (`LocatedContractingParty/Party`) | Identificador del órgano concedente (`organos`) |
| Destino | `data/contratos.json`, `data/encargos.json` | `data/subvenciones.json` |
| Frecuencia | Diaria (incremental desde la última ejecución correcta, con 3 días de margen) | Diaria (7 días de margen) |

Orquestador: `scripts/sync/run.mjs`. Estado: `data/sync/estado.json` (visible en el editor, pestaña *Fuentes*, y en el bloque *Origen de los datos*).

## Configuración (`config/entidad.json` → `fuentes`)

```json
"placsp": {
  "activo": true,
  "feeds": [
    { "tipo": "licitaciones", "url": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom" },
    { "tipo": "menores", "url": "https://contrataciondelsectorpublico.gob.es/sindicacion/sindicacion_1143/contratosMenoresPerfilesContratantes.atom" }
  ],
  "identificadores_organo": ["P4600000X", "L01460000"],
  "nombres_organo": ["Ayuntamiento de …"],
  "desde": "2022-01-01",
  "max_paginas": 400
},
"bdns": { "activo": true, "api": "https://www.infosubvenciones.es/bdnstrans/api", "organos": ["…"], "desde": "2022-01-01" }
```

> **Verificar antes de producción.** La URL del feed de licitaciones (sindicación 643) y la API de la BDNS están contrastadas con documentación pública. El número y el nombre exacto del feed de **contratos menores** (aquí `sindicacion_1143`) y los parámetros de la API de la BDNS deben confirmarse en las páginas oficiales de datos abiertos de la PLACSP y en el Swagger de la BDNS (`/bdnstrans/doc/swagger`). Las URL son configurables sin tocar código.

## Reglas de fusión

- Los registros con fuente `placsp` o `bdns` se sustituyen por su versión más reciente (por identificador de entrada).
- Las entradas borradas en PLACSP (`at:deleted-entry`) se eliminan.
- Los registros con fuente `manual` (dados de alta en el editor) se conservan siempre.
- Los datos de ejemplo se eliminan al recibir el primer dato real.
- Si la fuente no devuelve nada del órgano configurado, no se toca el conjunto y se registra el aviso `sin_resultados` (normalmente, identificador mal configurado).
- Un fallo de red de una fuente no impide publicar el resto (`--estricto` para hacerlo fallar).
- Los códigos nuevos (por ejemplo, un procedimiento que no esté en `data/codelists.json`) generan un aviso en la validación, no un error.

## Mapeo CODICE → modelo del portal

| Campo del portal | Ruta en la entrada CODICE |
|---|---|
| `expediente` | `ContractFolderStatus/ContractFolderID` |
| `estado` | `ContractFolderStatus/ContractFolderStatusCode` |
| `organo` | `LocatedContractingParty/Party/PartyName/Name` |
| `objeto` | `ProcurementProject/Name` (o `entry/title`) |
| `tipo` | `ProcurementProject/TypeCode` |
| `presupuesto_base_sin_iva` | `ProcurementProject/BudgetAmount/TaxExclusiveAmount` |
| `cpv` | `ProcurementProject/RequiredCommodityClassification/ItemClassificationCode` |
| `duracion_meses` | `ProcurementProject/PlannedPeriod/DurationMeasure` (convierte años y días) |
| `procedimiento` | `TenderingProcess/ProcedureCode` (en el feed de menores, `6` si falta) |
| `fecha_adjudicacion`, `numero_ofertas`, `adjudicatario_pyme` | `TenderResult/AwardDate`, `ReceivedTenderQuantity` (máximo de los lotes), `SMEAwardedIndicator` |
| `adjudicatario`, `adjudicatario_nif` | `TenderResult/WinningParty/PartyName/Name`, `PartyIdentification/ID` |
| `importe_adjudicacion_sin_iva` / `con_iva` | `TenderResult/AwardedTenderedProject/LegalMonetaryTotal/TaxExclusiveAmount` / `PayableAmount` (suma de lotes) |
| `fecha_formalizacion` | `TenderResult/Contract/IssueDate` |
| `url` | `entry/link/@href` |

Los **encargos a medios propios** se identifican por el texto de la entrada («encargo», «encomienda», «medio propio») y van a `data/encargos.json`.

## Carga histórica

El feed diario solo cubre las publicaciones recientes. Para cargar años anteriores:

1. Descarga los ZIP mensuales de datos abiertos de la PLACSP (licitaciones y contratos menores) y descomprímelos en una carpeta.
2. Ejecuta `node scripts/sync/run.mjs --solo placsp --placsp-archivos ./carpeta`.
3. Revisa, ejecuta `npm run build` y publica.

## Pruebas

`tests/sync.test.mjs` comprueba el analizador XML, el filtrado por órgano, la paginación, la suma de lotes, los menores, los encargos y el mapeo de la BDNS con los ficheros de `tests/fixtures/` (sin red). Se ejecuta en cada publicación y antes de cada sincronización.
