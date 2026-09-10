# ADR-001: Minimal HTTP transport

- **Status:** Accepted
- **Traces:** `docs/01-product-contract.md`, `docs/02-architecture-decision-v1.md`, `docs/07-implementation-design-v1.md`

## Context

The approved architecture requires a small Node.js + TypeScript monolith. The MVP needs a thin HTTP boundary for Knowledge Item CRUD, text search and isolated questions. The transport must not become a framework or an architectural decision in itself.

## Decision

Use **Fastify** as the minimal HTTP transport framework. It supports:

- JSON request/response handling;
- route parameters;
- status codes;
- request validation integration;
- centralized error mapping;
- a thin adapter without imposing an application architecture.

Fastify is used only at the transport boundary. Its route, plugin and schema mechanisms must not leak into domain or application semantics.

Do not introduce a framework-specific application architecture, plugin ecosystem, controller hierarchy or generated API platform.

The transport exposes only the routes defined in the Implementation Design v1:

- `/knowledge-items` for CRUD and text search;
- `/ask` for isolated questions.

Retrieval, grounded synthesis and deterministic validation remain internal application boundaries and are not public transport endpoints.

## Consequences

### Positive

- Keeps the HTTP layer thin and replaceable.
- Avoids selecting technology by architectural fashion.
- Preserves the application boundaries.
- Does not require a server platform or infrastructure decision.

### Negative

- The application now has a runtime dependency on Fastify.
- Framework-specific conveniences must not leak into domain or application semantics.

## Rejected alternatives

- A large opinionated backend platform.
- GraphQL.
- RPC framework.
- Separate services per module.
- Generated API infrastructure.

These alternatives add surface area without value for the closed MVP.

## Revisit trigger

Revisit only if Fastify cannot support the defined CRUD, search and ask boundaries without introducing framework-specific coupling or unacceptable operational constraints.
