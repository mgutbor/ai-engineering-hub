import { describe, expect, it } from 'vitest';
import { createKnowledgeItem, InvalidKnowledgeItemError, updateKnowledgeItem } from './knowledge-item.js';

describe('KnowledgeItem domain', () => {
  it('creates a valid human-authored item at revision one', () => {
    const item = createKnowledgeItem({ title: 'Decision', content: 'Keep state local.' }, '2025-01-01T00:00:00.000Z', 'item-1');
    expect(item).toMatchObject({ id: 'item-1', status: 'ACTIVE', provenance: 'human-authored', revision: 1 });
    expect(item.createdAt).toBe(item.updatedAt);
  });

  it('rejects empty title and content', () => {
    expect(() => createKnowledgeItem({ title: ' ', content: 'content' }, new Date().toISOString(), 'item-1')).toThrow(InvalidKnowledgeItemError);
    expect(() => createKnowledgeItem({ title: 'title', content: ' ' }, new Date().toISOString(), 'item-1')).toThrow(InvalidKnowledgeItemError);
  });

  it('updates editable data and increments revision without changing provenance', () => {
    const item = createKnowledgeItem({ title: 'Decision', content: 'Keep state local.' }, '2025-01-01T00:00:00.000Z', 'item-1');
    const updated = updateKnowledgeItem(item, { content: 'Keep state local by default.' }, '2025-01-02T00:00:00.000Z');
    expect(updated).toMatchObject({ revision: 2, content: 'Keep state local by default.', provenance: 'human-authored' });
    expect(updated.createdAt).toBe(item.createdAt);
    expect(updated.updatedAt).not.toBe(item.updatedAt);
  });
});
