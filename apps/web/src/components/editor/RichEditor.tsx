'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

interface RichEditorProps {
  content: string;
  onChange: (content: string, text: string, wordCount: number) => void;
  placeholder?: string;
  autoFocus?: boolean;
  readOnly?: boolean;
}

export default function RichEditor({
  content,
  onChange,
  placeholder = 'Start writing...',
  autoFocus = false,
  readOnly = false,
}: RichEditorProps) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false, // using lowlight version below
        link: false,
        underline: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList.configure({ HTMLAttributes: { class: 'task-list' } }),
      TaskItem.configure({ nested: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Highlight.configure({ multicolor: false }),
      Typography,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      CharacterCount,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: (() => {
      try {
        return JSON.parse(content);
      } catch {
        return content || '<p></p>';
      }
    })(),
    editable: !readOnly,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'ProseMirror',
        spellcheck: 'true',
        'aria-multiline': 'true',
        role: 'textbox',
        'aria-label': 'Note content',
      },
    },
    onUpdate: ({ editor }) => {
      const json = JSON.stringify(editor.getJSON());
      const text = editor.getText();
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      onChangeRef.current(json, text, words);
    },
  });

  // Update content when note changes (without cursor jump)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    try {
      const incoming = JSON.stringify(JSON.parse(content));
      const current = JSON.stringify(editor.getJSON());
      if (incoming !== current) {
        editor.commands.setContent(JSON.parse(content), {
          emitUpdate: false,
          parseOptions: {
            preserveWhitespace: 'full',
          },
        });
      }
    } catch {
      // If content is invalid JSON, treat as HTML/text
    }
  }, [content, editor]);

  if (!editor) return null;

  return (
    <div style={{ width: '100%' }}>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────
function EditorToolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const canUndo = editor.can().undo();
  const canRedo = editor.can().redo();

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {/* History */}
      <button
        className="toolbar-btn"
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!canUndo}
        title="Undo (⌘Z)"
        aria-label="Undo"
        id="toolbar-undo"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 10a7 7 0 1 0 7-7" /><path d="M3 4v6h6" />
        </svg>
      </button>
      <button
        className="toolbar-btn"
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!canRedo}
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
        id="toolbar-redo"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M17 10a7 7 0 1 1-7-7" /><path d="M17 4v6h-6" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* Headings */}
      <select
        className="toolbar-select"
        value={
          editor.isActive('heading', { level: 1 }) ? '1' :
          editor.isActive('heading', { level: 2 }) ? '2' :
          editor.isActive('heading', { level: 3 }) ? '3' : '0'
        }
        onChange={(e) => {
          const level = parseInt(e.target.value);
          if (level === 0) {
            editor.chain().focus().setParagraph().run();
          } else {
            editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 }).run();
          }
        }}
        aria-label="Text style"
        id="toolbar-heading"
      >
        <option value="0">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>

      <div className="toolbar-divider" />

      {/* Inline formatting */}
      <button
        className={`toolbar-btn ${editor.isActive('bold') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (⌘B)"
        aria-label="Bold"
        aria-pressed={editor.isActive('bold')}
        id="toolbar-bold"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path d="M6 4h5a4 4 0 0 1 0 8H6V4zm0 8h6a4 4 0 0 1 0 8H6v-8z" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('italic') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (⌘I)"
        aria-label="Italic"
        aria-pressed={editor.isActive('italic')}
        id="toolbar-italic"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path d="M8 4h8v2h-3l-4 8h3v2H4v-2h3l4-8H8V4z" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('underline') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        title="Underline (⌘U)"
        aria-label="Underline"
        aria-pressed={editor.isActive('underline')}
        id="toolbar-underline"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 4v7a5 5 0 0 0 10 0V4M3 17h14" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('strike') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
        aria-label="Strikethrough"
        aria-pressed={editor.isActive('strike')}
        id="toolbar-strike"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M4 10h12M8.5 6C6.5 6 5 7 5 8.5c0 2.5 10 2.5 10 5C15 15 13.5 16 11.5 16c-2 0-3.5-1-4-2" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('highlight') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        title="Highlight"
        aria-label="Highlight"
        aria-pressed={editor.isActive('highlight')}
        id="toolbar-highlight"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 14l4-4 6-6 3 3-6 6-4 4H5v-3z" fill="currentColor" fillOpacity="0.3" />
          <path d="M5 14l4-4 6-6 3 3-6 6-4 4H5v-3z" />
          <path d="M2 18h4" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('code') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
        aria-label="Inline code"
        aria-pressed={editor.isActive('code')}
        id="toolbar-code"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="5,8 1,12 5,16" /><polyline points="15,8 19,12 15,16" />
          <line x1="12" y1="4" x2="8" y2="20" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* Lists */}
      <button
        className={`toolbar-btn ${editor.isActive('bulletList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
        aria-label="Bullet list"
        id="toolbar-bullet-list"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M7 6h10M7 10h10M7 14h10" />
          <circle cx="3" cy="6" r="1" fill="currentColor" />
          <circle cx="3" cy="10" r="1" fill="currentColor" />
          <circle cx="3" cy="14" r="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('orderedList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
        aria-label="Numbered list"
        id="toolbar-ordered-list"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 6h10M8 10h10M8 14h10M3 5v3M2 8h2M2 14h2l-2 2h2M2 11h1.5a.5.5 0 0 1 0 1H2" />
        </svg>
      </button>
      <button
        className={`toolbar-btn ${editor.isActive('taskList') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Checklist"
        aria-label="Checklist"
        id="toolbar-task-list"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="5" width="5" height="5" rx="1" />
          <path d="M3.5 7.5l1 1 2-2" />
          <path d="M10 7h8M10 13h8" />
          <rect x="2" y="11" width="5" height="5" rx="1" />
        </svg>
      </button>

      <div className="toolbar-divider" />

      {/* Blocks */}
      <button
        className={`toolbar-btn ${editor.isActive('blockquote') ? 'active' : ''}`}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
        aria-label="Quote"
        id="toolbar-blockquote"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
          <path d="M3 4h2c1 0 2 1 2 2v2c0 1-1 2-2 2H4v1c0 2 1 3 3 3v2c-4 0-5-3-5-5V6c0-2 1-2 1-2zm9 0h2c1 0 2 1 2 2v2c0 1-1 2-2 2h-1v1c0 2 1 3 3 3v2c-4 0-5-3-5-5V6c0-2 1-2 1-2z" />
        </svg>
      </button>
      <button
        className="toolbar-btn"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Divider"
        aria-label="Horizontal divider"
        id="toolbar-hr"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 10h14" />
        </svg>
      </button>

      {/* Character count */}
      <div style={{ marginLeft: 'auto', fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
        {editor.storage.characterCount?.words()} w
        <span style={{ color: 'var(--border-default)' }}>·</span>
        {editor.storage.characterCount?.characters()} c
      </div>
    </div>
  );
}
