# ADR-002: Single Gemini grounded synthesis adapter for Slice B

- **Status:** Accepted for Slice B
- **Traces:** `docs/01-product-contract.md`, `docs/02-architecture-decision-v1.md`, `docs/03-ai-grounding-contract.md`, `docs/07-implementation-design-v1.md`

## Context

Slice B needs one concrete AI integration for grounded synthesis. The product contract explicitly excludes a generic AI platform, multiple providers, model routing, agents, and persistent conversations.

The application must send only the isolated question and the selected RetrievalContext. The model output is untrusted and must be validated before presentation.

## Decision

Use the Google Gemini REST API directly through the native runtime `fetch` API. The adapter calls Gemini `generateContent` with structured JSON output and uses the free-tier, low-latency model `gemini-3.5-flash-lite` by default.

Configuration is limited to:

- `GEMINI_API_KEY` — required credential;
- `GEMINI_MODEL` — optional model override, defaulting to `gemini-3.5-flash-lite`.

The adapter exposes only the capability:

> Generate a grounded draft from an isolated question and a selected RetrievalContext.

No provider registry, generic `AIProvider`, model router, orchestration framework, SDK, or second provider is introduced. The Gemini endpoint and request mapping remain implementation details of this single adapter.

If `GEMINI_API_KEY` is missing or the provider cannot be reached, the application uses the explicit unavailable path and returns `AI_UNAVAILABLE`. It never fabricates a response.

## Request boundary

The adapter sends only:

- the isolated question;
- the selected retrieval fragments;
- opaque evidence IDs;
- the minimum source metadata needed by the model to distinguish status and provenance;
- grounded synthesis instructions.

It does not send the complete corpus and has no access to SQLite, repositories, or application services. It does not use Google Search grounding or external web retrieval.

## Draft contract

Gemini must return:

- `answer`;
- `claims[]`;
- claim `id`;
- claim `text`;
- proposed support: `SUPPORTED`, `INFERRED`, or `INSUFFICIENT`;
- evidence IDs selected from the supplied RetrievalContext;
- optional exact evidence quote;
- optional `CLEAR` or `CONTEXTUAL_DIVERGENCE` proposal.

The application owns the valid evidence IDs. The model cannot create or expand them.

## Validation rule

The adapter output is untrusted input. Deterministic application validation must check:

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

- Uses the requested Gemini free-tier model without adding an SDK.
- Keeps provider integration narrow and replaceable at the existing adapter boundary.
- Makes malformed output and unavailable AI normal application states.
- Preserves the Slice A utility without AI.
- Sends only selected context rather than the corpus.

### Negative

- The adapter is tied to Gemini's `generateContent` and structured-output request shape.
- A future provider change may require a new adapter, but that is intentionally deferred until there is a real need.
- A real provider call remains probabilistic and cannot replace deterministic tests.
- Provider retention, region, quota, and billing/free-tier availability remain operational concerns outside the application boundary.

## Rejected alternatives

- Generic multi-provider abstraction.
- AI orchestration framework.
- Provider SDK.
- Google Search grounding or external web retrieval.
- Second validation LLM.
- Agent or tool-calling loop.
- Free-text response parsed with regular expressions.
- Persisting prompts, responses, claims, or retrieval contexts by default.
