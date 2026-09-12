import Fastify, { type FastifyInstance } from 'fastify';
import { InvalidKnowledgeItemError } from '../domain/knowledge-item.js';
import { KnowledgeItemNotFoundError, PersistenceConsistencyError, RevisionConflictError } from '../domain/errors.js';
import type { KnowledgeItemService } from '../application/knowledge-item-service.js';
import type { AskQuestionService } from '../application/ask-question-service.js';
import type { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';

interface IdParams { id: string; }
interface SearchQuerystring { q?: string; limit?: string; }
interface CreateBody { title?: unknown; content?: unknown; status?: unknown; sourceReference?: unknown; }
interface UpdateBody extends CreateBody { revision?: unknown; }
interface AskBody { question?: unknown; }
interface ErrorResponse { error: string; message: string; context?: unknown; }

export interface AppDependencies {
  readonly knowledgeItems: KnowledgeItemService;
  readonly repository: KnowledgeItemRepository;
  readonly retrieval: SqliteRetrievalService;
  readonly askQuestion?: AskQuestionService;
}

export function buildApp(dependencies: AppDependencies): FastifyInstance {
  const app = Fastify({ logger: false });

  app.setErrorHandler((error, _request, reply) => {
    const response = toErrorResponse(error);
    return reply.code(response.statusCode).send(response.body);
  });

  app.post<{ Body: CreateBody }>('/knowledge-items', async (request, reply) => {
    const input = parseCreateBody(request.body);
    const item = dependencies.knowledgeItems.create(input);
    return reply.code(201).send({ item });
  });

  app.get<{ Querystring: SearchQuerystring }>('/knowledge-items', async (request) => {
    const limit = parseLimit(request.query.limit);
    const query = request.query.q?.trim() ?? '';
    if (query.length === 0) return { items: dependencies.knowledgeItems.list() };
    const context = dependencies.retrieval.search({ query, corpus: 'user', limit });
    const items = context.fragments
      .map((fragment) => dependencies.repository.getById(fragment.knowledgeItemId))
      .filter((item, index, all): item is NonNullable<typeof item> => item !== null && all.findIndex((candidate) => candidate?.id === item.id) === index);
    return { items, context };
  });

  app.get<{ Params: IdParams }>('/knowledge-items/:id', async (request) => ({ item: dependencies.knowledgeItems.get(request.params.id) }));

  app.patch<{ Params: IdParams; Body: UpdateBody }>('/knowledge-items/:id', async (request) => {
    const input = parseUpdateBody(request.body);
    return { item: dependencies.knowledgeItems.update(request.params.id, input.revision, input.changes) };
  });

  app.delete<{ Params: IdParams; Querystring: { revision?: string } }>('/knowledge-items/:id', async (request, reply) => {
    dependencies.knowledgeItems.delete(request.params.id, parseRevision(request.query.revision));
    return reply.code(204).send();
  });

  app.post<{ Body: AskBody }>('/ask', async (request, reply) => {
    if (!dependencies.askQuestion) {
      return reply.code(503).send({ error: 'AI_UNAVAILABLE', message: 'No AI provider is configured.' });
    }
    const question = parseQuestion(request.body);
    const result = await dependencies.askQuestion.ask(question, 'user');
    if (result.ok) return reply.code(200).send(result.response);
    const statusCode = result.code === 'AI_UNAVAILABLE' ? 503 : result.code === 'NO_RELEVANT_EVIDENCE' ? 422 : 502;
    return reply.code(statusCode).send({ error: result.code, message: result.message, context: result.context });
  });

  return app;
}

function parseCreateBody(body: CreateBody): { title: string; content: string; status?: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED'; sourceReference?: string | null } {
  if (typeof body.title !== 'string' || typeof body.content !== 'string') throw new InvalidKnowledgeItemError('title and content are required strings');
  if (body.status !== undefined && body.status !== 'ACTIVE' && body.status !== 'SUPERSEDED' && body.status !== 'ARCHIVED') throw new InvalidKnowledgeItemError('status is invalid');
  if (body.sourceReference !== undefined && body.sourceReference !== null && typeof body.sourceReference !== 'string') throw new InvalidKnowledgeItemError('sourceReference must be a string or null');
  return { title: body.title, content: body.content, status: body.status as 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED' | undefined, sourceReference: body.sourceReference as string | null | undefined };
}

function parseUpdateBody(body: UpdateBody): { revision: number; changes: { title?: string; content?: string; status?: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED'; sourceReference?: string | null } } {
  const revision = parseRevision(body.revision);
  const changes: { title?: string; content?: string; status?: 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED'; sourceReference?: string | null } = {};
  if (body.title !== undefined) changes.title = requireString(body.title, 'title');
  if (body.content !== undefined) changes.content = requireString(body.content, 'content');
  if (body.status !== undefined) {
    if (body.status !== 'ACTIVE' && body.status !== 'SUPERSEDED' && body.status !== 'ARCHIVED') throw new InvalidKnowledgeItemError('status is invalid');
    changes.status = body.status;
  }
  if (body.sourceReference !== undefined) {
    if (body.sourceReference !== null && typeof body.sourceReference !== 'string') throw new InvalidKnowledgeItemError('sourceReference must be a string or null');
    changes.sourceReference = body.sourceReference;
  }
  return { revision, changes };
}

function parseQuestion(body: AskBody): string {
  if (typeof body.question !== 'string' || body.question.trim().length === 0) throw new InvalidKnowledgeItemError('question must be a non-empty string');
  return body.question;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new InvalidKnowledgeItemError(`${field} must be a string`);
  return value;
}

function parseRevision(value: unknown): number {
  const revision = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(revision) || revision < 1) throw new InvalidKnowledgeItemError('revision must be a positive integer');
  return revision;
}

function parseLimit(value: unknown): number {
  if (value === undefined) return 8;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new InvalidKnowledgeItemError('limit must be an integer between 1 and 50');
  return limit;
}

function toErrorResponse(error: unknown): { statusCode: number; body: ErrorResponse } {
  if (error instanceof KnowledgeItemNotFoundError) return { statusCode: 404, body: { error: 'NOT_FOUND', message: error.message } };
  if (error instanceof RevisionConflictError) return { statusCode: 409, body: { error: 'REVISION_CONFLICT', message: error.message } };
  if (error instanceof InvalidKnowledgeItemError) return { statusCode: 400, body: { error: 'INVALID_REQUEST', message: error.message } };
  if (error instanceof PersistenceConsistencyError) return { statusCode: 500, body: { error: 'PERSISTENCE_CONSISTENCY', message: 'Persistence could not remain consistent.' } };
  return { statusCode: 500, body: { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' } };
}
