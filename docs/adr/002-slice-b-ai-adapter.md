# ADR-002: Concrete grounded synthesis adapters for Slice B

- **Status:** Accepted for Slice B
- **Traces:** `docs/01-product-contract.md`, `docs/02-architecture-decision-v1.md`, `docs/03-ai-grounding-contract.md`, `docs/07-implementation-design-v1.md`

## Context

Slice B needs a concrete AI integration for grounded synthesis. The product contract excludes a generic AI platform, provider registry, dynamic routing, provider management, agents and persistent conversations.

The application must send only the isolated question and the selected `RetrievalContext`. Model output is untrusted and must be validated before presentation.

The current runtime uses the following simple operational priority:

```text
GROQ_API_KEY
    ↓
GroqGroundedSynthesis

if `GROQ_API_KEY` is not configured:
GEMINI_API_KEY
    ↓
GeminiGroundedSynthesis

if neither is configured:
UnavailableGroundedSynthesis
```

This is a concrete runtime selection, not a generic multi-provider architecture.

## Decision

Use the native runtime `fetch` API with two concrete adapters for the same narrow capability:

- **Primary:** Groq REST API through `GroqGroundedSynthesis`, configured with `GROQ_API_KEY` and optional `GROQ_MODEL`, defaulting to `openai/gpt-oss-20b`.
- **Fallback:** Google Gemini REST API through `GeminiGroundedSynthesis`, used when Groq is not configured and `GEMINI_API_KEY` is available. It accepts optional `GEMINI_MODEL`, defaulting to `gemini-3.5-flash-lite`.

The adapters expose only the capability:

> Generate a grounded draft from an isolated question and a selected RetrievalContext.

No provider registry, generic `AIProvider`, factory, model router, dynamic routing, provider management layer, orchestration framework or SDK is introduced. Each provider endpoint and request mapping remains an implementation detail of its concrete adapter.

If neither credential is configured, the application uses the explicit unavailable path and returns `AI_UNAVAILABLE`. Provider reachability failures are surfaced as `AI_UNAVAILABLE`; the runtime does not dynamically switch providers. It never fabricates a response.

## Request boundary

Each adapter sends only:

- the isolated question;
- the selected retrieval fragments;
- opaque evidence IDs;
- the minimum source metadata needed by the model to distinguish status and provenance;
- grounded synthesis instructions.

Neither adapter sends the complete corpus or has access to SQLite, repositories or application services. Neither adapter uses external web retrieval.

## Draft contract

The provider must return:

- `answer`;
- `claims[]`;
- claim `id`;
- claim `text`;
- proposed support: `SUPPORTED`, `INFERRED` or `INSUFFICIENT`;
- evidence IDs selected from the supplied `RetrievalContext`;
- optional exact evidence quote;
- optional `CLEAR` or `CONTEXTUAL_DIVERGENCE` proposal.

The application owns the valid evidence IDs. The model cannot create or expand them.

## Validation rule

Adapter output is untrusted input. Deterministic application validation must check:

- shape;
- evidence ID membership;
- Knowledge Item identity;
- revision;
- fragment ownership;
- retrieval-context membership;
- inspectability;
- current source status and provenance;
- conservative direct-text support before presenting `SUPPORTED`.

A model-proposed `SUPPORTED` value is advisory and never sufficient on its own. An invalid evidence reference must be downgraded and cannot become `SUPPORTED`.

## Consequences

### Positive

- Uses the current Groq-backed portfolio flow while keeping a tested Gemini fallback.
- Keeps provider integration narrow at the existing grounded-synthesis boundary.
- Makes malformed output and unavailable AI normal application states.
- Preserves the Slice A utility without AI.
- Sends only selected context rather than the corpus.

### Negative

- The adapters are tied to their providers' structured-output request shapes.
- A real provider call remains probabilistic and cannot replace deterministic tests.
- Provider retention, region, quota and billing/free-tier availability remain operational concerns outside the application boundary.
- The runtime has a fixed primary/fallback choice rather than a configurable provider platform; this is intentional for the MVP.

## Rejected alternatives

- Generic multi-provider abstraction.
- Provider registry or factory.
- Dynamic model routing or provider management.
- AI orchestration framework.
- Provider SDK.
- External web retrieval.
- Second validation LLM.
- Agent or tool-calling loop.
- Free-text response parsed with regular expressions.
- Persisting prompts, responses, claims or retrieval contexts by default.
