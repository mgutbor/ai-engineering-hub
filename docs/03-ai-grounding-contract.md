# AI / Grounding Contract v1

## Propósito

Este documento define la frontera entre generación probabilística y validación determinista para cumplir el Product Contract v1.

**Traza:** `docs/01-product-contract.md` → `docs/02-architecture-decision-v1.md`

No define un proveedor, un prompt concreto ni un formato de transporte.

---

## 1. Responsabilidad de la IA

La IA recibe una pregunta aislada y un contexto limitado de fragmentos recuperados. Puede proponer:

- claims;
- clasificación de cada claim;
- inferencias;
- referencias a claves de evidencia;
- una explicación de divergencia contextual.

La IA no tiene autoridad sobre el corpus. Su salida es un borrador no confiable hasta superar la validación.

La IA no puede:

- inventar Knowledge Items;
- crear referencias válidas por sí misma;
- acceder directamente a persistence;
- modificar Knowledge Items;
- usar conocimiento externo para rellenar huecos;
- convertir una inferencia en contenido original;
- resolver un conflicto que el corpus no permite resolver.

---

## 2. Vocabulario

### Claim

Una afirmación individual que puede evaluarse frente al contexto recuperado.

### Evidence candidate

Un fragmento recuperado que puede ser utilizado por la IA. Todavía no es evidencia aceptada para una claim hasta superar las comprobaciones de validez.

### Verifiable evidence

Un fragmento que:

1. pertenece a un Knowledge Item existente;
2. fue recuperado para la pregunta actual;
3. mantiene su localizador o snapshot inspeccionable;
4. conserva el estado y procedencia del Knowledge Item;
5. es referenciado mediante una identidad válida del contexto actual.

Esto prueba trazabilidad, no verdad objetiva.

---

## 3. Claim support

### SUPPORTED

Se puede presentar como `SUPPORTED` únicamente cuando:

- todas las referencias de evidencia son válidas, actuales, pertenecen al `RetrievalContext` y son inspeccionables;
- existe una `evidenceQuote` no vacía;
- la `evidenceQuote` es una subcadena exacta del fragmento citado (puede ser el fragmento completo o una parte continua del mismo);
- la claim es un restatement conservador de la quote mediante la regla `deletion-only`;
- la claim no añade causalidad, alcance, temporalidad, métrica, cuantificación, modalidad o generalización ausente del fragmento;
- el estado de la fuente no contradice la forma en que se presenta la claim.

#### Correspondencia textual directa y deletion-only

En v1, "correspondencia textual directa" significa que la claim puede obtenerse de la `evidenceQuote` eliminando tokens, pero sin:

- añadir, cambiar o reordenar tokens;
- alterar la negación;
- cambiar cuantificadores (`all`, `every`, `each`, `most`, `some`, etc.);
- cambiar la modalidad (`may`, `can`, `should`, `must`, etc.);
- cambiar el alcance de la afirmación.

La comparación ignora mayúsculas y diferencias de espacios/puntuación, conserva el orden de los tokens y exige conservar los tokens protegidos. La lista v1 es deliberadamente pequeña: `not`, `no`, `never`, `only`, `always`, `all`, `every`, `each`, `most`, `some`, `may`, `can`, `should`, `must`, `required`, `optional`, `for`, `within`, `inside`, `on`, `in`, `between`, `among`, `across` y sus equivalentes documentados en español (`ningún`, `nunca`, `solo`, `siempre`, `todo`, `cada`, `mayoría`, `alguno`, `puede`, `debe`, `obligatorio`, `opcional`, `para`, `dentro`, `sobre`, `entre`). Si la quote es parcial, no puede omitir un token protegido del fragmento en ninguna frase que la quote intersecte. Se pueden eliminar frases completas de la quote; no se pueden eliminar tokens protegidos de una frase intersectada. No pretende ser un analizador semántico completo.

Una quote válida no convierte automáticamente la claim en `SUPPORTED`: si la claim no pasa `deletion-only`, se degrada a `INFERRED` cuando la evidencia es válida y se conserva visible; si no hay evidencia válida, queda `INSUFFICIENT`.

### INFERRED

Se presenta como `INFERRED` cuando:

- la claim no puede demostrarse como restatement `deletion-only` de una quote verificable;
- se deriva de una o más evidencias válidas;
- las evidencias usadas se muestran;
- la redacción hace visible que es una deducción o síntesis.

Una inferencia no puede presentarse como una cita directa.

### INSUFFICIENT

Se presenta como `INSUFFICIENT` cuando:

- no existe evidencia relevante;
- existe evidencia temática pero no suficiente;
- las referencias propuestas son inválidas;
- la claim requiere conocimiento externo;
- no puede demostrarse el vínculo entre claim y fragmento.

La respuesta puede incluir el contexto disponible, pero debe dejar claro qué no puede establecerse.

---

## 4. Evidence condition

La condición no sustituye a `claim support`.

### CLEAR

La evidencia recuperada es relevante y no se presenta una divergencia contextual o conflicto visible.

### CONTEXTUAL_DIVERGENCE

