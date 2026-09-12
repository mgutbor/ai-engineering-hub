# Implementation Design v1

## 0. Estado, propósito y trazabilidad

**Proyecto:** Personal Technical Knowledge & Decision Navigator  
**Versión:** Implementation Design v1  
**Estado:** Slice A y Slice B implementados y verificados
**Product Contract:** `docs/01-product-contract.md`  
**Architecture Decision:** `docs/02-architecture-decision-v1.md`  
**AI / Grounding Contract:** `docs/03-ai-grounding-contract.md`  
**Retrieval Contract:** `docs/04-retrieval-contract.md`  
**Testing Strategy:** `docs/05-testing-strategy.md`  
**Privacy Notes:** `docs/06-privacy-data-handling.md`

Este documento concreta la arquitectura aprobada. No reabre decisiones de producto ni introduce funcionalidades fuera del MDP.

No contiene:

- código de producción;
- estructura de carpetas;
- nombres de archivos;
- schema SQL detallado;
- componentes concretos;
- configuración de infraestructura;
- configuración operativa del proveedor o despliegue;

Slice B añade una única integración concreta de grounded synthesis documentada en `docs/adr/002-slice-b-ai-adapter.md`. No se introduce una plataforma genérica de IA.

---

# 1. System structure

## 1.1 Forma del sistema

El sistema será un monolito modular pequeño con un único runtime de aplicación.

Las fronteras siguientes son módulos conceptuales dentro del mismo sistema, no servicios desplegables:

```text
Frontend Presentation
        ↓
Application
        ↓
Domain semantics
        ↓
Persistence / Retrieval / Grounded synthesis
        ↓
Deterministic validation
        ↓
Presentable response
```

El evaluation corpus y sus acceptance cases existen en el ámbito de evaluación, no como una segunda aplicación runtime.

## 1.2 Módulos y responsabilidades

### Presentation

Responsable de:

- interacción de usuario;
- CRUD de Knowledge Items;
- búsqueda textual;
- envío de preguntas aisladas;
- representación de claims, evidencias, estados y errores;
- navegación desde una claim al fragmento inspeccionable.

No conoce detalles de SQLite, prompts, proveedores ni reglas internas de validación.

### Application

Responsable de:

- coordinar casos de uso;
- elegir el corpus consultable;
- ejecutar Retrieval;
- construir el contexto limitado para IA;
- invocar grounded synthesis;
- invocar validación determinista;
- producir resultados seguros para Presentation;
- impedir que la IA modifique el user corpus.

### Domain semantics

Responsable de:

- identidad y ciclo de vida de `KnowledgeItem`;
- estados `ACTIVE`, `SUPERSEDED`, `ARCHIVED`;
- procedencia;
- reglas de contenido original;
- revisiones de contenido;
- distinción entre source of record y datos derivados.

El dominio no conoce IA, Retrieval, HTTP, React ni SQLite.

### Persistence

Responsable de:

- conservar el user corpus;
- leer y escribir Knowledge Items;
- mantener la consistencia entre contenido y su índice textual;
- invalidar datos derivados tras update/delete.

Persistence no genera claims ni respuestas.

### Retrieval

Responsable de:

- búsqueda textual;
- selección determinista de fragmentos;
- creación del `RetrievalContext`;
- conservación de identidad, revisión, estado y procedencia del origen.

Retrieval no genera respuestas ni clasifica claims.

### Grounded synthesis

Responsable de:

- enviar la pregunta y el contexto limitado a la IA;
- recibir un draft estructurado;
- mapear errores de disponibilidad o formato.

No tiene acceso directo a Persistence ni puede escribir Knowledge Items.

### Deterministic validation

Responsable de:

- validar la estructura del draft;
- validar referencias e identidades;
- comprobar pertenencia de fragmentos;
- comprobar pertenencia al RetrievalContext;
- comprobar revisión, estado y procedencia;
- decidir si una claim puede presentarse como `SUPPORTED` bajo la política conservadora de v1;
- degradar de forma segura las claims no verificables.

No pretende demostrar verdad objetiva ni resolver la semántica completa de una paráfrasis.

### Evaluation support

Responsable únicamente de:

- alojar el evaluation corpus congelado;
- ejecutar Q1-Q9;
- comparar retrieval esperado;
- evaluar salidas del modelo según los acceptance cases.

No puede escribir el user corpus ni contaminar consultas normales.

## 1.3 Dependencias permitidas

```text
Presentation → Application-facing API
Application → Domain
Application → Persistence capability
Application → Retrieval capability
Application → Grounded synthesis capability
Application → Deterministic validation
Retrieval → Persistence read capability
Validation → Domain values + RetrievalContext + AI draft
Persistence → SQLite
Grounded synthesis adapter → external AI transport
Evaluation → fixtures + application contracts
```

Las dependencias son de responsabilidad, no implican necesariamente paquetes separados.

## 1.4 Dependencias prohibidas

- Presentation → SQLite;
- Presentation → proveedor de IA;
- Presentation → prompt o selección de contexto;
- Domain → React, Node HTTP, SQLite, SDK de IA o Retrieval;
- Retrieval → proveedor de IA;
- Retrieval → generación de respuestas;
- Grounded synthesis → Persistence directa;
- IA → escritura de Knowledge Items;
- Validation → una segunda llamada a un LLM para decidir si otra salida de LLM es válida;
- user corpus → evaluation corpus en runtime normal;
- evaluation fixtures → mutación por casos de uso de usuario;
- cualquier módulo → un `IRepository<T>`, `IProcessor<T>` o plataforma genérica no justificada.

---

# 2. Domain model mínimo

Solo `KnowledgeItem` es una entidad persistida de dominio. El resto son values o resultados derivados necesarios para atravesar los boundaries.

## 2.1 KnowledgeItem

### Por qué existe

Es la unidad de contenido original que el usuario puede crear, leer, actualizar y eliminar. Es el source of record del user corpus.

### Datos mínimos

- `id`;
- `title`;
- `content` original;
- `createdAt`;
- `updatedAt`;
- `revision` monotónica;
- `status`;
- `provenance`;
- `sourceReference` opcional.

### Invariantes

- `id` es estable y no cambia;
- título y contenido no están vacíos;
- `createdAt` no cambia después de crear el item;
- `updatedAt` cambia cuando cambia contenido o metadata editable;
- `revision` aumenta con cada actualización que puede afectar Retrieval;
- `status` pertenece al vocabulario cerrado;
- `provenance` es conocida;
- el contenido original no puede ser reemplazado por una respuesta de IA;
- eliminar el item lo excluye de nuevos resultados y contextos.

### Reglas de procedencia

Los Knowledge Items creados por el usuario tienen procedencia `human-authored`.

La procedencia `imported` se conserva para fixtures o datos que ya existan en el evaluation corpus, pero no se añade una operación de importación al producto.

