export const KNOWLEDGE_ITEM_STATUSES = ['ACTIVE', 'SUPERSEDED', 'ARCHIVED'] as const;
export type KnowledgeItemStatus = (typeof KNOWLEDGE_ITEM_STATUSES)[number];

export const KNOWLEDGE_ITEM_PROVENANCES = ['human-authored', 'imported'] as const;
export type KnowledgeItemProvenance = (typeof KNOWLEDGE_ITEM_PROVENANCES)[number];

export type KnowledgeItemId = string;

export interface KnowledgeItem {
  readonly id: KnowledgeItemId;
  readonly title: string;
  readonly content: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly revision: number;
  readonly status: KnowledgeItemStatus;
  readonly provenance: KnowledgeItemProvenance;
  readonly sourceReference: string | null;
}

export interface CreateKnowledgeItemInput {
  readonly title: string;
  readonly content: string;
  readonly status?: KnowledgeItemStatus;
  readonly sourceReference?: string | null;
}

export interface UpdateKnowledgeItemInput {
  readonly title?: string;
  readonly content?: string;
  readonly status?: KnowledgeItemStatus;
  readonly sourceReference?: string | null;
}

export class InvalidKnowledgeItemError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'InvalidKnowledgeItemError';
  }
}

export function assertKnowledgeItemText(value: string, field: 'title' | 'content'): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new InvalidKnowledgeItemError(`${field} must not be empty`);
  }
  return value;
}

export function assertKnowledgeItemStatus(status: string): KnowledgeItemStatus {
  if (!KNOWLEDGE_ITEM_STATUSES.includes(status as KnowledgeItemStatus)) {
    throw new InvalidKnowledgeItemError(`Invalid status: ${status}`);
  }
  return status as KnowledgeItemStatus;
}

export function createKnowledgeItem(
  input: CreateKnowledgeItemInput,
  now: string,
  id: KnowledgeItemId,
): KnowledgeItem {
  return {
    id,
    title: assertKnowledgeItemText(input.title, 'title'),
    content: assertKnowledgeItemText(input.content, 'content'),
    createdAt: now,
    updatedAt: now,
    revision: 1,
    status: input.status ? assertKnowledgeItemStatus(input.status) : 'ACTIVE',
    provenance: 'human-authored',
    sourceReference: input.sourceReference ?? null,
  };
}

export function updateKnowledgeItem(
  current: KnowledgeItem,
  input: UpdateKnowledgeItemInput,
  now: string,
): KnowledgeItem {
  const title = input.title === undefined ? current.title : assertKnowledgeItemText(input.title, 'title');
  const content = input.content === undefined ? current.content : assertKnowledgeItemText(input.content, 'content');
  const status = input.status === undefined ? current.status : assertKnowledgeItemStatus(input.status);
  const sourceReference = input.sourceReference === undefined ? current.sourceReference : input.sourceReference;

  return {
    ...current,
    title,
    content,
    status,
    sourceReference,
    updatedAt: now,
    revision: current.revision + 1,
  };
}
