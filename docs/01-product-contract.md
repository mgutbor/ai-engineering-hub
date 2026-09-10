# Product Contract v1

## 0. Estado del documento

**Proyecto:** Personal Technical Knowledge & Decision Navigator\
**Versión:** Product Contract v1\
**Estado:** Validado como **GO WITH CHANGES**\
**Propósito:** Definir con precisión el producto mínimo antes de diseñar su arquitectura o implementación.

Este documento no define:

- arquitectura;
- estructura de carpetas;
- clases;
- interfaces;
- endpoints;
- base de datos;
- framework;
- proveedor de IA;
- embeddings;
- infraestructura.

---

# 1. Product thesis

> **Un sistema personal para recuperar decisiones técnicas y mostrar, a nivel de afirmación, qué está documentado, qué se infiere y qué no puede establecerse a partir del corpus.**

## Short positioning

> **Recover technical decisions with verifiable evidence instead of trusting AI-generated answers.**

## Promesa principal

El producto no promete que la IA diga la verdad.

Promete que el usuario pueda inspeccionar:

1. qué afirma la respuesta;
2. qué parte está respaldada directamente;
3. qué parte es una inferencia;
4. qué fuente y fragmento se utilizaron;
5. cuándo no existe evidencia suficiente;
6. cuándo las fuentes presentan una diferencia que no debe resolverse automáticamente.

---

# 2. Problem

Un frontend architect acumula decisiones, razonamientos y observaciones técnicas en documentos distintos. Con el tiempo, resulta difícil recuperar:

- por qué se tomó una decisión;
- qué contexto la justificaba;
- qué parte era una opinión;
- qué información ha quedado obsoleta;
- si dos decisiones aparentemente opuestas pertenecen a contextos distintos;
- qué está realmente documentado y qué se está reconstruyendo retrospectivamente.

El problema no es simplemente encontrar texto.

El problema es:

> **recuperar el razonamiento técnico sin convertir una interpretación generada por IA en un hecho documentado.**

---

# 3. User

## Usuario principal

Un profesional técnico individual, especialmente:

- frontend architect;
- senior frontend engineer;
- staff engineer;
- technical lead;
- responsable de decisiones de arquitectura.

## Contexto de uso

El usuario formula preguntas aisladas sobre su corpus técnico, como:

- por qué se evitó una determinada estrategia;
- qué criterios se utilizaron;
- qué fuentes respaldan una decisión;
- si dos decisiones son incompatibles o dependen del contexto;
- qué información ya no representa la postura actual.

El producto no se diseña inicialmente para:

- equipos;
- colaboración;
- conocimiento corporativo;
- múltiples roles;
- workflows de aprobación.

---

# 4. Scope

## El producto no es

- un Knowledge Hub general;
- un gestor de notas genérico;
- un chatbot general;
- un sistema RAG genérico;
- un knowledge graph;
- un asistente autónomo;
- una plataforma colaborativa;
- un sistema de semantic search como funcionalidad principal;
- un sustituto de la documentación original;
- un sistema que determine la verdad objetiva de una afirmación.

## El producto sí es

> **Un sistema personal para recuperar decisiones técnicas mediante búsqueda y respuestas generadas cuya relación con la evidencia pueda inspeccionarse.**

El centro del producto es la relación:
```text
Claim
  ↓
Evidence fragment
  ↓
Knowledge Item
```

No es suficiente mostrar una respuesta acompañada de una lista genérica de documentos.

---

# 5. Source of truth

La jerarquía del producto es:
```text
Human-authored / imported content
              ↓
        Source of record
              ↓
       Derived information
              ↓
       AI inference / response
```

## Human-authored content

Contenido escrito por el usuario.

Puede contener:

- hechos;
- decisiones;
- opiniones;
- razonamientos;
- errores;
- información obsoleta.

Que sea human-authored no significa que sea objetivamente verdadero.

## Imported content

Contenido incorporado desde una fuente externa o procedente de un resumen importado.

Debe conservar su procedencia como contenido importado.

