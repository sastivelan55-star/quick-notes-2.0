'use client';

/**
 * LifeMap OS — Unified Trash / Recycle Bin
 *
 * Shows two tabs:
 *   - Notes Trash  (soft-deleted notes, uses existing NotesView status="deleted")
 *   - Task Recycle Bin (soft-deleted tasks, uses TaskRecycleBinView)
 *
 * Navigating here from the Task Builder "Recycle Bin" button defaults to the Tasks tab.
 */

import { useState } from 'react';
import NotesView from './NotesView';
import TaskRecycleBinView from './TaskRecycleBinView';

type TrashTab = 'tasks' | 'notes';

export default function TrashView() {
  const [activeTab, setActiveTab] = useState<TrashTab>('tasks');

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
      {/* Tab switcher */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-1)',
          padding: 'var(--space-3) var(--space-4) 0',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-primary)',
        }}
      >
        <button
          className={`task-filter-tab ${activeTab === 'tasks' ? 'task-filter-tab--active' : ''}`}
          onClick={() => setActiveTab('tasks')}
          id="trash-tab-tasks"
          aria-selected={activeTab === 'tasks'}
        >
          🗑️ Task Recycle Bin
        </button>
        <button
          className={`task-filter-tab ${activeTab === 'notes' ? 'task-filter-tab--active' : ''}`}
          onClick={() => setActiveTab('notes')}
          id="trash-tab-notes"
          aria-selected={activeTab === 'notes'}
        >
          📝 Notes Trash
        </button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'tasks' ? (
          <TaskRecycleBinView />
        ) : (
          <NotesView status="deleted" />
        )}
      </div>
    </div>
  );
}
