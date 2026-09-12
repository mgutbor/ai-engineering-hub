# Technical Decision Navigator

**Recupera decisiones técnicas con evidencia verificable en lugar de confiar en respuestas generadas por IA.**

Las decisiones técnicas son fáciles de perder entre ADRs, retrospectivas, notas de rendimiento y documentos de implementación. Una respuesta generada por IA puede parecer convincente incluso cuando el corpus no respalda la afirmación. Recuperar una decisión requiere, por tanto, algo más que encontrar texto relacionado: la evidencia que sustenta cada afirmación debe poder inspeccionarse.

## Tesis

> **El sistema no pregunta si la respuesta de la IA parece correcta. Pregunta si el corpus puede respaldar la afirmación.**

Este proyecto explora cómo construir una validación determinista alrededor de una IA probabilística.

## Por qué no es un chatbot genérico

**Technical Decision Navigator** no es un chatbot, una demo genérica de RAG ni una base de conocimiento con chat.

La IA es solamente una etapa dentro de un pipeline más amplio:

- la recuperación de texto es determinista y utiliza SQLite FTS5;
- la aplicación construye un `RetrievalContext` limitado;
- la IA propone un borrador estructurado con afirmaciones y referencias de evidencia;
- la validación determinista comprueba el borrador antes de presentarlo;
- cada referencia de evidencia aceptada puede inspeccionarse hasta su `Knowledge Item`;
- cuando el corpus no proporciona evidencia relevante, el sistema se abstiene en lugar de completar la respuesta utilizando conocimiento externo.

**La IA propone una respuesta. No decide por sí sola qué está respaldado por el corpus.**

## Arquitectura / flujo

```text
Pregunta
   ↓
Recuperación determinista de texto
   ↓
RetrievalContext
   ↓
Síntesis probabilística con IA
   ↓
Validación determinista del grounding
   ↓
GroundedResponse
   ↓
Afirmaciones → Evidencia → Knowledge Item
```

`GroundedResponse` es el resultado obtenido después de la validación, no la respuesta original del proveedor de IA.

La validación determinista comprueba:

- identidad de la evidencia;
- pertenencia al `Knowledge Item` correspondiente;
- pertenencia al `RetrievalContext`;
- vigencia de la revisión;
- inspeccionabilidad de la evidencia;
- una regla conservadora de correspondencia textual directa.

No demuestra la verdad semántica de una afirmación ni proporciona una garantía completa de entailment semántico.

## Estados de las afirmaciones

### `SUPPORTED`

La evidencia permite una correspondencia suficientemente directa de acuerdo con las reglas conservadoras del sistema.

La afirmación debe apuntar a evidencia válida e inspeccionable perteneciente al contexto de recuperación actual.

### `INFERRED`

La evidencia es válida, pero la afirmación incorpora una interpretación o no supera la regla conservadora de correspondencia textual directa.

**`INFERRED` no significa incorrecto.**

Significa que el sistema distingue entre una derivación basada en evidencia y una afirmación documentada directamente.

### `INSUFFICIENT`

El corpus no proporciona suficiente evidencia relevante.

El sistema se abstiene en lugar de presentar como hecho una respuesta que no puede respaldar.

## Demo de portfolio

La demo utiliza dos preguntas que muestran comportamientos deliberadamente diferentes.

### Ejemplo A — existe evidencia

**Pregunta:**

> Why was a global store avoided for all UI state?

La demo real produce:

```text
Respuesta
   ↓
Afirmación: INFERRED
   ↓
Evidencia
   ↓
Knowledge Item
```

La evidencia puede inspeccionarse.

La afirmación es razonable, pero introduce una relación interpretativa que no supera la comprobación conservadora basada en eliminación de texto.

Este es un resultado **intencionado y correcto**, no un fallo de validación.

### Ejemplo B — no existe evidencia

**Pregunta:**

> Which database was selected for the platform?

Resultado:

```text
INSUFFICIENT
```

No existe evidencia relevante en el corpus, por lo que el sistema se abstiene.

No inventa una base de datos, no muestra evidencia falsa y no invoca la IA cuando la recuperación no encuentra fragmentos relevantes.

Estos dos casos constituyen la demostración principal del proyecto:

> **La existencia de evidencia no implica automáticamente que una afirmación sea una afirmación documentada directamente; y la ausencia de evidencia es un resultado válido.**

## Demo reproducible

### Requisitos

- Node.js 20+
- npm 10+

### Instalación

```bash
npm install
```

### Configurar Groq

Groq es el proveedor principal utilizado por el runtime actual. Gemini permanece disponible como fallback.

```bash
export GROQ_API_KEY="..."
export GROQ_MODEL="openai/gpt-oss-20b" # opcional
```

Si `GROQ_API_KEY` no está configurada y `GEMINI_API_KEY` sí lo está, el backend utiliza Gemini.