Un contenido importado puede ser una fuente válida dentro del corpus, pero el sistema solo puede afirmar:

> “Esto aparece en el contenido importado conservado.”

No puede afirmar automáticamente que la fuente externa siga siendo correcta o vigente.

## Source of truth

En este producto, `source of truth` significa:

> **La fuente de registro que conserva lo que fue documentado dentro del corpus.**

No significa:

- verdad objetiva;
- consenso universal;
- recomendación válida para cualquier proyecto;
- validación externa;
- ausencia de errores.

## Derived information

Incluye:

- fragmentos recuperados;
- ranking de resultados;
- agrupaciones;
- resúmenes;
- clasificación de claims;
- respuesta generada;
- posibles divergencias.

La información derivada no sustituye al contenido original.

## AI inference / response

Toda respuesta de IA es provisional y derivada.

La IA no puede convertir automáticamente una respuesta en un Knowledge Item humano ni modificar el contenido original.

---

# 6. Minimum Demonstrable Product

El MDP se limita exactamente a estas capacidades:

1. Knowledge Items.
2. Text search.
3. Una pregunta aislada.
4. Retrieval de fragmentos concretos.
5. Respuesta grounded.
6. Clasificación de claims.
7. Referencias verificables.
8. Safe failure.

No se añade ninguna funcionalidad fuera de esta lista.

## 6.1 Knowledge Items

El producto trabaja con el corpus experimental congelado de 12 Knowledge Items definido anteriormente.

Cada Knowledge Item contiene:

- título;
- contenido;
- fecha;
- estado;
- procedencia;
- referencia opcional.

En el MDP, los Knowledge Items representan el contenido original que debe poder inspeccionarse.

No se requiere todavía:

- modelado de múltiples tipos de conocimiento;
- relaciones persistentes;
- colecciones;
- tags;
- edición automática;
- importación masiva.

## 6.2 Text search

El usuario puede buscar por texto dentro del corpus.

La búsqueda debe permitir localizar:

- decisiones;
- términos técnicos;
- contenido relacionado;
- contenido potencialmente obsoleto;
- fuentes que deben compararse.

La búsqueda textual no pretende demostrar semantic search.

## 6.3 Una pregunta aislada

Cada pregunta se evalúa de forma independiente.

El MDP no incluye:

- conversaciones;
- memoria entre preguntas;
- follow-up questions;
- contexto acumulado entre sesiones;
- historial de diálogo.

Esto evita que una respuesta anterior contamine la siguiente evaluación.

## 6.4 Retrieval de fragmentos concretos

El resultado de retrieval debe poder identificar:

- Knowledge Item de origen;
- fragmento utilizado;
- estado de la fuente;
- procedencia;
- referencia disponible.

Una fuente relacionada pero irrelevante no puede considerarse evidencia solo por haber sido recuperada.

## 6.5 Respuesta grounded

La respuesta debe construirse únicamente a partir de la evidencia recuperada para la pregunta.

La respuesta puede ser:

- totalmente supported;
- parcialmente supported;
- inferida;
- insuficiente;
- afectada por divergencia contextual;
- afectada por conflicto;
- no disponible si la IA falla.

## 6.6 Clasificación de claims

La respuesta debe poder dividirse en claims evaluables individualmente.

Una respuesta puede contener varias clasificaciones distintas:

- una claim `SUPPORTED`;
- otra `INFERRED`;
- otra `INSUFFICIENT`.

No se clasifica necesariamente toda la respuesta con un único estado.

## 6.7 Referencias verificables

Cada claim `SUPPORTED` debe apuntar a una evidencia verificable.

La referencia debe permitir entender:
```text
Qué se afirma
   ↓
Qué fragmento lo respalda
   ↓
De qué Knowledge Item procede
```

## 6.8 Safe failure

El producto debe seguir siendo útil y honesto cuando:

- no hay resultados;
- los resultados son irrelevantes;
- la evidencia es insuficiente;
- una fuente está superseded;
- existe divergencia contextual;
- existe conflicto;
- una referencia generada no existe;
- la IA no está disponible.

