export interface EvaluationQuestion {
  readonly id: string;
  readonly question: string;
  readonly expectedItemIds: readonly string[];
  readonly expectedStatusByItem?: Readonly<Record<string, string>>;
  readonly shouldHaveRelevantEvidence: boolean;
}

export const evaluationQuestions: readonly EvaluationQuestion[] = [
  { id: 'Q1', question: 'Why was a global store avoided for all UI state?', expectedItemIds: ['KI-01', 'KI-02'], shouldHaveRelevantEvidence: true },
  { id: 'Q2', question: 'What problems appear when state must coordinate multiple parts of an application?', expectedItemIds: ['KI-01', 'KI-03', 'KI-04'], shouldHaveRelevantEvidence: true },
  { id: 'Q3', question: 'How should an architectural decision related to state and performance be validated?', expectedItemIds: ['KI-08', 'KI-09'], shouldHaveRelevantEvidence: true },
  { id: 'Q4', question: 'What general principle seems to guide decisions about centralizing state?', expectedItemIds: ['KI-01', 'KI-02', 'KI-03', 'KI-04'], shouldHaveRelevantEvidence: true },
  { id: 'Q5', question: 'How was the application migrated from SSR to CSR?', expectedItemIds: ['KI-06', 'KI-07'], shouldHaveRelevantEvidence: false },
  { id: 'Q6', question: 'What is the recommendation for managing state in a multi-step flow?', expectedItemIds: ['KI-03', 'KI-04'], shouldHaveRelevantEvidence: true },
  { id: 'Q7', question: 'Should SSR be the default option for every serious application?', expectedItemIds: ['KI-06', 'KI-07'], expectedStatusByItem: { 'KI-07': 'SUPERSEDED' }, shouldHaveRelevantEvidence: true },
  { id: 'Q8', question: 'What was observed after lazy loading the routes?', expectedItemIds: ['KI-08'], shouldHaveRelevantEvidence: true },
  { id: 'Q9', question: 'Which database was selected for the platform?', expectedItemIds: [], shouldHaveRelevantEvidence: false },
];
