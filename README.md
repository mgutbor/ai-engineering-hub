# Personal Technical Knowledge & Decision Navigator

Slice A implements the product utility without AI: Knowledge Item CRUD, deterministic text search, retrievable fragments, evidence inspection, revision invalidation, and the frozen evaluation corpus.

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

The backend creates its local SQLite database under `backend/data/` on first start.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Scope

Slice A intentionally does not include AI, `/ask`, embeddings, semantic search, conversations, or generated claims.