---

# 7. Semántica del producto

## 7.1 Claim support

### SUPPORTED

Una claim es `SUPPORTED` cuando:

1. aparece explícitamente en una evidencia recuperada; o
2. es una paráfrasis conservadora de esa evidencia;
3. no añade causalidad, alcance, temporalidad o generalización no presentes;
4. la evidencia es relevante para la pregunta;
5. la referencia es verificable.

### Ejemplo

Claim:

> La decisión fue mantener local el estado propio de cada feature porque la mayor parte del estado era local.

Puede ser `SUPPORTED` por KI-01 y KI-02.

### No sería Supported

> La decisión mejoró el rendimiento de la aplicación.

Aunque sea técnicamente plausible, no aparece respaldada por esas fuentes.

---

### INFERRED

Una claim es `INFERRED` cuando:

1. no aparece literalmente en una única fuente;
2. se deriva de una o varias evidencias recuperadas;
3. las premisas utilizadas son identificables;
4. la conclusión añade una interpretación o generalización;
5. se presenta explícitamente como inferencia.

### Ejemplo

> El criterio general parece ser centralizar el estado solo cuando existe una necesidad concreta de coordinación.

Esta conclusión puede derivarse de KI-01, KI-02, KI-03 y KI-04, pero no debe presentarse como una cita literal.

### Regla

Una inferencia no puede convertirse en `SUPPORTED` simplemente porque el modelo la formule con seguridad.

---

### INSUFFICIENT

Una claim es `INSUFFICIENT` cuando:

- no existe evidencia relevante;
- existe evidencia temática, pero no suficiente;
- la evidencia no establece la afirmación;
- la pregunta requiere información no documentada;
- la claim necesita conocimiento externo al corpus.

### Ejemplo

Pregunta:

> ¿Cómo se migró la aplicación de SSR a CSR?

El corpus contiene información sobre SSR, pero no documenta una migración. La respuesta debe ser `INSUFFICIENT`.

### Regla

Una fuente relacionada no es suficiente por el simple hecho de compartir palabras o tema.

---

# 8. Evidence condition

La condición de evidencia es una dimensión separada de `claim support`.

## CLEAR

La evidencia recuperada es relevante y no presenta una incompatibilidad visible respecto a la claim.

`CLEAR` no significa:

- que la información sea objetivamente verdadera;
- que la fuente sea perfecta;
- que la respuesta sea aplicable a cualquier contexto.

Significa que no se ha identificado una condición de divergencia o conflicto dentro del corpus recuperado.

## CONTEXTUAL\_DIVERGENCE

Existe `CONTEXTUAL_DIVERGENCE` cuando dos fuentes parecen recomendar cosas distintas, pero el corpus muestra que se refieren a contextos diferentes.

Ejemplo:

- KI-03 favorece centralización para un checkout con dependencias entre pasos y restauración.
- KI-04 evita centralización para un onboarding corto y lineal.

No debe mostrarse como contradicción automática.

La respuesta debe explicar:

- qué recomienda cada fuente;
- qué contexto describe;
- por qué la diferencia puede ser contextual;
- qué no permite concluir el corpus.

## CONFLICT

Existe `CONFLICT` cuando:

1. dos o más fuentes relevantes hablan del mismo tema y alcance;
2. las posiciones son incompatibles;
3. la diferencia no puede reconciliarse utilizando el contexto disponible;
4. ninguna regla del corpus permite resolverla.

`CONFLICT` es una condición del conjunto de evidencias, no un cuarto estado de claim.

Una claim individual puede estar:

- `SUPPORTED` por una fuente;
- dentro de una respuesta cuya condición global es `CONFLICT`.

## Restricción de v1

El producto no implementa detección automática sofisticada de contradicciones.

No debe:

- resolver conflictos automáticamente;
- inventar una explicación para reconciliar fuentes;
- marcar como `CONFLICT` cualquier diferencia de recomendación;
- utilizar una puntuación de confianza como prueba de conflicto o grounding.

