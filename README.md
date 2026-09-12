# Technical Decision Navigator

> **Recover technical decisions with verifiable evidence instead of trusting AI-generated answers.**

Technical decisions are easy to lose across ADRs, retrospectives, performance notes and implementation documents. A generated answer can sound convincing even when the corpus does not support the claim. Recovering a decision therefore requires more than retrieving related text: the evidence behind each claim must remain inspectable.

## Thesis

> **The system does not ask whether the AI sounds correct. It asks whether the corpus can support the claim.**

This project demonstrates **deterministic validation around probabilistic AI**.

## Why this is not a generic AI chatbot

Technical Decision Navigator is not a chatbot, a generic RAG demo or a knowledge base with chat. The AI is only one step in a wider pipeline:

- text retrieval is deterministic and uses SQLite FTS5;
- the application builds a limited `RetrievalContext`;
- the AI proposes a structured draft with claims and evidence IDs;
- deterministic validation checks the draft before presentation;
- every accepted evidence reference can be inspected back to its Knowledge Item;
- when the corpus does not provide relevant evidence, the system abstains instead of completing the answer with external knowledge.

The AI proposes a response. It does not decide by itself what the corpus supports.

## Architecture / flow

```text
Question
   ↓
Deterministic text retrieval
   ↓
RetrievalContext
   ↓
Probabilistic AI synthesis
   ↓
Deterministic grounding validation
   ↓
GroundedResponse
   ↓
Claims → Evidence → Knowledge Item
```

A `GroundedResponse` is the result after validation, not the raw provider output. Deterministic validation checks evidence identity, Knowledge Item ownership, retrieval-context membership, revision freshness, inspectability and a conservative direct-text support rule. It does not prove semantic truth or complete entailment.

## Claim states

### `SUPPORTED`

The evidence allows a sufficiently direct correspondence under the system's conservative rules. The claim must point to valid, inspectable evidence from the current retrieval context.

### `INFERRED`

The evidence is valid, but the claim adds interpretation or does not pass the conservative direct-text correspondence rule.

**`INFERRED` does not mean incorrect.** It means the system is distinguishing a derivation from a directly documented statement.

### `INSUFFICIENT`

The corpus does not provide enough relevant evidence. The system abstains instead of presenting an unsupported factual answer.

## Portfolio demo

### Example A — evidence exists

Question:

```text
Why was a global store avoided for all UI state?
```

The real demo is expected to produce:

```text
Answer
   ↓
Claim: INFERRED
   ↓
Evidence
   ↓
Knowledge Item
```

The evidence is inspectable. The claim is reasonable, but it introduces an interpretive relationship that does not pass the conservative deletion-only support check. This is an intentional and correct result, not a validation failure.

### Example B — evidence does not exist

Question:

```text
Which database was selected for the platform?
```

The result is:

```text
INSUFFICIENT
```

There is no relevant evidence, so the system abstains. It does not invent a database, does not show false evidence and does not invoke the AI when retrieval finds no relevant fragments.

These two cases are the main demonstration: evidence can support an inspectable claim without making it a literal statement, and lack of evidence is a valid result.

## Reproducible demo

### Requirements

- Node.js 20+
- npm 10+

### Install

```bash
npm install
```

### Configure Groq

Groq is the primary provider used by the current runtime. Gemini remains available as a fallback.

```bash
export GROQ_API_KEY="..."
export GROQ_MODEL="openai/gpt-oss-20b" # optional
```

If `GROQ_API_KEY` is not set and `GEMINI_API_KEY` is set, the backend uses Gemini. If neither key is available, CRUD and retrieval remain usable and grounded generation returns `AI_UNAVAILABLE` when evidence exists.

### Start

```bash
npm run dev
```

- frontend: `http://localhost:5173`
- backend: `http://localhost:3000`

The backend creates a local SQLite database under `data/` on first start.

### Create the demo corpus

The evaluation corpus is separate from the user corpus. The normal UI starts with an empty user corpus, so a fresh clone initially shows `Knowledge Items 0`.

Create these two Knowledge Items from **New Knowledge Item** in the UI.

#### Knowledge Item 1

Title:

```text
UI state ownership decision
```

Content:

```text
Feature-owned UI state remained local by default. Shared state was introduced only when multiple features needed to coordinate. A global store for all UI state was avoided because most state was local and the additional indirection made ownership harder to understand.
```

#### Knowledge Item 2

Title:

```text
Shared state decision
```

Content:

```text
Keep feature-owned state local by default. Introduce shared state only when there is a demonstrated cross-feature coordination problem.
```

Then run the two questions from the portfolio demo above. Select the evidence shown under the claim to inspect the source Knowledge Item, revision, status, provenance and optional source reference.

## Testing and verification

The repository separates deterministic application checks from probabilistic provider evaluation.

### Deterministic tests

They cover:

- Knowledge Item CRUD and revisions;
- status and provenance propagation;
- SQLite FTS5 retrieval;
- evidence references and retrieval-context membership;
- revision freshness and stale-context rejection;
- conservative deletion-only support;
- protected negation, quantifier, modality and scope tokens;
- degradation to `INFERRED`;
- degradation to `INSUFFICIENT`;
- malformed AI responses;
- provider-unavailable paths;
- abstention before AI invocation when retrieval finds no relevant evidence.

### AI adapter tests

Groq and Gemini adapters are contract-tested with controlled provider responses. These tests verify request boundaries, structured output handling, provider errors, malformed responses and secret-safe diagnostics without calling the real providers.

### Real-provider smoke tests

```bash
npm run smoke:groq --workspace backend
npm run smoke:gemini --workspace backend
```

These are smoke tests against real providers. They are not deterministic tests: their output depends on network conditions, quotas, model behavior and provider availability.

The normal quality checks are:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Known limitations

- deterministic validation does not provide complete semantic entailment;
- evidence provenance is not proof of objective truth;
- the project does not guarantee stable LLM response quality;
- there is no formal browser end-to-end suite;
- real-provider output is probabilistic;
- smoke tests depend on the network, selected model and provider;
- the project makes no performance or scalability claim;
- text retrieval is intentionally not semantic search.

## Deliberate non-goals

The MVP does not introduce:

- embeddings, vector databases or semantic search;
- agents, conversations, memory or a knowledge graph;
- automatic contradiction resolution or confidence scoring;
- collaboration, bulk import or automatic Knowledge Item mutation;
- a generic multi-provider architecture, provider registry, dynamic routing or provider management layer.

Concrete Groq and Gemini adapters exist to exercise the grounded-synthesis boundary. They do not turn this project into a provider platform.

## Documentation

- [Product Contract](docs/01-product-contract.md)
- [Architecture Decision](docs/02-architecture-decision-v1.md)
- [AI / Grounding Contract](docs/03-ai-grounding-contract.md)
- [Retrieval Contract](docs/04-retrieval-contract.md)
- [Testing Strategy](docs/05-testing-strategy.md)
- [Privacy / Data Handling](docs/06-privacy-data-handling.md)
- [Implementation Design](docs/07-implementation-design-v1.md)
- [HTTP transport ADR](docs/adr/001-http-transport.md)
- [Grounded synthesis adapter ADR](docs/adr/002-slice-b-ai-adapter.md)
