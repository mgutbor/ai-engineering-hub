import { afterEach, describe, expect, it, vi } from 'vitest';
import { listKnowledgeItems } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('frontend API', () => {
  it('surfaces backend errors', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'NOT_FOUND', message: 'Missing' }), { status: 404, headers: { 'content-type': 'application/json' } })));
    await expect(listKnowledgeItems()).rejects.toThrow('Missing');
  });
});
