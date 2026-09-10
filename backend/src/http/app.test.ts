import { describe, expect, it } from 'vitest';
import { KnowledgeItemService } from '../application/knowledge-item-service.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import { buildApp } from './app.js';

describe('Slice A HTTP API', () => {
  it('supports create, read, search, update and delete', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const app = buildApp({ knowledgeItems: new KnowledgeItemService(repository), repository, retrieval: new SqliteRetrievalService(repository) });

    const create = await app.inject({ method: 'POST', url: '/knowledge-items', payload: { title: 'State decision', content: 'Keep state local.' } });
    expect(create.statusCode).toBe(201);
    const item = (create.json() as { item: { id: string; revision: number } }).item;

    const read = await app.inject({ method: 'GET', url: `/knowledge-items/${item.id}` });
    expect(read.statusCode).toBe(200);

    const search = await app.inject({ method: 'GET', url: '/knowledge-items?q=local' });
    expect(search.statusCode).toBe(200);
    expect((search.json() as { context: { fragments: unknown[] } }).context.fragments).toHaveLength(1);

    const update = await app.inject({ method: 'PATCH', url: `/knowledge-items/${item.id}`, payload: { revision: item.revision, content: 'Use shared state only for coordination.' } });
    expect(update.statusCode).toBe(200);
    expect((update.json() as { item: { revision: number } }).item.revision).toBe(2);

    const stale = await app.inject({ method: 'PATCH', url: `/knowledge-items/${item.id}`, payload: { revision: item.revision, content: 'stale' } });
    expect(stale.statusCode).toBe(409);

    const remove = await app.inject({ method: 'DELETE', url: `/knowledge-items/${item.id}?revision=2` });
    expect(remove.statusCode).toBe(204);
    const missing = await app.inject({ method: 'GET', url: `/knowledge-items/${item.id}` });
    expect(missing.statusCode).toBe(404);

    await app.close();
    closeDatabase(database);
  });

  it('rejects invalid requests and missing items', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const app = buildApp({ knowledgeItems: new KnowledgeItemService(repository), repository, retrieval: new SqliteRetrievalService(repository) });
    const invalid = await app.inject({ method: 'POST', url: '/knowledge-items', payload: { title: '', content: '' } });
    expect(invalid.statusCode).toBe(400);
    const missing = await app.inject({ method: 'GET', url: '/knowledge-items/missing' });
    expect(missing.statusCode).toBe(404);
    await app.close();
    closeDatabase(database);
  });
});
