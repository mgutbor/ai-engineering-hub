# Personal Technical Knowledge & Decision Navigator

Slice A implements the product utility without AI: Knowledge Item CRUD, deterministic text search, retrievable fragments, evidence inspection, revision invalidation, and the frozen evaluation corpus. Slice B adds isolated grounded questions through `/ask`, using a single structured-output AI adapter and deterministic provenance validation.

## Requirements

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Run

```bash
npm run dev
```

The frontend runs at `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:3000`.

The backend creates its local SQLite database under `data/` on first start. Slice B uses Gemini with `GEMINI_API_KEY` and the optional `GEMINI_MODEL` (default `gemini-3.5-flash-lite`) when configured; without the key, `/ask` returns `AI_UNAVAILABLE` while Slice A remains usable.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Scope

The project includes Slice A and Slice B. It intentionally does not include embeddings, semantic search, conversations, persistent memory, agents, multiple providers, or generated Knowledge Items.

For a real AI call:

```bash
GEMINI_API_KEY=... GEMINI_MODEL=gemini-3.5-flash-lite npm run dev --workspace backend
```

The provider receives only the isolated question and selected retrieval fragments. AI output is never presented before application validation.