Si no hay ninguna clave configurada, las operaciones CRUD y la recuperación siguen disponibles. Cuando existe evidencia pero no hay proveedor de IA disponible, la generación devuelve `AI_UNAVAILABLE`.

### Arranque

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3000

El backend crea una base de datos SQLite local dentro de `data/` durante el primer arranque.

### Crear el corpus de demostración

El corpus de evaluación está separado del corpus de usuario.

La interfaz normal comienza con un corpus de usuario vacío, por lo que un clone limpio muestra inicialmente:

```text
Knowledge Items 0
```

Crea los siguientes dos `Knowledge Items` desde **New Knowledge Item** en la interfaz.

#### Knowledge Item 1

**Title:**

```text
UI state ownership decision
```

**Content:**

```text
Feature-owned UI state remained local by default. Shared state was introduced only when multiple features needed to coordinate. A global store for all UI state was avoided because most state was local and the additional indirection made ownership harder to understand.
```

#### Knowledge Item 2

**Title:**

```text
Shared state decision
```

**Content:**

```text
Keep feature-owned state local by default. Introduce shared state only when there is a demonstrated cross-feature coordination problem.
```

A continuación, ejecuta las dos preguntas descritas en la demo de portfolio.

Selecciona la evidencia mostrada bajo la afirmación para inspeccionar el `Knowledge Item` de origen, su revisión, estado, procedencia y, cuando exista, la referencia externa asociada.

## Testing y verificación

El repositorio separa las comprobaciones deterministas de la evaluación probabilística de los proveedores de IA.

### Tests deterministas

Cubren:

- CRUD y revisiones de `Knowledge Item`;
- propagación de estado y procedencia;
- recuperación mediante SQLite FTS5;
- referencias de evidencia y pertenencia al `RetrievalContext`;
- vigencia de revisiones y rechazo de contextos obsoletos;
- soporte conservador basado en eliminación de texto;
- protección de tokens de negación, cuantificación, modalidad y alcance;
- degradación a `INFERRED`;
- degradación a `INSUFFICIENT`;
- respuestas de IA malformadas;
- rutas de proveedor no disponible;
- abstención antes de invocar la IA cuando la recuperación no encuentra evidencia relevante.

### Tests de los adapters de IA

Los adapters de Groq y Gemini están cubiertos mediante tests de contrato con respuestas controladas.

Estos tests verifican:

- límites de la petición;
- tratamiento de respuestas estructuradas;
- errores del proveedor;
- respuestas malformadas;
- diagnósticos seguros que no exponen secretos.

No realizan llamadas a los proveedores reales.

### Smoke tests con proveedores reales

```bash
npm run smoke:groq --workspace backend
npm run smoke:gemini --workspace backend
```

Son smoke tests contra proveedores reales.

No son tests deterministas: su resultado depende de las condiciones de red, cuotas, comportamiento del modelo y disponibilidad del proveedor.

### Comprobaciones habituales

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Limitaciones conocidas

- la validación determinista no proporciona entailment semántico completo;
- la procedencia de la evidencia no demuestra la verdad objetiva de una afirmación;
- el proyecto no garantiza una calidad estable de las respuestas del LLM;
- no existe una suite formal de browser end-to-end;
- las respuestas de proveedores reales son probabilísticas;
- los smoke tests dependen de la red, el modelo seleccionado y la disponibilidad del proveedor;
- el proyecto no realiza afirmaciones de rendimiento o escalabilidad;
- la recuperación es deliberadamente textual y no constituye semantic search.

## No-objetivos deliberados

El MVP no incorpora:

- embeddings, bases de datos vectoriales ni semantic search;
- agentes, conversaciones, memoria ni knowledge graph;
- resolución automática de contradicciones ni confidence scoring;
- colaboración, importación masiva ni modificación automática de `Knowledge Items`;
- una arquitectura genérica multi-provider, un provider registry, routing dinámico o una capa de gestión de proveedores.

Existen adapters concretos para Groq y Gemini con el objetivo de ejercitar el límite de síntesis fundamentada con IA.

Esto no convierte el proyecto en una plataforma de proveedores.

## Documentación

- [Product Contract](docs/01-product-contract.md)
- [Architecture Decision](docs/02-architecture-decision-v1.md)
- [AI / Grounding Contract](docs/03-ai-grounding-contract.md)
- [Retrieval Contract](docs/04-retrieval-contract.md)
- [Testing Strategy](docs/05-testing-strategy.md)
- [Privacy / Data Handling](docs/06-privacy-data-handling.md)
- [Implementation Design](docs/07-implementation-design-v1.md)
- [HTTP transport ADR](docs/adr/001-http-transport.md)
- [Grounded synthesis adapter ADR](docs/adr/002-slice-b-ai-adapter.md)