La procedencia no se cambia como una edición ordinaria del usuario porque describe el origen del registro.

## 2.2 KnowledgeItemId

### Por qué existe

Permite referenciar un Knowledge Item sin utilizar el título, que puede cambiar y no es único.

### Datos mínimos

- identificador estable y opaco.

### Invariante

Una referencia a un Knowledge Item solo es válida si el identificador existe en el corpus seleccionado y corresponde a la revisión utilizada.

## 2.3 KnowledgeItemStatus

### Por qué existe

Permite interpretar una fuente según su vigencia sin eliminar su historia.

### Valores

- `ACTIVE`;
- `SUPERSEDED`;
- `ARCHIVED`.

### Invariantes

- no existen estados adicionales en v1;
- `SUPERSEDED` puede respaldar una afirmación histórica;
- `SUPERSEDED` no se presenta silenciosamente como recomendación actual;
- `ARCHIVED` puede aportar contexto, pero no es orientación activa por defecto;
- el estado no demuestra verdad objetiva ni falsedad.

`SUPERSEDED` y `ARCHIVED` no son errores de dominio. Son metadata visible que puede modificar la presentación.

## 2.4 KnowledgeItemProvenance

### Por qué existe

Distingue contenido humano del contenido importado y evita presentar un resumen importado como si fuese una nota original.

### Valores mínimos

- `human-authored`;
- `imported`.

### Invariantes

- debe estar presente en todo Knowledge Item;
- se conserva al derivar fragmentos o respuestas;
- no convierte el contenido en verdad objetiva.

## 2.5 Claim

### Por qué existe

La tesis exige evaluar la respuesta a nivel de afirmación y no como un único párrafo.

### Naturaleza

Es un resultado derivado de una pregunta. No se persiste como Knowledge Item ni se convierte en source of record.

### Datos mínimos

- `claimId` local a la respuesta;
- texto de la afirmación;
- `claimSupport` presentado;
- referencias a evidencias;
- indicación de si la evidencia se utiliza como soporte directo o como base de inferencia.

### Invariantes

- no puede citar un Knowledge Item que no esté en el RetrievalContext;
- una claim `SUPPORTED` necesita evidencia verificable;
- una claim `INFERRED` debe mostrar las evidencias de las que deriva;
- una claim `INSUFFICIENT` no puede presentarse como directamente respaldada;
- ninguna claim modifica el corpus.

## 2.6 ClaimSupport

### Por qué existe

Representa el grado de soporte presentado al usuario sin mezclarlo con el estado de la fuente o la condición del conjunto de evidencias.

### Valores

- `SUPPORTED`;
- `INFERRED`;
- `INSUFFICIENT`.

### Invariantes

- no se acepta el valor propuesto por la IA sin pasar los gates de validación;
- `SUPPORTED` requiere referencia válida y política conservadora de correspondencia textual directa en v1;
- `INFERRED` no se presenta como cita literal;
- `INSUFFICIENT` implica abstención sobre la parte no establecida.

## 2.7 EvidenceCondition

### Por qué existe

Describe el estado del conjunto de evidencias, que es diferente del soporte de una claim individual.

### Valores implementados en v1

- `CLEAR`;
- `CONTEXTUAL_DIVERGENCE`.

`CONFLICT` queda reservado conceptualmente. No se implementa un motor general ni se utiliza como resultado automático de v1.

### Invariantes

- no se utiliza como cuarto valor de `ClaimSupport`;
- `CONTEXTUAL_DIVERGENCE` debe mostrar las fuentes y sus contextos;
- no permite resolver automáticamente una diferencia;
- `CLEAR` no significa verdad objetiva.

## 2.8 EvidenceReference

### Por qué existe

Conecta una claim con el fragmento concreto que la respuesta declara utilizar.

### Naturaleza

Es un value derivado de la respuesta y del RetrievalContext. No es una entidad persistida.

### Datos mínimos

- `evidenceId` opaco perteneciente al RetrievalContext;
- `knowledgeItemId`;
- `itemRevision`;
- localizador del fragmento;
- referencia opcional del Knowledge Item;
- estado y procedencia heredados.

### Invariantes

- el `evidenceId` debe existir en el contexto actual;
- el Knowledge Item debe existir y coincidir;
- la revisión debe coincidir con la utilizada en retrieval;
- el fragmento debe poder inspeccionarse;
- la IA no puede crear ni ampliar el conjunto de referencias válidas.

## 2.9 RetrievalFragment

### Por qué existe

Es la unidad mínima que Retrieval entrega para lectura y generación.

### Datos mínimos

- `evidenceId`;
- `knowledgeItemId`;
- `itemRevision`;
- texto del fragmento;
- localizador estable dentro del Knowledge Item, preferiblemente ordinal y offsets;
- estado;
- procedencia;
- referencia opcional del origen.

### Invariantes

- el texto corresponde al contenido de la revisión indicada;
- el fragmento pertenece a un único Knowledge Item;
- el usuario puede abrir el contexto suficiente para inspeccionarlo;
- un fragmento de una revisión anterior no es válido para una respuesta nueva después de update/delete.

## 2.10 RetrievalContext

### Por qué existe

Delimita qué evidencias estuvieron disponibles para una pregunta y evita que la IA cite cualquier contenido del corpus.

### Datos mínimos

- `contextId`;
- pregunta o consulta normalizada para esa operación;
- corpus seleccionado;
- lista ordenada de `RetrievalFragment`;
- revisión de cada Knowledge Item utilizado;
- límite aplicado a los resultados;
- momento de creación.

### Invariantes

- solo incluye fragmentos obtenidos por Retrieval para esa pregunta;
- no incluye respuestas ni claims generadas;
- todas sus referencias son inspeccionables;
- una modificación o eliminación posterior puede invalidarlo para presentar una nueva respuesta.

## 2.11 GroundedResponse

### Por qué existe

Es el resultado presentable después de validar el draft y no el output crudo de la IA.

### Datos mínimos

- pregunta aislada;
- respuesta textual, si existe;
- claims validadas o degradadas;
- RetrievalContext o sus evidencias inspectables;
- EvidenceCondition cuando corresponda;
- estado de disponibilidad o insuficiencia, si no existe respuesta grounded.

### Invariantes

- nunca presenta como grounded un draft no validado;
- no persiste automáticamente;
- conserva procedencia y source status de cada evidencia;
- puede representar una abstención sin inventar respuesta.

---

# 3. Application use cases

## 3.1 Create Knowledge Item

### Entrada

- título;
- contenido original;
- estado inicial, por defecto `ACTIVE`;
- referencia opcional.

La procedencia de un item creado por el usuario es `human-authored`.

### Salida

Knowledge Item creado con identidad, fechas y revisión inicial.

### Reglas

