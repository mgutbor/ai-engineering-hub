import type { KnowledgeItem, KnowledgeItemId } from '../domain/knowledge-item.js';
import type { KnowledgeItemRepository } from './knowledge-item-repository.js';

export class EvaluationCorpusRepository {
  public constructor(private readonly repository: KnowledgeItemRepository) {}

  public list(): KnowledgeItem[] {
    return this.repository.getEvaluationItems();
  }

  public getById(id: KnowledgeItemId): KnowledgeItem | null {
    return this.list().find((item) => item.id === id) ?? null;
  }
}
