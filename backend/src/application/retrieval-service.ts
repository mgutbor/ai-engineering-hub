import type { RetrievalContext } from '../retrieval/types.js';
import type { RetrievalQuery, RetrievalService } from '../retrieval/retrieval-service.js';

export class EvidenceRetrievalService {
  public constructor(private readonly retrieval: RetrievalService) {}

  public retrieve(query: RetrievalQuery): RetrievalContext {
    return this.retrieval.search(query);
  }
}
