export class KnowledgeItemNotFoundError extends Error {
  public constructor(id: string) {
    super(`Knowledge Item not found: ${id}`);
    this.name = 'KnowledgeItemNotFoundError';
  }
}

export class RevisionConflictError extends Error {
  public constructor(id: string, expected: number, actual: number) {
    super(`Knowledge Item ${id} revision conflict: expected ${expected}, actual ${actual}`);
    this.name = 'RevisionConflictError';
  }
}

export class SearchQueryError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'SearchQueryError';
  }
}

export class PersistenceConsistencyError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'PersistenceConsistencyError';
  }
}
