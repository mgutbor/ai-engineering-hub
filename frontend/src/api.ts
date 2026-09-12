export type KnowledgeItemStatus = 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED';
export type KnowledgeItemProvenance = 'human-authored' | 'imported';

export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  status: KnowledgeItemStatus;
  provenance: KnowledgeItemProvenance;
  sourceReference: string | null;
}

export interface RetrievalFragment {
  evidenceId: string;
  knowledgeItemId: string;
  itemRevision: number;
  text: string;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
  status: KnowledgeItemStatus;
  provenance: KnowledgeItemProvenance;
  sourceReference: string | null;
}

export interface RetrievalContext {
  contextId: string;
  query: string;
  corpus: 'user' | 'evaluation';
  fragments: RetrievalFragment[];
  createdAt: string;
}

interface ItemsResponse {
  items: KnowledgeItem[];
  context?: RetrievalContext;
}

interface ItemResponse {
  item: KnowledgeItem;
}

interface ErrorResponse {
  error: string;
  message: string;
  context?: RetrievalContext;
}

export interface Evidence {
  evidenceId: string;
  fragment: string;
  knowledgeItemId: string;
  knowledgeItemTitle: string;
  revision: number;
  status: KnowledgeItemStatus;
  provenance: KnowledgeItemProvenance;
  sourceReference: string | null;
  paragraphIndex: number;
  startOffset: number;
  endOffset: number;
}

export type ClaimSupport = 'SUPPORTED' | 'INFERRED' | 'INSUFFICIENT';
export type EvidenceCondition = 'CLEAR' | 'CONTEXTUAL_DIVERGENCE';

export interface GroundedClaim {
  id: string;
  text: string;
  support: ClaimSupport;
  evidence: Evidence[];
  reason?: string;
}

export interface GroundedResponse {
  answer: string;
  claims: GroundedClaim[];
  evidenceCondition: EvidenceCondition;
  contextId: string;
}

export interface AskFailure {
  error: string;
  message: string;
  context?: RetrievalContext;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  const body = response.status === 204 ? undefined : await response.json();
  if (!response.ok) {
    const error = body as ErrorResponse;
    const failure = new Error(error.message) as Error & { code?: string; context?: RetrievalContext };
    failure.code = error.error;
    failure.context = error.context;
    throw failure;
  }
  return body as T;
}

export function listKnowledgeItems(query = ''): Promise<ItemsResponse> {
  const search = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  return request<ItemsResponse>(`/knowledge-items${search}`);
}

export function getKnowledgeItem(id: string): Promise<ItemResponse> {
  return request<ItemResponse>(`/knowledge-items/${encodeURIComponent(id)}`);
}

export function createKnowledgeItem(input: { title: string; content: string; status: KnowledgeItemStatus; sourceReference: string | null }): Promise<ItemResponse> {
  return request<ItemResponse>('/knowledge-items', { method: 'POST', body: JSON.stringify(input) });
}

export function updateKnowledgeItem(id: string, input: { revision: number; title: string; content: string; status: KnowledgeItemStatus; sourceReference: string | null }): Promise<ItemResponse> {
  return request<ItemResponse>(`/knowledge-items/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteKnowledgeItem(id: string, revision: number): Promise<void> {
  return request<void>(`/knowledge-items/${encodeURIComponent(id)}?revision=${revision}`, { method: 'DELETE' });
}

export function askQuestion(question: string): Promise<GroundedResponse> {
  return request<GroundedResponse>('/ask', { method: 'POST', body: JSON.stringify({ question }) });
}
