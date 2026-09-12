import type { GroundedDraft, GroundedDraftClaim } from '../ai/grounded-synthesis.js';
import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';
import type { RetrievalService } from '../retrieval/retrieval-service.js';
import type { RetrievalContext, RetrievalFragment } from '../retrieval/types.js';
import {
  evidenceFromFragment,
  isGroundedDraft,
  isInspectableEvidence,
  type GroundedAnswerResult,
  type GroundedResponse,
  type ValidatedClaim,
  type ValidatedEvidence,
} from './grounded-response.js';

export class GroundedValidator {
  public constructor(
    private readonly repository: KnowledgeItemRepository,
    private readonly retrieval: RetrievalService,
  ) {}

  public validate(draft: unknown, context: RetrievalContext): GroundedAnswerResult {
    if (!isGroundedDraft(draft)) {
      return {
        ok: false,
        failure: {
          code: 'AI_MALFORMED_RESPONSE',
          message: 'The AI response did not match the grounded draft contract.',
          claims: [],
          contextId: context.contextId,
        },
      };
    }

    if (!this.retrieval.isContextCurrent(context)) {
      return {
        ok: false,
        failure: {
          code: 'GROUNDING_VALIDATION_FAILURE',
          message: 'The retrieval context is stale and cannot support a new response.',
          claims: [],
          contextId: context.contextId,
        },
      };
    }

    const claims = draft.claims.map((claim) => this.validateClaim(claim, context));
    const evidenceCondition = draft.proposedEvidenceCondition === 'CONTEXTUAL_DIVERGENCE'
      && hasMultipleKnowledgeItems(claims)
      ? 'CONTEXTUAL_DIVERGENCE'
      : 'CLEAR';

    const response: GroundedResponse = {
      answer: draft.answer,
      claims,
      evidenceCondition,
      contextId: context.contextId,
    };
    return { ok: true, response };
  }

