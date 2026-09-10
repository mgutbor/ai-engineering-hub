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
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  });
  if (!response.ok) {
    const error = (await response.json()) as ErrorResponse;
    throw new Error(error.message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
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
