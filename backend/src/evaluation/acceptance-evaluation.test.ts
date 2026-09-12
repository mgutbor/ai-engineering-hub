import { describe, expect, it } from 'vitest';
import { MockGroundedSynthesis } from '../ai/mock-grounded-synthesis.js';
import { AskQuestionService } from '../application/ask-question-service.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import { evaluationQuestions } from './questions.js';

describe('Slice B Q1-Q9 acceptance outcomes', () => {
  it('validates the required Q1, Q5, Q6, Q7, Q8 and Q9 outcomes', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    const retrieval = new SqliteRetrievalService(repository);
    let synthesisInvocationCount = 0;
    const synthesis = new MockGroundedSynthesis((question, context) => {
      synthesisInvocationCount += 1;
      if (question.includes('global store avoided')) {
        const fragment = context.fragments[0];
        if (!fragment) throw new Error('Q1 requires retrieved evidence.');
        return {
          answer: 'The decision favored local state because most UI state was local and global indirection made ownership harder to understand.',
          claims: [{
            id: 'claim-1',
            text: 'The decision favored local state because most UI state was local and global indirection made ownership harder to understand.',
            proposedSupport: 'SUPPORTED',
            evidenceIds: [fragment.evidenceId],
            evidenceQuote: fragment.text,
          }],
        };
      }
      if (question.includes('migrated from SSR to CSR')) {
        return {
          answer: 'The corpus does not document an SSR to CSR migration.',
          claims: [{ id: 'claim-1', text: 'The corpus does not document an SSR to CSR migration.', proposedSupport: 'INSUFFICIENT', evidenceIds: [] }],
        };
      }
      if (question.includes('multi-step flow')) {
        return {
          answer: 'The recommendation depends on the flow context.',
          proposedEvidenceCondition: 'CONTEXTUAL_DIVERGENCE',
          claims: [{ id: 'claim-1', text: 'The recommendation depends on the flow context.', proposedSupport: 'INFERRED', evidenceIds: context.fragments.map((fragment) => fragment.evidenceId) }],
        };
      }
      if (question.includes('lazy loading')) {
        const fragment = context.fragments.find((candidate) => candidate.knowledgeItemId === 'KI-08') ?? context.fragments[0]!;
        const claim = 'The initial bundle for the main entry points decreased and stayed within the agreed performance budget on the target devices.';
        return { answer: claim, claims: [{ id: 'claim-1', text: claim, proposedSupport: 'SUPPORTED', evidenceIds: [fragment.evidenceId], evidenceQuote: fragment.text }] };
      }
      const fragment = context.fragments[0];
      if (!fragment) throw new Error('The adapter should not be called without evidence.');
      return { answer: fragment.text, claims: [{ id: 'claim-1', text: fragment.text, proposedSupport: 'SUPPORTED', evidenceIds: [fragment.evidenceId], evidenceQuote: fragment.text }] };
    });
    const service = new AskQuestionService(retrieval, synthesis, repository);

    expect(evaluationQuestions).toHaveLength(9);
    const q1 = await service.ask(evaluationQuestions.find((question) => question.id === 'Q1')!.question, 'evaluation');
    expect(q1.ok).toBe(true);
    if (q1.ok) {
      expect(q1.response.claims[0]?.support).toBe('INFERRED');
      expect(q1.response.claims[0]?.evidence.length).toBeGreaterThan(0);
      expect(q1.response.claims[0]?.reason).toContain('deletion-only');
    }

    const q5 = await service.ask(evaluationQuestions.find((question) => question.id === 'Q5')!.question, 'evaluation');
    expect(q5.ok).toBe(true);
    if (q5.ok) expect(q5.response.claims[0]?.support).toBe('INSUFFICIENT');

    const q6 = await service.ask(evaluationQuestions.find((question) => question.id === 'Q6')!.question, 'evaluation');
    expect(q6.ok).toBe(true);
    if (q6.ok) expect(q6.response.evidenceCondition).toBe('CONTEXTUAL_DIVERGENCE');

    const q7 = await service.ask(evaluationQuestions.find((question) => question.id === 'Q7')!.question, 'evaluation');
    expect(q7.ok).toBe(true);
    if (q7.ok) expect(q7.response.claims.some((claim) => claim.evidence.some((evidence) => evidence.status === 'SUPERSEDED'))).toBe(true);

    const q8 = await service.ask(evaluationQuestions.find((question) => question.id === 'Q8')!.question, 'evaluation');
    expect(q8.ok).toBe(true);
    if (q8.ok) expect(q8.response.claims[0]?.evidence[0]?.knowledgeItemId).toBe('KI-08');

    const invocationCountBeforeQ9 = synthesisInvocationCount;
    const q9 = await service.ask(evaluationQuestions.find((question) => question.id === 'Q9')!.question, 'evaluation');
    expect(q9).toMatchObject({ ok: true, response: { claims: [{ support: 'INSUFFICIENT', evidence: [] }] } });
    expect(synthesisInvocationCount).toBe(invocationCountBeforeQ9);
    closeDatabase(database);
  });
});
