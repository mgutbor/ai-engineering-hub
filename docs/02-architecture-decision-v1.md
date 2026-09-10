# Architecture Decision v1

## 0. Estado y propósito

**Proyecto:** Personal Technical Knowledge & Decision Navigator  
**Versión:** Architecture Decision v1  
**Estado:** Decisiones base aprobadas para diseñar el primer vertical slice  
**Traza de producto:** `docs/01-product-contract.md`

Este documento decide los límites y responsabilidades de la arquitectura. No define:

- estructura de carpetas;
- nombres de archivos;
- endpoints concretos;
- schema SQL detallado;
- código;
- proveedor o modelo de IA;
- infraestructura de despliegue.

La arquitectura será un **monolito modular pequeño**, con un único flujo de aplicación y fronteras explícitas para persistence, retrieval, generación de IA y validación determinista.

---

## 1. Decisiones resumidas

| Decisión | Motivo | Estado |
|---|---|---|
| Un único runtime de aplicación | El MDP no necesita distribución ni procesamiento asíncrono | Decidida |
| `KnowledgeItem` es la única entidad persistida del dominio | Evita crear un modelo de knowledge hub innecesario | Decidida |
| El evaluation corpus es un fixture inmutable separado del user corpus | Permite reproducibilidad sin mezclar datos de usuario con acceptance cases | Decidida |
| Retrieval textual es una capacidad independiente de generación | Permite usar el producto sin IA y sustituir la estrategia después | Decidida |
| La IA solo produce un borrador estructurado | La IA no puede escribir en el dominio ni validar sus propias claims | Decidida |
| La validación determinista se ejecuta antes de presentar la respuesta | Impide aceptar referencias inexistentes o fuera de contexto | Decidida |
| Las respuestas de IA no se persisten por defecto | No son source of record y no son necesarias para el MDP | Decidida |
| Frontend y backend comparten TypeScript, pero mantienen responsabilidades separadas | Reduce fricción sin trasladar reglas críticas al cliente | Recomendada |
| El proveedor/modelo concreto de IA queda pendiente | El Product Contract no exige uno y la decisión depende de privacidad/coste | Pendiente |

---

## 2. System boundaries

### 2.1 Product runtime

El runtime del producto contiene seis responsabilidades, no seis servicios:

1. **Presentation:** interacción, lectura y representación de estados.
2. **Application:** orquestación de casos de uso.
3. **Domain semantics:** reglas sobre Knowledge Items, procedencia y estado de fuente.
4. **Persistence:** almacenamiento del user corpus.
5. **Retrieval:** búsqueda textual y extracción de fragmentos.
6. **AI generation y deterministic validation:** síntesis probabilística y comprobaciones deterministas posteriores.

Estas responsabilidades viven dentro de un mismo sistema desplegable. No se crean microservicios, workers, brokers ni eventos para separarlas.

### 2.2 User corpus

El user corpus contiene los Knowledge Items que el usuario puede:

- crear;
- leer;
- editar;
- eliminar.

Es el único contenido mutable del producto.

### 2.3 Evaluation corpus

El evaluation corpus contiene los 12 Knowledge Items congelados del experimento y las preguntas Q1-Q9.

Sus propiedades arquitectónicas son:

- no pertenece al user corpus;
- no se modifica mediante los casos de uso de usuario;
- se utiliza en tests y evaluaciones reproducibles;
- no se cuenta como contenido creado por el usuario;
- no se utiliza para enriquecer silenciosamente las respuestas del user corpus.

El evaluation corpus es un artefacto de evaluación, no una feature de organización del conocimiento.

### 2.4 External AI boundary

El proveedor de IA es una dependencia externa de una única capacidad: **grounded synthesis**.

El sistema solo envía:

- la pregunta aislada;
- los fragmentos recuperados necesarios;
- identificadores de evidencia opacos para poder validar referencias;
- instrucciones de salida grounded.

El sistema no envía el corpus completo ni permite que el proveedor acceda directamente a persistence.

### 2.5 Evaluation boundary

