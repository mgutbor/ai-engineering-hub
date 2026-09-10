import type {
  CreateKnowledgeItemInput,
  KnowledgeItem,
  KnowledgeItemId,
  UpdateKnowledgeItemInput,
} from '../domain/knowledge-item.js';

export interface KnowledgeItemRepository {
  create(input: CreateKnowledgeItemInput): KnowledgeItem;
  getById(id: KnowledgeItemId): KnowledgeItem | null;
  list(): KnowledgeItem[];
  update(id: KnowledgeItemId, expectedRevision: number, input: UpdateKnowledgeItemInput): KnowledgeItem;
  delete(id: KnowledgeItemId, expectedRevision: number): void;
  getEvaluationItems(): KnowledgeItem[];
  searchRows(query: string, corpus: 'user' | 'evaluation', limit: number): SearchRow[];
  isCurrent(id: KnowledgeItemId, revision: number, corpus: 'user' | 'evaluation'): boolean;
}

export interface SearchRow {
  readonly item_id: string;
  readonly corpus: 'user' | 'evaluation';
  readonly revision: number;
  readonly title: string;
  readonly content: string;
  readonly score: number;
}
