import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

const item = {
  id: 'item-1', title: 'State ownership', content: 'Local state belongs to the owning feature.', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', revision: 1, status: 'ACTIVE' as const, provenance: 'human-authored' as const, sourceReference: null,
};

function mockFetch() {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/knowledge-items') && (!options || options.method === undefined)) return response({ items: [item] });
    if (url.includes('/knowledge-items/item-1') && (!options || options.method === undefined)) return response({ item });
    if (url.endsWith('/knowledge-items?q=local')) return response({ items: [item], context: { contextId: 'ctx', query: 'local', corpus: 'user', createdAt: '2025-01-01T00:00:00.000Z', fragments: [{ evidenceId: 'ev-1', knowledgeItemId: item.id, itemRevision: 1, text: item.content, paragraphIndex: 0, startOffset: 0, endOffset: item.content.length, status: item.status, provenance: item.provenance, sourceReference: null }] } });
    if (options?.method === 'POST') return response({ item: { ...item, id: 'created-1', title: 'New item' } }, 201);
    if (options?.method === 'PATCH') return response({ item: { ...item, revision: 2 } });
    return response({}, 204);
  }));
}

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Slice A frontend', () => {
  it('lists an item, opens its detail and inspects a search fragment', async () => {
    mockFetch();
    render(<App />);
    expect(await screen.findByText('State ownership')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /State ownership.*ACTIVE/ }));
    expect(await screen.findByText('Local state belongs to the owning feature.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Search text'), { target: { value: 'local' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/Evidence ev-1/)).toBeInTheDocument();
  });

  it('opens the create form and submits a new item', async () => {
    mockFetch();
    render(<App />);
    fireEvent.click(screen.getAllByRole('button', { name: 'New Knowledge Item' })[0]!);
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New decision' } });
    fireEvent.change(screen.getByLabelText('Content'), { target: { value: 'Keep the boundary small.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getByText('New Knowledge Item')).toBeInTheDocument());
  });
});