- no llama a IA;
- actualiza el índice textual de forma consistente;
- no crea claims ni resúmenes derivados.

### Errores principales

- datos requeridos ausentes o inválidos;
- fallo de persistencia/indexación, sin confirmar el item como creado.

## 3.2 Get Knowledge Item

### Entrada

- `KnowledgeItemId`.

### Salida

Contenido original, metadata, estado, procedencia, referencia y revisión.

### Error principal

- item inexistente: error visible equivalente a not found.

## 3.3 Update Knowledge Item

### Entrada

- `KnowledgeItemId`;
- revisión esperada;
- campos editables: título, contenido, estado y referencia opcional.

### Salida

Knowledge Item actualizado con nueva revisión.

### Reglas

- `id` y `createdAt` son inmutables;
- `provenance` no se cambia como edición ordinaria;
- el índice textual se actualiza junto con el contenido;
- cualquier RetrievalContext anterior sobre la revisión modificada deja de ser válido para nuevas respuestas;
- una actualización conflictiva por revisión inesperada no sobrescribe silenciosamente el contenido actual.

### Errores principales

- item inexistente;
- revisión esperada obsoleta;
- datos inválidos;
- fallo de consistencia entre contenido e índice.

## 3.4 Delete Knowledge Item

### Entrada

- `KnowledgeItemId`;
- revisión esperada.

### Salida

Confirmación determinista de eliminación.

### Reglas

- elimina el source of record del user corpus;
- elimina o invalida su representación textual derivada;
- invalida contextos posteriores que lo referencien;
- no mantiene una respuesta de IA como sustituto del item.

### Errores principales

- item inexistente;
- revisión esperada obsoleta;
- fallo de eliminación consistente.

## 3.5 Search Knowledge Items

### Entrada

- consulta textual opcional;
- corpus objetivo: user corpus en uso normal;
- límite de resultados.

Sin consulta, devuelve la lista de Knowledge Items. Con consulta, devuelve coincidencias textuales y fragmentos inspeccionables.

### Salida

- Knowledge Items coincidentes;
- fragmentos relevantes;
- ranking determinista;
- estado y procedencia.

### Reglas

- no usa IA;
- no amplía semánticamente la consulta;
- no mezcla evaluation corpus con user corpus;
- puede seguir funcionando con IA deshabilitada.

## 3.6 Retrieve Evidence

### Entrada

- pregunta o consulta textual;
- corpus objetivo;
- límite de fragmentos.

### Salida

Un `RetrievalContext` con cero o más fragmentos, identidad de origen, revisión, estado y procedencia.

### Reglas

- usa únicamente Retrieval textual;
- no genera claims;
- no decide soporte semántico;
- no llama a IA;
- si no encuentra resultados, devuelve un contexto vacío y una condición segura.

Es una boundary real para Application, pero no necesita un endpoint público independiente en v1. `Ask Question` y `Search Knowledge Items` son sus puntos de entrada de producto.

## 3.7 Ask Question

### Entrada

- una pregunta aislada;
- corpus objetivo implícito: user corpus en uso normal.

### Flujo

1. validar la pregunta;
2. ejecutar `Retrieve Evidence`;
3. si no existe evidencia relevante, abstenerse;
4. limitar el contexto a los fragmentos seleccionados;
5. ejecutar `Generate Grounded Draft`;
6. ejecutar `Validate Grounded Draft`;
7. devolver `GroundedResponse` o un resultado seguro.

### Salida

- respuesta validada, si existe;
- claims clasificadas;
- evidencias inspectables;
- estado de fuente;
- condición de evidencia;
- estado seguro si no puede responderse.

### No hace

- persistir pregunta o respuesta por defecto;
- iniciar una conversación;
- modificar Knowledge Items;
- utilizar conocimiento fuera del contexto recuperado.

## 3.8 Generate Grounded Draft

### Entrada

- pregunta aislada;
- `RetrievalContext` limitado.

### Salida

Un draft probabilístico con:

- respuesta candidata;
- claims candidatas;
- clasificación propuesta por claim;
- referencias candidatas mediante `evidenceId`;
- evidencia textual citada, si la IA la proporciona;
- premisas de una inferencia;
- condición de evidencia propuesta, si aplica.

### Reglas

- solo puede seleccionar identificadores presentes en el contexto que recibe;
- no puede crear Knowledge Items ni referencias nuevas;
- no accede a Persistence;
- sus valores son no confiables hasta validación;
- una respuesta malformada no llega a Presentation.

## 3.9 Validate Grounded Draft

### Entrada

- draft probabilístico;
- RetrievalContext original;
- snapshot vigente de los Knowledge Items referenciados.

### Salida

`GroundedResponse` validada o resultado de fallo seguro.

### Reglas

- valida primero estructura y provenance;
- aplica la política conservadora de `SUPPORTED`;
- degrada claims no verificables;
- preserva estados y procedencia;
- no llama a otro LLM para validar el draft;
- no modifica el corpus.

---

# 4. Internal contracts

## 4.1 Application → Retrieval

### Entra

- pregunta textual;
- corpus seleccionado;
- límite de resultados/fragmentos.

### Sale

- `RetrievalContext`;
- indicación de contexto vacío o resultados relacionados pero insuficientes;
- errores técnicos de Retrieval cuando no puede completar la operación.

### Garantías

- cada fragmento tiene origen, revisión, estado y procedencia;
- cada `evidenceId` es único dentro del contexto;
- no se incluyen fragmentos no inspeccionables.

## 4.2 Application → Grounded synthesis

### Entra

- pregunta aislada;
- fragmentos necesarios;
- `evidenceId` opacos;
- status/provenance mínimo necesario para interpretar fuentes;
- restricciones de respuesta grounded.

### Sale

- draft probabilístico estructurado;
- error de disponibilidad;
- error de respuesta malformada;
- error técnico del adaptador.

La IA no recibe acceso a Persistence ni puede consultar otros Knowledge Items.

## 4.3 Grounded synthesis → Validation

### Entra

- texto de respuesta;
- claims;
- support propuesto;
- evidence IDs propuestos;
- citas textuales propuestas, si existen;
- base de evidencias para inferencias;
- condición propuesta.

### Sale

- claims presentables con `SUPPORTED`, `INFERRED` o `INSUFFICIENT`;
- referencias aceptadas y descartadas;
- evidencias inspeccionables;
- `CLEAR` o `CONTEXTUAL_DIVERGENCE` cuando puede mostrarse con las fuentes válidas;
- fallo seguro si el draft no puede validarse.

## 4.4 Validation → Presentation

Presentation recibe únicamente un resultado validado o un estado seguro:

- respuesta y claims;
- clasificación final presentable;
- evidencia y origen;
- estado y procedencia de fuente;
- condición de evidencia;
- abstención, no results, IA unavailable o grounding failure;
- información suficiente para inspección.

