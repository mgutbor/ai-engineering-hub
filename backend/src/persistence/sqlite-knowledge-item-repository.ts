import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  createKnowledgeItem,
  type CreateKnowledgeItemInput,
  type KnowledgeItem,
  type KnowledgeItemId,
  type UpdateKnowledgeItemInput,
  updateKnowledgeItem,
} from '../domain/knowledge-item.js';
import { KnowledgeItemNotFoundError, PersistenceConsistencyError, RevisionConflictError } from '../domain/errors.js';
import { evaluationCorpus } from '../evaluation/evaluation-corpus.js';
import { toFtsQuery } from '../retrieval/query-terms.js';
import type { KnowledgeItemRepository, SearchRow } from './knowledge-item-repository.js';
import type { SqliteDatabase } from './sqlite-database.js';

interface KnowledgeItemRow {
  id: string;
  corpus: 'user' | 'evaluation';
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  revision: number;
  status: KnowledgeItem['status'];
  provenance: KnowledgeItem['provenance'];
  source_reference: string | null;
}

export class SqliteKnowledgeItemRepository implements KnowledgeItemRepository {
  public constructor(private readonly database: SqliteDatabase) {
    this.seedEvaluationCorpus();
  }

  public create(input: CreateKnowledgeItemInput): KnowledgeItem {
    const now = new Date().toISOString();
    const item = createKnowledgeItem(input, now, randomUUID());
    const transaction = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO knowledge_items
            (id, corpus, title, content, created_at, updated_at, revision, status, provenance, source_reference)
           VALUES (@id, 'user', @title, @content, @createdAt, @updatedAt, @revision, @status, @provenance, @sourceReference)`,
        )
        .run({
          id: item.id,
          title: item.title,
          content: item.content,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          revision: item.revision,
          status: item.status,
          provenance: item.provenance,
          sourceReference: item.sourceReference,
        });
      this.replaceIndex(item, 'user');
    });
    transaction();
    return item;
  }

  public getById(id: KnowledgeItemId): KnowledgeItem | null {
    const row = this.database
      .prepare("SELECT * FROM knowledge_items WHERE id = ? AND corpus = 'user'")
      .get(id) as KnowledgeItemRow | undefined;
    return row ? mapRow(row) : null;
  }

  public list(): KnowledgeItem[] {
    const rows = this.database
      .prepare("SELECT * FROM knowledge_items WHERE corpus = 'user' ORDER BY created_at DESC, id ASC")
      .all() as KnowledgeItemRow[];
    return rows.map(mapRow);
  }

  public update(id: KnowledgeItemId, expectedRevision: number, input: UpdateKnowledgeItemInput): KnowledgeItem {
    const current = this.getById(id);
    if (!current) {
      throw new KnowledgeItemNotFoundError(id);
    }
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(id, expectedRevision, current.revision);
    }

    const updated = updateKnowledgeItem(current, input, new Date().toISOString());
    const transaction = this.database.transaction(() => {
      const result = this.database
        .prepare(
          `UPDATE knowledge_items
           SET title = @title,
               content = @content,
               updated_at = @updatedAt,
               revision = @revision,
               status = @status,
               source_reference = @sourceReference
           WHERE id = @id AND corpus = 'user' AND revision = @expectedRevision`,
        )
        .run({
          id: updated.id,
          title: updated.title,
          content: updated.content,
          updatedAt: updated.updatedAt,
          revision: updated.revision,
          status: updated.status,
          sourceReference: updated.sourceReference,
          expectedRevision,
        });
      if (result.changes !== 1) {
        throw new RevisionConflictError(id, expectedRevision, current.revision);
      }
      this.replaceIndex(updated, 'user');
    });
    transaction();
    return updated;
  }

  public delete(id: KnowledgeItemId, expectedRevision: number): void {
    const current = this.getById(id);
    if (!current) {
      throw new KnowledgeItemNotFoundError(id);
    }
    if (current.revision !== expectedRevision) {
      throw new RevisionConflictError(id, expectedRevision, current.revision);
    }

    const transaction = this.database.transaction(() => {
      const result = this.database
        .prepare("DELETE FROM knowledge_items WHERE id = ? AND corpus = 'user' AND revision = ?")
        .run(id, expectedRevision);
      if (result.changes !== 1) {
        throw new RevisionConflictError(id, expectedRevision, current.revision);
      }
      this.database.prepare("DELETE FROM knowledge_items_fts WHERE item_id = ? AND corpus = 'user'").run(id);
    });
    transaction();
  }

  public getEvaluationItems(): KnowledgeItem[] {
    const rows = this.database
      .prepare("SELECT * FROM knowledge_items WHERE corpus = 'evaluation' ORDER BY id ASC")
      .all() as KnowledgeItemRow[];
    return rows.map(mapRow);
  }

  public searchRows(query: string, corpus: 'user' | 'evaluation', limit: number): SearchRow[] {
    return this.database
      .prepare(
        `SELECT f.item_id, f.corpus, f.revision, f.title, f.content, bm25(knowledge_items_fts) AS score
         FROM knowledge_items_fts AS f
         WHERE knowledge_items_fts MATCH ? AND f.corpus = ?
         ORDER BY score ASC, f.item_id ASC
         LIMIT ?`,
      )
      .all(toFtsQuery(query), corpus, limit) as SearchRow[];
  }

  public isCurrent(id: KnowledgeItemId, revision: number, corpus: 'user' | 'evaluation'): boolean {
    const row = this.database
      .prepare('SELECT revision FROM knowledge_items WHERE id = ? AND corpus = ?')
      .get(id, corpus) as { revision: number } | undefined;
    return row?.revision === revision;
  }

  private seedEvaluationCorpus(): void {
    const transaction = this.database.transaction(() => {
      const insertItem = this.database.prepare(
        `INSERT OR IGNORE INTO knowledge_items
          (id, corpus, title, content, created_at, updated_at, revision, status, provenance, source_reference)
         VALUES (@id, 'evaluation', @title, @content, @createdAt, @updatedAt, @revision, @status, @provenance, @sourceReference)`,
      );
      for (const item of evaluationCorpus) {
        insertItem.run({
          id: item.id,
          title: item.title,
          content: item.content,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          revision: item.revision,
          status: item.status,
          provenance: item.provenance,
          sourceReference: item.sourceReference,
        });
        this.replaceIndex(item, 'evaluation');
      }
    });
    transaction();
  }

  private replaceIndex(item: KnowledgeItem, corpus: 'user' | 'evaluation'): void {
    this.database.prepare('DELETE FROM knowledge_items_fts WHERE item_id = ? AND corpus = ?').run(item.id, corpus);
    this.database
      .prepare('INSERT INTO knowledge_items_fts (item_id, corpus, revision, title, content) VALUES (?, ?, ?, ?, ?)')
      .run(item.id, corpus, item.revision, item.title, item.content);
    const indexed = this.database
      .prepare('SELECT 1 FROM knowledge_items_fts WHERE item_id = ? AND corpus = ?')
      .get(item.id, corpus);
    if (!indexed) {
      throw new PersistenceConsistencyError(`FTS index missing Knowledge Item: ${item.id}`);
    }
  }
}

function mapRow(row: KnowledgeItemRow): KnowledgeItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    revision: row.revision,
    status: row.status,
    provenance: row.provenance,
    sourceReference: row.source_reference,
  };
}

