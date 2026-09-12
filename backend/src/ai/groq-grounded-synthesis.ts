import type { RetrievalContext } from '../retrieval/types.js';
import { GroundedSynthesisError, type GroundedDraft, type GroundedSynthesis } from './grounded-synthesis.js';

interface GroqChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
}

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
const DEFAULT_GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Expone el contenido del prompt de grounding (gemini-grounded-synthesis.ts) para reutilizarlo
// íntegro en Groq: la única diferencia entre proveedores debe ser el proveedor/modelo.
export function buildGroundingPrompt(question: string, context: RetrievalContext) {
  const systemInstruction = 'Answer only from the supplied retrieval context. Use exact evidenceQuote text for SUPPORTED claims. Mark interpretation as INFERRED. If the context is insufficient, use INSUFFICIENT and abstain. Never invent evidence IDs. Return only the requested JSON object.';
  const userInput = JSON.stringify({
    question,
    retrievalContext: context.fragments.map((fragment) => ({
      evidenceId: fragment.evidenceId,
      knowledgeItemId: fragment.knowledgeItemId,
      revision: fragment.itemRevision,
      status: fragment.status,
      provenance: fragment.provenance,
      text: fragment.text,
    })),
  });
  return { systemInstruction, userInput };
}

export class GroqGroundedSynthesis implements GroundedSynthesis {
  public constructor(
    private readonly apiKey: string,
    private readonly model = DEFAULT_GROQ_MODEL,
    private readonly endpoint = DEFAULT_GROQ_ENDPOINT,
    private readonly fetcher: typeof fetch = fetch,
  ) {
    // Sin credencial no hay llamada posible: fallar de forma segura antes de contactar al provider.
    if (apiKey.trim().length === 0) {
      throw new GroundedSynthesisError('AI_UNAVAILABLE', 'No AI provider is configured.');
    }
  }

  public async generate(question: string, context: RetrievalContext): Promise<GroundedDraft> {
    // El objeto schema se construye por llamada porque JSON Schema no permite `null`
    // como valor de propiedad: la nulabilidad se expresa con tipos union ['string', 'null'].
    const groundedDraftSchema = {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        claims: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              text: { type: 'string' },
              proposedSupport: { type: 'string', enum: ['SUPPORTED', 'INFERRED', 'INSUFFICIENT'] },
              evidenceIds: { type: 'array', items: { type: 'string' } },
              evidenceQuote: { type: ['string', 'null'] },
            },
            required: ['id', 'text', 'proposedSupport', 'evidenceIds', 'evidenceQuote'],
            additionalProperties: false,
          },
        },
        proposedEvidenceCondition: { type: ['string', 'null'], enum: ['CLEAR', 'CONTEXTUAL_DIVERGENCE', null] },
      },
      required: ['answer', 'claims', 'proposedEvidenceCondition'],
      additionalProperties: false,
    } as const;

    const { systemInstruction, userInput } = buildGroundingPrompt(question, context);
    let response: Response;
    try {
      response = await this.fetcher(this.endpoint, {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: userInput },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'grounded_draft',
              strict: true,
              schema: groundedDraftSchema,
            },
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

    let payload: GroqChatCompletionResponse;
    try {
      payload = (await response.json()) as GroqChatCompletionResponse;
    } catch {
      throw new GroundedSynthesisError('AI_MALFORMED_RESPONSE', 'The AI provider returned invalid JSON.');
    }

    const content = payload.choices?.[0]?.message?.content;
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
  if (typeof providerError.code === 'string' && providerError.code.length > 0) {
    diagnostics.push(`code ${sanitizeDiagnosticString(providerError.code, apiKey)}`);
  }
  if (typeof providerError.message === 'string' && providerError.message.length > 0) {
    diagnostics.push(`message ${sanitizeDiagnosticString(providerError.message, apiKey)}`);
  }
  if (typeof providerError.type === 'string' && providerError.type.length > 0) {
    diagnostics.push(`type ${sanitizeDiagnosticString(providerError.type, apiKey)}`);
  }

  return `The AI provider returned ${diagnostics.join('; ')}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeDiagnosticString(value: string, apiKey: string): string {
  return apiKey.length > 0 ? value.replaceAll(apiKey, '[REDACTED]') : value;
}