La evaluación del modelo queda fuera del flujo determinista de negocio, aunque reutiliza los mismos contratos de retrieval y grounding.

La evaluación incluye:

- expectativas de retrieval para Q1-Q9;
- revisión de clasificación de claims;
- revisión de abstención;
- revisión de estados de fuente;
- revisión de referencias.

No se trata el resultado del modelo como una prueba determinista de corrección semántica.

---

## 3. Domain model mínimo

### 3.1 Entidad: KnowledgeItem

`KnowledgeItem` es la única entidad persistida del dominio en v1.

Representa contenido original o importado que forma parte del source of record del corpus. Contiene como mínimo:

- identificador estable;
- título;
- contenido original;
- fecha de creación;
- estado de fuente;
- procedencia;
- referencia opcional.

El contenido no puede ser reemplazado automáticamente por una respuesta de IA.

### 3.2 Values del dominio

No se crean entidades independientes para estos conceptos:

- **SourceStatus:** `ACTIVE`, `SUPERSEDED`, `ARCHIVED`.
- **Provenance:** origen del contenido, como human-authored o imported.
- **SourceReference:** referencia opcional conservada como valor.
- **KnowledgeItemId:** identidad estable del Knowledge Item.

Estos valores tienen semántica de dominio, pero no justifican entidades propias en v1.

### 3.3 Conceptos derivados de aplicación

Los siguientes conceptos son necesarios para transportar un resultado, pero no son entidades persistidas del dominio:

- question;
- search result;
- retrieved fragment;
- evidence reference;
- claim;
- grounded response;
- claim support;
- evidence condition.

Un `retrieved fragment` debe mantener la relación con su Knowledge Item y un localizador o snapshot que permita inspeccionarlo. Es información derivada y reconstruible.

### 3.4 Lo que no pertenece al dominio v1

No se crean entidades para:

- Source;
- Topic;
- Tag;
- Relation;
- Collection;
- Insight;
- Conversation;
- AIAnalysis;
- KnowledgeGraph;
- Conflict.

`CONFLICT` es una condición de evidencia preparada en el vocabulario del producto, no una entidad ni un motor de detección en v1.

---

## 4. Application use cases

Los casos de uso mínimos son:

1. **Create Knowledge Item**
2. **Read Knowledge Item**
3. **Update Knowledge Item**
4. **Delete Knowledge Item**
5. **Search Knowledge Items** mediante texto
6. **Ask isolated question** sobre el corpus seleccionado
7. **Inspect grounded response** junto con claims, fragmentos, referencias y estados

La inspección forma parte del resultado del caso de uso de pregunta; no requiere un sistema separado de conversaciones.

### Ask isolated question

El flujo de aplicación es:

1. recibir una pregunta aislada;
2. ejecutar retrieval textual;
3. construir un contexto limitado con fragmentos recuperados;
4. si no existe evidencia relevante, devolver un estado seguro sin inventar respuesta;
5. solicitar una síntesis grounded a la IA cuando existe contexto útil;
6. recibir un borrador probabilístico;
7. validarlo determinísticamente;
8. producir la respuesta presentable;
9. exponer los fragmentos inspeccionables.

La aplicación no guarda automáticamente la pregunta, la respuesta ni los claims generados.

---

## 5. AI boundary

### 5.1 Inicio de la parte probabilística

La parte probabilística comienza cuando la aplicación entrega a la capacidad de grounded synthesis:

- la pregunta;
- el contexto recuperado;
- las claves de evidencia disponibles;
- las restricciones de grounding.

### 5.2 Fin de la parte probabilística

La parte probabilística termina cuando la IA devuelve un borrador candidato. El borrador no es todavía una respuesta válida del sistema.

La aplicación debe tratarlo como input no confiable que requiere validación.

### 5.3 Capacidad, no plataforma

La frontera representa una capacidad concreta: **sintetizar una respuesta basada en fragmentos recuperados**.

No se crea una abstracción genérica de plataforma de IA, un registry de modelos ni un `AIProvider` con operaciones hipotéticas.

El adaptador de IA debe poder sustituirse porque está detrás de una capacidad estrecha, no porque se diseñe una plataforma multi-provider.