Presentation no recibe el draft no validado como si fuera una respuesta final.

---

# 5. AI contract

## 5.1 Capacidad

La única capacidad de IA de v1 es **grounded synthesis**.

No se diseña una plataforma de capacidades ni una abstracción genérica de proveedores.

## 5.2 Reglas de entrada

La IA recibe solo:

- una pregunta aislada;
- los fragmentos seleccionados;
- identificadores de evidencia opacos;
- status/provenance mínimo cuando sea necesario para la interpretación;
- instrucciones para abstenerse ante falta de soporte.

No recibe:

- acceso directo a la base de datos;
- corpus completo;
- Knowledge Items no recuperados;
- conversación previa;
- permisos para modificar contenido.

## 5.3 Draft mínimo

El draft debe permitir representar:

- respuesta candidata;
- lista de claims;
- texto de cada claim;
- clasificación `SUPPORTED`, `INFERRED` o `INSUFFICIENT` propuesta por la IA;
- referencias mediante `evidenceId`;
- cita textual propuesta cuando la claim se presenta como supported;
- evidencias base de una inferencia;
- condición `CLEAR` o `CONTEXTUAL_DIVERGENCE` propuesta, con sus referencias.

La IA no puede utilizar identificadores que no estén presentes en el contexto de entrada.

## 5.4 Política de clasificación

La clasificación de la IA es advisory.

### SUPPORTED

La aplicación solo la presenta automáticamente como `SUPPORTED` si:

- las referencias son válidas;
- los fragmentos pertenecen al contexto;
- la revisión es vigente;
- el usuario puede inspeccionarlos;
- existe una `evidenceQuote` verificable dentro del fragmento;
- la claim es un restatement `deletion-only` conservador de la quote.

La política conservadora no acepta una claim por la mera clasificación de la IA. Una claim puede eliminar material de la quote conservando el orden, pero no puede añadir, cambiar o reordenar tokens ni eliminar operadores protegidos de la proposición que conserva. La comprobación no demuestra entailment semántico completo.

### INFERRED

Se presenta como `INFERRED` cuando las referencias son válidas y la claim no puede demostrarse mediante el restatement `deletion-only` conservador, por lo que añade una interpretación, síntesis o paráfrasis no demostrable por la regla textual. Las evidencias base deben mostrarse.

Una claim que falla la regla con evidencia válida se degrada a `INFERRED`; una claim sin evidencia válida queda `INSUFFICIENT`.

### INSUFFICIENT

Se presenta como `INSUFFICIENT` cuando el corpus no soporta suficientemente la claim, las referencias son inválidas o la respuesta requiere conocimiento externo.

## 5.5 Prohibiciones

- La IA no crea Knowledge Items.
- La IA no crea EvidenceReferences válidas.
- La IA no valida sus propias referencias.
- La IA no modifica Knowledge Items.
- La IA no rellena huecos con conocimiento externo.
- La IA no convierte una inferencia en source of record.
- La IA no resuelve `CONFLICT`.

---

# 6. Deterministic validation design

## 6.1 Pipeline

```text
AI draft
   ↓
Parse and shape validation
   ↓
Evidence reference validation
   ↓
Knowledge Item and revision validation
   ↓
Retrieval context membership
   ↓
Inspectable fragment validation
   ↓
Source status/provenance propagation
   ↓
Conservative claim presentation policy
   ↓
GroundedResponse
```

## 6.2 Validaciones obligatorias

### Estructura

- el draft tiene respuesta o una abstención explícita;
- cada claim tiene identidad local y texto;
- cada clasificación pertenece al vocabulario permitido;
- cada referencia utiliza un `evidenceId` conocido;
- no se aceptan campos desconocidos que alteren la semántica de validación sin una decisión explícita.

### Identidad

- el Knowledge Item existe;
- la referencia apunta al Knowledge Item correcto;
- el `evidenceId` pertenece al RetrievalContext actual;
- el fragmento pertenece al Knowledge Item;
- la revisión del fragmento coincide con la consultada;
- el item no fue eliminado ni editado después de crear el contexto.

### Inspeccionabilidad

- el texto del fragmento está disponible para la presentación;
- el localizador permite situarlo dentro del contenido original;
- la UI puede mostrar el fragmento y su Knowledge Item;
- una cita textual propuesta por la IA coincide con el texto recuperado, cuando se presenta como cita.

### Source status y provenance

- status y provenance se leen del Knowledge Item/contexto, no de una afirmación de la IA;
- `SUPERSEDED` y `ARCHIVED` se conservan en la respuesta;
- una claim histórica puede utilizar una fuente `SUPERSEDED` si su redacción es histórica;
- una fuente superseded no se presenta silenciosamente como orientación actual.

### Claim support

- `SUPPORTED` requiere al menos una referencia válida;
- todas las referencias deben pertenecer al `RetrievalContext`, ser actuales e inspeccionables;
- `SUPPORTED` requiere una `evidenceQuote` no vacía que sea una subcadena exacta del fragmento citado;
- la claim debe ser un restatement `deletion-only` de la quote: puede eliminar tokens conservando orden, pero no añadir, cambiar o reordenar tokens;
- no se pueden eliminar tokens protegidos que cambien negación, cuantificación, modalidad o alcance (`not`, `no`, `never`, `only`, `always`, `all`, `every`, `each`, `most`, `some`, `may`, `can`, `should`, `must`, `required`, `optional`, `for`, `within`, `inside`, `on`, `in`, `between`, `among`, `across` y equivalentes documentados en español);
- una quote parcial tampoco puede omitir operadores protegidos del fragmento completo en las frases que intersecta;
- se pueden eliminar frases completas de la quote; si la claim conserva tokens de una frase, debe conservar también sus tokens protegidos;
- una referencia válida no basta si la claim sobreinterpreta el fragmento;
- `INFERRED` requiere evidencias válidas de las premisas o del contexto que se muestra;
- `INSUFFICIENT` no puede llevar una presentación de soporte directo;
- si una claim propuesta como `SUPPORTED` tiene evidencia válida pero falla `deletion-only`, se degrada a `INFERRED` y conserva la evidencia;
- si una claim propuesta como `SUPPORTED` no tiene evidencia válida, queda `INSUFFICIENT`;
- si la IA propone una referencia inexistente, la claim afectada no puede ser `SUPPORTED`;
- si existe el fragmento pero no soporta la claim, no se acepta como `SUPPORTED`.

La validación determinista garantiza trazabilidad y correspondencia textual conservadora; no demuestra entailment semántico completo ni decide por sí sola que una paráfrasis libre conserve todo el significado.

## 6.3 Qué valida y qué no valida

### Validación objetiva de la aplicación

