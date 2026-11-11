# Modelo de datos

Cada conjunto vive en `data/<id>.json` con esta envoltura:

```json
{ "generat": "2026-11-11", "avis": "…", "unitat": "EUR", "dades": [ { … }, … ] }
```

El esquema de cada conjunto (campos, tipos, descripción y lista de códigos asociada) está en `data/metadata/datasets.json`. Para añadir o modificar un conjunto:

1. Declarar sus metadatos y campos en `datasets.json` (título y descripción en ca/es/en, tema EU y NTI, periodicidad, cobertura temporal).
2. Si usa códigos, añadir la lista en `data/codelists.json` con etiquetas en los tres idiomas.
3. Dejar el fichero `data/<id>.json`.
4. `npm run build` → valida y regenera CSV, catálogo, Data Package y OpenAPI.

## Conjuntos

| Id | Contenido | Periodicidad | Origen previsto |
|---|---|---|---|
| `pressupost` | Inicial / definitivo / ejecutado por año, tipo, capítulo y programa | Trimestral | ERP económico-financiero |
| `contractes` | Contratos adjudicados (incl. menores), alineados con PSCP/OCDS | Continua | PSCP / API de contratación |
| `subvencions` | Subvenciones concedidas con referencia BDNS | Trimestral | Gestión de subvenciones / BDNS |
| `convenis` | Convenios firmados y obligaciones económicas | Trimestral | Registro de convenios |
| `plantilla` | Efectivos por categoría, sexo, edad y relación laboral | Anual | RRHH |
| `retribucions` | Bandas salariales y medias por sexo | Anual | Nóminas / RRHH |
| `alts-carrecs` | Puestos directivos, retribución y declaraciones | Anual | Secretaría |
| `agenda` | Agenda institucional con grupos de interés | Semanal | Agenda corporativa / Registro de grupos de interés |
| `regals` | Registro de regalos | Trimestral | Secretaría |
| `indicadors-turisme` | 9 indicadores mensuales desde 2019 | Mensual | Observatori del Turisme, INE/Idescat, Aena, Port, datos propios |
| `mercats-origen` | Cuota por mercado emisor (ISO 3166) | Anual | Observatori / INE |
| `oficines-informacio` | Oficinas georreferenciadas (WGS84) y visitas | Anual | Datos propios |
| `dret-acces` | Solicitudes de acceso, tema, resolución y plazos | Trimestral | Registro / seu electrònica |
| `objectius` | Objetivos estratégicos con base, valor actual y meta | Semestral | Plan de actuación |
| `obligacions` | Autoevaluación de 42 obligaciones de la Ley 19/2014 | Mensual | Unidad de Transparencia |

## Protección de datos

- El prototipo no contiene nombres de personas físicas. En producción, la identificación de altos cargos (art. 9.1.g Ley 19/2014) debe publicarse; el resto de personas (solicitantes, personal) solo de forma agregada o anonimizada.
- Los identificadores de solicitudes de acceso son anonimizados y no permiten reidentificar a la persona solicitante.
- Los NIF de personas jurídicas adjudicatarias o beneficiarias son información pública; los de personas físicas no deben publicarse.
