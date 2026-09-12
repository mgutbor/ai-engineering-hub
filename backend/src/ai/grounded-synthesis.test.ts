import { describe, expect, it } from 'vitest';
import { DEFAULT_GEMINI_MODEL, GeminiGroundedSynthesis } from './gemini-grounded-synthesis.js';
import type { RetrievalContext } from '../retrieval/types.js';

const context: RetrievalContext = {
  contextId: 'ctx-1', query: 'state', corpus: 'user', createdAt: '2025-01-01T00:00:00.000Z', fragments: [{
    evidenceId: 'ev-1', knowledgeItemId: 'item-1', itemRevision: 1, text: 'Keep state local.', paragraphIndex: 0, startOffset: 0, endOffset: 17, status: 'ACTIVE', provenance: 'human-authored', sourceReference: null,
  }],
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function rawResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

describe('GeminiGroundedSynthesis', () => {
  it('parses structured output and sends only the selected context', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let requestUrl: string | URL | Request | undefined;
    let requestHeaders: HeadersInit | undefined;
    const adapter = new GeminiGroundedSynthesis('key', 'model', 'https://example.test/models', async (input, init) => {
      requestUrl = input;
      requestHeaders = init?.headers;
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'Keep state local.', claims: [{ id: 'claim-1', text: 'Keep state local.', proposedSupport: 'SUPPORTED', evidenceIds: ['ev-1'], evidenceQuote: 'Keep state local.' }], proposedEvidenceCondition: null }) }] } }] });
    });
    const draft = await adapter.generate('What is the state rule?', context);
    expect(draft.claims[0]?.evidenceIds).toEqual(['ev-1']);
    expect(String(requestUrl)).toBe('https://example.test/models/model:generateContent');
    expect(requestBody).toBeDefined();
    expect(requestBody?.generationConfig).toMatchObject({ responseMimeType: 'application/json', temperature: 0 });
    expect(new Headers(requestHeaders).get('x-goog-api-key')).toBe('key');
    expect(requestBody).not.toHaveProperty('knowledgeItems');
    const contents = requestBody?.contents as Array<{ parts: Array<{ text: string }> }>;
    expect(contents[0]?.parts[0]?.text).toContain('Keep state local.');
    expect(contents[0]?.parts[0]?.text).not.toContain('item-2');
  });

  it('defaults to the MVP Gemini model', async () => {
    let requestUrl = '';
    const adapter = new GeminiGroundedSynthesis('key', undefined, 'https://example.test/models', async (input) => {
      requestUrl = String(input);
      return response({ candidates: [{ content: { parts: [{ text: JSON.stringify({ answer: 'Keep state local.', claims: [{ id: 'claim-1', text: 'Keep state local.', proposedSupport: 'SUPPORTED', evidenceIds: ['ev-1'] }] }) }] } }] });
    });
    await adapter.generate('state', context);
    expect(DEFAULT_GEMINI_MODEL).toBe('gemini-3.5-flash-lite');
    expect(requestUrl).toContain('/gemini-3.5-flash-lite:generateContent');
  });
  it('preserves safe provider diagnostics for non-2xx JSON errors', async () => {
    const adapter = new GeminiGroundedSynthesis('secret-key', 'model', 'https://example.test/models', async () => response({
      error: {
        status: 'NOT_FOUND',
        message: 'Model secret-key was not found.',
        details: [{ reason: 'MODEL_NOT_FOUND', apiKey: 'secret-key' }],
      },
    }, 404));

    await expect(adapter.generate('question', context)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: 'The AI provider returned HTTP 404; status NOT_FOUND; message Model [REDACTED] was not found.; details [{"reason":"MODEL_NOT_FOUND","apiKey":"[REDACTED]"}].',
    });
  });

  it('preserves the HTTP status when a non-2xx body is not JSON', async () => {
    const adapter = new GeminiGroundedSynthesis('secret-key', 'model', 'https://example.test/models', async () => rawResponse('not-json', 404));

    await expect(adapter.generate('question', context)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: 'The AI provider returned HTTP 404; the error body could not be interpreted as JSON.',
    });
  });


  it('maps invalid model content to AI_MALFORMED_RESPONSE', async () => {
    const adapter = new GeminiGroundedSynthesis('key', 'model', 'https://example.test/models', async () => response({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }));
    await expect(adapter.generate('question', context)).rejects.toMatchObject({ code: 'AI_MALFORMED_RESPONSE' });
  });
});