### 5.4 Resultado esperado de la IA

La IA puede proponer:

- claims;
- clasificación de support;
- referencias a claves de evidencia;
- citas o extractos;
- inferencias;
- una condición de evidencia como posible divergencia contextual.

La IA no puede decidir por sí sola que ninguna de esas propuestas sea válida.

### 5.5 Respuesta malformada

Si la IA devuelve texto sin estructura suficiente para identificar claims y referencias, la aplicación no lo presenta como grounded. Devuelve un estado de fallo de generación o insuficiencia, conservando los resultados de retrieval.

---

## 6. Retrieval boundary

Retrieval es independiente de la IA.

### Retrieval recibe

- una pregunta textual;
- el corpus consultable;
- los límites de la búsqueda textual.

### Retrieval devuelve

- cero o más fragmentos;
- Knowledge Item de origen;
- localizador o snapshot del fragmento;
- estado de fuente;
- procedencia;
- referencia opcional;
- una identidad de contexto de retrieval para enlazar el resultado con la validación posterior.

### Retrieval no hace

- generar respuestas;
- clasificar claims;
- decidir que una claim está supported;
- escribir Knowledge Items;
- consultar al proveedor de IA;
- resolver conflictos.

### Indexación

El índice textual es información derivada y reconstruible desde el user corpus. La eliminación o modificación de un Knowledge Item debe impedir que una versión obsoleta siga apareciendo como resultado válido.

No se introduce una estrategia semántica ni una infraestructura vectorial en v1.

---

## 7. Deterministic validation boundary

La validación se ejecuta después de la generación y antes de la presentación.

```text
Retrieved context
       ↓
AI grounded draft
       ↓
Deterministic validation
       ↓
Presentable grounded response
```

### 7.1 Validaciones mínimas obligatorias

La validación debe comprobar:

1. La salida tiene una estructura interpretable.
2. Cada claim tiene una identidad dentro de la respuesta.
3. Cada referencia apunta a una evidencia existente.
4. El Knowledge Item referenciado existe en el corpus consultado.
5. El fragmento pertenece al Knowledge Item referenciado.
6. El fragmento formó parte del contexto de retrieval de esa pregunta.
7. El usuario puede inspeccionar el fragmento original recuperado.
8. Las referencias no apuntan a identificadores inventados.
9. Una claim `SUPPORTED` contiene al menos una referencia válida.
10. Una claim `INFERRED` identifica las evidencias de las que deriva.
11. Una claim `INSUFFICIENT` no se presenta como respaldada.
12. El estado y la procedencia de cada fuente se conservan en el resultado.
13. El contexto de retrieval no fue invalidado por una edición o eliminación posterior.
14. Las citas o extractos declarados por la IA coinciden exactamente con el texto disponible, cuando la salida incluya citas textuales.
15. Las claims no pueden citar silenciosamente una fuente que no fue recuperada.

### 7.2 Límite de la validación determinista

Estas comprobaciones prueban la **integridad de la referencia y de la cadena de procedencia**. No prueban por sí solas que el texto de una claim sea semánticamente verdadero ni que una inferencia sea correcta.

Para que v1 no convierta `LLM says supported` en `application trusts`, se adopta esta regla conservadora:

- una claim puede presentarse automáticamente como `SUPPORTED` solo cuando la evidencia recuperada contiene una correspondencia textual directa e inspeccionable con la afirmación;
- una paráfrasis o síntesis generada por la IA no se considera semánticamente validada por el mero hecho de citar un fragmento;
- cuando la salida añade interpretación, alcance, causalidad o generalización, la claim se presenta como `INFERRED` o `INSUFFICIENT`, según las evidencias disponibles;
- la clasificación `SUPPORTED` propuesta por la IA es siempre advisory y nunca es suficiente para superar la validación.

Esto reduce la cobertura automática de `SUPPORTED`, pero hace técnicamente honesta la promesa del MDP. La validación semántica más amplia se evalúa en Q1-Q9 y mediante inspección humana; no se oculta esta limitación detrás de una confidence score.

