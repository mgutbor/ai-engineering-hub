import { AskQuestionService } from '../application/ask-question-service.js';
import { DEFAULT_GEMINI_MODEL, GeminiGroundedSynthesis } from '../ai/gemini-grounded-synthesis.js';
import type { GroundedResponse } from '../grounding/grounded-response.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import type { KnowledgeItemId } from '../domain/knowledge-item.js';
import type { RetrievalQuery, RetrievalService } from '../retrieval/retrieval-service.js';
import type { RetrievalContext } from '../retrieval/types.js';
import { evaluationQuestions, type EvaluationQuestion } from './questions.js';
import { createEvaluationRetrieval } from './retrieval-evaluation.js';

const SMOKE_QUESTION_IDS = ['Q1', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'] as const;

interface SmokeMetrics {
  geminiInvocationCount: number;
}

/** Registra el contexto producido por el retrieval real sin alterar su comportamiento. */
class RecordingRetrievalService implements RetrievalService {
  public lastContext: RetrievalContext | undefined;

  public constructor(private readonly delegate: RetrievalService) {}

  public search(query: RetrievalQuery): RetrievalContext {
    this.lastContext = this.delegate.search(query);
    return this.lastContext;
  }

  public isContextCurrent(context: RetrievalContext): boolean {
    return this.delegate.isContextCurrent(context);
  }

  public isFragmentCurrent(knowledgeItemId: KnowledgeItemId, revision: number, corpus: 'user' | 'evaluation'): boolean {
    return this.delegate.isFragmentCurrent(knowledgeItemId, revision, corpus);
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required to run the Gemini evaluation smoke test.');
    process.exitCode = 1;
    return;
  }

  const database = createDatabase();
  const repository = new SqliteKnowledgeItemRepository(database);
  const retrieval = new RecordingRetrievalService(createEvaluationRetrieval(repository));
  const metrics: SmokeMetrics = { geminiInvocationCount: 0 };
  const realFetch: typeof fetch = async (input, init) => {
    metrics.geminiInvocationCount += 1;
    return fetch(input, init);
  };
  const synthesis = new GeminiGroundedSynthesis(
    apiKey,
    process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
    undefined,
    realFetch,
  );
  const service = new AskQuestionService(retrieval, synthesis, repository);
  const failures: string[] = [];

  try {
    for (const questionId of SMOKE_QUESTION_IDS) {
      retrieval.lastContext = undefined;
      const question = getQuestion(questionId);
      const previousInvocationCount = metrics.geminiInvocationCount;
      const failure = await runQuestion(question, service, retrieval, metrics, previousInvocationCount);
      if (failure) failures.push(failure);
    }
  } finally {
    closeDatabase(database);
  }

  if (failures.length > 0) {
    console.error(`\nSmoke test failed: ${failures.join('; ')}`);
    process.exitCode = 1;
  }
}

async function runQuestion(
  question: EvaluationQuestion,
  service: AskQuestionService,
  retrieval: RecordingRetrievalService,
  metrics: SmokeMetrics,
  previousInvocationCount: number,
): Promise<string | undefined> {
  let result;

  try {
    result = await service.ask(question.question, 'evaluation');
  } catch (error: unknown) {
    console.log(`\n[${question.id}] ${question.question}`);
    printRetrieval(retrieval.lastContext);
    console.log(`Gemini invoked: ${metrics.geminiInvocationCount > previousInvocationCount ? 'YES' : 'NO'}`);
    console.log(`Final result: ERROR (${error instanceof Error ? error.message : 'unexpected error'})`);
    return `${question.id}: unexpected execution error`;
  }

  const context = result.ok ? retrieval.lastContext : result.context;
  const invoked = metrics.geminiInvocationCount > previousInvocationCount;

  console.log(`\n[${question.id}] ${question.question}`);
  printRetrieval(context);
  console.log(`Gemini invoked: ${invoked ? 'YES' : 'NO'}`);

  if (!context) {
    console.log('Final result: ERROR (retrieval context was not observed)');
    return `${question.id}: retrieval context was not observed`;
  }

  if (result.ok) {
    printResponse(result.response);
  } else {
    console.log(`Final result: ERROR (${result.code})`);
    console.log(`Error: ${result.message}`);
    printContext(result.context);
  }

  if (question.id === 'Q9') {
    if (invoked || context.fragments.length !== 0 || !result.ok || result.response.claims[0]?.support !== 'INSUFFICIENT') {
      return 'Q9: expected retrieval without evidence, INSUFFICIENT and no Gemini invocation';
    }
    return undefined;
  }

  if (!invoked) return `${question.id}: Gemini was not invoked`;
  if (!result.ok) return `${question.id}: flow ended with ${result.code}`;
  return undefined;
}

function getQuestion(questionId: (typeof SMOKE_QUESTION_IDS)[number]): EvaluationQuestion {
  const question = evaluationQuestions.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error(`Unknown evaluation question: ${questionId}`);
  return question;
}

function printRetrieval(context: RetrievalContext | undefined): void {
  console.log(`Retrieval corpus: ${context?.corpus ?? 'unavailable'}`);
  console.log(`Retrieved fragments: ${context?.fragments.length ?? 'unavailable'}`);
  console.log(`Retrieved Knowledge Items: ${context ? formatKnowledgeItemIds(context) : 'unavailable'}`);
}

function formatKnowledgeItemIds(context: RetrievalContext): string {
  const ids = [...new Set(context.fragments.map((fragment) => fragment.knowledgeItemId))];
  return ids.length > 0 ? ids.join(', ') : 'none';
}

function printResponse(response: GroundedResponse): void {
  const supports = [...new Set(response.claims.map((claim) => claim.support))];
  console.log(`Final result: ${supports.join(', ')}`);
  console.log(`Evidence condition: ${response.evidenceCondition}`);
  for (const claim of response.claims) {
    const evidence = claim.evidence.map((item) => `${item.evidenceId} → ${item.knowledgeItemId} (${item.status})`).join(', ') || 'none';
    console.log(`Claim ${claim.id}: ${claim.support}; evidence: ${evidence}`);
    if (claim.reason) console.log(`Reason: ${claim.reason}`);
  }
}

function printContext(context: RetrievalContext): void {
  console.log(`Context evidence: ${context.fragments.map((fragment) => `${fragment.evidenceId} → ${fragment.knowledgeItemId}`).join(', ') || 'none'}`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Gemini evaluation smoke test failed.');
  process.exitCode = 1;
});