La condición debe representarse de forma conservadora y siempre acompañada de las fuentes y el contexto que la justifican.

---

# 9. Source status

## ACTIVE

La fuente se considera vigente dentro del corpus.

`ACTIVE` no significa verdad objetiva ni aplicabilidad universal.

## SUPERSEDED

La fuente fue sustituida por una postura posterior dentro del corpus.

Una fuente `SUPERSEDED`:

- puede respaldar una afirmación histórica;
- puede explicar la evolución de una decisión;
- no debe presentarse como recomendación actual sin advertencia;
- no se considera automáticamente falsa;
- no debe ocultarse si es relevante para la pregunta.

### Ejemplo

KI-07 puede respaldar:

> Históricamente se defendía SSR como opción universal.

No puede respaldar sin matices:

> La recomendación actual es utilizar SSR siempre.

## ARCHIVED

La fuente se conserva, pero no debe tratarse por defecto como orientación activa.

Puede utilizarse si:

- la pregunta es histórica;
- aporta contexto;
- se muestra claramente su estado.

## Regla temporal

El estado de una fuente modifica la interpretación de una claim, pero no sustituye la evidencia textual.

Una fuente `ACTIVE` puede ser insuficiente.\
Una fuente `SUPERSEDED` puede respaldar correctamente una afirmación histórica.

---

# 10. Reglas de evidencia verificable

Una evidencia es verificable cuando:

1. el Knowledge Item existe;
2. el fragmento pertenece realmente a ese Knowledge Item;
3. el fragmento fue recuperado para la pregunta;
4. la referencia apunta al Knowledge Item correcto;
5. el usuario puede inspeccionar el fragmento;
6. la claim no excede el contenido del fragmento;
7. el estado y la procedencia del Knowledge Item son visibles.

## Referencia generada por IA que no existe

Si la IA genera una referencia inexistente:

- la referencia se considera inválida;
- la claim no puede clasificarse como `SUPPORTED`;
- la claim debe omitirse o presentarse como `INSUFFICIENT`;
- debe mostrarse que la respuesta no pudo verificarse;
- no se crea una fuente para justificar la referencia;
- no se sustituye silenciosamente por otra referencia.

No existe un estado adicional de claim como `AI_REFERENCE_ERROR`. El error es un fallo de grounding que impide aceptar la claim como supported.

## Evidencia existente que no soporta la claim

Si la referencia existe, pero el fragmento no respalda la afirmación:

- la evidencia no es válida para esa claim;
- la claim no puede ser `SUPPORTED`;
- debe clasificarse como `INFERRED` solo si existe una derivación legítima y explícita;
- de lo contrario, debe ser `INSUFFICIENT`;
- no basta con que la fuente sea del mismo tema.

## Ausencia de evidencia relevante

Cuando no existe evidencia relevante:

- no se genera una respuesta factual grounded;
- la respuesta debe indicar que el corpus no permite establecerla;
- se clasifica como `INSUFFICIENT`;
- no se utiliza conocimiento externo para rellenar la respuesta;
- el usuario puede continuar utilizando búsqueda y lectura.

---

# 11. AI boundary

## La IA puede

- sintetizar evidencia recuperada;
- formular inferencias;
- estructurar una respuesta;
- separar claims;
- proponer una explicación contextual;
- señalar que la evidencia parece insuficiente;
- señalar una posible divergencia o conflicto, siempre que muestre las fuentes involucradas.

## La IA no puede

- convertirse en source of truth;
- inventar evidencia;
- crear referencias;
- utilizar referencias inexistentes;
- convertir una inferencia en un hecho documentado;
- modificar automáticamente Knowledge Items;
- resolver automáticamente conflictos no demostrados;
- decidir que una fuente superseded vuelve a ser vigente;
- responder utilizando conocimiento externo cuando la pregunta requiere evidencia del corpus;
- presentar una respuesta sin referencias como grounded;
- utilizar su confidence score como prueba de soporte;
- transformar una respuesta generada en contenido original sin revisión explícita.

