'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { getTodayTasks, getOverdueTasks } from '@/lib/services/tasks';
import { listNotes } from '@/lib/services/notes';
import type { LocalTask, LocalNote } from '@/lib/db/local';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { onSyncDataChanged } from '@/lib/services/sync-worker';

export default function TodayView() {
  const { userId, setActiveView, setActiveNoteId } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [todayTasks, setTodayTasks] = useState<LocalTask[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<LocalTask[]>([]);
  const [recentNotes, setRecentNotes] = useState<LocalNote[]>([]);
  useEffect(() => {
    let cancelled = false;
    async function fetchLatest() {
      if (!userId) return;
      const [today, overdue, notes] = await Promise.all([
        getTodayTasks(userId),
        getOverdueTasks(userId),
        listNotes(userId, { limit: 5 }),
      ]);
      if (!cancelled) {
        setTodayTasks(today);
        setOverdueTasks(overdue);
        setRecentNotes(notes);
        setLoading(false);
      }
    }

    fetchLatest();
    const unsub = onSyncDataChanged(() => {
      fetchLatest();
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, [userId]);

  const today = new Date();

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-8) var(--space-6)' }}>
        {/* Today header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)', marginBottom: 'var(--space-1)' }}>
            {format(today, 'EEEE')}
          </p>
          <h1 style={{ fontSize: 'var(--font-size-5xl)', fontWeight: 'var(--font-weight-bold)', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            {format(today, 'MMMM d')}
          </h1>
        </div>

        {/* Quick capture */}
        <div
          className="card card-hover"
          style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}
          onClick={() => setActiveView('capture')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setActiveView('capture')}
          aria-label="New note"
          id="today-new-note-btn"
        >
          <div style={{ width: 36, height: 36, background: 'var(--bg-brand-subtle)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-brand)', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M10 4v12M4 10h12" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)' }}>Capture a thought</div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>Open editor · ⌘N</div>
          </div>
        </div>

        {/* Overdue tasks */}
        {overdueTasks.length > 0 && (
          <section style={{ marginBottom: 'var(--space-6)' }} aria-label="Overdue tasks">
            <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-danger)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>
              Overdue · {overdueTasks.length}
            </h2>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {overdueTasks.map((task) => (
                <TodayTaskRow key={task.id} task={task} isOverdue />
              ))}
            </div>
          </section>
        )}

        {/* Today's tasks */}
        <section style={{ marginBottom: 'var(--space-6)' }} aria-label="Today's tasks">
          <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>
            Today · {todayTasks.length}
          </h2>
          {todayTasks.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
              No tasks due today. 
              <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('tasks')} style={{ marginLeft: 'var(--space-2)' }}>
                Add a task →
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {todayTasks.map((task) => <TodayTaskRow key={task.id} task={task} />)}
            </div>
          )}
        </section>

        {/* Recent notes */}
        <section aria-label="Recent notes">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
            <h2 style={{ fontSize: 'var(--font-size-xs)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Recent Notes
            </h2>
            <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('notes')}>
              See all →
            </button>
          </div>
          {recentNotes.length === 0 ? (
            <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
              No notes yet. 
              <button className="btn btn-ghost btn-sm" onClick={() => setActiveView('capture')} style={{ marginLeft: 'var(--space-2)' }}>
                Write your first note →
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--space-3)', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
              {recentNotes.map((note) => (
                <div
                  key={note.id}
                  className="card card-hover"
                  onClick={() => {
                    setActiveNoteId(note.id);
                    setActiveView('notes');
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') { setActiveNoteId(note.id); setActiveView('notes'); }}}
                  style={{ padding: 'var(--space-4)' }}
                  aria-label={`Open note: ${note.title || 'Untitled'}`}
                >
                  <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', marginBottom: 'var(--space-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.title || 'Untitled'}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.content_text?.slice(0, 80) || 'Empty note'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TodayTaskRow({ task, isOverdue }: { task: LocalTask; isOverdue?: boolean }) {
  return (
    <div className="task-item" style={{ background: isOverdue ? 'var(--color-danger-bg)' : undefined }}>
      <div
        className={`task-checkbox ${task.status === 'done' ? 'checked' : ''}`}
        role="checkbox"
        aria-checked={task.status === 'done'}
        tabIndex={0}
        style={{ cursor: 'pointer' }}
      >
        {task.status === 'done' && (
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </div>
      <div className="task-content">
        <div className={`task-title ${task.status === 'done' ? 'done' : ''}`}>{task.title}</div>
        {task.due_date && (
          <div className="task-meta">
            <span className="task-meta-item" style={{ color: isOverdue ? 'var(--text-danger)' : undefined }}>
              {isOverdue ? `Overdue · ${format(parseISO(task.due_date), 'MMM d')}` : 'Today'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