La promesa técnicamente honesta es:

> El usuario puede verificar que una claim presentada como supported apunta al fragmento exacto del corpus que la respuesta declara utilizar, y que las claims interpretativas están marcadas como inferencias.

La aplicación no describe esta verificación como una prueba de verdad objetiva.

### 7.3 Regla de presentación

Una claim propuesta como `SUPPORTED` solo puede presentarse con ese estado si supera todas las validaciones estructurales y la regla conservadora de correspondencia textual directa. Si falla cualquiera:

- no se presenta como `SUPPORTED`;
- se presenta como `INFERRED` solo si las evidencias permiten una derivación explícita;
- en otro caso, se presenta como `INSUFFICIENT` o como respuesta no verificable;
- se conserva el motivo del fallo como estado de resultado, no como evidencia inventada.

### 7.4 Contextual divergence

`CONTEXTUAL_DIVERGENCE` puede proponerse cuando la respuesta cita dos o más fuentes válidas y explica sus contextos distintos.

La validación determinista comprueba:

- que las fuentes existen;
- que fueron recuperadas;
- que los fragmentos son inspeccionables;
- que la condición no se presenta como `CONFLICT` automáticamente.

No se construye un motor general de contradicciones. La interpretación semántica de la divergencia se evalúa en Q6 y permanece visible como una interpretación basada en las fuentes.

---

## 8. Persistence approach

### 8.1 Persistido como source of record

Debe persistirse:

- user Knowledge Items;
- contenido original;
- estado de fuente;
- procedencia;
- referencia opcional;
- fechas necesarias para lectura y actualización.

### 8.2 Derivado y reconstruible

Puede generarse de nuevo:

- índice textual;
- fragmentos indexados;
- ranking de resultados;
- contexto de retrieval;
- claims de una respuesta;
- clasificación propuesta;
- referencias de una respuesta.

### 8.3 No persistido por defecto

No se persisten por defecto:

- prompts completos;
- respuestas completas de IA;
- claims generadas;
- fragmentos enviados al proveedor;
- historial conversacional.

Esto evita tratar outputs provisionales como conocimiento y reduce la exposición de contenido personal.

### 8.4 Edición y eliminación

Una edición o eliminación de un Knowledge Item debe invalidar su representación derivada para nuevas búsquedas. Una respuesta ya mostrada no se convierte en un registro persistente del corpus.

### 8.5 Corpus de evaluación

El evaluation corpus se mantiene fuera de la persistencia mutable del usuario y se carga como fixture de evaluación. No se mezcla con el source of record del user corpus.

---

## 9. Failure model

| Situación | Resultado de aplicación | Presentación esperada |
|---|---|---|
| No results | Contexto vacío, sin llamada obligatoria a IA | No hay evidencia relevante; permitir seguir buscando |
| Resultados irrelevantes | Contexto sin soporte suficiente | Mostrar contexto relacionado, pero no respuesta grounded |
| Evidencia insuficiente | Respuesta `INSUFFICIENT` o abstención | Explicar qué no puede establecerse |
| Referencia inexistente | Fallo de validación | No presentar la claim como `SUPPORTED` |
| Fragmento no perteneciente al item | Fallo de validación | Respuesta no verificable; conservar resultados válidos |
| Claim supported sin referencia | Fallo de validación | Degradar u omitir la claim |
| IA no disponible | Retrieval sigue disponible | Mostrar búsqueda y fragmentos; no simular respuesta |
| Fuente `SUPERSEDED` | Evidencia válida con advertencia temporal | Mostrar estado y no tratarla como recomendación actual |
| Fuente `ARCHIVED` | Evidencia histórica o contextual | Mostrar estado; no usar por defecto como orientación activa |
| `CONTEXTUAL_DIVERGENCE` | Condición contextual con fuentes válidas | Mostrar posiciones y contextos, sin resolverlas |
| Respuesta malformada | No presentable como grounded | Mostrar fallo de generación y resultados de retrieval |
| Item editado/eliminado tras retrieval | Contexto invalidado | No aceptar referencias basadas en versión obsoleta |

