import { describe, expect, it } from 'vitest';
import { MockGroundedSynthesis } from '../ai/mock-grounded-synthesis.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import { AskQuestionService } from './ask-question-service.js';

describe('AskQuestionService', () => {
  it('returns a validated grounded response from retrieval and synthesis', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.' });
    const retrieval = new SqliteRetrievalService(repository);
    const service = new AskQuestionService(retrieval, new MockGroundedSynthesis(), repository);
    const result = await service.ask('state');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.claims[0]?.support).toBe('SUPPORTED');
    closeDatabase(database);
  });

  it('abstains before AI when retrieval has no relevant evidence', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const retrieval = new SqliteRetrievalService(repository);
    const service = new AskQuestionService(retrieval, new MockGroundedSynthesis(() => { throw new Error('AI must not be called'); }), repository);
    const result = await service.ask('Which database was selected?');
    expect(result).toMatchObject({ ok: true, response: { claims: [{ support: 'INSUFFICIENT', evidence: [] }] } });
    closeDatabase(database);
  });
});
