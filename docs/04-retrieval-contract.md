# Retrieval Contract v1

## Propósito

Definir Retrieval como una capacidad independiente de la IA para localizar y entregar fragmentos inspeccionables.

**Traza:** `docs/01-product-contract.md` → `docs/02-architecture-decision-v1.md`

---

## 1. Alcance

Retrieval v1 utiliza búsqueda textual sobre el user corpus o sobre el evaluation corpus seleccionado.

Quedan fuera:

- embeddings;
- vector database;
- semantic search;
- reranking semántico;
- query expansion automática;
- agentes de recuperación;
- búsqueda sobre fuentes externas.

---

## 2. Input

Retrieval recibe:

- una pregunta o consulta textual;
- el corpus objetivo;
- el límite de resultados o fragmentos definido por la aplicación;
- la versión lógica del corpus que debe consultarse.

La consulta no incluye memoria de preguntas anteriores.

---

## 3. Output

Cada resultado debe conservar como mínimo:

- identificador del Knowledge Item;
- fragmento de contenido;
- localizador del fragmento o snapshot equivalente;
- estado de la fuente;
- procedencia;
- referencia opcional;
- identidad del retrieval context;
- versión o momento de lectura necesario para comprobar que el fragmento sigue vigente.

El resultado no contiene una respuesta de IA.

---

## 4. Retrieval context

El retrieval context es el conjunto delimitado de fragmentos entregado a la generación.

Debe permitir comprobar posteriormente:

- qué fragmentos fueron recuperados;
- qué fragmentos fueron enviados a la IA;
- a qué Knowledge Items pertenecían;
- qué versión del contenido se utilizó.

Un Knowledge Item relacionado pero ausente del retrieval context no puede ser citado por la respuesta como evidencia de esa pregunta.

---

## 5. Reglas de fragmentación

La fragmentación debe preservar suficiente contexto para que el usuario pueda inspeccionar el significado del fragmento.

No se fija todavía una estrategia técnica de fragmentación. Antes de implementarla deben comprobarse, como mínimo:

- que no se corten frases de forma que cambie el significado;
- que el fragmento conserve su relación con el texto original;
- que pueda localizarse dentro del Knowledge Item;
- que la UI pueda mostrar contexto suficiente sin presentar el fragmento como un documento independiente.

---

## 6. Estados de retrieval

### No results

No se recuperan fragmentos relevantes. La aplicación no debe generar una respuesta factual grounded.

### Related but insufficient

Se recuperan fragmentos temáticamente próximos, pero no permiten establecer la pregunta. La aplicación puede mostrarlos como contexto, nunca como soporte suficiente.

### Retrieved context

Se recuperan uno o más fragmentos inspeccionables. Esto permite solicitar generación, pero no garantiza que la respuesta del modelo esté correctamente grounded.

### Stale context

Un fragmento deja de ser válido si el Knowledge Item fue editado o eliminado después del retrieval. No puede utilizarse para presentar una nueva respuesta como grounded.

---

## 7. Source status en retrieval

Retrieval conserva el estado de cada Knowledge Item.

- `ACTIVE`: puede utilizarse como orientación actual dentro del corpus.
- `SUPERSEDED`: puede recuperarse para historia o comparación, pero debe mostrarse como superseded.
- `ARCHIVED`: puede recuperarse como contexto histórico, no como orientación activa por defecto.

Retrieval no decide por sí solo que una fuente sea verdad o que deba excluirse siempre.

---

## 8. Desacoplamiento

Retrieval no conoce:

- el proveedor de IA;
- prompts;
- claims;
- clasificación de support;
- presentación visual;
- persistencia de respuestas.

La aplicación puede usar los resultados para:

- mostrarlos sin IA;
- construir contexto para IA;
- ejecutar acceptance cases;
- inspeccionar evidencia.

Una estrategia de retrieval futura puede sustituirse mientras conserve el significado de Knowledge Item, fragmento, estado, procedencia y contexto verificable.

---

## 9. Evaluation contract

Las preguntas Q1-Q9 utilizan un evaluation corpus congelado y expectativas explícitas.

Retrieval debe evaluarse separadamente de la generación:

- Q1: debe encontrar KI-01 y KI-02;
- Q2: debe encontrar KI-01, KI-03 y KI-04;
- Q3: debe encontrar KI-08 y KI-09;
- Q4: debe encontrar KI-01 a KI-04;
- Q5: puede encontrar KI-06 y KI-07 como contexto, pero no existe procedimiento de migración;
- Q6: debe encontrar KI-03 y KI-04;
- Q7: debe encontrar KI-06 y KI-07;
- Q8: debe encontrar KI-08;
- Q9: no debe requerir ninguna fuente relevante.

Estas expectativas no convierten todos los resultados adicionales en incorrectos automáticamente. La evaluación debe distinguir:

- evidencia obligatoria;
- contexto opcional;
- resultados irrelevantes que no deben ser usados como soporte.

---

## 10. Propiedades de privacidad

Retrieval selecciona el contexto mínimo razonable para la pregunta. No envía el corpus completo al proveedor de IA y no incorpora contenido externo en v1.
