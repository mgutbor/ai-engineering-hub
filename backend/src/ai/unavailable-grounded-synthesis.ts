import type { RetrievalContext } from '../retrieval/types.js';
import { GroundedSynthesisError, type GroundedDraft, type GroundedSynthesis } from './grounded-synthesis.js';

export class UnavailableGroundedSynthesis implements GroundedSynthesis {
  public async generate(_question: string, _context: RetrievalContext): Promise<GroundedDraft> {
    throw new GroundedSynthesisError('AI_UNAVAILABLE', 'No AI provider is configured.');
  }
}
