import type { RetrievalContext } from '../retrieval/types.js';
import { GroundedSynthesisError, type GroundedDraft, type GroundedDraftClaim, type GroundedSynthesis } from './grounded-synthesis.js';

export type MockDraftResolver = (question: string, context: RetrievalContext) => GroundedDraft;

export class MockGroundedSynthesis implements GroundedSynthesis {
  public constructor(
    private readonly resolve: MockDraftResolver = defaultDraft,
    private readonly unavailable = false,
  ) {}

  public async generate(question: string, context: RetrievalContext): Promise<GroundedDraft> {
    if (this.unavailable) {
      throw new GroundedSynthesisError('AI_UNAVAILABLE', 'Grounded synthesis is unavailable.');
    }
    return Promise.resolve(this.resolve(question, context));
  }
}

function defaultDraft(question: string, context: RetrievalContext): GroundedDraft {
  if (context.fragments.length === 0) {
    return {
      answer: 'The corpus does not contain enough evidence to answer this question.',
      claims: [{ id: 'claim-1', text: 'The corpus does not contain enough evidence to answer this question.', proposedSupport: 'INSUFFICIENT', evidenceIds: [] }],
    };
  }

  const first = context.fragments[0]!;
  const claim: GroundedDraftClaim = {
    id: 'claim-1',
    text: first.text,
    proposedSupport: 'SUPPORTED',
    evidenceIds: [first.evidenceId],
    evidenceQuote: first.text,
  };
  return {
    answer: `The retrieved corpus states: ${first.text}`,
    claims: [claim],
  };
}
