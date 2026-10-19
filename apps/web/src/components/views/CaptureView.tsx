'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/app-store';
import {
  getOrCreateDraft,
  saveNote,
  promoteDraft,
  createNote,
  getNote,
  extractTextFromTipTap,
  countWords,
} from '@/lib/services/notes';
import type { LocalNote } from '@/lib/db/local';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { runAIOperation } from '@/lib/services/ai';
import VoiceCaptureModal from '@/components/voice/VoiceCaptureModal';

// Dynamically import the editor to avoid SSR issues
const RichEditor = dynamic(() => import('@/components/editor/RichEditor'), {
  ssr: false,
  loading: () => (
    <div style={{ padding: 'var(--space-4)', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
      Loading editor...
    </div>
  ),
});

const AUTOSAVE_DELAY = 800; // ms

export default function CaptureView() {
  const { userId, activeNoteId, setActiveNoteId, updateNoteInCache, setActiveView } = useAppStore();
  const [note, setNote] = useState<LocalNote | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('{"type":"doc","content":[{"type":"paragraph"}]}');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAIRunning, setIsAIRunning] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [aiResult, setAIResult] = useState<string | null>(null);
  const [aiError, setAIError] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // ─── Load note ────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;

    async function loadNote() {
      let n: LocalNote | null = null;

      if (activeNoteId) {
        n = await getNote(activeNoteId);
      }

      if (!n) {
        n = await getOrCreateDraft(userId!);
      }

      setNote(n);
      setTitle(n.title);
      setContent(n.content);
    }

    loadNote();
  }, [userId, activeNoteId]);

  // ─── Autosave ─────────────────────────────────────────────────
  const scheduleSave = useCallback(
    (noteId: string, updates: Partial<LocalNote>) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setIsSaving(true);
        try {
          await saveNote(noteId, updates);
          setLastSaved(new Date());
          if (note) {
            const updated = { ...note, ...updates };
            setNote(updated as LocalNote);
            updateNoteInCache(updated as LocalNote);
          }
        } catch (e) {
          console.error('[CaptureView] Save error:', e);
        } finally {
          setIsSaving(false);
        }
      }, AUTOSAVE_DELAY);
    },
    [note, updateNoteInCache]
  );

  function handleTitleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setTitle(v);
    if (note) scheduleSave(note.id, { title: v });
  }

  function handleContentChange(
    newContent: string,
    text: string,
    wordCount: number
  ) {
    setContent(newContent);
    if (note) {
      scheduleSave(note.id, {
        content: newContent,
        content_text: text,
        word_count: wordCount,
      });
    }
  }

  function handleInsertVoiceText(text: string) {
    let nextContent = content;
    try {
      const doc = JSON.parse(content);
      if (!doc.content) doc.content = [];
      doc.content.push({
        type: 'paragraph',
        content: [{ type: 'text', text }],
      });
      nextContent = JSON.stringify(doc);
    } catch {
      nextContent = content ? `${content}\n${text}` : text;
    }
    setContent(nextContent);
    const plainText = extractTextFromTipTap(nextContent);
    const words = countWords(plainText);
    if (note) {
      scheduleSave(note.id, {
        content: nextContent,
        content_text: plainText,
        word_count: words,
      });
    }
  }

  // ─── Promote draft to permanent note ────────────────────────────
  async function handleSaveNote() {
    if (!userId) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);

    try {
      setIsSaving(true);

      // If this is a draft, promote it
      if (note?.is_draft) {
        // Save latest content first
        await saveNote(note.id, {
          title,
          content,
          content_text: extractTextFromTipTap(content),
          word_count: countWords(extractTextFromTipTap(content)),
        });

        const promoted = await promoteDraft(userId);
        if (promoted) {
          setNote(promoted);
          setActiveNoteId(promoted.id);
          updateNoteInCache(promoted);
          toast.success('Note saved!');
        }
      } else if (note) {
        await saveNote(note.id, {
          title,
          content,
          content_text: extractTextFromTipTap(content),
          word_count: countWords(extractTextFromTipTap(content)),
        });
        toast.success('Saved');
      }

      setLastSaved(new Date());
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Create new empty note ─────────────────────────────────────
  async function handleNewNote() {
    if (!userId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    // Save current note first
    if (note && (title.trim() || extractTextFromTipTap(content).trim())) {
      await handleSaveNote();
    }

    // Reset to a fresh capture
    setActiveNoteId(null);
    const fresh = await getOrCreateDraft(userId);
    setNote(fresh);
    setTitle('');
    setContent('{"type":"doc","content":[{"type":"paragraph"}]}');
    setAIResult(null);
    setAIError(null);

    // Focus title
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  // ─── AI operations ────────────────────────────────────────────
  async function handleAIOperation(
    operation: 'summarize' | 'extract_tasks' | 'suggest_title' | 'fix_grammar' | 'meeting_summary',
    overrideText?: string
  ) {
    const text = overrideText || extractTextFromTipTap(content);
    if (!text.trim()) {
      setAIError('Write some content first before using AI.');
      setShowAIPanel(true);
      return;
    }

    setIsAIRunning(true);
    setAIError(null);
    setAIResult(null);
    setShowAIPanel(true);

    const result = await runAIOperation(operation, text);

    if (result.status === 'success' && result.result) {
      setAIResult(result.result);
      if (operation === 'suggest_title' && note) {
        setTitle(result.result);
        scheduleSave(note.id, { title: result.result });
      }
    } else if (result.status === 'unavailable') {
      setAIError('AI is not configured. Add your OpenAI API key to .env.local to enable AI features.');
    } else {
      setAIError(result.error ?? 'AI operation failed. Please try again.');
    }

    setIsAIRunning(false);
  }

  // ─── Title auto-resize ────────────────────────────────────────
  function handleTitleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Move focus to editor — TipTap handles its own focus
    }
  }

  if (!note) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  const hasContent = title.trim().length > 0 || extractTextFromTipTap(content).trim().length > 0;

  return (
    <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
      {/* Main editor area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header bar */}
        <div className="workspace-header">
          {/* Mobile menu */}
          <button
            className="icon-btn"
            style={{ display: 'none' }}
            id="mobile-menu-btn"
            aria-label="Open menu"
            onClick={() => useAppStore.getState().setMobileSidebarOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h14M3 10h14M3 14h14" />
            </svg>
          </button>

          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: 'var(--font-weight-medium)' }}>
            {note.is_draft ? 'New Note' : 'Editing'}
          </span>

          {/* Autosave indicator */}
          <div className="sync-status" style={{ marginLeft: 'auto' }}>
            {isSaving ? (
              <>
                <div className="sync-dot pending" />
                <span style={{ fontSize: 'var(--font-size-xs)' }}>Saving...</span>
              </>
            ) : lastSaved ? (
              <>
                <div className="sync-dot synced" />
                <span style={{ fontSize: 'var(--font-size-xs)' }}>
                  Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
                </span>
              </>
            ) : (
              <>
                <div className="sync-dot" style={{ background: 'var(--color-neutral-300)' }} />
                <span style={{ fontSize: 'var(--font-size-xs)' }}>Unsaved</span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginLeft: 'var(--space-3)' }}>
            {/* Voice Dictation button */}
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowVoiceModal(true)}
              title="Voice Dictate & Record"
              id="voice-modal-toggle"
              style={{ gap: 'var(--space-1)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
              Voice
            </button>

            {/* AI button */}
            <button
              className={`btn btn-secondary btn-sm ${showAIPanel ? 'active' : ''}`}
              onClick={() => setShowAIPanel(!showAIPanel)}
              title="AI Assistant"
              id="ai-panel-toggle"
              style={{ gap: 'var(--space-1)' }}
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <circle cx="10" cy="10" r="7" />
                <path d="M7 10h6M10 7v6" strokeDasharray="2 1" />
              </svg>
              AI
            </button>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveView('notes')}
              title="Browse notes"
              id="browse-notes-btn"
            >
              Browse
            </button>

            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveNote}
              disabled={isSaving || !hasContent}
              title="Save note (⌘S)"
              id="save-note-btn"
            >
              {isSaving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : 'Save'}
            </button>
          </div>
        </div>

        {/* Editor */}
        <div className="editor-container">
          <div className="editor-inner">
            {/* Title */}
            <textarea
              ref={titleRef}
              className="editor-title-input"
              placeholder="Untitled"
              value={title}
              onChange={handleTitleChange}
              onKeyDown={handleTitleKeyDown}
              rows={1}
              style={{
                height: 'auto',
                overflow: 'hidden',
              }}
              onInput={(e) => {
                // Auto-resize
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
              aria-label="Note title"
              id="note-title-input"
              autoFocus={!activeNoteId}
            />

            {/* Rich editor */}
            <RichEditor
              key={note.id}
              content={content}
              onChange={handleContentChange}
              placeholder="Start writing... (or use AI to get started)"
              autoFocus={!!activeNoteId}
            />

            {/* Note metadata footer */}
            {hasContent && (
              <div className="editor-meta" style={{ marginTop: 'var(--space-4)' }}>
                <span className="editor-meta-item">
                  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="10" cy="10" r="7" /><path d="M10 6v4l3 3" />
                  </svg>
                  {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true })}
                </span>
                {note.word_count > 0 && (
                  <span className="editor-meta-item">
                    {note.word_count} words
                  </span>
                )}
                {note.is_draft && (
                  <span className="chip" style={{ marginLeft: 'auto' }}>Draft</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Side Panel */}
      {showAIPanel && (
        <div
          className="context-panel"
          style={{ display: 'flex', flexDirection: 'column' }}
          aria-label="AI Assistant"
        >
          <div style={{
            padding: 'var(--space-4)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
              AI Assistant
            </span>
            <button
              className="icon-btn"
              onClick={() => setShowAIPanel(false)}
              aria-label="Close AI panel"
            >
              <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l12 12M16 4L4 16" />
              </svg>
            </button>
          </div>

          <div style={{ padding: 'var(--space-4)', flex: 1, overflow: 'auto' }}>
            <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: '1.5' }}>
              AI operations run on your note content. Your original content is always preserved.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {[
                { op: 'summarize' as const, label: 'Summarize', icon: '📋' },
                { op: 'suggest_title' as const, label: 'Suggest Title', icon: '✏️' },
                { op: 'extract_tasks' as const, label: 'Extract Tasks', icon: '✅' },
                { op: 'fix_grammar' as const, label: 'Fix Grammar', icon: '🔤' },
              ].map(({ op, label, icon }) => (
                <button
                  key={op}
                  className="btn btn-secondary"
                  onClick={() => handleAIOperation(op)}
                  disabled={isAIRunning}
                  style={{ justifyContent: 'flex-start', gap: 'var(--space-2)' }}
                  id={`ai-${op}-btn`}
                >
                  {isAIRunning ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <span>{icon}</span>}
                  {label}
                </button>
              ))}
            </div>

            {aiError && (
              <div style={{
                marginTop: 'var(--space-4)',
                padding: 'var(--space-3)',
                background: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-warning)',
                lineHeight: '1.5',
              }}>
                {aiError}
              </div>
            )}

            {aiResult && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
                  Result
                </div>
                <div style={{
                  padding: 'var(--space-3)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--font-size-sm)',
                  color: 'var(--text-primary)',
                  lineHeight: '1.6',
                  whiteSpace: 'pre-wrap',
                }}>
                  {aiResult}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      navigator.clipboard.writeText(aiResult);
                      toast.success('Copied to clipboard');
                    }}
                  >
                    Copy
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setAIResult(null)}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice Dictation Modal */}
      <VoiceCaptureModal
        isOpen={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onInsertText={handleInsertVoiceText}
        onRunAI={(op, text) => {
          handleAIOperation(op, text);
        }}
      />
    </div>
  );
}
