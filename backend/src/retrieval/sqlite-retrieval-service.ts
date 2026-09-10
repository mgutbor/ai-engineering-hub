import { randomUUID } from 'node:crypto';
import type { KnowledgeItemId } from '../domain/knowledge-item.js';
import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';
import { fragmentContent } from './fragmentation.js';
import { extractSearchTerms } from './query-terms.js';
import type { RetrievalQuery, RetrievalService } from './retrieval-service.js';
import type { RetrievalContext, RetrievalFragment } from './types.js';

export class SqliteRetrievalService implements RetrievalService {
  public constructor(
    private readonly repository: KnowledgeItemRepository,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public search(query: RetrievalQuery): RetrievalContext {
    const normalizedQuery = query.query.trim();
    const limit = query.limit ?? 8;
    const rows = normalizedQuery.length === 0 ? [] : this.repository.searchRows(normalizedQuery, query.corpus, limit);
    const fragments: RetrievalFragment[] = [];

    for (const row of rows) {
      const item = query.corpus === 'user'
        ? this.repository.getById(row.item_id)
        : this.repository.getEvaluationItems().find((candidate) => candidate.id === row.item_id) ?? null;
      if (!item) continue;

      const itemFragments = fragmentContent(item.content);
      const matchingFragments = itemFragments
        .filter((fragment) => containsQueryTerms(fragment.text, normalizedQuery) || containsQueryTerms(item.title, normalizedQuery))
        .slice(0, query.maxFragmentsPerItem ?? 2);

      for (const fragment of matchingFragments) {
        fragments.push({
          evidenceId: `ev-${fragments.length + 1}-${randomUUID()}`,
          knowledgeItemId: item.id,
          itemRevision: item.revision,
          text: fragment.text,
          paragraphIndex: fragment.paragraphIndex,
          startOffset: fragment.startOffset,
          endOffset: fragment.endOffset,
          status: item.status,
          provenance: item.provenance,
          sourceReference: item.sourceReference,
        });
      }
    }

    return {
      contextId: randomUUID(),
      query: normalizedQuery,
      corpus: query.corpus,
      fragments: fragments.slice(0, limit),
      createdAt: this.clock(),
    };
  }

  public isContextCurrent(context: RetrievalContext): boolean {
    return context.fragments.every((fragment) => this.isFragmentCurrent(fragment.knowledgeItemId, fragment.itemRevision, context.corpus));
  }

  public isFragmentCurrent(knowledgeItemId: KnowledgeItemId, revision: number, corpus: 'user' | 'evaluation' = 'user'): boolean {
    return this.repository.isCurrent(knowledgeItemId, revision, corpus);
  }
}

function containsQueryTerms(value: string, query: string): boolean {
  const normalizedValue = value.toLocaleLowerCase();
  const terms = extractSearchTerms(query);
  return terms.some((term) => normalizedValue.includes(term));
}
