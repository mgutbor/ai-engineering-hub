# Privacy / Data Handling Notes v1

## Propósito

Documentar únicamente las decisiones de privacidad necesarias para el MDP.

**Traza:** `docs/01-product-contract.md` → `docs/02-architecture-decision-v1.md`

No es una política de compliance enterprise.

---

## 1. Data ownership

El user corpus es conocimiento personal del usuario y constituye el source of record local del producto.

Las respuestas de IA, claims generadas y fragmentos utilizados son información derivada. No se consideran conocimiento original.

---

## 2. What leaves the system

Para una pregunta aislada, solo se puede enviar al proveedor de IA:

- la pregunta;
- los fragmentos recuperados necesarios;
- identificadores opacos para vincular referencias;
- instrucciones de grounded synthesis.

No se envía automáticamente:

- el corpus completo;
- el índice completo;
- Knowledge Items no recuperados;
- preguntas anteriores;
- respuestas anteriores;
- contenido externo no seleccionado.

---

## 3. What remains local to the product

Debe permanecer bajo control del producto:

- Knowledge Items;
- procedencia;
- estados de fuente;
- referencias;
- índice textual;
- separación entre evaluation corpus y user corpus;
- decisiones de eliminación e invalidación.

La tecnología concreta de despliegue local o remoto queda pendiente y no se decide en este documento.

---

## 4. Logging

El logging inicial debe limitarse a información técnica:

- tipo de operación;
- duración;
- resultado de disponibilidad;
- tipo de error;
- tamaño agregado del contexto si fuese necesario para diagnosticar límites.

No se registran por defecto:

- contenido de Knowledge Items;
- preguntas completas;
- respuestas completas;
- prompts completos;
- fragmentos enviados al proveedor;
- claims generadas.

---

## 5. Retention

No se persisten por defecto:

- preguntas aisladas;
- respuestas de IA;
- contexto enviado;
- historial de conversación;
- claims derivadas.

Los Knowledge Items sí se conservan hasta que el usuario los edita o elimina.

---

## 6. Deletion

Eliminar un Knowledge Item debe impedir que aparezca en nuevas búsquedas o contextos de IA.

También debe invalidar sus representaciones derivadas reconstruibles.

Una respuesta previamente mostrada no debe convertirse en fuente persistente ni mantenerse como conocimiento independiente del Knowledge Item eliminado.

---

## 7. Evaluation corpus

El evaluation corpus es un fixture del producto y no debe mezclarse con el user corpus ni enviarse a un proveedor en consultas de usuario salvo que una evaluación explícita lo requiera.

Las evaluaciones deben poder ejecutarse de forma controlada y separada.

---

## 8. Pending decisions

Quedan pendientes:

- proveedor concreto;
- región y retención del proveedor;
- configuración exacta de almacenamiento local o remoto;
- estrategia de secretos;
- controles de acceso futuros.

Estas decisiones no son necesarias para fijar la regla de minimización: enviar solo el contexto necesario y no persistir outputs por defecto.
