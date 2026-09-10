import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';
import { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import { evaluationQuestions } from './questions.js';

export function createEvaluationRetrieval(repository: KnowledgeItemRepository): SqliteRetrievalService {
  return new SqliteRetrievalService(repository, () => '2025-01-01T00:00:00.000Z');
}

export function evaluateQuestion(repository: KnowledgeItemRepository, questionId: string) {
  const question = evaluationQuestions.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error(`Unknown evaluation question: ${questionId}`);
  const retrieval = createEvaluationRetrieval(repository);
  const context = retrieval.search({ query: question.question, corpus: 'evaluation', limit: 8 });
  return { question, context };
}
