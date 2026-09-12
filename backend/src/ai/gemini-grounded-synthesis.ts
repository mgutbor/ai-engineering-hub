import type { RetrievalContext } from '../retrieval/types.js';
import { GroundedSynthesisError, type GroundedDraft, type GroundedSynthesis } from './grounded-synthesis.js';

interface GeminiGenerateContentResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

export class GeminiGroundedSynthesis implements GroundedSynthesis {
  public constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_GEMINI_MODEL,
    private readonly endpoint = DEFAULT_GEMINI_ENDPOINT,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  public async generate(question: string, context: RetrievalContext): Promise<GroundedDraft> {
    const endpoint = `${this.endpoint}/${encodeURIComponent(this.model)}:generateContent`;
    let response: Response;
    try {
      response = await this.fetcher(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': this.apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: 'Answer only from the supplied retrieval context. Use exact evidenceQuote text for SUPPORTED claims. Mark interpretation as INFERRED. If the context is insufficient, use INSUFFICIENT and abstain. Never invent evidence IDs. Return only the requested JSON object.',
            }],
          },
          contents: [{
            role: 'user',
            parts: [{
              text: JSON.stringify({
                question,
                retrievalContext: context.fragments.map((fragment) => ({
                  evidenceId: fragment.evidenceId,
                  knowledgeItemId: fragment.knowledgeItemId,
                  revision: fragment.itemRevision,
                  status: fragment.status,
                  provenance: fragment.provenance,
                  text: fragment.text,
                })),
              }),
            }],
          }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: groundedDraftSchema,
          },
        }),
      });
    } catch {
      throw new GroundedSynthesisError('AI_UNAVAILABLE', 'The AI provider could not be reached.');
    }

    if (!response.ok) {
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new GroundedSynthesisError(
          'AI_UNAVAILABLE',
          `The AI provider returned HTTP ${response.status}; the error body could not be interpreted as JSON.`,
        );
      }

      throw new GroundedSynthesisError(
        'AI_UNAVAILABLE',
        formatProviderError(response.status, payload, this.apiKey),
      );
    }

    let payload: GeminiGenerateContentResponse;
    try {
      payload = (await response.json()) as GeminiGenerateContentResponse;
    } catch {
      throw new GroundedSynthesisError('AI_MALFORMED_RESPONSE', 'The AI provider returned invalid JSON.');
    }

    const content = payload.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new GroundedSynthesisError('AI_MALFORMED_RESPONSE', 'The AI provider returned no grounded draft content.');
    }

    try {
      return JSON.parse(content) as GroundedDraft;
    } catch {
      throw new GroundedSynthesisError('AI_MALFORMED_RESPONSE', 'The AI provider returned a non-JSON grounded draft.');
    }
  }
}

function formatProviderError(httpStatus: number, payload: unknown, apiKey: string): string {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return `The AI provider returned HTTP ${httpStatus}; the JSON error body did not contain recognized diagnostics.`;
  }

  const providerError = payload.error;
  const diagnostics = [`HTTP ${httpStatus}`];
  if (typeof providerError.status === 'string' && providerError.status.length > 0) {
    diagnostics.push(`status ${sanitizeDiagnosticString(providerError.status, apiKey)}`);
  }
  if (typeof providerError.message === 'string' && providerError.message.length > 0) {
    diagnostics.push(`message ${sanitizeDiagnosticString(providerError.message, apiKey)}`);
  }
  if (providerError.details !== undefined) {
    diagnostics.push(`details ${serializeDiagnosticValue(providerError.details, apiKey)}`);
  }

  return `The AI provider returned ${diagnostics.join('; ')}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function serializeDiagnosticValue(value: unknown, apiKey: string): string {
  try {
    return JSON.stringify(sanitizeDiagnosticValue(value, apiKey));
  } catch {
    return '[unserializable]';
  }
}

function sanitizeDiagnosticValue(value: unknown, apiKey: string, propertyName?: string): unknown {
  if (propertyName && /(api.?key|authorization|credential|password|secret|token)/i.test(propertyName)) return '[REDACTED]';
  if (typeof value === 'string') return sanitizeDiagnosticString(value, apiKey);
  if (Array.isArray(value)) return value.map((entry) => sanitizeDiagnosticValue(entry, apiKey));
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, sanitizeDiagnosticValue(entry, apiKey, key)]));
  }
  return value;
}

function sanitizeDiagnosticString(value: string, apiKey: string): string {
  return apiKey.length > 0 ? value.replaceAll(apiKey, '[REDACTED]') : value;
}

const groundedDraftSchema = {
  type: 'OBJECT',
  propertyOrdering: ['answer', 'claims', 'proposedEvidenceCondition'],
  properties: {
    answer: { type: 'STRING' },
    claims: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        propertyOrdering: ['id', 'text', 'proposedSupport', 'evidenceIds', 'evidenceQuote'],
        properties: {
          id: { type: 'STRING' },
          text: { type: 'STRING' },
          proposedSupport: { type: 'STRING', enum: ['SUPPORTED', 'INFERRED', 'INSUFFICIENT'] },
          evidenceIds: { type: 'ARRAY', items: { type: 'STRING' } },
          evidenceQuote: { type: 'STRING', nullable: true },
        },
        required: ['id', 'text', 'proposedSupport', 'evidenceIds'],
      },
    },
    proposedEvidenceCondition: {
      type: 'STRING',
      enum: ['CLEAR', 'CONTEXTUAL_DIVERGENCE'],
      nullable: true,
    },
  },
  required: ['answer', 'claims'],
} as const;
