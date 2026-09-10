import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { buildApp } from './http/app.js';
import { KnowledgeItemService } from './application/knowledge-item-service.js';
import { SqliteKnowledgeItemRepository } from './persistence/sqlite-knowledge-item-repository.js';
import { createDatabase } from './persistence/sqlite-database.js';
import { SqliteRetrievalService } from './retrieval/sqlite-retrieval-service.js';

const databasePath = process.env.DATABASE_PATH ?? resolve(process.cwd(), 'data', 'navigator.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });
const database = createDatabase(databasePath);
const repository = new SqliteKnowledgeItemRepository(database);
const retrieval = new SqliteRetrievalService(repository);
const knowledgeItems = new KnowledgeItemService(repository);
const app = buildApp({ knowledgeItems, repository, retrieval });
const port = Number(process.env.PORT ?? 3000);

try {
  await app.listen({ host: '0.0.0.0', port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