- identidad;
- existencia;
- pertenencia;
- revisión;
- retrieval provenance;
- referencia;
- estado;
- procedencia;
- contenido inspeccionable;
- correspondencia textual directa según la política v1.

### Evaluación probabilística

- si una paráfrasis conserva exactamente el significado;
- si una claim está semánticamente respaldada cuando no es literal;
- si una inferencia es razonable;
- si una síntesis no ha introducido una conclusión nueva;
- si dos fuentes forman una divergencia contextual;
- si una respuesta es útil para el usuario.

La aplicación no presenta estas evaluaciones probabilísticas como pruebas de verdad objetiva. La comprobación `deletion-only` únicamente garantiza que la claim conserva una subsecuencia ordenada y conservadora de una quote verificable. No prueba el entailment semántico completo, especialmente para causalidad, aplicabilidad, temporalidad o relaciones que no estén expresadas mediante los tokens comparados.

Una claim que falla `deletion-only` no puede ser `SUPPORTED`; con referencias válidas se degrada a `INFERRED`, y sin referencias válidas queda `INSUFFICIENT`.

## 6.4 Referencia inexistente

Si el draft contiene un `evidenceId` que no está en el RetrievalContext:

- esa referencia se rechaza;
- la claim no puede ser `SUPPORTED`;
- no se crea ni se busca una fuente alternativa silenciosamente;
- la claim se omite, se degrada a `INSUFFICIENT` o se marca la respuesta como no verificable;
- se conserva un motivo técnico para diagnóstico sin almacenar el contenido del usuario en logs.

## 6.5 Evidencia existente pero no suficiente

Si el fragmento existe y la referencia es válida, pero la claim no pasa la correspondencia textual `deletion-only`:

- no se acepta como `SUPPORTED`;
- una propuesta `SUPPORTED` se degrada a `INFERRED`;
- la evidencia válida se conserva visible como base de la inferencia;
- la claim debe presentarse como interpretación, no como cita literal.

Si la evidencia o la referencia no son válidas:

- la claim se presenta como `INSUFFICIENT`;
- no se conserva la referencia como soporte aceptado;
- no se sustituye silenciosamente por otra evidencia.

La regla no intenta construir un NLP completo. Es una comprobación determinista y deliberadamente conservadora: solo permite eliminar material de la quote, preservando el orden y los operadores protegidos de negación, cuantificación, modalidad y alcance.

## 6.6 Contextual divergence

En v1 no existe detección automática general de contradicciones.

Una `CONTEXTUAL_DIVERGENCE` puede presentarse cuando:

- el draft cita al menos dos evidencias válidas;
- las fuentes y sus contextos son inspeccionables;
- la respuesta explica la diferencia contextual;
- no se presenta como `CONFLICT` automático.

La clasificación semántica de la diferencia sigue siendo probabilística y se evalúa especialmente en Q6. La aplicación valida la trazabilidad de las fuentes, no la verdad objetiva de la explicación.

---

# 7. Retrieval design

## 7.1 Estrategia

Retrieval v1 utiliza full-text search de SQLite mediante FTS5, sin embeddings ni búsqueda semántica.

La decisión se justifica por:

- corpus personal pequeño;
- necesidad de comportamiento determinista;
- facilidad de inspección y depuración;
- ausencia de infraestructura externa;
- posibilidad de reconstruir el índice desde Knowledge Items;
- adecuación a búsquedas de términos técnicos, nombres de librerías y decisiones explícitas.

## 7.2 Input

- consulta textual;
- corpus objetivo;
- límite de Knowledge Items y fragmentos;
- revisión lógica actual del corpus.

No existe memoria de preguntas previas ni expansión automática de la consulta.

## 7.3 Fragment representation

El contenido se divide de forma determinista en párrafos. Cada fragmento conserva:

- ordinal del párrafo;
- offsets o localizador dentro del contenido original;
- texto exacto;
- Knowledge Item y revisión;
- status y provenance.

Si un párrafo es demasiado grande para el contexto operativo, se divide en ventanas de frases conservando los offsets. La estrategia debe evitar cortar una frase de manera que cambie su interpretación.

## 7.4 Ranking inicial

El ranking debe ser explicable y estable:

1. coincidencia exacta de la consulta en título;
2. coincidencia exacta de la consulta en contenido;
3. coincidencia de términos en título;
4. coincidencia de términos en contenido;
5. desempate estable por `KnowledgeItemId`.

No se usa el status para convertir una fuente en irrelevante automáticamente. `SUPERSEDED` y `ARCHIVED` pueden recuperarse, pero su estado debe viajar al resultado.

El límite inicial de implementación es de hasta 8 fragmentos por pregunta y un máximo de 2 fragmentos por Knowledge Item, salvo que una prueba de Q1-Q9 requiera documentar una excepción. Es un límite operativo, no una nueva feature.

## 7.5 RetrievalContext

El contexto contiene solo los fragmentos finalmente seleccionados para la generación. Un resultado de búsqueda que no entre en el contexto no puede ser citado por la IA para esa pregunta.

Cada fragmento recibe un `evidenceId` opaco generado para ese contexto. La IA solo puede devolver esos identificadores.

## 7.6 Update

Al actualizar título o contenido:

- aumenta la revisión;
- se actualiza el Knowledge Item y su índice de forma consistente;
- los contextos basados en la revisión anterior quedan stale;
- una nueva pregunta solo utiliza la revisión actual.

El sistema no intenta mantener respuestas previas como objetos persistentes.

## 7.7 Delete

Al eliminar un Knowledge Item:

- se elimina del source of record del user corpus;
- se elimina o invalida del índice FTS5;
- no aparece en nuevos resultados;
- cualquier RetrievalContext que lo referencie deja de poder validarse para nuevas presentaciones.

## 7.8 No results

Retrieval devuelve contexto vacío.

Application no solicita grounded synthesis y devuelve una abstención visible:

> No se encontró evidencia relevante en el corpus para esta pregunta.

---

# 8. Persistence design

## 8.1 Datos persistentes

Solo se persiste como source of record:

- Knowledge Items del user corpus;
- contenido original;
- estado;
- procedencia;
- referencia opcional;
- fechas;
- revisión.

El evaluation corpus se mantiene como fixture inmutable de evaluación y no como datos mutables del usuario.

## 8.2 Datos derivados

El índice FTS5 y la representación de fragmentos son derivados del contenido y de su revisión.

No se crean estructuras persistentes para:

- claims;
- respuestas;
- conversaciones;
- evidencias históricas;
- relaciones;
- tags;
- colecciones;
- Knowledge Graph.

## 8.3 Consistencia

La escritura de un Knowledge Item y la actualización de su índice deben tratarse como una única operación lógica. La aplicación no confirma el cambio si el contenido persistido y su índice no pueden quedar coherentes.

