import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { App } from './App';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function response(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Slice B question surface', () => {
  it('renders claim support and inspectable evidence', async () => {
    const item = { id: 'item-1', title: 'State', content: 'Keep state local.', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', revision: 1, status: 'ACTIVE', provenance: 'human-authored', sourceReference: null };
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/knowledge-items') && !options?.method) return response({ items: [item] });
      if (url.includes('/knowledge-items/item-1') && !options?.method) return response({ item });
      if (url.endsWith('/ask')) return response({ answer: 'Keep state local.', evidenceCondition: 'CLEAR', contextId: 'ctx', claims: [{ id: 'claim-1', text: 'Keep state local.', support: 'SUPPORTED', evidence: [{ evidenceId: 'ev-1', fragment: 'Keep state local.', knowledgeItemId: 'item-1', knowledgeItemTitle: 'State', revision: 1, status: 'ACTIVE', provenance: 'human-authored', sourceReference: null, paragraphIndex: 0, startOffset: 0, endOffset: 17 }] }] });
      return response({});
    }));

    render(<App />);
    await screen.findByText('State');
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'Why is state local?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    expect(await screen.findByText('SUPPORTED')).toBeInTheDocument();
    expect(screen.getByText('Evidence ev-1')).toBeInTheDocument();
    expect(screen.getAllByText('Keep state local.').length).toBeGreaterThanOrEqual(1);
  });

  it('shows controlled AI unavailability without hiding search', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/knowledge-items')) return response({ items: [] });
      return response({ error: 'AI_UNAVAILABLE', message: 'No AI provider is configured.', context: { fragments: [] } }, 503);
    }));

    render(<App />);
    await screen.findByText('No Knowledge Items found.');
    fireEvent.change(screen.getByLabelText('Question'), { target: { value: 'state' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('AI generation is unavailable'));
    expect(screen.getByRole('heading', { name: 'Knowledge Items' })).toBeInTheDocument();
  });
});
