import { describe, expect, it } from 'vitest';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { evaluateQuestion } from './retrieval-evaluation.js';

describe('evaluation corpus retrieval cases', () => {
  it('keeps Q1 evidence in the local/shared state sources', () => {
    const database = createDatabase();
    const result = evaluateQuestion(new SqliteKnowledgeItemRepository(database), 'Q1');
    expect(result.context.fragments.map((fragment) => fragment.knowledgeItemId)).toEqual(expect.arrayContaining(['KI-01', 'KI-02']));
    closeDatabase(database);
  });

  it('keeps Q5 as related context without pretending to document migration steps', () => {
    const database = createDatabase();
    const result = evaluateQuestion(new SqliteKnowledgeItemRepository(database), 'Q5');
    expect(result.context.fragments.map((fragment) => fragment.knowledgeItemId)).toEqual(expect.arrayContaining(['KI-06', 'KI-07']));
    expect(result.question.shouldHaveRelevantEvidence).toBe(false);
    closeDatabase(database);
  });

  it('retrieves Q6 contextual alternatives, Q7 superseded history, Q8 bounded evidence and Q9 none', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const q6 = evaluateQuestion(repository, 'Q6');
    expect(q6.context.fragments.map((fragment) => fragment.knowledgeItemId)).toEqual(expect.arrayContaining(['KI-03', 'KI-04']));
    const q7 = evaluateQuestion(repository, 'Q7');
    expect(q7.context.fragments.some((fragment) => fragment.knowledgeItemId === 'KI-07' && fragment.status === 'SUPERSEDED')).toBe(true);
    const q8 = evaluateQuestion(repository, 'Q8');
    expect(q8.context.fragments.map((fragment) => fragment.knowledgeItemId)).toEqual(expect.arrayContaining(['KI-08']));
    const q9 = evaluateQuestion(repository, 'Q9');
    expect(q9.context.fragments).toHaveLength(0);
    closeDatabase(database);
  });
});