---

## 10. Testing strategy summary

La estrategia completa está en `docs/05-testing-strategy.md`. Las decisiones principales son:

- reglas de dominio y validación: deterministas;
- retrieval textual y relación fragmento-item: testeables con fixtures;
- adapter de IA: contract tests con respuestas controladas y malformadas;
- integración real con IA: evaluada, no tratada como test determinista;
- Q1-Q9: corpus congelado, expectativas de retrieval y revisión de grounding;
- fallos de referencia, ausencia de IA y estados de fuente: hard gates.

La arquitectura no depende de que el modelo produzca siempre la misma redacción.

---

## 11. Frontend/backend boundary

### Frontend

El frontend es responsable de:

- presentar Knowledge Items;
- permitir las acciones CRUD del usuario;
- enviar búsquedas y preguntas aisladas;
- mostrar loading, vacío y error;
- presentar claims y su clasificación;
- abrir el fragmento de evidencia;
- mostrar procedencia y estado de fuente;
- distinguir respuesta grounded, inferida, insuficiente y no disponible.

El frontend no decide:

- qué evidencia es válida;
- si una claim puede ser `SUPPORTED`;
- qué fragmentos se envían a IA;
- cómo se construye el prompt;
- cómo se valida una referencia;
- cómo se aplica source of truth.

### Backend

El backend es responsable de:

- casos de uso;
- persistencia del user corpus;
- indexación y retrieval textual;
- selección del contexto mínimo;
- llamada al adaptador de IA;
- validación determinista;
- construcción del resultado presentable;
- estados de fallo;
- aislamiento del proveedor;
- aplicación de la política de privacidad.

---

## 12. Technology recommendation

### Frontend: React + TypeScript

Se recomienda React con TypeScript porque:

- el repository actual no impone un framework existente;
- la UI necesita representar estados ricos de claims, evidencia, insuficiencia y disponibilidad;
- permite hacer explícitos los límites entre application state, view models y presentación;
- aporta una demostración complementaria a la experiencia de arquitectura frontend, sin hacer que la integración de IA dependa del framework;
- mantiene el mismo lenguaje que el backend recomendado.

La recomendación no justifica introducir una solución global de estado antes de que exista una necesidad real.

### Backend: Node.js + TypeScript, modular monolith

Se recomienda un backend TypeScript en un único runtime porque:

- mantiene el contrato de tipos y conceptos entre frontend y backend sin acoplar sus responsabilidades;
- es suficiente para CRUD, búsqueda textual, validación y una llamada a IA;
- permite aislar los adaptadores sin microservicios;
- facilita tests deterministas alrededor de la frontera probabilística.

No se decide todavía un framework HTTP concreto.

### Persistence: SQLite con búsqueda full-text

Se recomienda SQLite como persistencia inicial porque:

- el producto es personal y de un único usuario;
- el corpus es pequeño;
- soporta CRUD y búsqueda textual sin infraestructura externa;
- permite que el índice sea local, explícito y reconstruible;
- evita introducir una base de datos vectorial o un servicio gestionado sin necesidad demostrada.

La elección de la variante concreta de full-text search se confirma durante el diseño técnico detallado, sin cambiar la frontera de Retrieval.

### AI integration strategy

Se recomienda una única integración detrás de una capacidad estrecha de grounded synthesis:

- input limitado a pregunta y fragmentos recuperados;
- output estructurado con claims y referencias;
- validación determinista posterior;
- ningún acceso de la IA a persistence;
- ningún proveedor múltiple ni model router.

El proveedor y modelo concreto quedan pendientes hasta documentar privacidad, coste y disponibilidad. Esta pendiente no bloquea el diseño de la frontera.

---

## 13. First vertical slice

El primer vertical slice implementable es:

