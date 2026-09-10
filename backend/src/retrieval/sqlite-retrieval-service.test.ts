import { describe, expect, it } from 'vitest';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { SqliteRetrievalService } from './sqlite-retrieval-service.js';

describe('SqliteRetrievalService', () => {
  it('returns inspectable fragments with source metadata', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const item = repository.create({ title: 'State ownership', content: 'Local state belongs to the owning feature.' });
    const retrieval = new SqliteRetrievalService(repository, () => '2025-01-01T00:00:00.000Z');
    const context = retrieval.search({ query: 'local state', corpus: 'user' });
    expect(context.fragments).toHaveLength(1);
    expect(context.fragments[0]).toMatchObject({ knowledgeItemId: item.id, itemRevision: 1, text: item.content, status: 'ACTIVE', provenance: 'human-authored' });
    expect(retrieval.isContextCurrent(context)).toBe(true);
    closeDatabase(database);
  });

  it('invalidates an old context after update and delete', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const item = repository.create({ title: 'State ownership', content: 'Local state belongs to the owning feature.' });
    const retrieval = new SqliteRetrievalService(repository);
    const context = retrieval.search({ query: 'local state', corpus: 'user' });
    expect(retrieval.isContextCurrent(context)).toBe(true);
    const updated = repository.update(item.id, item.revision, { content: 'Shared state is reserved for coordination.' });
    expect(updated.revision).toBe(2);
    expect(retrieval.isContextCurrent(context)).toBe(false);
    const newContext = retrieval.search({ query: 'shared state', corpus: 'user' });
    expect(retrieval.isContextCurrent(newContext)).toBe(true);
    repository.delete(updated.id, updated.revision);
    expect(retrieval.isContextCurrent(newContext)).toBe(false);
    closeDatabase(database);
  });

  it('retrieves the expected evaluation sources for Q7 and no source for Q9', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const retrieval = new SqliteRetrievalService(repository);
    const q7 = retrieval.search({ query: 'Should SSR be the default option for every serious application?', corpus: 'evaluation' });
    expect(q7.fragments.map((fragment) => fragment.knowledgeItemId)).toEqual(expect.arrayContaining(['KI-06', 'KI-07']));
    expect(q7.fragments.find((fragment) => fragment.knowledgeItemId === 'KI-07')?.status).toBe('SUPERSEDED');
    const q9 = retrieval.search({ query: 'Which database was selected for the platform?', corpus: 'evaluation' });
    expect(q9.fragments).toHaveLength(0);
    closeDatabase(database);
  });
});