Se muestra cuando fuentes válidas parecen recomendar cosas distintas, pero el propio contexto recuperado ofrece una explicación plausible basada en escenarios diferentes.

La condición debe incluir las fuentes y el contexto que la justifican. No convierte las claims en conflicto.

### CONFLICT

Es un concepto reservado para fuentes incompatibles sobre el mismo tema y alcance, sin resolución disponible. En v1 no existe un motor general que lo detecte automáticamente.

Si una salida de IA propone `CONFLICT`, la aplicación solo puede presentarlo si las fuentes y el contexto son verificables y la condición no contradice el alcance de v1. Si no puede verificarse, se degrada a una respuesta no resuelta, no a un conflicto afirmado.

---

## 5. Source status

### ACTIVE

La fuente está vigente dentro del corpus.

### SUPERSEDED

La fuente conserva valor histórico, pero una postura posterior la reemplaza para orientación actual. Puede soportar una claim histórica, pero no una recomendación actual sin advertencia.

### ARCHIVED

La fuente se conserva para consulta histórica o contextual y no debe tratarse por defecto como orientación activa.

El estado nunca convierte una fuente en verdad o falsedad objetiva.

---

## 6. Validación determinista

La aplicación valida la salida antes de presentarla como grounded.

### Validaciones de estructura

- la respuesta puede dividirse en claims;
- cada claim tiene una identidad local;
- cada claim tiene un support state permitido;
- cada referencia utiliza una identidad de evidencia conocida;
- las referencias duplicadas o desconocidas no se aceptan silenciosamente.

### Validaciones de identidad y pertenencia

- el Knowledge Item existe;
- la referencia apunta al Knowledge Item correcto;
- el fragmento pertenece al Knowledge Item;
- el fragmento pertenece al retrieval context de esta pregunta;
- el contexto corresponde a la versión vigente del Knowledge Item;
- el fragmento es inspeccionable por el usuario;
- una referencia no puede apuntar a un item eliminado o editado después del retrieval.

### Validaciones de estado

- una fuente `SUPERSEDED` se muestra con ese estado;
- una claim histórica puede utilizarla si la redacción es histórica;
- una recomendación actual no puede ocultar que depende de una fuente `SUPERSEDED`;
- una fuente `ARCHIVED` no se trata como orientación activa por defecto.

### Validaciones de soporte

- una claim `SUPPORTED` exige al menos una referencia válida;
- una claim `SUPPORTED` exige una `evidenceQuote` que sea una subcadena exacta del fragmento citado;
- una claim `SUPPORTED` exige que la claim pase la comprobación `deletion-only` respecto a la quote;
- una claim `INFERRED` exige referencias válidas a las evidencias que se muestran;
- una claim `INSUFFICIENT` no puede tener presentación de soporte directo;
- si una referencia existe pero la claim no pasa `deletion-only`, la propuesta `SUPPORTED` se degrada a `INFERRED` y conserva la evidencia válida;
- si una referencia existe pero el fragmento no es válido, la claim queda `INSUFFICIENT`;
- si la IA proporciona una cita textual, debe ser una subcadena exacta del fragmento recuperado;
- si la IA genera una referencia inexistente, la claim afectada no puede ser `SUPPORTED`.

### Límite de la validación

Estas reglas validan la cadena de procedencia, la integridad de referencias y una correspondencia textual conservadora. La regla `deletion-only` no demuestra entailment semántico completo: no puede decidir por sí sola si dos formulaciones no literales conservan toda la intención, causalidad, contexto o aplicabilidad de la evidencia. Por ello, una claim que no pueda demostrarse con esta regla no debe ser `SUPPORTED`; puede quedar como `INFERRED` si mantiene evidencias válidas y se presenta como interpretación.

La evaluación de sobreinterpretaciones, divergencias contextuales y aplicabilidad pertenece a los acceptance cases Q1-Q9 y a la revisión humana del resultado. Una `confidence score` del modelo nunca sustituye estas comprobaciones.

---

## 7. Presentation rules

### Supported

Debe mostrar:

```text
Claim → exact evidence fragment → Knowledge Item
```

### Inferred

Debe mostrar:

```text
Inference → supporting evidence set → indication that it is not literal
```

### Insufficient

Debe mostrar:

- qué pregunta o parte no puede establecerse;
- si existió contexto relacionado;
- por qué no es suficiente;
- que no se usó conocimiento externo para completar la respuesta.

### Invalid generated reference

Debe mostrar un resultado no verificable o insuficiente. Nunca debe aparecer como claim supported.

### AI unavailable

No se presenta respuesta sintética. Se conserva acceso a retrieval, búsqueda y lectura.

---

## 8. Privacy constraint

La IA recibe únicamente:

- pregunta aislada;
- fragmentos seleccionados;
- identificadores opacos necesarios para referencias;
- instrucciones de grounded synthesis.

No recibe:

- el corpus completo;
- el índice completo;
- Knowledge Items no recuperados;
- historial conversacional;
- acceso directo a persistence.

Los prompts, respuestas y fragmentos enviados no se persisten por defecto.