1. Crear un Knowledge Item del user corpus con título, contenido, estado y procedencia.
2. Leer el Knowledge Item para confirmar que el contenido original es accesible.
3. Buscar un término exacto del contenido.
4. Recuperar un fragmento asociado al Knowledge Item.
5. Formular una pregunta aislada sobre ese fragmento.
6. Enviar únicamente la pregunta y el fragmento recuperado a la capacidad de grounded synthesis.
7. Recibir una respuesta con una claim y una referencia candidata.
8. Validar determinísticamente la existencia del item, pertenencia del fragmento y pertenencia al contexto de retrieval.
9. Presentar la claim como `SUPPORTED` únicamente si supera la validación y puede inspeccionarse el fragmento.
10. Simular IA no disponible y comprobar que búsqueda y lectura siguen funcionando.

Este slice no incluye todavía:

- el corpus completo de evaluación;
- las nueve preguntas en UI;
- detección general de conflictos;
- conversación;
- importación;
- semantic search.

El evaluation corpus y Q1-Q9 se incorporan como siguiente conjunto de pruebas sobre las mismas fronteras, no como una ampliación funcional del slice.

---

## 14. Architecture risks

### R1 — La validación determinista no prueba entailment semántico

La aplicación puede demostrar que una claim cita un fragmento real, pero no puede probar completamente que el fragmento implique la claim sin otra evaluación semántica. La documentación y la UI no deben prometer más que trazabilidad verificable.

### R2 — El modelo puede generalizar más allá del corpus

La validación estructural no detecta por sí sola toda generalización. Q1-Q9 y la revisión de claims son necesarios para evaluar este riesgo.

### R3 — Divergencia contextual puede confundirse con conflicto

La ausencia de un Conflict Engine es intencional. La respuesta debe mostrar contexto y no resolver automáticamente diferencias.

### R4 — Índice derivado obsoleto

Una edición o eliminación puede dejar fragmentos derivados inválidos. La aplicación debe validar la vigencia del item y permitir reconstruir el índice.

### R5 — La respuesta grounded puede parecer demasiado confiable

La presentación debe diferenciar evidencia de verdad objetiva y mostrar claramente el estado de la fuente.

### R6 — Contaminación entre evaluation corpus y user corpus

Los fixtures de evaluación no deben convertirse silenciosamente en conocimiento del usuario ni afectar sus búsquedas normales.

### R7 — Complejidad accidental en el frontend

La representación de estados no justifica una plataforma de estado global ni una jerarquía de componentes excesiva.

---

## 15. Explicit decisions NOT to make yet

Quedan pendientes, sin inventar una decisión:

- proveedor y modelo de IA;
- prompt exacto;
- formato serializado exacto del output del modelo;
- framework HTTP concreto;
- estrategia exacta de despliegue;
- autenticación;
- retención opcional de historial de respuestas;
- política de ranking más allá de búsqueda textual inicial;
- mecanismo general de detección de `CONFLICT`;
- embeddings o búsqueda semántica;
- importación;
- colaboración;
- conversación y memoria;
- observabilidad de contenido personal;
- optimizaciones de rendimiento del índice.

Estas decisiones no son necesarias para fijar las fronteras del MDP.

---

## 16. Traceability

| Product Contract | Architecture Decision | Documento operativo |
|---|---|---|
| Knowledge Items y source of truth | `KnowledgeItem` único; user/evaluation corpus separados | Este documento; `docs/03-ai-grounding-contract.md` |
| Text search y retrieval | Retrieval independiente, textual y reconstruible | `docs/04-retrieval-contract.md` |
| Grounded answer y claims | AI draft + validación determinista | `docs/03-ai-grounding-contract.md` |
| Referencias verificables | Validación de identidad, pertenencia, snapshot y contexto | `docs/03-ai-grounding-contract.md` |
| Safe failure | Estados explícitos sin IA y sin evidencia | Este documento; `docs/03-ai-grounding-contract.md` |
| Q1-Q9 y hard gates | Fixtures, contract tests y evaluación del modelo | `docs/05-testing-strategy.md` |
| Privacidad y contexto mínimo | Solo se envían fragmentos necesarios; no se persisten outputs por defecto | `docs/06-privacy-data-handling.md` |

La implementación posterior debe vincular cada cambio relevante a esta decisión y actualizar el documento si cambia una frontera, una regla de source of truth o la semántica de grounding.
