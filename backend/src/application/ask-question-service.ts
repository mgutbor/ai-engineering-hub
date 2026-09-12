import { GroundedSynthesisError, type GroundedSynthesis } from '../ai/grounded-synthesis.js';
import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';
import type { RetrievalService } from '../retrieval/retrieval-service.js';
import type { RetrievalContext } from '../retrieval/types.js';
import { GroundedValidator } from '../grounding/grounded-validator.js';
import type { GroundedResponse } from '../grounding/grounded-response.js';

export type AskFailureCode = 'NO_RELEVANT_EVIDENCE' | 'AI_UNAVAILABLE' | 'AI_MALFORMED_RESPONSE' | 'GROUNDING_VALIDATION_FAILURE';

export interface AskSuccess {
  readonly ok: true;
  readonly response: GroundedResponse;
}

export interface AskFailure {
  readonly ok: false;
  readonly code: AskFailureCode;
  readonly message: string;
  readonly context: RetrievalContext;
}

export type AskResult = AskSuccess | AskFailure;

export class AskQuestionService {
  private readonly validator: GroundedValidator;

  public constructor(
    private readonly retrieval: RetrievalService,
    private readonly synthesis: GroundedSynthesis,
    repository: KnowledgeItemRepository,
  ) {
    this.validator = new GroundedValidator(repository, retrieval);
  }

  public async ask(question: string, corpus: 'user' | 'evaluation' = 'user'): Promise<AskResult> {
    const context = this.retrieval.search({ query: question, corpus, limit: 8 });
    if (context.fragments.length === 0) {
      return {
        ok: true,
        response: {
          answer: 'The corpus does not contain sufficient verifiable evidence to answer this question.',
          claims: [{
            id: 'abstention',
            text: 'The corpus does not contain sufficient verifiable evidence to answer this question.',
            support: 'INSUFFICIENT',
            evidence: [],
            reason: 'No relevant evidence was found in the selected corpus.',
          }],
          evidenceCondition: 'CLEAR',
          contextId: context.contextId,
        },
      };
    }

    try {
      const draft = await this.synthesis.generate(question, context);
      const validation = this.validator.validate(draft, context);
      if (!validation.ok) {
        return {
          ok: false,
          code: validation.failure.code,
          message: validation.failure.message,
          context,
        };
      }
      return { ok: true, response: validation.response };
    } catch (error) {
      if (error instanceof GroundedSynthesisError) {
        return { ok: false, code: error.code, message: error.message, context };
      }
      throw error;
    }
  }
}