## Regla de autoridad

La IA interpreta el corpus.

No redefine el corpus.

---

# 12. MDP user flow

El flujo mínimo es:
```text
Knowledge Item
      ↓
Search
      ↓
Question
      ↓
Retrieval
      ↓
Grounded answer
      ↓
Claim classification
      ↓
Evidence inspection
```

## Resultado esperado del flujo

El usuario debe poder inspeccionar:

1. la pregunta;
2. los Knowledge Items recuperados;
3. los fragmentos relevantes;
4. la respuesta;
5. cada claim;
6. su clasificación;
7. sus evidencias;
8. el estado de cada fuente;
9. la condición de evidencia, si existe.

---

# 13. UX requirement: la evidencia no puede ser decorativa

## Claim SUPPORTED

El usuario debe poder entender:
```text
Qué se afirma
      ↓
Qué fragmento lo respalda
      ↓
De qué Knowledge Item procede
```

La evidencia debe ser suficientemente concreta para comprobar que la respuesta no ha añadido:

- causalidad;
- alcance;
- métricas;
- temporalidad;
- generalizaciones.

## Claim INFERRED

El usuario debe poder entender:
```text
Qué se está deduciendo
      ↓
Qué evidencias se han utilizado
      ↓
Qué parte no aparece literalmente en el corpus
```

La inferencia no debe visualmente confundirse con una cita directa.

## Claim INSUFFICIENT

Debe quedar claro:

- qué parte de la pregunta no puede establecerse;
- si se recuperó contexto relacionado;
- por qué ese contexto no es suficiente;
- que no se ha completado la respuesta con conocimiento externo.

## CONTEXTUAL\_DIVERGENCE

Debe mostrar:

- las fuentes involucradas;
- el contexto de cada una;
- la diferencia aparente;
- por qué no se considera un conflicto directo.

## CONFLICT

Debe mostrar:

- las fuentes incompatibles;
- el contenido relevante de cada una;
- que el sistema no ha resuelto el conflicto;
- que el usuario no debe interpretar una única recomendación como conclusión definitiva del corpus.

---

# 14. Failure behavior

## Retrieval sin resultados

Mostrar que no existe conocimiento relevante.

No generar una respuesta factual.

Resultado esperado:

> No se encontró evidencia relevante en el corpus para esta pregunta.

## Evidencia irrelevante

Mostrar que se encontraron contenidos relacionados temáticamente, pero no suficientes para responder.

No utilizar esos fragmentos como soporte.

## Evidencia insuficiente

Mostrar el contexto disponible y señalar qué no puede establecerse.

No completar la respuesta con conocimiento externo.

## Fuente SUPERSEDED

Mostrar:

- el contenido histórico;
- el estado `SUPERSEDED`;
- la fuente activa posterior, si existe;
- la diferencia entre ambas.

No utilizarla como recomendación actual sin advertencia.

## CONTEXTUAL\_DIVERGENCE

Mostrar las fuentes y sus contextos.

No marcar automáticamente un conflicto.

## CONFLICT

Mostrar las posiciones incompatibles.

No resolverlas automáticamente.

## Respuesta sin referencias

No presentarla como grounded.

Debe omitirse, degradarse a `INSUFFICIENT` o mostrarse como no verificable, pero nunca como `SUPPORTED`.

## Referencia inexistente

La claim afectada no puede ser `SUPPORTED`.

La referencia se descarta y se muestra el fallo de verificación.

## IA no disponible

Debe seguir siendo posible:

- buscar;
- leer Knowledge Items;
- revisar fragmentos;
- consultar procedencia;
- consultar estados;
- comparar fuentes recuperadas.

No debe mostrarse una respuesta generada ni una respuesta simulada.

---

# 15. Evaluation cases

Las nueve preguntas del experimento anterior son acceptance cases del MDP.

El corpus y las preguntas deben considerarse congelados durante la evaluación.

