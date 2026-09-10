import type { KnowledgeItemId, KnowledgeItemProvenance, KnowledgeItemStatus } from '../domain/knowledge-item.js';

export interface RetrievalFragment {
  readonly evidenceId: string;
  readonly knowledgeItemId: KnowledgeItemId;
  readonly itemRevision: number;
  readonly text: string;
  readonly paragraphIndex: number;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly status: KnowledgeItemStatus;
  readonly provenance: KnowledgeItemProvenance;
  readonly sourceReference: string | null;
}

export interface RetrievalContext {
  readonly contextId: string;
  readonly query: string;
  readonly corpus: 'user' | 'evaluation';
  readonly fragments: readonly RetrievalFragment[];
  readonly createdAt: string;
}
