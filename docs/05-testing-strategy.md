# Testing Strategy v1

## Propósito

Definir qué debe ser determinista, qué debe evaluarse como comportamiento probabilístico y cómo se comprueba la trazabilidad desde el Product Contract.

**Traza:** `docs/01-product-contract.md` → `docs/02-architecture-decision-v1.md`

No es un sistema académico de evaluación de LLM. Es una estrategia mínima para proteger las promesas del producto.

---

## 1. Principio de división

### Determinista

Debe ser determinista:

- reglas de Knowledge Item;
- estados `ACTIVE`, `SUPERSEDED`, `ARCHIVED`;
- separación entre user corpus y evaluation corpus;
- CRUD del user corpus;
- pertenencia de fragmento a Knowledge Item;
- pertenencia de fragmento al retrieval context;
- validez de referencias;
- vigencia de una versión recuperada;
- rechazo de referencias inexistentes;
- imposibilidad de presentar `SUPPORTED` sin evidencia válida y correspondencia textual directa;
- degradación ante IA no disponible;
- ausencia de persistencia automática de outputs.

### Probabilístico o evaluativo

Debe evaluarse, no asumirse como determinista:

- selección de fragmentos cuando hay varias coincidencias;
- separación de una respuesta en claims;
- clasificación semántica de una claim;
- calidad de una inferencia;
- fidelidad de una síntesis;
- reconocimiento de divergencia contextual;
- abstención propuesta por el modelo.

La aplicación puede imponer gates estructurales, pero no puede declarar que el modelo es semánticamente correcto únicamente porque devolvió un estado.

---

## 2. Unit tests de dominio y reglas

Deben cubrir:

- creación de Knowledge Item con campos requeridos;
- edición sin convertir contenido derivado en original;
- eliminación e invalidación de resultados derivados;
- interpretación de estados de fuente;
- preservación de procedencia;
- separación de corpus;
- reglas de presentación de `SUPERSEDED` y `ARCHIVED`.

No deben depender de un modelo de IA.

---

## 3. Tests de retrieval

Con fixtures controlados, deben comprobar:

- coincidencias exactas;
- recuperación de fragmentos con su Knowledge Item;
- localización o snapshot inspeccionable;
- propagación de estado y procedencia;
- resultado vacío;
- resultados relacionados pero insuficientes;
- exclusión de contenido eliminado o versión obsoleta;
- aislamiento entre user corpus y evaluation corpus.

Debe comprobarse retrieval de forma independiente antes de evaluar respuestas generadas.

---

## 4. Tests de validación de grounding

Las salidas de IA se representan mediante ejemplos controlados, sin llamar al modelo.

Deben existir casos para:

1. claim supported con referencia válida;
2. claim supported sin referencia;
3. referencia a Knowledge Item inexistente;
4. referencia a fragmento que no pertenece al item;
5. fragmento existente pero ausente del retrieval context;
6. claim que declara una cita textual diferente del fragmento;
7. claim inferred con todas sus premisas;
8. claim inferred sin evidencias completas;
9. claim insufficient con contexto relacionado;
10. fuente superseded presentada como recomendación actual;
11. contexto stale después de editar o eliminar un item;
12. respuesta malformada;
13. duplicación o inconsistencia de referencias.

El resultado esperado debe ser la clasificación presentable y no la clasificación propuesta por la IA.

---

## 5. Tests de integración de IA

La integración se prueba con respuestas controladas y, cuando sea necesario, con una llamada real separada de los tests deterministas.

Debe comprobarse:

- timeout o proveedor no disponible;
- respuesta vacía;
- salida no estructurada;
- referencia inexistente;
- claim sin referencias;
- intento de usar una referencia fuera del contexto;
- intento de responder con conocimiento no presente;
- respuesta con varias claims y distintos estados propuestos.

El test no debe confiar en el texto exacto de una redacción generada.

---

## 6. Evaluation corpus Q1-Q9

El evaluation corpus y las preguntas son fixtures congelados.

Cada caso debe conservar:

- pregunta;
- fuentes obligatorias;
- contexto opcional;
- fuentes que no deben utilizarse como soporte;
- resultado de support esperado;
- condición de evidencia esperada;
- claims que deben rechazarse;
- reglas de abstención.

### Gates específicos

- **Q1:** debe recuperar KI-01/KI-02; las claims directas pueden ser `SUPPORTED`, mientras que la síntesis interpretativa que se muestra en la demo de portfolio debe ser `INFERRED` con evidencia válida.
- **Q2:** síntesis contextual; no regla universal.
- **Q3:** hechos con correspondencia textual directa supported; síntesis general inferred.
- **Q4:** principio general inferred.
- **Q5:** abstención; no inventar procedimiento SSR→CSR.
- **Q6:** mostrar `CONTEXTUAL_DIVERGENCE`, no conflicto automático.
- **Q7:** respetar KI-07 `SUPERSEDED` y la postura activa de KI-06.
- **Q8:** no generalizar más allá del bundle inicial, entry points y dispositivos objetivo.
- **Q9:** abstención completa; ninguna tecnología de base de datos.

Q1-Q9 no deben convertirse en asserts frágiles sobre palabras exactas. Deben evaluarse por claims, referencias, estados y comportamiento seguro.

---

## 7. Failure cases

Se consideran obligatorios:

- retrieval sin resultados;
- evidencia irrelevante;
- evidencia insuficiente;
- fuente superseded;
- divergencia contextual;
- referencia inexistente;
- claim supported sin evidencia;
- IA no disponible;
- contenido editado o eliminado después del retrieval;
- respuesta con conocimiento externo no presente.

Cada caso debe comprobar tanto la salida como la ausencia de efectos indebidos sobre el user corpus.

---

## 8. Test de utilidad sin IA

Con la IA deshabilitada, deben seguir funcionando:

- create, read, update y delete de Knowledge Items;
- búsqueda textual;
- lectura de resultados;
- inspección de fragmentos;
- lectura de estado y procedencia.

La ausencia de IA no debe producir una pantalla vacía ni ocultar el source of record.

---

## 9. Criterio de suficiencia

No se fija un porcentaje científico para un corpus de 12 items.

El MDP es suficientemente bueno si:

- ningún `SUPPORTED` presentado carece de referencia verificable y correspondencia textual directa;
- Q5 y Q9 se abstienen;
- Q7 respeta `SUPERSEDED`;
- Q6 distingue divergencia contextual de conflicto automático;
- Q8 conserva el alcance limitado de su evidencia;
- los fallos de referencia son rechazados;
- la búsqueda sigue siendo útil sin IA;
- las respuestas pueden auditarse a nivel de claim.

Un fallo en cualquiera de los gates anteriores bloquea la aceptación del slice de grounding.