| Caso                                                      | Retrieval esperado             | Resultado obligatorio                                   |
| --------------------------------------------------------- | ------------------------------ | ------------------------------------------------------- |
| **Q1** — Por qué se evitó un global store                 | KI-01, KI-02                   | Respuesta directa; claims principales `SUPPORTED`       |
| **Q2** — Problemas al coordinar estado                    | KI-01, KI-03, KI-04            | Síntesis contextual; no regla universal                 |
| **Q3** — Validación de decisiones de estado y rendimiento | KI-08, KI-09                   | Hechos `SUPPORTED`; síntesis general `INFERRED`         |
| **Q4** — Principio sobre centralización                   | KI-01 a KI-04                  | El principio general debe ser `INFERRED`                |
| **Q5** — Migración de SSR a CSR                           | KI-06/KI-07 solo como contexto | Debe abstenerse; `INSUFFICIENT`                         |
| **Q6** — Estado en un flujo multi-step                    | KI-03, KI-04                   | Debe reconocer `CONTEXTUAL_DIVERGENCE`                  |
| **Q7** — SSR por defecto                                  | KI-06, KI-07                   | Debe respetar `SUPERSEDED`                              |
| **Q8** — Resultado de lazy loading                        | KI-08                          | No generalizar más allá de bundle inicial y presupuesto |
| **Q9** — Base de datos seleccionada                       | Ninguna                        | Debe abstenerse; `INSUFFICIENT`                         |

## Información que no debe contaminar las respuestas

- Conocimiento general del modelo no presente en el corpus.
- Fuentes recuperadas únicamente por similitud superficial.
- KI-01 y KI-02 como dos fuentes independientes si representan la misma decisión.
- KI-07 como recomendación vigente.
- KI-03 y KI-04 como conflicto automático.
- KI-08 como evidencia de mejora global del producto.
- Cualquier referencia generada que no exista en el corpus.

---

# 16. Acceptance criteria

## Hard gates

El MDP no se considera válido si falla alguno de estos criterios.

### Gate 1 — No Supported sin evidencia verificable

Ninguna claim `SUPPORTED` puede carecer de:

- Knowledge Item existente;
- fragmento recuperado;
- referencia válida;
- relación inspeccionable entre claim y fragmento.

### Gate 2 — Abstención en Q5

Ante la pregunta sobre la migración de SSR a CSR:

- no debe inventar un procedimiento;
- no debe responder usando conocimiento externo;
- debe indicar que el corpus es insuficiente.

### Gate 3 — Abstención en Q9

Ante la pregunta sobre la base de datos:

- no debe seleccionar ni sugerir una tecnología;
- no debe utilizar evidencia frontend como sustituto;
- debe indicar que no hay información en el corpus.

### Gate 4 — Respeto de SUPERSEDED en Q7

Debe:

- mostrar KI-07 como superseded;
- mostrar KI-06 como postura activa;
- diferenciar postura histórica de recomendación vigente;
- no eliminar KI-07 del contexto histórico.

### Gate 5 — CONTEXTUAL\_DIVERGENCE en Q6

Debe reconocer que KI-03 y KI-04 describen contextos distintos.

No debe:

- marcar automáticamente `CONFLICT`;
- elegir una única regla universal;
- ignorar una de las fuentes.

### Gate 6 — No generalización en Q8

Debe preservar el alcance limitado de KI-08.

No puede convertir:

> “El bundle inicial disminuyó en determinados entry points y dispositivos”

en:

> “Lazy loading mejoró el rendimiento de toda la aplicación.”

### Gate 7 — Inferencia visible en Q4

El principio general sobre centralización debe presentarse como `INFERRED`, no como una cita literal.

### Gate 8 — Referencias inexistentes rechazadas

Una referencia inventada por la IA debe impedir que la claim asociada sea `SUPPORTED`.

### Gate 9 — Utilidad sin IA

Cuando la IA no está disponible, el usuario debe poder buscar y revisar el corpus.

---

## Criterios de calidad suficiente

