import { describe, expect, it } from 'vitest';
import { MockGroundedSynthesis } from '../ai/mock-grounded-synthesis.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import type { RetrievalContext, RetrievalFragment } from '../retrieval/types.js';
import { GroundedValidator } from './grounded-validator.js';

describe('GroundedValidator', () => {
  it('does not trust SUPPORTED when the AI invents an evidence ID', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.' });
    const retrieval = new SqliteRetrievalService(repository);
    const context = retrieval.search({ query: 'state', corpus: 'user' });
    const validator = new GroundedValidator(repository, retrieval);
    const result = validator.validate({ answer: 'Unsupported.', claims: [{ id: 'claim-1', text: 'Unsupported.', proposedSupport: 'SUPPORTED', evidenceIds: ['does-not-exist'], evidenceQuote: 'Unsupported.' }] }, context);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.claims[0]?.support).toBe('INSUFFICIENT');
    closeDatabase(database);
  });

  it('accepts an exact quote and exact claim as SUPPORTED', () => {
    const { database, repository, retrieval, context, fragment } = createHarness('Keep state local.');
    const result = validateSupported(repository, retrieval, context, fragment, fragment.text, fragment.text);
    expectSupport(result, 'SUPPORTED');
    closeDatabase(database);
  });

  it('accepts a conservative deletion-only claim as SUPPORTED', () => {
    const evidence = 'After feature routes were lazy-loaded, the initial bundle for the main entry points decreased from the previous baseline and stayed within the agreed performance budget on the target devices.';
    const quote = evidence;
    const claim = 'The initial bundle for the main entry points decreased and stayed within the agreed performance budget on the target devices.';
    const { database, repository, retrieval, context, fragment } = createHarness(evidence, 'bundle');
    const result = validateSupported(repository, retrieval, context, fragment, claim, quote);
    expectSupport(result, 'SUPPORTED');
    closeDatabase(database);
  });

  it('accepts a valid partial quote and a deletion-only claim as SUPPORTED', () => {
    const evidence = 'After feature routes were lazy-loaded, the initial bundle for the main entry points decreased from the previous baseline and stayed within the agreed performance budget on the target devices.';
    const quote = 'the initial bundle for the main entry points decreased from the previous baseline and stayed within the agreed performance budget on the target devices.';
    const claim = 'The initial bundle for the main entry points decreased and stayed within the agreed performance budget on the target devices.';
    const { database, repository, retrieval, context, fragment } = createHarness(evidence, 'bundle');
    const result = validateSupported(repository, retrieval, context, fragment, claim, quote);
    expectSupport(result, 'SUPPORTED');
    closeDatabase(database);
  });

  it('rejects a partial quote that omits a negation from the fragment', () => {
    const { database, repository, retrieval, context, fragment } = createHarness('The system is not safe.', 'safe');
    const result = validateSupported(repository, retrieval, context, fragment, 'safe', 'safe');
    expectSupport(result, 'INFERRED');
    closeDatabase(database);
  });

  it('rejects a partial quote that omits a quantifier from the fragment', () => {
    const { database, repository, retrieval, context, fragment } = createHarness('All systems are safe.', 'systems');
    const result = validateSupported(repository, retrieval, context, fragment, 'systems are safe', 'systems are safe');
    expectSupport(result, 'INFERRED');
    closeDatabase(database);
  });

  it('rejects a partial quote that omits modality from the fragment', () => {
    const { database, repository, retrieval, context, fragment } = createHarness('The system should be safe.', 'safe');
    const result = validateSupported(repository, retrieval, context, fragment, 'safe', 'safe');
    expectSupport(result, 'INFERRED');
    closeDatabase(database);
  });

  it.each([
    ['an added word', 'The initial bundle clearly decreased on target devices.', 'The initial bundle decreased on target devices.'],
    ['a changed word', 'The initial bundle increased on target devices.', 'The initial bundle decreased on target devices.'],
    ['an added negation', 'The initial bundle did not decrease on target devices.', 'The initial bundle decreased on target devices.'],
    ['a removed negation', 'The initial bundle decreased on target devices.', 'The initial bundle did not decrease on target devices.'],
    ['a changed quantifier', 'The bundle decreased for most main entry points.', 'The bundle decreased for every main entry point.'],
    ['a changed scope', 'The bundle decreased on target devices.', 'The bundle decreased within the agreed performance budget on the target devices.'],
    ['a generalized scope', 'Lazy loading improved the application.', 'The bundle decreased for the main entry points.'],
  ])('degrades %s to INFERRED instead of SUPPORTED', (_description, claim, evidence) => {
    const { database, repository, retrieval, context, fragment } = createHarness(evidence, 'bundle');
    const result = validateSupported(repository, retrieval, context, fragment, claim, fragment.text);
    expectSupport(result, 'INFERRED');
    closeDatabase(database);
  });

  it('does not accept a generalized UI-state claim as SUPPORTED', () => {
    const evidence = 'Local form, filter and selection state should remain inside the feature that owns it.';
    const claim = 'Most UI state should remain local to the feature that owns it.';
    const { database, repository, retrieval, context, fragment } = createHarness(evidence, 'state');
    const result = validateSupported(repository, retrieval, context, fragment, claim, fragment.text);
    expectSupport(result, 'INFERRED');
    closeDatabase(database);
  });

  it('does not accept a valid quote with no deletion-only relationship', () => {
    const evidence = 'Introduce shared state only when there is a demonstrated cross-feature coordination problem.';
    const claim = 'Global state should always be avoided.';
    const { database, repository, retrieval, context, fragment } = createHarness(evidence, 'state');
    const result = validateSupported(repository, retrieval, context, fragment, claim, fragment.text);
    expectSupport(result, 'INFERRED');
    closeDatabase(database);
  });

  it('rejects a nonexistent quote and evidence from another fragment', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.\nUse shared state for coordination.' });
    const retrieval = new SqliteRetrievalService(repository);
    const context = retrieval.search({ query: 'state', corpus: 'user' });
    const validator = new GroundedValidator(repository, retrieval);
    const first = context.fragments[0]!;
    const second = context.fragments[1]!;

    const nonexistent = validator.validate({ answer: first.text, claims: [{ id: 'claim-1', text: first.text, proposedSupport: 'SUPPORTED', evidenceIds: [first.evidenceId], evidenceQuote: 'This quote does not exist.' }] }, context);
    const foreign = validator.validate({ answer: first.text, claims: [{ id: 'claim-1', text: second.text, proposedSupport: 'SUPPORTED', evidenceIds: [first.evidenceId], evidenceQuote: second.text }] }, context);
    expectSupport(nonexistent, 'INFERRED');
    expectSupport(foreign, 'INFERRED');
    closeDatabase(database);
  });

  it('rejects an invalid evidence reference and evidence outside the RetrievalContext', () => {
    const { database, repository, retrieval, context, fragment } = createHarness('Keep state local.');
    const validator = new GroundedValidator(repository, retrieval);
    const invalidId = validator.validate({ answer: fragment.text, claims: [{ id: 'claim-1', text: fragment.text, proposedSupport: 'SUPPORTED', evidenceIds: ['invalid'], evidenceQuote: fragment.text }] }, context);
    const outsideContext = { ...context, fragments: [] };
    const outside = validator.validate({ answer: fragment.text, claims: [{ id: 'claim-1', text: fragment.text, proposedSupport: 'SUPPORTED', evidenceIds: [fragment.evidenceId], evidenceQuote: fragment.text }] }, outsideContext);
    expectSupport(invalidId, 'INSUFFICIENT');
    expectSupport(outside, 'INSUFFICIENT');
    closeDatabase(database);
  });

  it('fails safely when the Knowledge Item is stale or deleted', () => {
    const updateDatabase = createDatabase();
    const updateRepository = new SqliteKnowledgeItemRepository(updateDatabase);
    const updateItem = updateRepository.create({ title: 'State', content: 'Keep state local.' });
    const updateRetrieval = new SqliteRetrievalService(updateRepository);
    const updateContext = updateRetrieval.search({ query: 'state', corpus: 'user' });
    updateRepository.update(updateItem.id, updateItem.revision, { content: 'Use shared state for coordination.' });
    expect(new GroundedValidator(updateRepository, updateRetrieval).validate({ answer: 'Keep state local.', claims: [{ id: 'claim-1', text: 'Keep state local.', proposedSupport: 'SUPPORTED', evidenceIds: [updateContext.fragments[0]!.evidenceId], evidenceQuote: 'Keep state local.' }] }, updateContext)).toMatchObject({ ok: false, failure: { code: 'GROUNDING_VALIDATION_FAILURE' } });
    closeDatabase(updateDatabase);

    const deleteDatabase = createDatabase();
    const deleteRepository = new SqliteKnowledgeItemRepository(deleteDatabase);
    const deleteItem = deleteRepository.create({ title: 'State', content: 'Keep state local.' });
    const deleteRetrieval = new SqliteRetrievalService(deleteRepository);
    const deleteContext = deleteRetrieval.search({ query: 'state', corpus: 'user' });
    deleteRepository.delete(deleteItem.id, deleteItem.revision);
    expect(new GroundedValidator(deleteRepository, deleteRetrieval).validate({ answer: 'Keep state local.', claims: [{ id: 'claim-1', text: 'Keep state local.', proposedSupport: 'SUPPORTED', evidenceIds: [deleteContext.fragments[0]!.evidenceId], evidenceQuote: 'Keep state local.' }] }, deleteContext)).toMatchObject({ ok: false, failure: { code: 'GROUNDING_VALIDATION_FAILURE' } });
    closeDatabase(deleteDatabase);
  });

  it('preserves valid evidence when a proposed SUPPORTED claim degrades to INFERRED', () => {
    const { database, repository, retrieval, context, fragment } = createHarness('Keep state local.');
    const result = validateSupported(repository, retrieval, context, fragment, 'The application keeps state local.', fragment.text);
    expectSupport(result, 'INFERRED');
    if (result.ok) expect(result.response.claims[0]?.evidence[0]?.evidenceId).toBe(fragment.evidenceId);
    closeDatabase(database);
  });

  it('returns INSUFFICIENT for a proposed SUPPORTED claim without valid evidence', () => {
    const { database, repository, retrieval, context } = createHarness('Keep state local.');
    const result = new GroundedValidator(repository, retrieval).validate({ answer: 'Unsupported.', claims: [{ id: 'claim-1', text: 'Unsupported.', proposedSupport: 'SUPPORTED', evidenceIds: [] }] }, context);
    expectSupport(result, 'INSUFFICIENT');
    closeDatabase(database);
  });

  it('accepts an inference only with valid evidence and keeps unsupported claims insufficient', () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.' });
    const retrieval = new SqliteRetrievalService(repository);
    const context = retrieval.search({ query: 'state', corpus: 'user' });
    const fragment = context.fragments[0]!;
    const validator = new GroundedValidator(repository, retrieval);
    const result = validator.validate({ answer: 'The principle appears to favor locality.', claims: [
      { id: 'claim-1', text: 'The principle appears to favor locality.', proposedSupport: 'INFERRED', evidenceIds: [fragment.evidenceId] },
      { id: 'claim-2', text: 'The application is faster.', proposedSupport: 'SUPPORTED', evidenceIds: [fragment.evidenceId], evidenceQuote: 'The application is faster.' },
    ] }, context);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.response.claims.map((claim) => claim.support)).toEqual(['INFERRED', 'INFERRED']);
    closeDatabase(database);
  });

  it('does not turn an unavailable AI adapter into a grounded response', async () => {
    const database = createDatabase();
    const repository = new SqliteKnowledgeItemRepository(database);
    repository.create({ title: 'State', content: 'Keep state local.' });
    const retrieval = new SqliteRetrievalService(repository);
    const synthesis = new MockGroundedSynthesis(undefined, true);
    await expect(synthesis.generate('state', retrieval.search({ query: 'state', corpus: 'user' }))).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    closeDatabase(database);
  });
});

