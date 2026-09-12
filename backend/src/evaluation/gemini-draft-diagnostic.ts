import { GeminiGroundedSynthesis, DEFAULT_GEMINI_MODEL } from '../ai/gemini-grounded-synthesis.js';
import { GroundedSynthesisError } from '../ai/grounded-synthesis.js';
import type { GroundedDraft } from '../ai/grounded-synthesis.js';
import { createDatabase, closeDatabase } from '../persistence/sqlite-database.js';
import { SqliteKnowledgeItemRepository } from '../persistence/sqlite-knowledge-item-repository.js';
import type { KnowledgeItemRepository } from '../persistence/knowledge-item-repository.js';
import { createEvaluationRetrieval } from './retrieval-evaluation.js';
import type { SqliteRetrievalService } from '../retrieval/sqlite-retrieval-service.js';
import { evaluationQuestions } from './questions.js';

// Ejecución diagnóstica de solo lectura: llama a Gemini directamente y compara el GroundedDraft
// con los fragmentos reales recuperados. No ejecuta GroundedValidator ni modifica código.

const DIAGNOSTIC_QUESTION_IDS = ['Q1', 'Q5', 'Q8'] as const;
type DiagnosticQuestionId = (typeof DIAGNOSTIC_QUESTION_IDS)[number];

function getQuestion(questionId: DiagnosticQuestionId) {
  const question = evaluationQuestions.find((candidate) => candidate.id === questionId);
  if (!question) throw new Error(`Unknown evaluation question: ${questionId}`);
  return question;
}

function truncate(value: string, maxLength = 96): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}…`;
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is required to run this diagnostic.');
    process.exitCode = 1;
    return;
  }

  const database = createDatabase();
  const repository: KnowledgeItemRepository = new SqliteKnowledgeItemRepository(database);
  const retrieval: SqliteRetrievalService = createEvaluationRetrieval(repository);
  const synthesis = new GeminiGroundedSynthesis(
    apiKey,
    process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
  );

  try {
    for (const questionId of DIAGNOSTIC_QUESTION_IDS) {
      const failure = await runQuestion(questionId, retrieval, synthesis);
      if (failure) process.exitCode = 1;
    }
  } finally {
    closeDatabase(database);
  }
}

async function runQuestion(
  questionId: DiagnosticQuestionId,
  retrieval: SqliteRetrievalService,
  synthesis: GeminiGroundedSynthesis,
): Promise<string | undefined> {
  const question = getQuestion(questionId);

  console.log('\n' + '='.repeat(78));
  console.log(`[${question.id}] ${question.question}`);
  console.log(`Expected items: ${question.expectedItemIds.join(', ')}`);

  // 1) Retrieval real (mismo corpus congelado que usa el smoke test).
  const context = retrieval.search({ query: question.question, corpus: 'evaluation', limit: 8 });
  console.log(`Context ID: ${context.contextId}`);
  console.log(`Fragments retrieved: ${context.fragments.length}`);

  const fragmentById = new Map(context.fragments.map((fragment) => [fragment.evidenceId, fragment]));
  for (const fragment of context.fragments) {
    console.log(
      `  - ${fragment.evidenceId} → ${fragment.knowledgeItemId} (rev ${fragment.itemRevision}, ${fragment.status})`,
    );
    console.log(`    "${truncate(fragment.text, 140)}"`);
  }

  // 2) Llamada directa a GeminiGroundedSynthesis.generate() — SIN GroundedValidator.
  let draft: GroundedDraft;
  try {
    draft = await synthesis.generate(question.question, context);
  } catch (error) {
    if (error instanceof GroundedSynthesisError) {
      console.log(`Gemini call FAILED: ${error.code} — ${error.message}`);
      return `${question.id}: synthesis failed (${error.code})`;
    }
    throw error;
  }

  // 3) Draft crudo de Gemini (GroundedDraft), antes de GroundedValidator.
  console.log('\nGemini GroundedDraft (raw, pre-validator):');
  console.log(`  answer: ${truncate(draft.answer, 200)}`);
  console.log(`  proposedEvidenceCondition: ${draft.proposedEvidenceCondition ?? '(absent)'}`);

  for (const claim of draft.claims) {
    console.log(`\n  Claim ${claim.id} [${claim.proposedSupport}]`);
    console.log(`    text: ${truncate(claim.text, 200)}`);
    const resolvedIds = claim.evidenceIds
      .map((evidenceId) => {
        const fragment = fragmentById.get(evidenceId);
        return fragment ? `${evidenceId} → ${fragment.knowledgeItemId}` : `${evidenceId} → NOT IN CONTEXT`;
      })
      .join(', ');
    console.log(`    evidenceIds: ${resolvedIds || '(none)'}`);

    if (claim.evidenceQuote !== undefined && claim.evidenceQuote !== null) {
      const quote = claim.evidenceQuote.trim();
      const exactFragment = context.fragments.find((fragment) => fragment.text === quote);
      const substringMatch = exactFragment !== undefined
        || context.fragments.some((fragment) => fragment.text.includes(quote));
      console.log(`    evidenceQuote: "${truncate(quote, 160)}"`);
      console.log(`      exact fragment match: ${exactFragment ? exactFragment.evidenceId : 'no'}`);
      console.log(`      substring of a fragment: ${substringMatch ? 'yes' : 'no'}`);
    } else {
      console.log(`    evidenceQuote: (absent)`);
    }
  }

  return undefined;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Gemini draft diagnostic failed.');
  process.exitCode = 1;
});
