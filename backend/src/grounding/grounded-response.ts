import type { GroundedDraftClaim, ProposedClaimSupport } from '../ai/grounded-synthesis.js';
import type { KnowledgeItem, KnowledgeItemProvenance, KnowledgeItemStatus } from '../domain/knowledge-item.js';
import type { RetrievalContext, RetrievalFragment } from '../retrieval/types.js';

export type ClaimSupport = 'SUPPORTED' | 'INFERRED' | 'INSUFFICIENT';
export type EvidenceCondition = 'CLEAR' | 'CONTEXTUAL_DIVERGENCE';

export interface ValidatedEvidence {
  readonly evidenceId: string;
  readonly fragment: string;
  readonly knowledgeItemId: string;
  readonly knowledgeItemTitle: string;
  readonly revision: number;
  readonly status: KnowledgeItemStatus;
  readonly provenance: KnowledgeItemProvenance;
  readonly sourceReference: string | null;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
}

export interface ValidatedClaim {
  readonly id: string;
  readonly text: string;
  readonly support: ClaimSupport;
  readonly evidence: readonly ValidatedEvidence[];
  readonly reason?: string;
}

export interface GroundedResponse {
  readonly answer: string;
  readonly claims: readonly ValidatedClaim[];
  readonly evidenceCondition: EvidenceCondition;
  readonly contextId: string;
}

export interface ValidationFailure {
  readonly code: 'GROUNDING_VALIDATION_FAILURE' | 'AI_MALFORMED_RESPONSE';
  readonly message: string;
  readonly claims: readonly ValidatedClaim[];
  readonly contextId: string;
}

export type GroundedAnswerResult =
  | { readonly ok: true; readonly response: GroundedResponse }
  | { readonly ok: false; readonly failure: ValidationFailure };

export function isProposedSupport(value: unknown): value is ProposedClaimSupport {
  return value === 'SUPPORTED' || value === 'INFERRED' || value === 'INSUFFICIENT';
}

export function isGroundedDraftClaim(value: unknown): value is GroundedDraftClaim {
  if (!value || typeof value !== 'object') return false;
  const claim = value as Record<string, unknown>;
  return typeof claim.id === 'string'
    && claim.id.trim().length > 0
    && typeof claim.text === 'string'
    && claim.text.trim().length > 0
    && isProposedSupport(claim.proposedSupport)
    && Array.isArray(claim.evidenceIds)
    && claim.evidenceIds.every((evidenceId) => typeof evidenceId === 'string' && evidenceId.trim().length > 0)
    && (claim.evidenceQuote === undefined || claim.evidenceQuote === null || (typeof claim.evidenceQuote === 'string' && claim.evidenceQuote.trim().length > 0));
}

export function isGroundedDraft(value: unknown): value is { answer: string; claims: GroundedDraftClaim[]; proposedEvidenceCondition?: EvidenceCondition } {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Record<string, unknown>;
  return typeof draft.answer === 'string'
    && draft.answer.trim().length > 0
    && Array.isArray(draft.claims)
    && draft.claims.length > 0
    && draft.claims.every(isGroundedDraftClaim)
    && (draft.proposedEvidenceCondition === undefined || draft.proposedEvidenceCondition === null || draft.proposedEvidenceCondition === 'CLEAR' || draft.proposedEvidenceCondition === 'CONTEXTUAL_DIVERGENCE');
}

export function evidenceFromFragment(fragment: RetrievalFragment, item: KnowledgeItem): ValidatedEvidence {
  return {
    evidenceId: fragment.evidenceId,
    fragment: fragment.text,
    knowledgeItemId: fragment.knowledgeItemId,
    knowledgeItemTitle: item.title,
    revision: fragment.itemRevision,
    status: fragment.status,
    provenance: fragment.provenance,
    sourceReference: fragment.sourceReference,
    paragraphIndex: fragment.paragraphIndex,
    startOffset: fragment.startOffset,
    endOffset: fragment.endOffset,
  };
}

export function emptyValidationClaims(): readonly ValidatedClaim[] {
  return [];
}

export function isInspectableEvidence(context: RetrievalContext, fragment: RetrievalFragment): boolean {
  return context.fragments.some((candidate) => candidate.evidenceId === fragment.evidenceId
    && candidate.knowledgeItemId === fragment.knowledgeItemId
    && candidate.itemRevision === fragment.itemRevision
    && candidate.text === fragment.text);
}
