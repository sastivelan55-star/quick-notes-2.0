'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/app-store';
import {
  listNotes,
  getNote,
  saveNote,
  createNote,
  trashNote,
  archiveNote,
  restoreNote,
  togglePin,
  toggleFavorite,
  searchNotesLocal,
} from '@/lib/services/notes';
import { saveRevision } from '@/lib/services/revisions';
import type { LocalNote } from '@/lib/db/local';
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import type { NoteTemplate } from '@/lib/templates/note-templates';

const RichEditor = dynamic(() => import('@/components/editor/RichEditor'), { ssr: false });
const TemplateSelector = dynamic(() => import('@/components/editor/TemplateSelector'), { ssr: false });

interface NotesViewProps {
  status?: 'active' | 'archived' | 'deleted';
  filter?: 'all' | 'favorites' | 'tags';
}

function formatNoteTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isToday(d)) return format(d, 'h:mm a');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  } catch {
    return '';
  }
}

// Pastel card color palette (Reference Image 2)
const PASTEL_PALETTE = [
  { name: 'peach', bg: 'var(--pastel-peach-bg)', border: 'var(--pastel-peach-border)', text: 'var(--pastel-peach-text)' },
  { name: 'mint', bg: 'var(--pastel-mint-bg)', border: 'var(--pastel-mint-border)', text: 'var(--pastel-mint-text)' },
  { name: 'sky', bg: 'var(--pastel-sky-bg)', border: 'var(--pastel-sky-border)', text: 'var(--pastel-sky-text)' },
  { name: 'lavender', bg: 'var(--pastel-lavender-bg)', border: 'var(--pastel-lavender-border)', text: 'var(--pastel-lavender-text)' },
  { name: 'butter', bg: 'var(--pastel-butter-bg)', border: 'var(--pastel-butter-border)', text: 'var(--pastel-butter-text)' },
];

const AVAILABLE_TAGS = ['Ideas', 'Important', 'Personal', 'Study', 'Work', 'Projects'];

