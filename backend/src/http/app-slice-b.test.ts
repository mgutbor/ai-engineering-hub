import { describe, expect, it } from 'vitest';
import { AskQuestionService } from '../application/ask-question-service.js';
import { MockGroundedSynthesis } from '../ai/mock-grounded-synthesis.js';
import { KnowledgeItemService } from '../application/knowledge-item-service.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import { buildApp } from './app.js';

describe('Slice B /ask endpoint', () => {
  it('returns validated claims and inspectable evidence', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.' });
    const retrieval = new SqliteRetrievalService(repository);
    const app = buildApp({ knowledgeItems: new KnowledgeItemService(repository), repository, retrieval, askQuestion: new AskQuestionService(retrieval, new MockGroundedSynthesis(), repository) });
    const response = await app.inject({ method: 'POST', url: '/ask', payload: { question: 'state' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ claims: [{ support: 'SUPPORTED', evidence: [{ status: 'ACTIVE' }] }] });
    await app.close();
    closeDatabase(database);
  });

  it('abstains when retrieval has no evidence and reports AI unavailable when configured without an adapter', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const retrieval = new SqliteRetrievalService(repository);
    const app = buildApp({ knowledgeItems: new KnowledgeItemService(repository), repository, retrieval, askQuestion: new AskQuestionService(retrieval, new MockGroundedSynthesis(() => { throw new Error('AI must not be called without evidence'); }), repository) });
    const noEvidence = await app.inject({ method: 'POST', url: '/ask', payload: { question: 'Which database was selected?' } });
    expect(noEvidence.statusCode).toBe(200);
    expect(noEvidence.json()).toMatchObject({ claims: [{ support: 'INSUFFICIENT', evidence: [] }] });
    await app.close();

    const unavailableApp = buildApp({ knowledgeItems: new KnowledgeItemService(repository), repository, retrieval });
    const unavailable = await unavailableApp.inject({ method: 'POST', url: '/ask', payload: { question: 'state' } });
    expect(unavailable.statusCode).toBe(503);
    expect(unavailable.json()).toMatchObject({ error: 'AI_UNAVAILABLE' });
    await unavailableApp.close();
    closeDatabase(database);
  });

  it('downgrades an AI SUPPORTED claim when its reference is foreign', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.' });
    const retrieval = new SqliteRetrievalService(repository);
    const synthesis = new MockGroundedSynthesis((_question, context) => ({ answer: 'unsafe', claims: [{ id: 'claim-1', text: 'unsafe', proposedSupport: 'SUPPORTED', evidenceIds: ['does-not-exist'] }] }));
    const app = buildApp({ knowledgeItems: new KnowledgeItemService(repository), repository, retrieval, askQuestion: new AskQuestionService(retrieval, synthesis, repository) });
    const response = await app.inject({ method: 'POST', url: '/ask', payload: { question: 'state' } });
    expect(response.statusCode).toBe(200);
    expect(response.json().claims[0].support).toBe('INSUFFICIENT');
    await app.close();
    closeDatabase(database);
  });
});
