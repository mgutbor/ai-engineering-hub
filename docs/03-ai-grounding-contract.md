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

- la claim tiene al menos una referencia válida;
- la referencia apunta a un fragmento del contexto recuperado;
- el fragmento pertenece al Knowledge Item citado;
- el usuario puede inspeccionar el fragmento;
- la claim no añade causalidad, alcance, temporalidad, métrica o generalización ausente del fragmento;
- el estado de la fuente no contradice la forma en que se presenta la claim.

La validación estructural es obligatoria. No basta la clasificación propuesta por el modelo. En v1, una presentación automática como `SUPPORTED` requiere además correspondencia textual directa e inspeccionable; una paráfrasis o generalización no queda validada solo por citar una fuente.

### INFERRED

Se presenta como `INFERRED` cuando:

- la claim no aparece literalmente en una única evidencia;
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
- una claim `INFERRED` exige referencias a todas las premisas declaradas;
- una claim `INSUFFICIENT` no puede tener presentación de soporte directo;
- si una referencia existe pero el fragmento no soporta la claim, la claim no puede ser `SUPPORTED`;
- si la IA proporciona una cita textual, debe coincidir con el fragmento recuperado;
- si la IA genera una referencia inexistente, la claim afectada no puede ser `SUPPORTED`.

### Límite de la validación

Estas reglas validan la cadena de procedencia y la integridad de referencias. No prueban automáticamente el entailment semántico completo. Para mantener una promesa honesta, v1 solo presenta automáticamente como `SUPPORTED` una claim con correspondencia textual directa e inspeccionable; las paráfrasis, síntesis y generalizaciones deben quedar como `INFERRED` o `INSUFFICIENT` según el caso.

La evaluación de si una claim sobreinterpreta un fragmento pertenece a los acceptance cases Q1-Q9 y a la revisión humana del resultado. Una `confidence score` del modelo nunca sustituye estas comprobaciones.

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