En caso de fallo, se conserva el estado anterior o se marca la operación como fallida; no se permite servir silenciosamente un índice que represente otra revisión.

## 8.4 Read model de búsqueda

El índice de búsqueda contiene únicamente los campos necesarios para buscar y reconstruir fragmentos:

- Knowledge Item ID;
- revisión;
- título/contenido indexable;
- localizadores de fragmento.

Status, provenance y referencia se resuelven desde el Knowledge Item vigente para evitar duplicar autoridad en el índice.

## 8.5 Eliminación y privacidad

Eliminar un Knowledge Item no elimina contenido que ya haya sido enviado previamente a un proveedor externo. Esa limitación se comunica mediante la política de privacidad y depende de la retención del proveedor, todavía pendiente.

---

# 9. API design

El transporte HTTP utiliza Fastify únicamente en el adaptador de transporte; la decisión está registrada en `docs/adr/001-http-transport.md`.

Las rutas son límites de transporte, no contratos de dominio. Los nombres siguientes son los únicos endpoints de v1.

## 9.1 Create Knowledge Item

- **Método:** `POST`
- **Ruta:** `/knowledge-items`
- **Propósito:** crear un Knowledge Item humano.

### Request conceptual

- título;
- contenido;
- estado opcional;
- source reference opcional.

### Response conceptual

- Knowledge Item creado;
- id;
- fechas;
- revisión;
- estado;
- procedencia `human-authored`.

### Errores principales

- request inválida;
- fallo de persistencia o indexación.

## 9.2 List/Search Knowledge Items

- **Método:** `GET`
- **Ruta:** `/knowledge-items`
- **Propósito:** listar o buscar Knowledge Items del user corpus.

### Request conceptual

- `q` opcional;
- límite opcional dentro de un valor seguro.

### Response conceptual

- resultados ordenados de forma determinista;
- Knowledge Item metadata;
- fragmentos coincidentes cuando existe consulta;
- estado y procedencia.

### Errores principales

- consulta inválida;
- fallo de Retrieval/Persistence.

No existe una ruta de tags, collections, graph o semantic search.

## 9.3 Get Knowledge Item

- **Método:** `GET`
- **Ruta:** `/knowledge-items/{id}`
- **Propósito:** leer el contenido original y su metadata.

### Errores principales

- item inexistente.

## 9.4 Update Knowledge Item

- **Método:** `PATCH`
- **Ruta:** `/knowledge-items/{id}`
- **Propósito:** actualizar contenido o metadata editable.

### Request conceptual

- revisión esperada;
- campos editables: título, contenido, estado, referencia opcional.

### Response conceptual

- Knowledge Item actualizado;
- nueva revisión;
- fechas actualizadas;
- estado y procedencia.

### Errores principales

- item inexistente;
- revisión obsoleta;
- request inválida;
- inconsistencia de persistencia/índice.

## 9.5 Delete Knowledge Item

- **Método:** `DELETE`
- **Ruta:** `/knowledge-items/{id}`
- **Propósito:** eliminar un Knowledge Item del user corpus.

### Request conceptual

- revisión esperada, mediante metadata de la operación.

### Response conceptual

- confirmación de eliminación.

### Errores principales

- item inexistente;
- revisión obsoleta;
- fallo de eliminación consistente.

## 9.6 Ask Question

- **Método:** `POST`
- **Ruta:** `/ask`
- **Propósito:** ejecutar una pregunta aislada y devolver una respuesta grounded o un estado seguro.

### Request conceptual

- pregunta textual no vacía.

### Response conceptual si existe respuesta

- pregunta;
- respuesta;
- claims con clasificación;
- referencias a evidencias;
- fragmentos inspeccionables;
- Knowledge Item de origen;
- status y provenance;
- EvidenceCondition.

### Response conceptual sin respuesta grounded

- pregunta;
- resultados o contexto disponible;
- motivo seguro: no results, insufficient evidence, invalid reference, malformed AI response, AI unavailable o validation failure;
- sin claims `SUPPORTED` no verificadas.

### Errores principales

Los fallos de grounding se devuelven como resultados de aplicación visibles y seguros, no como una respuesta textual generada sin evidencia.

## 9.7 Endpoint deliberadamente no creado

No existe endpoint independiente para `Retrieve Evidence` ni `Generate Grounded Draft` ni `Validate Grounded Draft`.

Son boundaries internas reales del caso de uso `Ask Question`. Exponerlos como API pública añadiría superficie sin valor para el MDP.

---

# 10. Frontend design

## 10.1 Superficies funcionales

### Knowledge list/search

Permite:

- listar Knowledge Items;
- buscar por texto;
- abrir el contenido original;
- ver status y provenance;
- acceder a fragmentos coincidentes.

### Knowledge Item detail/form

Una única superficie puede cubrir:

- lectura;
- creación;
- edición;
- eliminación.

Debe mostrar claramente contenido original frente a cualquier resultado derivado.

### Question/answer

Permite:

- introducir una pregunta aislada;
- mostrar estado de retrieval;
- presentar respuesta y claims;
- mostrar abstención o fallo seguro.

### Evidence inspection

No es una pantalla independiente. Es una parte de la respuesta y de los resultados de búsqueda.

Debe permitir navegar:

```text
Claim → fragmento → Knowledge Item
```

## 10.2 View models conceptuales

El frontend consumirá estados de presentación, no modelos crudos de infraestructura:

- Knowledge Item list state;
- Knowledge Item detail/edit state;
- search result state;
- question lifecycle state;
- grounded response state;
- claim presentation state;
- evidence inspection state;
- safe failure state.

No se crea un store global. Cada superficie mantiene su estado local y el resultado de una pregunta solo vive en su flujo aislado.

## 10.3 Responsabilidades del frontend

- validación básica de formularios;
- interacción CRUD;
- mostrar loading, vacío y error;
- presentar classification y condition recibidas;
- hacer visible status/provenance;
- permitir inspeccionar fragmentos;
- no modificar ni recalcular la decisión de grounding.

## 10.4 Accesibilidad

- claims y evidencias deben tener una relación navegable por teclado;
- status no puede depender únicamente del color;
- `SUPERSEDED`, `ARCHIVED`, `INSUFFICIENT` y `AI unavailable` deben expresarse también con texto;
- loading y errores deben anunciarse semánticamente;
- los fragmentos deben conservar headings y contexto suficiente;
- la respuesta no debe hacer pasar una inferencia por una cita visualmente equivalente.

---

# 11. Error model

## 11.1 Error taxonomy

