'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { searchNotesLocal } from '@/lib/services/notes';
import type { LocalNote } from '@/lib/db/local';
import { formatDistanceToNow } from 'date-fns';

export default function SearchView() {
  const { userId, setActiveNoteId, setActiveView } = useAppStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocalNote[]>([]);
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(
    async (q: string) => {
      if (!userId || !q.trim()) { setResults([]); return; }
      setLoading(true);
      const r = await searchNotesLocal(userId, q);
      setResults(r);
      setLoading(false);
    },
    [userId]
  );

  useEffect(() => {
    const timer = setTimeout(() => doSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, doSearch]);

  function handleOpenNote(id: string) {
    setActiveNoteId(id);
    setActiveView('notes');
  }

  function highlight(text: string, q: string): string {
    if (!q.trim()) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return text.replace(new RegExp(`(${escaped})`, 'gi'), '**$1**');
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search header */}
      <div className="workspace-header">
        <div className="search-input-wrapper" style={{ flex: 1, maxWidth: 600 }}>
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="5" /><path d="M14 14l3 3" />
          </svg>
          <input
            className="search-input"
            type="search"
            placeholder="Search notes, tasks, content..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            id="global-search-input"
            aria-label="Search"
          />
          {query && (
            <button className="icon-btn" onClick={() => setQuery('')} style={{ width: 20, height: 20 }} aria-label="Clear search">
              <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            </button>
          )}
        </div>
        {results.length > 0 && (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {results.length} result{results.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {!query.trim() ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="empty-state-icon">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <h2 className="empty-state-title">Search your notes</h2>
            <p className="empty-state-body">Type to search across all your notes by title and content.</p>
          </div>
        ) : loading ? (
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <div className="skeleton" style={{ height: 16, width: '50%' }} />
                <div className="skeleton" style={{ height: 12, width: '90%' }} />
                <div className="skeleton" style={{ height: 12, width: '70%' }} />
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="empty-state-icon">
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /><path d="M8 11h6M11 8v6" />
            </svg>
            <h2 className="empty-state-title">No results found</h2>
            <p className="empty-state-body">
              No notes match <strong>"{query}"</strong>. Try different keywords.
            </p>
          </div>
        ) : (
          <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {results.map((note) => {
              const snippet = note.content_text?.slice(0, 200) || '';
              const queryLower = query.toLowerCase();
              const matchIndex = snippet.toLowerCase().indexOf(queryLower);
              const contextStart = Math.max(0, matchIndex - 40);
              const contextSnippet = (contextStart > 0 ? '...' : '') + snippet.slice(contextStart, contextStart + 160) + (snippet.length > contextStart + 160 ? '...' : '');

              return (
                <div
                  key={note.id}
                  className="card card-hover"
                  onClick={() => handleOpenNote(note.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpenNote(note.id)}
                  aria-label={`Open note: ${note.title || 'Untitled'}`}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 'var(--space-2)' }}>
                    <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
                      {note.title || 'Untitled'}
                    </h3>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', whiteSpace: 'nowrap', marginLeft: 'var(--space-3)' }}>
                      {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                    {contextSnippet || 'Empty note'}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