function createHarness(content: string, query = 'state'): {
  database: ReturnType<typeof createDatabase>;
  repository: SqliteKnowledgeItemRepository;
  retrieval: SqliteRetrievalService;
  context: RetrievalContext;
  fragment: RetrievalFragment;
} {
  const database = createDatabase();
  const repository = new SqliteKnowledgeItemRepository(database);
  repository.create({ title: 'Evidence', content });
  const retrieval = new SqliteRetrievalService(repository);
  const context = retrieval.search({ query, corpus: 'user' });
  const fragment = context.fragments[0];
  if (!fragment) throw new Error('The test fixture did not produce a retrieval fragment.');
  return { database, repository, retrieval, context, fragment };
}

function validateSupported(
  repository: SqliteKnowledgeItemRepository,
  retrieval: SqliteRetrievalService,
  context: RetrievalContext,
  fragment: RetrievalFragment,
  text: string,
  evidenceQuote: string,
) {
  return new GroundedValidator(repository, retrieval).validate({ answer: text, claims: [{ id: 'claim-1', text, proposedSupport: 'SUPPORTED', evidenceIds: [fragment.evidenceId], evidenceQuote }] }, context);
}

function expectSupport(result: ReturnType<GroundedValidator['validate']>, support: 'SUPPORTED' | 'INFERRED' | 'INSUFFICIENT'): void {
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.response.claims[0]?.support).toBe(support);
}
