import { FormEvent, useEffect, useState } from 'react';
import {
  createKnowledgeItem,
  deleteKnowledgeItem,
  getKnowledgeItem,
  listKnowledgeItems,
  type KnowledgeItem,
  type KnowledgeItemStatus,
  type RetrievalContext,
  updateKnowledgeItem,
  askQuestion,
  type GroundedResponse,
} from './api';
import './styles.css';

const emptyDraft = { title: '', content: '', status: 'ACTIVE' as KnowledgeItemStatus, sourceReference: '' };

export function App() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [context, setContext] = useState<RetrievalContext | undefined>();
  const [selected, setSelected] = useState<KnowledgeItem | null>(null);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<GroundedResponse | null>(null);
  const [asking, setAsking] = useState(false);

  async function loadItems(nextQuery = query) {
    setLoading(true);
    setError(null);
    try {
      const result = await listKnowledgeItems(nextQuery);
      setItems(result.items);
      setContext(result.context);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Knowledge Items.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems('');
  }, []);

  function startCreate() {
    setSelected(null);
    setEditing(true);
    setDraft(emptyDraft);
    setError(null);
  }

  async function selectItem(id: string) {
    setError(null);
    try {
      const result = await getKnowledgeItem(id);
      setSelected(result.item);
      setEditing(false);
      setDraft({
        title: result.item.title,
        content: result.item.content,
        status: result.item.status,
        sourceReference: result.item.sourceReference ?? '',
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load Knowledge Item.');
    }
  }

  function editSelected() {
    if (!selected) return;
    setEditing(true);
    setDraft({
      title: selected.title,
      content: selected.content,
      status: selected.status,
      sourceReference: selected.sourceReference ?? '',
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const input = { ...draft, sourceReference: draft.sourceReference.trim() || null };
      const result = selected
        ? await updateKnowledgeItem(selected.id, { ...input, revision: selected.revision })
        : await createKnowledgeItem(input);
      setSelected(result.item);
      setEditing(false);
      setDraft({ ...input, sourceReference: input.sourceReference ?? '' });
      await loadItems(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save Knowledge Item.');
    } finally {
      setSaving(false);
    }
  }

  async function removeSelected() {
    if (!selected || !window.confirm('Delete this Knowledge Item?')) return;
    setError(null);
    try {
      await deleteKnowledgeItem(selected.id, selected.revision);
      setSelected(null);
      setEditing(false);
      setDraft(emptyDraft);
      await loadItems(query);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete Knowledge Item.');
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await loadItems(query);
  }

  async function submitQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setError(null);
    try {
      setAnswer(await askQuestion(question));
    } catch (cause) {
      const failure = cause as Error & { code?: string; context?: RetrievalContext };
      setAnswer(null);
      setError(failure.code === 'AI_UNAVAILABLE' ? 'AI generation is unavailable. Search and evidence inspection remain available.' : failure.message);
      if (failure.context) setContext(failure.context);
    } finally {
      setAsking(false);
    }
  }

  const isAbstention = answer?.claims.some((claim) => claim.support === 'INSUFFICIENT') ?? false;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Evidence-first technical decisions</p>
          <h1>Technical Decision Navigator</h1>
          <p className="intro">AI proposes. The system validates. Evidence remains inspectable.</p>
        </div>
        <button className="primary-button" type="button" onClick={startCreate}>New Knowledge Item</button>
      </header>

      {error && <div className="alert" role="alert">{error}</div>}

      <section className="question-panel panel" aria-labelledby="question-heading">
        <div className="panel-heading"><div><p className="section-kicker">Grounded question</p><h2 id="question-heading">Ask about the corpus</h2></div></div>
        <form className="question-form" onSubmit={submitQuestion}>
          <label htmlFor="question">Question</label>
          <div className="question-row"><input id="question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Why was a global store avoided?" /><button className="primary-button" type="submit" disabled={asking}>{asking ? 'Retrieving…' : 'Ask'}</button></div>
        </form>
        {answer && <div className="answer-block"><div className="answer-condition">{isAbstention ? 'ABSTENTION' : answer.evidenceCondition}</div>{isAbstention ? <p className="answer-condition-note">The corpus did not provide sufficient evidence, so the system did not invent an answer.</p> : answer.evidenceCondition === 'CLEAR' && <p className="answer-condition-note">No evidence divergence detected in the retrieved corpus.</p>}<p className="answer-text">{answer.answer}</p>{answer.claims.map((claim) => <article className="claim-card" key={claim.id}><div className="claim-header"><strong>{claim.support}</strong><span>{claim.text}</span></div>{claim.reason && <p className="muted">{claim.reason}</p>}{claim.evidence.map((evidence) => <button className="answer-evidence" type="button" key={evidence.evidenceId} onClick={() => void selectItem(evidence.knowledgeItemId)}><span>Evidence {evidence.evidenceId}</span><p>{evidence.fragment}</p><small>{evidence.knowledgeItemTitle} · revision {evidence.revision} · {evidence.status} · {evidence.provenance}{evidence.sourceReference && ` · ${evidence.sourceReference}`}</small></button>)}</article>)}</div>}
      </section>

      <div className="workspace">
        <section className="panel list-panel" aria-labelledby="knowledge-heading">
          <div className="panel-heading">
            <div>
              <p className="section-kicker">User corpus</p>
              <h2 id="knowledge-heading">Knowledge Items</h2>
            </div>
            <span className="count">{items.length}</span>
          </div>
          <form className="search-form" onSubmit={submitSearch}>
            <label htmlFor="search">Search text</label>
            <div className="search-row">
              <input id="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="state, SSR, testing…" />
              <button type="submit">Search</button>
            </div>
          </form>
          {loading ? <p className="muted">Loading…</p> : items.length === 0 ? <p className="empty-state">No Knowledge Items found.</p> : (
            <ul className="item-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button className={`item-card ${selected?.id === item.id ? 'selected' : ''}`} type="button" onClick={() => void selectItem(item.id)}>
                    <strong>{item.title}</strong>
                    <span>{item.status} · revision {item.revision}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {context && <p className="retrieval-note">Retrieved {context.fragments.length} inspectable fragment{context.fragments.length === 1 ? '' : 's'}.</p>}
        </section>

        <section className="panel detail-panel" aria-labelledby="detail-heading">
          {editing ? (
            <form onSubmit={submit}>
              <div className="panel-heading"><div><p className="section-kicker">Source of record</p><h2 id="detail-heading">{selected ? 'Edit Knowledge Item' : 'Create Knowledge Item'}</h2></div></div>
              <label htmlFor="title">Title</label>
              <input id="title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} required />
              <label htmlFor="content">Content</label>
              <textarea id="content" rows={12} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} required />
              <label htmlFor="status">Status</label>
              <select id="status" value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as KnowledgeItemStatus })}>
                <option value="ACTIVE">ACTIVE</option><option value="SUPERSEDED">SUPERSEDED</option><option value="ARCHIVED">ARCHIVED</option>
              </select>
              <label htmlFor="sourceReference">Source reference <span className="optional">optional</span></label>
              <input id="sourceReference" value={draft.sourceReference} onChange={(event) => setDraft({ ...draft, sourceReference: event.target.value })} />
              <div className="button-row"><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button><button type="button" onClick={() => setEditing(false)}>Cancel</button></div>
            </form>
          ) : selected ? (
            <>
              <div className="panel-heading"><div><p className="section-kicker">Knowledge Item</p><h2 id="detail-heading">{selected.title}</h2></div><button type="button" onClick={editSelected}>Edit</button></div>
              <div className="metadata"><span className={`status status-${selected.status.toLowerCase()}`}>{selected.status}</span><span>revision {selected.revision}</span><span>{selected.provenance}</span>{selected.sourceReference && <span>{selected.sourceReference}</span>}</div>
              <p className="content-display">{selected.content}</p>
              <dl className="dates"><div><dt>Created</dt><dd>{formatDate(selected.createdAt)}</dd></div><div><dt>Updated</dt><dd>{formatDate(selected.updatedAt)}</dd></div></dl>
              <div className="evidence-section"><h3>Evidence inspection</h3><p className="muted">Fragments returned by deterministic text search appear here. Each fragment is linked to the original Knowledge Item.</p>{context?.fragments.filter((fragment) => fragment.knowledgeItemId === selected.id).map((fragment) => <article className="evidence-card" key={fragment.evidenceId}><div className="evidence-label">Evidence {fragment.evidenceId}</div><p>{fragment.text}</p><small>paragraph {fragment.paragraphIndex + 1} · revision {fragment.itemRevision} · {fragment.status} · {fragment.provenance}{fragment.sourceReference && ` · ${fragment.sourceReference}`}</small></article>)}</div>
              <button className="danger-button" type="button" onClick={() => void removeSelected()}>Delete Knowledge Item</button>
            </>
          ) : (
            <div className="empty-detail"><p className="section-kicker">Evidence-first knowledge</p><h2 id="detail-heading">Select an item to inspect</h2><p>Search results link back to the exact stored content, revision, status and provenance.</p><button className="primary-button" type="button" onClick={startCreate}>Create your first item</button></div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
}
