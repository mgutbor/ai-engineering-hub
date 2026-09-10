import type { KnowledgeItem } from '../domain/knowledge-item.js';
import type { RetrievalContext } from '../retrieval/types.js';

export interface SearchResult {
  readonly item: KnowledgeItem;
  readonly fragments: RetrievalContext['fragments'];
}
