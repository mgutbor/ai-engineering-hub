import type {
  CreateKnowledgeItemInput,
  KnowledgeItem,
  KnowledgeItemId,
  UpdateKnowledgeItemInput,
} from '../domain/knowledge-item.js';
import { KnowledgeItemNotFoundError } from '../domain/errors.js';
import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';

export class KnowledgeItemService {
  public constructor(private readonly repository: KnowledgeItemRepository) {}

  public create(input: CreateKnowledgeItemInput): KnowledgeItem {
    return this.repository.create(input);
  }

  public get(id: KnowledgeItemId): KnowledgeItem {
    const item = this.repository.getById(id);
    if (!item) throw new KnowledgeItemNotFoundError(id);
    return item;
  }

  public list(): KnowledgeItem[] {
    return this.repository.list();
  }

  public update(id: KnowledgeItemId, expectedRevision: number, input: UpdateKnowledgeItemInput): KnowledgeItem {
    return this.repository.update(id, expectedRevision, input);
  }

  public delete(id: KnowledgeItemId, expectedRevision: number): void {
    this.repository.delete(id, expectedRevision);
  }
}