export default function NotesView({ status = 'active', filter = 'all' }: NotesViewProps) {
  const {
    userId,
    activeNoteId,
    setActiveNoteId,
    activeFolderId,
    setActiveFolderId,
    notesLayout,
    setNotesLayout,
    selectedTagFilter,
    setSelectedTagFilter,
  } = useAppStore();

  const [notes, setNotes] = useState<LocalNote[]>([]);
  const [activeNote, setActiveNote] = useState<LocalNote | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const savingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadNotes = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let result = await listNotes(userId, { status, folder_id: activeFolderId ?? undefined });
      if (filter === 'favorites') {
        result = result.filter((n) => n.is_favorite);
      } else if (filter === 'tags') {
        if (selectedTagFilter) {
          result = result.filter((n) => n.tags && n.tags.includes(selectedTagFilter));
        } else {
          result = result.filter((n) => n.tags && n.tags.length > 0);
        }
      }
      setNotes(result);

      // Auto-select first note if none is active on desktop (width >= 768)
      if (typeof window !== 'undefined' && window.innerWidth >= 768) {
        if (!activeNoteId && result.length > 0) {
          setActiveNoteId(result[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [userId, status, activeFolderId, filter, selectedTagFilter, activeNoteId, setActiveNoteId]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Search filter
  useEffect(() => {
    if (!userId) return;
    if (!searchQuery.trim()) {
      loadNotes();
      return;
    }
    const timer = setTimeout(async () => {
      let results = await searchNotesLocal(userId, searchQuery);
      results = results.filter((n) => n.status === status);
      if (filter === 'favorites') results = results.filter((n) => n.is_favorite);
      if (filter === 'tags' && selectedTagFilter) {
        results = results.filter((n) => n.tags && n.tags.includes(selectedTagFilter));
      }
      setNotes(results);
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, userId, status, filter, selectedTagFilter, loadNotes]);

  // Load active note
  useEffect(() => {
    if (!activeNoteId) {
      setActiveNote(null);
      return;
    }
    getNote(activeNoteId).then((n) => {
      if (n) {
        setActiveNote(n);
        setEditTitle(n.title);
        setEditContent(n.content);
      }
    });
  }, [activeNoteId]);

  async function handleSelectNote(id: string) {
    setActiveNoteId(id);
  }

  async function handleCreateNewNote(template?: NoteTemplate) {
    if (!userId) return;
    if (!template) {
      // Show template selector instead of immediately creating
      setShowTemplateSelector(true);
      return;
    }
    try {
      const newNote = await createNote(userId, {
        title: template.id === 'blank' ? 'Untitled Note' : template.title,
        content:
          template.id === 'blank'
            ? JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] })
            : template.content,
        content_text: template.content_text,
        word_count: template.content_text.trim().split(/\s+/).filter(Boolean).length,
        tags: template.tags,
        folder_id: activeFolderId,
      });
      await loadNotes();
      setActiveNoteId(newNote.id);
      toast.success(
        template.id === 'blank' ? 'New note created' : `${template.name} created`
      );
    } catch (e) {
      console.error(e);
      toast.error('Failed to create note');
    }
  }

  const saveTimer = useCallback(
    (() => {
      let t: ReturnType<typeof setTimeout> | null = null;
      return (id: string, updates: Partial<LocalNote>) => {
        if (t) clearTimeout(t);
        setSavingStatus('saving');
        t = setTimeout(async () => {
          await saveNote(id, updates);
          setSavingStatus('saved');
          // Queue revision snapshot
          if (updates.content !== undefined || updates.title !== undefined) {
            const note = await getNote(id);
            if (note) {
              await saveRevision(id, {
                title: updates.title ?? note.title,
                content: updates.content ?? note.content,
                content_text: updates.content_text ?? note.content_text,
                word_count: updates.word_count ?? note.word_count,
                revision_type: 'autosave',
              });
            }
          }
          loadNotes();
          // Clear 'saved' status after 2s
          if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
          savingTimerRef.current = setTimeout(() => setSavingStatus('idle'), 2000);
        }, 600);
      };
    })(),
    [loadNotes]
  );

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setEditTitle(e.target.value);
    if (activeNote) saveTimer(activeNote.id, { title: e.target.value });
  }

  function handleContentChange(content: string, text: string, wc: number) {
    setEditContent(content);
    if (activeNote) saveTimer(activeNote.id, { content, content_text: text, word_count: wc });
  }

  async function handleToggleTag(tag: string) {
    if (!activeNote) return;
    const currentTags = activeNote.tags || [];
    const newTags = currentTags.includes(tag)
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag];

    setActiveNote({ ...activeNote, tags: newTags });
    await saveNote(activeNote.id, { tags: newTags });
    loadNotes();
    toast.success(`Tag ${currentTags.includes(tag) ? 'removed' : 'added'}`);
  }

  async function handleTrash(id: string) {
    if (status === 'deleted') {
      if (!window.confirm('Permanently delete this note? This cannot be undone.')) return;
    }
    await trashNote(id);
    toast.success('Moved to trash');
    if (activeNoteId === id) setActiveNoteId(null);
    loadNotes();
  }

  async function handleArchive(id: string) {
    await archiveNote(id);
    toast.success('Archived');
    if (activeNoteId === id) setActiveNoteId(null);
    loadNotes();
  }

  async function handleRestore(id: string) {
    await restoreNote(id);
    toast.success('Restored');
    loadNotes();
  }

  async function handleTogglePin(id: string) {
    await togglePin(id);
    loadNotes();
  }

  async function handleToggleFavorite(id: string) {
    await toggleFavorite(id);
    loadNotes();
  }

  const viewTitle =
    status === 'archived'
      ? 'Archive'
      : status === 'deleted'
      ? 'Trash'
      : filter === 'favorites'
      ? 'Favorites'
      : filter === 'tags'
      ? 'Tags'
      : 'All Notes';

  return (
    <div
      className={`notes-workspace-container ${activeNoteId ? 'has-active-note' : 'no-active-note'}`}
      style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden', width: '100%' }}
    >
      {/* Middle Column: Notes List / Grid (Reference Image 1, 2 & 5) */}
      <div
        className="notes-list-pane"
        style={{
          width: notesLayout === 'grid' ? '420px' : '320px',
          minWidth: '280px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Header with Title, Layout Switcher, and "+ New Note" blue pill button */}
        <div
          className="notes-list-header"
          style={{
            padding: 'var(--space-3) var(--space-4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--border-subtle)',
            minHeight: 'var(--header-height)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <span
              className="notes-list-title"
              style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-bold)', color: 'var(--text-primary)' }}
            >
              {viewTitle}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 500 }}>
              ({notes.length})
            </span>
            {activeFolderId && (
              <button
                className="icon-btn"
                onClick={() => setActiveFolderId(null)}
                title="Clear folder filter"
                aria-label="Clear folder filter"
                style={{ width: 18, height: 18 }}
              >
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M4 4l12 12M16 4L4 16" />
                </svg>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            {/* View Mode Toggle: List vs Pastel Grid (Reference Image 2) */}
            <div className="view-mode-toggle" style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 2 }}>
              <button
                className={`icon-btn ${notesLayout === 'list' ? 'active' : ''}`}
                onClick={() => setNotesLayout('list')}
                title="List view (NoteNest standard)"
                aria-label="List view"
                style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)' }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="4" y1="6" x2="16" y2="6" />
                  <line x1="4" y1="10" x2="16" y2="10" />
                  <line x1="4" y1="14" x2="16" y2="14" />
                </svg>
              </button>
              <button
                className={`icon-btn ${notesLayout === 'grid' ? 'active' : ''}`}
                onClick={() => setNotesLayout('grid')}
                title="Card grid view (Pastel cards)"
                aria-label="Card grid view"
                style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)' }}
              >
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="6" height="6" rx="1" />
                  <rect x="11" y="3" width="6" height="6" rx="1" />
                  <rect x="3" y="11" width="6" height="6" rx="1" />
                  <rect x="11" y="11" width="6" height="6" rx="1" />
                </svg>
              </button>
            </div>

            {status === 'active' && (
              <>
                <button
                  className="icon-btn"
                  onClick={() => setShowTemplateSelector(true)}
                  title="Choose template for new note"
                  aria-label="New note from template"
                  style={{ width: 26, height: 26, borderRadius: 'var(--radius-sm)' }}
                  id="template-new-note-btn"
                >
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="3" width="14" height="14" rx="2" />
                    <path d="M7 7h6M7 10h4M7 13h3" />
                  </svg>
                </button>
                <button
                  className="btn-pill-primary"
                  onClick={() => handleCreateNewNote({ id: 'blank', name: 'Blank Note', description: '', icon: '📄', title: 'Untitled Note', content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }), content_text: '', tags: [], color: null })}
                  id="middle-new-note-btn"
                  title="New blank note"
                >
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M10 4v12M4 10h12" />
                  </svg>
                  New Note
                </button>
              </>
            )}

          </div>
        </div>

        {/* Search Bar */}
        <div className="notes-list-search" style={{ padding: 'var(--space-2) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="search-input-wrapper">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
              <circle cx="9" cy="9" r="5" />
              <path d="M14 14l3 3" />
            </svg>
            <input
              className="search-input"
              type="search"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="notes-search-input"
              aria-label="Search notes"
            />
            {searchQuery && (
              <button
                className="icon-btn"
                onClick={() => setSearchQuery('')}
                style={{ width: 20, height: 20 }}
                aria-label="Clear search"
              >
                <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M4 4l12 12M16 4L4 16" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Tags Selector Filter Strip (Visible when filter === 'tags' or active tag exists) */}
        {filter === 'tags' && (
          <div
            className="tag-filter-strip"
            style={{
              padding: 'var(--space-2) var(--space-4)',
              display: 'flex',
              gap: 'var(--space-2)',
              overflowX: 'auto',
              borderBottom: '1px solid var(--border-subtle)',
              background: 'var(--bg-tertiary)',
            }}
          >
            <button
              className={`tag-pill ${!selectedTagFilter ? 'active' : ''}`}
              onClick={() => setSelectedTagFilter(null)}
              style={{
                background: !selectedTagFilter ? '#2563EB' : 'var(--bg-primary)',
                color: !selectedTagFilter ? '#ffffff' : 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
              }}
            >
              All Tags
            </button>
            {AVAILABLE_TAGS.map((tag) => {
              const isSelected = selectedTagFilter === tag;
              return (
                <button
                  key={tag}
                  className={`tag-pill ${tag.toLowerCase()} ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedTagFilter(isSelected ? null : tag)}
                  style={{
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 2px var(--color-brand-500)' : 'none',
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        )}

        {/* Note Rows List or Pastel Cards Grid */}
        <div
          className="notes-list-items"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: notesLayout === 'grid' ? 'var(--space-3)' : 0,
          }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
                <div className="skeleton" style={{ height: 12, width: '85%' }} />
              </div>
            ))
          ) : notes.length === 0 ? (
            <div className="empty-state" style={{ padding: 'var(--space-8) var(--space-4)' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-state-icon">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              <p className="empty-state-title" style={{ fontSize: 'var(--font-size-sm)' }}>
                {searchQuery
                  ? 'No notes match your search'
                  : filter === 'favorites'
                  ? 'No favorites yet'
                  : filter === 'tags' && selectedTagFilter
                  ? `No notes tagged "${selectedTagFilter}"`
                  : `No ${viewTitle.toLowerCase()}`}
              </p>
            </div>
          ) : notesLayout === 'grid' ? (
            // ─── Pastel Card Grid (Reference Image 2: Multi-Device Keep Cards) ───
            <div
              className="pastel-notes-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 'var(--space-3)',
              }}
            >
              {notes.map((n, idx) => {
                const color = PASTEL_PALETTE[idx % PASTEL_PALETTE.length];
                const isActive = activeNoteId === n.id;
                return (
                  <div
                    key={n.id}
                    className={`pastel-note-card ${isActive ? 'active' : ''}`}
                    onClick={() => handleSelectNote(n.id)}
                    style={{
                      background: color.bg,
                      borderColor: isActive ? 'var(--color-brand-600)' : color.border,
                      borderWidth: isActive ? 2 : 1,
                      borderStyle: 'solid',
                      borderRadius: 'var(--radius-lg)',
                      padding: 'var(--space-3)',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
                      position: 'relative',
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleSelectNote(n.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 'var(--font-size-sm)',
                          color: color.text,
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '130px',
                        }}
                      >
                        {n.title || 'Untitled'}
                      </span>
                      {n.is_favorite && (
                        <span style={{ fontSize: '12px', color: '#f59e0b' }}>★</span>
                      )}
                    </div>

                    <p
                      style={{
                        fontSize: '11px',
                        color: color.text,
                        opacity: 0.85,
                        lineHeight: 1.4,
                        maxHeight: '4.2em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 'var(--space-2)',
                        flex: 1,
                      }}
                    >
                      {n.content_text || 'No content yet...'}
                    </p>

                    {/* Card Tags */}
                    {n.tags && n.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
                        {n.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            style={{
                              fontSize: '9px',
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: 'rgba(0,0,0,0.06)',
                              color: color.text,
                            }}
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Bottom Action Strip */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        paddingTop: 4,
                        borderTop: '1px solid rgba(0,0,0,0.06)',
                        fontSize: '10px',
                        color: color.text,
                        opacity: 0.75,
                      }}
                    >
                      <span>{formatNoteTime(n.updated_at)}</span>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleFavorite(n.id);
                          }}
                          style={{ width: 18, height: 18 }}
                          title="Favorite"
                          aria-label="Favorite"
                        >
                          <svg width="11" height="11" viewBox="0 0 20 20" fill={n.is_favorite ? '#f59e0b' : 'none'} stroke="currentColor" strokeWidth="1.75">
                            <path d="M10 2l2.5 5.5H18l-4.5 3.5 1.7 6-5.2-3.8L4.8 17l1.7-6L2 7.5h5.5L10 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // ─── Standard NoteNest List Rows (Reference Image 1 & 5) ───
            notes.map((n) => (
              <NoteListItem
                key={n.id}
                note={n}
                isActive={activeNoteId === n.id}
                onSelect={() => handleSelectNote(n.id)}
                onTrash={() => handleTrash(n.id)}
                onArchive={() => handleArchive(n.id)}
                onRestore={status === 'deleted' ? () => handleRestore(n.id) : undefined}
                onPin={() => handleTogglePin(n.id)}
                onFavorite={() => handleToggleFavorite(n.id)}
                showRestore={status !== 'active'}
              />
            ))
          )}
        </div>
      </div>

      {/* Right Column: Note Editor / Detail View (Reference Image 1 & 5) */}
      <div
        className="notes-editor-pane"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-primary)',
          height: '100%',
        }}
      >
        {!activeNote ? (
          <div className="empty-state" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-state-icon">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10,9 9,9 8,9" />
            </svg>
            <h2 className="empty-state-title" style={{ fontSize: 'var(--font-size-base)', marginTop: 'var(--space-3)' }}>
              Select a note to view
            </h2>
            <p className="empty-state-body" style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-xs)', marginBottom: 'var(--space-4)' }}>
              Choose a note from the list, or create a fresh one.
            </p>
            <button
              className="btn-pill-primary"
              onClick={() => setShowTemplateSelector(true)}
              id="create-note-from-empty-btn"
            >
              + New Note
            </button>
          </div>
        ) : (
          <>
            {/* Note Header Toolbar */}
            <div
              className="workspace-header"
              style={{
                justifyContent: 'space-between',
                padding: '0 var(--space-4)',
                borderBottom: '1px solid var(--border-subtle)',
                minHeight: 'var(--header-height)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <button
                  className="icon-btn"
                  onClick={() => setActiveNoteId(null)}
                  title="Back to list"
                  aria-label="Back to notes list"
                >
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M15 10H5M10 5L5 10l5 5" />
                  </svg>
                </button>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                  Edited {formatDistanceToNow(new Date(activeNote.updated_at), { addSuffix: true })}
                </span>
                {/* Autosave status indicator */}
                {savingStatus !== 'idle' && (
                  <span
                    style={{
                      fontSize: '11px',
                      color: savingStatus === 'saving' ? 'var(--text-tertiary)' : 'var(--color-success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      transition: 'opacity var(--transition-fast)',
                    }}
                    aria-live="polite"
                    aria-label={savingStatus === 'saving' ? 'Saving...' : 'Saved'}
                  >
                    {savingStatus === 'saving' ? (
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M10 3a7 7 0 0 1 7 7" />
                      </svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M4 10l4 4 8-8" />
                      </svg>
                    )}
                    {savingStatus === 'saving' ? 'Saving...' : 'Saved'}
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                {status === 'active' && (
                  <>
                    <button
                      className={`icon-btn ${activeNote.is_favorite ? 'active' : ''}`}
                      onClick={() => handleToggleFavorite(activeNote.id)}
                      title={activeNote.is_favorite ? 'Remove favorite' : 'Add favorite'}
                      style={{ color: activeNote.is_favorite ? '#f59e0b' : 'inherit' }}
                      aria-label="Toggle favorite"
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill={activeNote.is_favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.75">
                        <path d="M10 2l2.5 5.5H18l-4.5 3.5 1.7 6-5.2-3.8L4.8 17l1.7-6L2 7.5h5.5L10 2z" />
                      </svg>
                    </button>
                    <button
                      className="icon-btn"
                      onClick={() => handleTrash(activeNote.id)}
                      title="Move to trash"
                      aria-label="Move to trash"
                      style={{ color: 'var(--text-danger)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                        <path d="M4 6h12l-1 11H5L4 6zM2 6h16M8 6V4h4v2" />
                      </svg>
                    </button>
                  </>
                )}
                {status !== 'active' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleRestore(activeNote.id)}
                    id="restore-note-btn"
                  >
                    Restore
                  </button>
                )}
              </div>
            </div>

            {/* Note Editor Canvas Area */}
            <div className="editor-container" style={{ flex: 1, overflowY: 'auto' }}>
              <div className="editor-inner">
                <textarea
                  className="editor-title-input"
                  placeholder="Untitled"
                  value={editTitle}
                  onChange={handleTitleChange}
                  rows={1}
                  readOnly={status !== 'active'}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = 'auto';
                    el.style.height = el.scrollHeight + 'px';
                  }}
                  aria-label="Note title"
                  style={{ fontSize: 'var(--font-size-3xl)', marginBottom: 'var(--space-2)' }}
                />

                <RichEditor
                  key={activeNote.id}
                  content={editContent}
                  onChange={handleContentChange}
                  readOnly={status !== 'active'}
                  autoFocus={false}
                />

                {/* NoteNest Interactive Tag Pills (Reference Image 1 & 5) */}
                <div className="tag-pills-container" style={{ marginTop: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Tags
                  </span>
                  {AVAILABLE_TAGS.map((tag) => {
                    const isAttached = activeNote.tags?.includes(tag);
                    const tagClass = tag.toLowerCase() === 'ideas' ? 'ideas' : tag.toLowerCase() === 'important' ? 'important' : 'personal';
                    return (
                      <button
                        key={tag}
                        className={`tag-pill ${tagClass}`}
                        onClick={() => handleToggleTag(tag)}
                        style={{
                          opacity: isAttached ? 1 : 0.45,
                          cursor: 'pointer',
                          border: isAttached ? '1px solid transparent' : '1px dashed var(--border-default)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title={`Click to ${isAttached ? 'remove' : 'add'} ${tag}`}
                        aria-pressed={isAttached}
                      >
                        {tag}
                        {isAttached && <span style={{ fontSize: '10px' }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Template Selector Modal (Portal) */}
      {showTemplateSelector && (
        <TemplateSelector
          onSelect={(template) => handleCreateNewNote(template)}
          onClose={() => setShowTemplateSelector(false)}
        />
      )}
    </div>
  );
}

// ─── Note List Item Component (Reference Image 1: Title, Time, Snippet) ───
function NoteListItem({
  note,
  isActive,
  onSelect,
  onTrash,
  onArchive,
  onRestore,
  onPin,
  onFavorite,
  showRestore,
}: {
  note: LocalNote;
  isActive: boolean;
  onSelect: () => void;
  onTrash: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  onPin: () => void;
  onFavorite: () => void;
  showRestore: boolean;
}) {
  const preview = note.content_text
    ? note.content_text.slice(0, 90).replace(/\s+/g, ' ')
    : 'No content yet...';

  return (
    <div
      className={`note-list-item ${isActive ? 'active' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      aria-selected={isActive}
      style={{
        padding: 'var(--space-3) var(--space-4)',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'relative',
        cursor: 'pointer',
        background: isActive ? 'var(--bg-primary)' : 'transparent',
      }}
    >
      {/* Top Line: Title & Timestamp */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <div
          className="note-list-item-title"
          style={{
            fontWeight: 600,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '190px',
          }}
        >
          {note.is_pinned && (
            <span style={{ marginRight: 4, color: 'var(--color-brand-500)' }}>📌</span>
          )}
          {note.title || 'Untitled'}
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', flexShrink: 0, marginLeft: 8 }}>
          {formatNoteTime(note.updated_at)}
        </span>
      </div>

      {/* Second Line: Preview Snippet */}
      <div
        className="note-list-item-preview"
        style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          lineHeight: 1.4,
          maxHeight: '2.8em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {preview}
      </div>

      {/* Tags preview chips if present */}
      {note.tags && note.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
          {note.tags.slice(0, 2).map((t: string) => (
            <span
              key={t}
              className={`tag-pill ${t.toLowerCase() === 'ideas' ? 'ideas' : t.toLowerCase() === 'important' ? 'important' : 'personal'}`}
              style={{ padding: '1px 8px', fontSize: '10px' }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