| Caso | Naturaleza | Recuperable | Visible | Bloquea `SUPPORTED` |
|---|---|---:|---:|---:|
| Knowledge Item inexistente | Aplicación/Persistence | Sí | Sí | Sí |
| Request inválida | Transporte/Aplicación | Sí | Sí | Sí |
| Referencia inválida | Grounding validation | Sí | Sí, de forma resumida | Sí |
| Fragmento inválido | Grounding validation | Sí | Sí | Sí |
| Retrieval sin resultados | Resultado seguro | Sí | Sí | Sí |
| Evidencia insuficiente | Resultado seguro | Sí | Sí | Sí |
| AI unavailable | Dependencia externa | Sí | Sí | Sí |
| AI malformed response | Integración | Sí | Sí | Sí |
| Grounding validation failure | Integridad de resultado | Sí | Sí | Sí |
| Knowledge Item `SUPERSEDED` | Metadata de fuente | Sí | Sí | No automáticamente |
| Knowledge Item `ARCHIVED` | Metadata de fuente | Sí | Sí | No automáticamente |
| Revisión obsoleta al editar | Consistencia | Sí | Sí | No aplica |

## 11.2 Reglas de presentación

- `SUPERSEDED` y `ARCHIVED` no generan una página de error; generan advertencias visibles.
- No results y insufficient evidence son respuestas de negocio seguras, no excepciones técnicas ocultas.
- AI unavailable mantiene search/read disponibles.
- Una invalid reference nunca se repara sustituyéndola silenciosamente.
- Un draft malformado nunca se presenta como respuesta grounded.
- Una validación fallida no altera el user corpus.

## 11.3 Estado silencioso permitido

Solo pueden ser silenciosos detalles internos que no cambien el resultado visible, como métricas técnicas agregadas o un retry controlado que no exponga contenido. Los fallos que afecten grounding, disponibilidad o trazabilidad deben ser visibles.

---

# 12. Testing implementation plan

## 12.1 Unit tests deterministas

Cubrir:

- invariantes de KnowledgeItem;
- creación y actualización de revisiones;
- preservación de provenance;
- interpretación de statuses;
- separación entre user corpus y evaluation corpus;
- eliminación e invalidación de datos derivados;
- rechazo de referencias inexistentes;
- pertenencia fragmento → Knowledge Item;
- pertenencia fragmento → RetrievalContext;
- revisión stale;
- `SUPPORTED` sin referencia;
- `SUPPORTED` con referencia fuera de contexto;
- cita textual que no coincide;
- degradación a `INFERRED` o `INSUFFICIENT`.

No dependen de un proveedor ni de una respuesta generativa real.

## 12.2 Retrieval tests

Con fixtures, comprobar:

- coincidencia directa en título y contenido;
- generación de fragmentos con offsets/localizador;
- ranking estable;
- status/provenance propagados;
- contexto vacío;
- resultados relacionados pero insuficientes;
- item editado que deja stale un contexto anterior;
- item eliminado que desaparece del índice;
- aislamiento de evaluation corpus;
- límite de fragmentos.

## 12.3 AI contract tests

Usar drafts controlados para comprobar:

- draft válido;
- claims múltiples;
- claims con distintos support propuestos;
- referencia inexistente;
- referencia a item incorrecto;
- referencia fuera del RetrievalContext;
- fragmento inventado;
- cita textual alterada;
- claim supported sin referencia;
- inferencia sin todas sus premisas;
- respuesta malformada;
- respuesta vacía;
- timeout o IA unavailable.

## 12.4 Integration tests

Ejecutar el flujo completo con un generador controlado:

```text
Question
  → Retrieval
  → RetrievalContext
  → Grounded draft
  → Deterministic validation
  → GroundedResponse
```

El generador controlado permite probar la aplicación sin depender de variabilidad del modelo.

## 12.5 Acceptance tests Q1-Q9

El evaluation corpus y las preguntas permanecen congelados.

Cada caso se evalúa en dos niveles:

1. Retrieval: fuentes obligatorias, contexto opcional y fuentes que no deben usarse como soporte.
2. Grounding: claims, clasificación, condición, estados y abstención.

| Caso | Expectativa de implementación |
|---|---|
| Q1 | KI-01/KI-02; claims directas `SUPPORTED` solo si superan correspondencia directa; no inventar rendimiento |
| Q2 | KI-01/KI-03/KI-04; síntesis contextual; no regla universal |
| Q3 | KI-08/KI-09; hechos directos supported; síntesis general inferred |
| Q4 | KI-01 a KI-04; principio general `INFERRED` |
| Q5 | Puede recuperar contexto SSR, pero debe abstenerse sobre migración SSR→CSR |
| Q6 | KI-03/KI-04; `CONTEXTUAL_DIVERGENCE`; no `CONFLICT` automático |
| Q7 | KI-06/KI-07; KI-07 visible como `SUPERSEDED`; no recomendación actual silenciosa |
| Q8 | KI-08; conservar alcance de bundle inicial, entry points y dispositivos objetivo |
| Q9 | Ninguna fuente; abstención completa |

Los tests no deben depender de una redacción exacta del modelo. Deben inspeccionar:

- referencias válidas;
- fuente y fragmento;
- clasificación aceptable;
- estado de fuente;
- ausencia de generalizaciones prohibidas;
- abstención cuando corresponde.

## 12.6 Criterio de aceptación técnica

El slice no se acepta si:

- alguna claim `SUPPORTED` presentada carece de referencia y fragmento verificables;
- Q5 o Q9 generan una respuesta factual;
- Q7 oculta `SUPERSEDED`;
- Q6 convierte automáticamente la divergencia contextual en conflicto;
- Q8 generaliza más allá de la evidencia;
- una referencia inexistente se muestra como válida;
- AI unavailable oculta búsqueda o lectura.

No se usa un porcentaje científico sobre 12 Knowledge Items. Los casos críticos son gates.

---

# 13. Privacy implementation plan

## 13.1 Data sent to AI

Solo se envían:

- pregunta aislada;
- fragmentos seleccionados;
- identifiers opacos de evidencia;
- status/provenance mínimo necesario para interpretar fuentes.

No se envían automáticamente:

- corpus completo;
- Knowledge Items no recuperados;
- índice;
- historial de preguntas;
- respuestas anteriores;
- datos de evaluación en consultas normales.

## 13.2 Local data

Permanecen bajo control del producto:

- Knowledge Items;
- revisiones;
- status;
- provenance;
- referencias;
- índice textual;
- separación de corpus.

## 13.3 Logging

Registrar solo:

- tipo de operación;
- duración;
- counts agregados de resultados/claims;
- categoría de error;
- disponibilidad de IA.

No registrar por defecto:

- contenido de Knowledge Items;
- pregunta completa;
- respuesta completa;
- prompt;
- fragmentos enviados;
- claims textuales.

## 13.4 Deletion

Delete elimina el Knowledge Item y sus derivados locales. No se promete borrar contenido que ya haya llegado a un proveedor externo; esa retención depende de una decisión posterior sobre proveedor y configuración.

La aplicación no almacena respuestas para intentar reconstruir conocimiento eliminado.

