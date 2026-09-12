import { describe, expect, it } from 'vitest';
import { DEFAULT_GROQ_MODEL, GroqGroundedSynthesis } from './groq-grounded-synthesis.js';
import { GroundedSynthesisError } from './grounded-synthesis.js';
import type { RetrievalContext } from '../retrieval/types.js';

const context: RetrievalContext = {
  contextId: 'ctx-1', query: 'state', corpus: 'user', createdAt: '2025-01-01T00:00:00.000Z', fragments: [{
    evidenceId: 'ev-1', knowledgeItemId: 'item-1', itemRevision: 1, text: 'Keep state local.', paragraphIndex: 0, startOffset: 0, endOffset: 17, status: 'ACTIVE', provenance: 'human-authored', sourceReference: null,
  }],
};

const validDraft = {
  answer: 'Keep state local.',
  claims: [{ id: 'claim-1', text: 'Keep state local.', proposedSupport: 'SUPPORTED', evidenceIds: ['ev-1'], evidenceQuote: 'Keep state local.' }],
  proposedEvidenceCondition: null,
};

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function rawResponse(body: string, status: number): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

describe('GroqGroundedSynthesis', () => {
  it('forms the request with model, authorization header and only the selected context', async () => {
    let requestBody: Record<string, unknown> | undefined;
    let requestUrl: string | URL | Request | undefined;
    let requestHeaders: HeadersInit | undefined;
    const adapter = new GroqGroundedSynthesis('key', 'model', 'https://example.test/chat/completions', async (input, init) => {
      requestUrl = input;
      requestHeaders = init?.headers;
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response({ choices: [{ message: { content: JSON.stringify(validDraft) } }] });
    });
    const draft = await adapter.generate('What is the state rule?', context);
    expect(draft.claims[0]?.evidenceIds).toEqual(['ev-1']);
    expect(String(requestUrl)).toBe('https://example.test/chat/completions');
    expect(requestBody).toMatchObject({ model: 'model', temperature: 0 });
    expect(requestBody?.response_format).toMatchObject({ type: 'json_schema', json_schema: { name: 'grounded_draft', strict: true } });
    const schema = (requestBody?.response_format as { json_schema: { schema: Record<string, unknown> } }).json_schema.schema;
    expect(schema.required).toEqual(['answer', 'claims', 'proposedEvidenceCondition']);
    expect(new Headers(requestHeaders).get('authorization')).toBe('Bearer key');
    const messages = requestBody?.messages as Array<{ role: string; content: string }>;
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('Answer only from the supplied retrieval context.');
    expect(messages[1]?.content).toContain('Keep state local.');
    expect(messages[1]?.content).not.toContain('item-2');
  });

  it('defaults to the MVP Groq model', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const adapter = new GroqGroundedSynthesis('key', undefined, 'https://example.test/chat/completions', async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return response({ choices: [{ message: { content: JSON.stringify(validDraft) } }] });
    });
    await adapter.generate('state', context);
    expect(DEFAULT_GROQ_MODEL).toBe('openai/gpt-oss-20b');
    expect(requestBody?.model).toBe('openai/gpt-oss-20b');
  });

  it('never calls the provider and fails safe without an API key', async () => {
    let fetchCalls = 0;
    const fetcher = async (): Promise<Response> => {
      fetchCalls += 1;
      return response({ choices: [{ message: { content: '{}' } }] });
    };
    const buildAdapter = (): GroqGroundedSynthesis =>
      new GroqGroundedSynthesis('', 'model', 'https://example.test/chat/completions', fetcher);
    expect(buildAdapter).toThrow(GroundedSynthesisError);
    expect(fetchCalls).toBe(0);
  });

  it('preserves safe provider diagnostics without leaking the API key', async () => {
    const adapter = new GroqGroundedSynthesis('secret-key', 'model', 'https://example.test/chat/completions', async () => response({
      error: {
        code: 'model_not_found',
        message: 'The model `secret-key` does not exist or you do not have access to it.',
        type: 'invalid_request_error',
      },
    }, 404));

    await expect(adapter.generate('question', context)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: 'The AI provider returned HTTP 404; code model_not_found; message The model `[REDACTED]` does not exist or you do not have access to it.; type invalid_request_error.',
    });
  });

  it('preserves the HTTP status when a non-2xx body is not JSON', async () => {
    const adapter = new GroqGroundedSynthesis('secret-key', 'model', 'https://example.test/chat/completions', async () => rawResponse('not-json', 503));

    await expect(adapter.generate('question', context)).rejects.toMatchObject({
      code: 'AI_UNAVAILABLE',
      message: 'The AI provider returned HTTP 503; the error body could not be interpreted as JSON.',
    });
  });

  it('maps invalid model content to AI_MALFORMED_RESPONSE', async () => {
    const adapter = new GroqGroundedSynthesis('key', 'model', 'https://example.test/chat/completions', async () => response({ choices: [{ message: { content: 'not json' } }] }));
    await expect(adapter.generate('question', context)).rejects.toMatchObject({ code: 'AI_MALFORMED_RESPONSE' });
  });

  it('maps a missing message content to AI_MALFORMED_RESPONSE', async () => {
    const adapter = new GroqGroundedSynthesis('key', 'model', 'https://example.test/chat/completions', async () => response({ choices: [{ message: { content: null } }] }));
    await expect(adapter.generate('question', context)).rejects.toMatchObject({ code: 'AI_MALFORMED_RESPONSE' });
  });
});