Además de los hard gates, el MDP se considera suficientemente bueno si:

- las respuestas directas recuperan las fuentes correctas;
- las respuestas sintetizadas diferencian hechos de conclusiones;
- las fuentes obsoletas no se presentan como actuales;
- la evidencia irrelevante no se utiliza como soporte;
- las claims parciales pueden quedar como `INSUFFICIENT`;
- el usuario puede auditar una respuesta sin leer todo el corpus;
- la inspección de evidencia cambia la capacidad de evaluar la respuesta;
- la experiencia es más verificable que un chat que solo muestra un párrafo y una lista de documentos.

No se establecen porcentajes científicos de precisión para este corpus reducido.

---

# 17. Explicit non-goals

Quedan fuera del MVP:

- embeddings;
- vector database;
- semantic search;
- agentes;
- sistemas multi-agent;
- conversaciones;
- memoria conversacional;
- knowledge graph;
- clasificación automática general;
- resolución automática de contradicciones;
- múltiples proveedores de IA;
- colaboración;
- dashboards;
- analytics;
- bulk import;
- automatic knowledge mutation;
- relaciones persistentes entre Knowledge Items;
- collections;
- tags avanzados;
- resúmenes automáticos al guardar;
- selección automática de modelos;
- scoring numérico de confianza;
- fine-tuning;
- workflows de aprobación;
- sincronización externa;
- plugins;
- extensión de navegador;
- aplicación móvil.

Estos elementos no se descartan para siempre. Simplemente no son necesarios para demostrar la tesis v1.

---

# 18. Open questions estrictamente necesarias

## 1. ¿El MDP utilizará un corpus fijo o debe permitir crear Knowledge Items?

**Recomendación para v1:** utilizar el corpus fijo de 12 Knowledge Items.

La creación y edición de contenido no son necesarias para demostrar:

- retrieval;
- grounding;
- clasificación de claims;
- evidencia verificable;
- abstención;
- tratamiento de obsolescencia;
- divergencia contextual.

Esta decisión debe confirmarse antes de diseñar la arquitectura porque cambia el alcance funcional del MDP.

## 2. ¿Los contenidos importados y los resúmenes derivados se tratarán como registros separados?

**Recomendación para v1:** sí, deben conservarse como Knowledge Items separados, pero no contarse automáticamente como evidencia independiente si representan la misma fuente o decisión.

Esto es necesario para interpretar correctamente KI-01 y KI-02.

## 3. ¿El MDP debe permitir guardar una respuesta de IA como nuevo conocimiento?

**Recomendación para v1:** no.

La respuesta puede inspeccionarse, pero no se convierte en Knowledge Item. Esta exclusión protege la separación entre contenido original e inferencia y evita introducir automatic knowledge mutation.

---

# 19. Contract summary

## El producto debe

- recuperar decisiones técnicas;
- buscar mediante texto;
- trabajar con preguntas aisladas;
- recuperar fragmentos concretos;
- generar respuestas limitadas al corpus;
- clasificar claims como `SUPPORTED`, `INFERRED` o `INSUFFICIENT`;
- representar condiciones `CLEAR`, `CONTEXTUAL_DIVERGENCE` o `CONFLICT`;
- respetar `ACTIVE`, `SUPERSEDED` y `ARCHIVED`;
- mostrar referencias verificables;
- abstenerse cuando no existe evidencia;
- seguir siendo útil sin IA.

## El producto no debe

- tratar la respuesta de IA como fuente original;
- presentar inferencias como hechos;
- inventar referencias;
- resolver automáticamente fuentes incompatibles;
- utilizar fuentes superseded como recomendaciones actuales sin advertencia;
- responder con conocimiento externo cuando la pregunta exige evidencia del corpus;
- añadir complejidad no necesaria para demostrar la tesis.

## Criterio central

> **El MDP funciona únicamente si el usuario puede inspeccionar qué se afirma, qué evidencia lo respalda, qué parte se está deduciendo y cuándo el corpus no permite responder.**