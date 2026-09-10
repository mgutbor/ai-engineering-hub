import type { KnowledgeItemId } from '../domain/knowledge-item.js';
import type { RetrievalContext } from './types.js';

export interface RetrievalQuery {
  readonly query: string;
  readonly corpus: 'user' | 'evaluation';
  readonly limit?: number;
  readonly maxFragmentsPerItem?: number;
}

export interface RetrievalService {
  search(query: RetrievalQuery): RetrievalContext;
  isContextCurrent(context: RetrievalContext): boolean;
  isFragmentCurrent(knowledgeItemId: KnowledgeItemId, revision: number, corpus: 'user' | 'evaluation'): boolean;
}