  private validateClaim(claim: GroundedDraftClaim, context: RetrievalContext): ValidatedClaim {
    const evidence = claim.evidenceIds
      .map((evidenceId) => context.fragments.find((fragment) => fragment.evidenceId === evidenceId))
      .filter((fragment): fragment is RetrievalFragment => fragment !== undefined)
      .filter((fragment) => this.isValidFragment(fragment, context))
      .map((fragment) => {
        const item = this.getItem(context, fragment);
        return item ? evidenceFromFragment(fragment, item) : null;
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const hasInvalidReference = claim.evidenceIds.some((evidenceId) => !context.fragments.some((fragment) => fragment.evidenceId === evidenceId));
    if (hasInvalidReference || evidence.length !== claim.evidenceIds.length) {
      return {
        id: claim.id,
        text: claim.text,
        support: 'INSUFFICIENT',
        evidence,
        reason: 'One or more evidence references could not be verified in the current retrieval context.',
      };
    }

    if (claim.proposedSupport === 'SUPPORTED' && evidence.length > 0) {
      if (this.hasDirectEvidence(claim, evidence)) {
        return { id: claim.id, text: claim.text, support: 'SUPPORTED', evidence };
      }
      return {
        id: claim.id,
        text: claim.text,
        support: 'INFERRED',
        evidence,
        reason: 'The evidence is valid, but the claim did not pass the conservative deletion-only support check.',
      };
    }

    if (claim.proposedSupport === 'INFERRED' && evidence.length > 0) {
      return { id: claim.id, text: claim.text, support: 'INFERRED', evidence };
    }

    return {
      id: claim.id,
      text: claim.text,
      support: 'INSUFFICIENT',
      evidence,
      reason: evidence.length === 0 ? 'The corpus did not provide verifiable evidence for this claim.' : 'The claim was not proposed as a supported or inferred statement with verifiable evidence.',
    };
  }

  private isValidFragment(fragment: RetrievalFragment, context: RetrievalContext): boolean {
    if (!isInspectableEvidence(context, fragment)) return false;
    const item = this.getItem(context, fragment);
    return item !== null
      && item.revision === fragment.itemRevision
      && item.status === fragment.status
      && item.provenance === fragment.provenance
      && fragment.text === item.content.slice(fragment.startOffset, fragment.endOffset);
  }

  private getItem(context: RetrievalContext, fragment: RetrievalFragment) {
    return context.corpus === 'evaluation'
      ? this.repository.getEvaluationItems().find((item) => item.id === fragment.knowledgeItemId) ?? null
      : this.repository.getById(fragment.knowledgeItemId);
  }

  private hasDirectEvidence(claim: GroundedDraftClaim, evidence: readonly ValidatedEvidence[]): boolean {
    const quote = claim.evidenceQuote;
    if (!quote) return false;

    return evidence.some((item) => item.fragment.includes(quote)
      && !hasOmittedProtectedOperator(item.fragment, quote)
      && isDeletionOnlyRestatement(claim.text, quote));
  }
}

function hasMultipleKnowledgeItems(claims: readonly ValidatedClaim[]): boolean {
  return new Set(claims.flatMap((claim) => claim.evidence.map((evidence) => evidence.knowledgeItemId))).size > 1;
}

function hasOmittedProtectedOperator(fragment: string, quote: string): boolean {
  const quoteStart = fragment.indexOf(quote);
  if (quoteStart < 0) return true;
  const quoteEnd = quoteStart + quote.length;
  const fragmentTokens = tokenizeWithSentences(fragment);
  const quoteSentences = new Set(
    fragmentTokens
      .filter((token) => token.start < quoteEnd && token.end > quoteStart)
      .map((token) => token.sentence),
  );

  return fragmentTokens.some((token) => quoteSentences.has(token.sentence)
    && PROTECTED_TOKENS.has(token.value)
    && (token.start < quoteStart || token.end > quoteEnd));
}

/**
 * Comprueba una relación textual conservadora: la claim solo puede conservar tokens de la quote,
 * en el mismo orden, y debe conservar los tokens protegidos que controlan el significado.
 */
function isDeletionOnlyRestatement(claim: string, quote: string): boolean {
  const claimTokens = tokenize(claim);
  const quoteTokens = tokenizeWithSentences(quote);
  if (claimTokens.length === 0 || quoteTokens.length === 0) return false;

  let claimIndex = 0;
  const retainedQuoteIndexes = new Set<number>();
  for (const [quoteIndex, quoteToken] of quoteTokens.entries()) {
    if (claimTokens[claimIndex] === quoteToken.value) {
      retainedQuoteIndexes.add(quoteIndex);
      claimIndex += 1;
    }
  }
  if (claimIndex !== claimTokens.length) return false;

  // Se pueden eliminar frases completas, pero no operadores protegidos de una frase que la claim conserva.
  const retainedSentences = new Set(
    [...retainedQuoteIndexes].map((quoteIndex) => quoteTokens[quoteIndex]!.sentence),
  );
  return quoteTokens.every((quoteToken, quoteIndex) => !PROTECTED_TOKENS.has(quoteToken.value)
    || retainedQuoteIndexes.has(quoteIndex)
    || !retainedSentences.has(quoteToken.sentence));
}

function tokenize(value: string): string[] {
  return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu) ?? [];
}

interface TokenWithSentence {
  readonly value: string;
  readonly sentence: number;
  readonly start: number;
  readonly end: number;
}

function tokenizeWithSentences(value: string): TokenWithSentence[] {
  const tokens: TokenWithSentence[] = [];
  const sentencePattern = /[^.!?]+(?:[.!?]+|$)/gu;
  let sentenceMatch: RegExpExecArray | null;
  let sentence = 0;

  while ((sentenceMatch = sentencePattern.exec(value)) !== null) {
    const tokenPattern = /[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)?/gu;
    let tokenMatch: RegExpExecArray | null;
    while ((tokenMatch = tokenPattern.exec(sentenceMatch[0])) !== null) {
      const start = sentenceMatch.index + tokenMatch.index;
      tokens.push({
        value: tokenMatch[0].toLocaleLowerCase(),
        sentence,
        start,
        end: start + tokenMatch[0].length,
      });
    }
    sentence += 1;
  }
  return tokens;
}

// Lista deliberadamente pequeña: son operadores de negación, cuantificación, modalidad y alcance.
const PROTECTED_TOKENS = new Set([
  'not', 'no', 'never', 'only', 'always', 'all', 'every', 'each', 'most', 'some',
  'may', 'can', 'should', 'must', 'required', 'optional',
  'ningún', 'ninguna', 'nunca', 'solo', 'sólo', 'siempre', 'todo', 'toda', 'todos', 'todas',
  'cada', 'mayoría', 'alguno', 'alguna', 'puede', 'debe', 'obligatorio', 'opcional',
  'for', 'within', 'inside', 'on', 'in', 'between', 'among', 'across',
  'para', 'dentro', 'sobre', 'entre',
]);
