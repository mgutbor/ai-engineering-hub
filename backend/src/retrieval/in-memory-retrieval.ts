import { randomUUID } from 'node:crypto';
import type { KnowledgeItem, KnowledgeItemId } from '../domain/knowledge-item.js';
import { fragmentContent } from './fragmentation.js';
import type { RetrievalQuery, RetrievalService } from './retrieval-service.js';
import type { RetrievalContext, RetrievalFragment } from './types.js';

export interface KnowledgeItemCorpus {
  list(): KnowledgeItem[];
  getById(id: KnowledgeItemId): KnowledgeItem | null;
}

export class InMemoryRetrievalService implements RetrievalService {
  public constructor(
    private readonly userCorpus: KnowledgeItemCorpus,
    private readonly evaluationItems: readonly KnowledgeItem[],
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  public search(query: RetrievalQuery): RetrievalContext {
    const normalizedQuery = query.query.trim();
    const items = query.corpus === 'evaluation' ? [...this.evaluationItems] : this.userCorpus.list();
    const terms = tokenize(normalizedQuery);
    const maxFragmentsPerItem = query.maxFragmentsPerItem ?? 2;
    const limit = query.limit ?? 8;

    if (terms.length === 0) {
      return {
        contextId: randomUUID(),
        query: normalizedQuery,
        corpus: query.corpus,
        fragments: [],
        createdAt: this.clock(),
      };
    }

    const candidates = items.flatMap((item) => {
      const fragments = fragmentContent(item.content);
      const matching = fragments
        .map((fragment) => ({ item, fragment, score: scoreFragment(item, fragment.text, terms) }))
        .filter((candidate) => candidate.score > 0)
        .sort((left, right) => right.score - left.score || left.fragment.paragraphIndex - right.fragment.paragraphIndex)
        .slice(0, maxFragmentsPerItem);

      return matching;
    });

    const selected = candidates
      .sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id) || left.fragment.paragraphIndex - right.fragment.paragraphIndex)
      .slice(0, limit);

    return {
      contextId: randomUUID(),
      query: normalizedQuery,
      corpus: query.corpus,
      fragments: selected.map(({ item, fragment }, index): RetrievalFragment => ({
        evidenceId: `ev-${index + 1}-${randomUUID()}`,
        knowledgeItemId: item.id,
        itemRevision: item.revision,
        text: fragment.text,
        paragraphIndex: fragment.paragraphIndex,
        startOffset: fragment.startOffset,
        endOffset: fragment.endOffset,
        status: item.status,
        provenance: item.provenance,
        sourceReference: item.sourceReference,
      })),
      createdAt: this.clock(),
    };
  }

  public isContextCurrent(context: RetrievalContext): boolean {
    return context.fragments.every((fragment) => this.isFragmentCurrent(fragment.knowledgeItemId, fragment.itemRevision, context.corpus));
  }

  public isFragmentCurrent(knowledgeItemId: KnowledgeItemId, revision: number, corpus: 'user' | 'evaluation' = 'user'): boolean {
    const item = corpus === 'evaluation'
      ? this.evaluationItems.find((candidate) => candidate.id === knowledgeItemId) ?? null
      : this.userCorpus.getById(knowledgeItemId);
    return item?.revision === revision;
  }
}

function tokenize(query: string): string[] {
  return query.toLocaleLowerCase().split(/[^\p{L}\p{N}]+/u).filter((term) => term.length > 1);
}

function scoreFragment(item: KnowledgeItem, text: string, terms: readonly string[]): number {
  const title = item.title.toLocaleLowerCase();
  const content = text.toLocaleLowerCase();
  return terms.reduce((score, term) => score + (title.includes(term) ? 4 : 0) + (content.includes(term) ? 2 : 0), 0);
}
