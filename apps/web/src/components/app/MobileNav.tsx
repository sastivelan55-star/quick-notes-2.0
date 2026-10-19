'use client';

import { useAppStore, type AppView } from '@/store/app-store';
import { createNote } from '@/lib/services/notes';
import toast from 'react-hot-toast';

export default function MobileNav() {
  const {
    activeView,
    setActiveView,
    activeNoteId,
    setActiveNoteId,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    setCommandPaletteOpen,
    userId,
  } = useAppStore();

  async function handleFabClick() {
    if (!userId) return;
    try {
      if (activeView === 'tasks') {
        // Focus or trigger task creation
        setActiveView('tasks');
        const input = document.getElementById('checklist-quick-add-input');
        if (input) input.focus();
        toast('Add your task below');
      } else {
        const newNote = await createNote(userId, {
          title: 'New Note',
          content: '',
          content_text: '',
          word_count: 0,
          tags: ['Ideas'],
        });
        setActiveView('notes');
        setActiveNoteId(newNote.id);
        toast.success('New note created');
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not create item');
    }
  }

  const navItems: { id: AppView; label: string; icon: React.ReactNode }[] = [
    {
      id: 'notes',
      label: 'Notes',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h12M4 8h12M4 12h8M4 16h6" />
        </svg>
      ),
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="7" />
          <path d="M7 10l2 2 4-4" />
        </svg>
      ),
    },
    {
      id: 'search',
      label: 'Search',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="9" r="5" />
          <path d="M14 14l3 3" />
        </svg>
      ),
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10" r="2.5" />
          <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5.05 5.05l1.41 1.41M13.54 13.54l1.41 1.41M5.05 14.95l1.41-1.41M13.54 6.46l1.41-1.41" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="mobile-top-header" aria-label="Mobile header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          {activeView === 'notes' && activeNoteId ? (
            <button
              className="icon-btn"
              onClick={() => setActiveNoteId(null)}
              aria-label="Back to all notes"
              title="Back"
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M15 10H5M10 5L5 10l5 5" />
              </svg>
            </button>
          ) : (
            <button
              className="icon-btn"
              onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
              aria-label="Open navigation menu"
              title="Menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                background: '#2563EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="4" y="3" width="12" height="16" rx="2" fill="white" />
                <path d="M7 7h6M7 11h4" stroke="#2563EB" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              NoteNest
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
          <button
            className="icon-btn"
            onClick={() => setCommandPaletteOpen(true)}
            aria-label="Search and command palette"
            title="Search (⌘K)"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="9" cy="9" r="5" />
              <path d="M14 14l3 3" />
            </svg>
          </button>
        </div>
      </header>

      {/* Floating Action Button (+ FAB) matching Reference Image 1 & 5 */}
      {(!activeNoteId || activeView !== 'notes') && (
        <button
          className="mobile-fab"
          onClick={handleFabClick}
          aria-label="Create new note"
          title="Create new note"
          id="mobile-fab-btn"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav" aria-label="Mobile bottom navigation">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              className={`mobile-bottom-nav-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveView(item.id);
                if (item.id === 'notes') {
                  // Keep or show note list
                }
              }}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="mobile-bottom-nav-icon">{item.icon}</div>
              <span className="mobile-bottom-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
