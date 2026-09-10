import { describe, expect, it } from 'vitest';
import { createDatabase, closeDatabase } from './sqlite-database.js';
import { SqliteKnowledgeItemRepository } from './sqlite-knowledge-item-repository.js';

describe('SqliteKnowledgeItemRepository', () => {
  it('persists CRUD and keeps FTS5 synchronized', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const created = repository.create({ title: 'State decision', content: 'Keep state local.' });
    expect(repository.getById(created.id)).toEqual(created);
    expect(repository.searchRows('state', 'user', 8)).toHaveLength(1);

    const updated = repository.update(created.id, created.revision, { content: 'Use shared state only for coordination.' });
    expect(updated.revision).toBe(2);
    expect(repository.searchRows('local', 'user', 8)).toHaveLength(0);
    expect(repository.searchRows('coordination', 'user', 8)).toHaveLength(1);

    repository.delete(updated.id, updated.revision);
    expect(repository.getById(updated.id)).toBeNull();
    expect(repository.searchRows('coordination', 'user', 8)).toHaveLength(0);
    closeDatabase(database);
  });

  it('seeds the evaluation corpus without exposing it to user CRUD', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    expect(repository.getEvaluationItems()).toHaveLength(12);
    expect(repository.list()).toHaveLength(0);
    expect(repository.getById('KI-01')).toBeNull();
    expect(repository.searchRows('SSR', 'evaluation', 8).map((row) => row.item_id)).toEqual(expect.arrayContaining(['KI-06', 'KI-07']));
    closeDatabase(database);
  });
});
