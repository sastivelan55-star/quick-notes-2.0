'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore, type AppView } from '@/store/app-store';
import { searchNotesLocal, createNote } from '@/lib/services/notes';
import { createTask } from '@/lib/services/tasks';
import type { LocalNote } from '@/lib/db/local';
import toast from 'react-hot-toast';

interface CommandItem {
  id: string;
  title: string;
  category: 'Navigation' | 'Actions' | 'Theme' | 'Notes';
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void | Promise<void>;
}

export default function CommandPalette() {
  const {
    commandPaletteOpen,
    setCommandPaletteOpen,
    setActiveView,
    setActiveNoteId,
    userId,
    setTheme,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [noteResults, setNoteResults] = useState<LocalNote[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Global keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        // Allow command palette except if inside code editor where override isn't wanted
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      } else if (e.key === 'Escape' && commandPaletteOpen) {
        e.preventDefault();
        setCommandPaletteOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Focus input when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Search notes from local Dexie DB when query is provided
  useEffect(() => {
    if (!userId || !query.trim()) {
      setNoteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchNotesLocal(userId, query.trim());
        setNoteResults(results.slice(0, 5));
      } catch (err) {
        console.error('Command palette search error:', err);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [query, userId]);

  const closePalette = useCallback(() => {
    setCommandPaletteOpen(false);
  }, [setCommandPaletteOpen]);

  const navigateTo = useCallback(
    (view: AppView, noteId: string | null = null) => {
      setActiveView(view);
      if (noteId !== null) {
        setActiveNoteId(noteId);
      }
      closePalette();
    },
    [setActiveView, setActiveNoteId, closePalette]
  );

  // Define static commands
  const staticCommands: CommandItem[] = [
    // Navigation
    {
      id: 'nav-notes',
      title: 'Go to All Notes',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 4h12M4 8h12M4 12h8M4 16h6" />
        </svg>
      ),
      shortcut: 'G N',
      onSelect: () => navigateTo('notes'),
    },
    {
      id: 'nav-favorites',
      title: 'Go to Favorites',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M10 2l2.5 5.5H18l-4.5 3.5 1.7 6-5.2-3.8L4.8 17l1.7-6L2 7.5h5.5L10 2z" />
        </svg>
      ),
      shortcut: 'G F',
      onSelect: () => navigateTo('favorites'),
    },
    {
      id: 'nav-tags',
      title: 'Go to Tags',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M2 10V4a2 2 0 0 1 2-2h6l8 8a2 2 0 0 1 0 2.83l-4 4a2 2 0 0 1-2.83 0L2 10z" />
          <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" />
        </svg>
      ),
      shortcut: 'G T',
      onSelect: () => navigateTo('tags'),
    },
    {
      id: 'nav-tasks',
      title: 'Go to Tasks',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="10" cy="10" r="7" />
          <path d="M7 10l2 2 4-4" />
        </svg>
      ),
      shortcut: 'G K',
      onSelect: () => navigateTo('tasks'),
    },
    {
      id: 'nav-today',
      title: 'Go to Today',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="3" y="4" width="14" height="14" rx="2" />
          <path d="M7 2v4M13 2v4M3 9h14" />
        </svg>
      ),
      shortcut: 'G D',
      onSelect: () => navigateTo('today'),
    },
    {
      id: 'nav-trash',
      title: 'Go to Trash',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 6h12l-1 11H5L4 6zM2 6h16M8 6V4h4v2" />
        </svg>
      ),
      onSelect: () => navigateTo('trash'),
    },
    {
      id: 'nav-settings',
      title: 'Go to Settings',
      category: 'Navigation',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 3v2M10 15v2M3 10h2M15 10h2" />
        </svg>
      ),
      shortcut: 'G S',
      onSelect: () => navigateTo('settings'),
    },

    // Actions
    {
      id: 'action-new-note',
      title: 'Create New Note',
      category: 'Actions',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 4v12M4 10h12" />
        </svg>
      ),
      shortcut: '⌘N',
      onSelect: async () => {
        if (!userId) return;
        try {
          const newNote = await createNote(userId, {
            title: 'Untitled Note',
            content: '',
            content_text: '',
            word_count: 0,
            tags: ['Ideas'],
          });
          navigateTo('notes', newNote.id);
          toast.success('Note created');
        } catch (e) {
          console.error(e);
          toast.error('Could not create note');
        }
      },
    },
    {
      id: 'action-new-task',
      title: 'Create New Task',
      category: 'Actions',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="10" cy="10" r="7" />
          <path d="M10 7v6M7 10h6" />
        </svg>
      ),
      shortcut: '⌘T',
      onSelect: async () => {
        if (!userId) return;
        try {
          await createTask(userId, {
            title: 'New Task',
            priority: 'medium',
          });
          navigateTo('tasks');
          toast.success('Task created');
        } catch (e) {
          console.error(e);
          toast.error('Could not create task');
        }
      },
    },

    // Theme
    {
      id: 'theme-light',
      title: 'Switch to Light Theme',
      category: 'Theme',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <circle cx="10" cy="10" r="4" />
          <path d="M10 2v2M10 16v2M2 10h2M16 10h2" />
        </svg>
      ),
      onSelect: () => {
        setTheme('light');
        closePalette();
        toast.success('Light theme activated');
      },
    },
    {
      id: 'theme-dark',
      title: 'Switch to Dark Theme',
      category: 'Theme',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M17 12A7 7 0 1 1 8 3a5 5 0 0 0 9 9z" />
        </svg>
      ),
      onSelect: () => {
        setTheme('dark');
        closePalette();
        toast.success('Dark theme activated');
      },
    },
    {
      id: 'theme-system',
      title: 'Switch to System Theme',
      category: 'Theme',
      icon: (
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
          <rect x="2" y="3" width="16" height="12" rx="2" />
          <path d="M7 19h6M10 15v4" />
        </svg>
      ),
      onSelect: () => {
        setTheme('system');
        closePalette();
        toast.success('System theme activated');
      },
    },
  ];

  // Convert note results into command items
  const noteCommands: CommandItem[] = noteResults.map((note) => ({
    id: `note-${note.id}`,
    title: note.title || 'Untitled Note',
    category: 'Notes',
    icon: (
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M4 4h12M4 8h12M4 12h8" />
      </svg>
    ),
    shortcut: note.tags && note.tags.length > 0 ? note.tags[0] : undefined,
    onSelect: () => navigateTo('notes', note.id),
  }));

  // Filter commands by query
  const q = query.toLowerCase().trim();
  const filteredCommands = [
    ...noteCommands,
    ...staticCommands.filter((c) => {
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
      );
    }),
  ];

  // Keyboard navigation inside palette
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].onSelect();
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selectedElement = list.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

  return (
    <div
      className="command-palette-backdrop"
      onClick={closePalette}
      role="presentation"
    >
      <div
        className="command-palette-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        tabIndex={-1}
      >
        {/* Search Input Bar */}
        <div className="command-palette-input-wrapper">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }}>
            <circle cx="9" cy="9" r="5" />
            <path d="M14 14l3 3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or search notes... (e.g. 'notes', 'dark', 'task')"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            aria-autocomplete="list"
          />
          <kbd className="command-palette-kbd">ESC</kbd>
        </div>

        {/* Results List */}
        <div className="command-palette-list" ref={listRef} role="listbox">
          {filteredCommands.length === 0 ? (
            <div className="command-palette-empty">
              <p style={{ fontWeight: 500 }}>No results found for &ldquo;{query}&rdquo;</p>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', marginTop: 'var(--space-1)' }}>
                Try searching for &apos;notes&apos;, &apos;theme&apos;, or a note title.
              </p>
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={cmd.id}
                  data-index={idx}
                  className={`command-palette-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => cmd.onSelect()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span className="command-palette-item-icon">{cmd.icon}</span>
                  <span className="command-palette-item-title">{cmd.title}</span>
                  <span className="command-palette-item-category">{cmd.category}</span>
                  {cmd.shortcut && (
                    <span className="command-palette-item-shortcut">{cmd.shortcut}</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts hint */}
        <div className="command-palette-footer">
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <span><kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to navigate</span>
            <span><kbd className="kbd">↵</kbd> to select</span>
            <span><kbd className="kbd">ESC</kbd> to dismiss</span>
          </div>
          <span style={{ color: 'var(--color-brand-600)', fontWeight: 600 }}>NoteNest</span>
        </div>
      </div>
    </div>
  );
}