## 13.5 AI disabled

Con IA deshabilitada siguen disponibles:

- CRUD;
- búsqueda;
- lectura;
- fragmentos;
- status;
- provenance.

---

# 14. First implementation slice

## Slice A — Product utility without AI

1. Crear un Knowledge Item humano.
2. Leer el contenido original.
3. Actualizarlo y comprobar incremento de revisión.
4. Buscar un término exacto.
5. Recuperar un fragmento con Knowledge Item, revisión, status y provenance.
6. Inspeccionar el fragmento.
7. Eliminar el Knowledge Item.
8. Comprobar que no aparece en nuevas búsquedas y que un contexto anterior queda stale.

### Fronteras demostradas

- CRUD;
- source of record;
- persistencia;
- FTS5;
- fragmentación;
- trazabilidad;
- invalidación por update/delete;
- utilidad sin IA.

## Slice B — Grounded synthesis con Q1

Sobre el mismo flujo:

1. cargar un conjunto mínimo del evaluation corpus que contenga KI-01 y KI-02;
2. formular Q1 como pregunta aislada;
3. ejecutar Retrieval;
4. construir RetrievalContext con fragmentos concretos;
5. producir un draft controlado y después conectar la capacidad de IA seleccionada;
6. validar referencias, item, revisión, fragmento y contexto;
7. presentar las claims directas como `SUPPORTED` solo si pasan la política conservadora;
8. mostrar la relación claim → fragmento → Knowledge Item;
9. forzar una referencia inexistente y comprobar degradación segura;
10. deshabilitar IA y comprobar que Search/Read siguen disponibles.

### No incluye todavía

- todas las preguntas visibles en una UI de evaluación;
- detección general de conflicto;
- conversación;
- memoria;
- semantic search;
- importación;
- cualquier entidad futura.

Q1-Q9 se ejecutan como acceptance tests sobre las mismas boundaries una vez que Slice B sea estable.

---

# 15. Technology choices

## Frontend

- React;
- TypeScript;
- estado local por superficie;
- sin global state management en v1.

React complementa el portfolio existente y permite hacer explícita la separación entre presentación, view models y aplicación sin introducir una plataforma de UI mayor que el producto.

## Backend

- Node.js;
- TypeScript;
- monolito modular;
- Fastify únicamente en el límite HTTP, documentado en `docs/adr/001-http-transport.md`.

## Persistence

- SQLite;
- FTS5 para búsqueda textual;
- índice derivado y reconstruible.

## AI integration

- una única capacidad de grounded synthesis;
- input limitado a pregunta y contexto;
- draft no confiable;
- validación determinista posterior;
- sin acceso del modelo a Persistence;
- sin multi-provider ni model router.

Slice B utiliza el adaptador Gemini directo mediante `fetch`, configurado con `GEMINI_API_KEY` y el modelo `GEMINI_MODEL` opcional, cuyo valor por defecto es `gemini-3.5-flash-lite`. Si no existe la clave, el runtime utiliza un adaptador explícito de disponibilidad fallida y devuelve `AI_UNAVAILABLE`; no genera respuestas ficticias.

---

# 16. Architecture risks under implementation

## R1 — Confundir provenance con semantic truth

La cadena verificable demuestra que la claim apunta a contenido real del corpus. No demuestra por sí sola que la claim sea objetivamente cierta.

## R2 — Sobreaceptar paráfrasis

Una paráfrasis convincente puede exceder el texto fuente. La política conservadora de v1 evita presentarla automáticamente como `SUPPORTED`.

## R3 — Retrieval textual insuficiente

Si el corpus real exige conceptos expresados con vocabulario muy diferente, FTS5 puede no recuperar el contexto. No se soluciona anticipadamente con embeddings; se registra como presión futura sobre Retrieval.

## R4 — Stale contexts

Update/delete deben invalidar contextos por revisión. Si no se conserva la revisión, la promesa de trazabilidad después de editar no es honesta.

## R5 — Falso conflicto

Q6 puede producir divergencia contextual, no conflicto. No debe construirse un motor general para corregir este riesgo en v1.

## R6 — Respuesta demasiado autoritativa

La Presentation debe mostrar status, provenance, clasificación y límites. La redacción fluida no puede ocultar incertidumbre.

## R7 — Carga de evidencia excesiva

El límite inicial de fragmentos y la ausencia de historial reducen coste y complejidad. No se introduce persistencia de respuestas para compensar esta limitación.

## R8 — Configuración operativa del proveedor

La integración concreta de Slice B está limitada al adaptador Gemini documentado en `docs/adr/002-slice-b-ai-adapter.md`, usando `gemini-3.5-flash-lite` como modelo MVP. Permanecen fuera de este slice la retención efectiva del proveedor, la región, los secretos de despliegue y la operación remota; sin credenciales, el sistema falla de forma explícita con `AI_UNAVAILABLE`.

---

# 17. Explicit decisions not made yet

Estas decisiones permanecen pendientes y no bloquean el diseño de las fronteras:

- modelo alternativo y parámetros operativos distintos del modelo MVP `gemini-3.5-flash-lite`;
- política de retención del proveedor;
- configuración de secretos;
- despliegue local o remoto;
- estrategia exacta de despliegue y configuración operativa del transporte;
- formato de transporte exacto del draft;
- estrategia de streaming;
- autenticación;
- selección general de `CONFLICT`;
- embeddings o semantic search;
- persistencia opcional de preguntas/respuestas;
- importación;
- conversación y memoria;
- colaboración;
- observabilidad de contenido personal.

La integración concreta de Slice B está registrada en `docs/adr/002-slice-b-ai-adapter.md`; las decisiones operativas pendientes no amplían el alcance del producto.

---

# 18. Definition of Done del Implementation Design v1

El diseño se considera completo porque define:

- módulos y responsabilidades;
- dependencias permitidas y prohibidas;
- separación user/evaluation corpus;
- dominio mínimo e invariantes;
- casos de uso y sus fronteras;
- flujo de datos completo;
- draft de IA y límites de autoridad;
- validación determinista y sus límites;
- Retrieval textual y trazabilidad;
- persistencia e invalidación;
- endpoints mínimos;
- superficies funcionales del frontend;
- modelo de errores;
- estrategia de testing implementable;
- plan de privacidad;
- Slice A y Slice B, incluido `/ask` y validación determinista de drafts;
- riesgos;
- decisiones que permanecen pendientes.

La trazabilidad de implementación queda definida como:

```text
Product Contract
  → Architecture Decision v1
  → Implementation Design v1
  → implementation boundary
  → tests / Q1-Q9
```

Cualquier cambio posterior que afecte al dominio, grounding, Retrieval, source of truth o límites entre módulos debe actualizar este documento y, si modifica una decisión arquitectónica, el ADR correspondiente.
