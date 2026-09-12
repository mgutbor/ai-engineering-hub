import type { RetrievalContext } from '../retrieval/types.js';

export type ProposedClaimSupport = 'SUPPORTED' | 'INFERRED' | 'INSUFFICIENT';
export type ProposedEvidenceCondition = 'CLEAR' | 'CONTEXTUAL_DIVERGENCE';

export interface GroundedDraftClaim {
  readonly id: string;
  readonly text: string;
  readonly proposedSupport: ProposedClaimSupport;
  readonly evidenceIds: readonly string[];
  readonly evidenceQuote?: string | null;
}

export interface GroundedDraft {
  readonly answer: string;
  readonly claims: readonly GroundedDraftClaim[];
  readonly proposedEvidenceCondition?: ProposedEvidenceCondition | null;
}

export type GroundedSynthesisFailureCode = 'AI_UNAVAILABLE' | 'AI_MALFORMED_RESPONSE';

export class GroundedSynthesisError extends Error {
  public constructor(
    public readonly code: GroundedSynthesisFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'GroundedSynthesisError';
  }
}

export interface GroundedSynthesis {
  generate(question: string, context: RetrievalContext): Promise<GroundedDraft>;
}
