'use client';

/**
 * LifeMap OS — Task Builder View
 *
 * Full-featured personal task workspace with:
 * - Unlimited tasks and nested subtasks
 * - Independent notes per task/subtask
 * - Create, edit, complete, reopen, delete (to Recycle Bin)
 * - Expand/collapse subtask trees
 * - Search and filters (All, Active, Completed)
 * - Supabase cloud sync via offline-first IndexedDB
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  listTasks,
  createTask,
  saveTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  getSubtasks,
  getOverdueTasks,
  getTodayTasks,
} from '@/lib/services/tasks';
import type { LocalTask } from '@/lib/db/local';
import toast from 'react-hot-toast';
import { onSyncDataChanged } from '@/lib/services/sync-worker';

type TaskFilter = 'all' | 'active' | 'done';

/* ─── Inline SVG icons ──────────────────────────────────────────── */
const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 5l5 5-5 5" />
  </svg>
);
const ChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 7l5 5 5-5" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12l-1 11H5L4 6zM2 6h16M8 6V4h4v2M8 10v5M12 10v5" />
  </svg>
);
const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M10 4v12M4 10h12" />
  </svg>
);
const NoteIcon = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="14" height="14" rx="2" />
    <path d="M7 7h6M7 11h4" />
  </svg>
);
const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 3.3a1 1 0 0 1 2 2L7 15l-3 1 1-3 9.7-9.7z" />
  </svg>
);
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="9" cy="9" r="5" /><path d="M14 14l3 3" />
  </svg>
);

/* ─── TaskRow component ─────────────────────────────────────────── */
interface TaskRowProps {
  task: LocalTask;
  depth: number;
  userId: string;
  onRefresh: () => void;
  searchQuery: string;
}

function TaskRow({ task, depth, userId, onRefresh, searchQuery }: TaskRowProps) {
  const [subtasks, setSubtasks] = useState<LocalTask[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editNote, setEditNote] = useState(task.description ?? '');
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [subtaskCount, setSubtaskCount] = useState(0);
  const editRef = useRef<HTMLInputElement>(null);
  const subtaskInputRef = useRef<HTMLInputElement>(null);

  const isCompleted = task.status === 'done';

  const loadSubtasks = useCallback(async () => {
    const subs = await getSubtasks(task.id);
    setSubtasks(subs);
    setSubtaskCount(subs.length);
  }, [task.id]);

  useEffect(() => {
    loadSubtasks();
  }, [loadSubtasks]);

  // If searching and task doesn't match, still render subtasks that might match
  const matchesSearch =
    !searchQuery ||
    task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (task.description ?? '').toLowerCase().includes(searchQuery.toLowerCase());

  const filteredSubtasks = searchQuery
    ? subtasks.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : subtasks;

  // Auto-expand when searching
  useEffect(() => {
    if (searchQuery && filteredSubtasks.length > 0) {
      setExpanded(true);
    }
  }, [searchQuery, filteredSubtasks.length]);

  const visibleSubtasks = searchQuery ? filteredSubtasks : (expanded ? subtasks : []);

  async function handleComplete() {
    if (isCompleted) {
      await uncompleteTask(task.id);
      toast.success('Task reopened');
    } else {
      await completeTask(task.id);
      toast.success('Task completed! 🎉');
    }
    onRefresh();
  }

  async function handleDelete() {
    await deleteTask(task.id);
    onRefresh();
    toast.success('Moved to Recycle Bin');
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return;
    await saveTask(task.id, {
      title: editTitle.trim(),
      description: editNote.trim() || null,
    });
    setEditing(false);
    onRefresh();
    toast.success('Task updated');
  }

  async function handleAddSubtask() {
    if (!newSubtaskTitle.trim()) return;
    await createTask(userId, {
      title: newSubtaskTitle.trim(),
      parent_task_id: task.id,
      sort_order: Date.now(),
    });
    setNewSubtaskTitle('');
    setAddingSubtask(false);
    setExpanded(true);
    await loadSubtasks();
    onRefresh();
    toast.success('Subtask added');
  }

  async function handleSaveNote() {
    await saveTask(task.id, { description: editNote.trim() || null });
    setShowNote(false);
    onRefresh();
    toast.success('Note saved');
  }

  function startEdit() {
    setEditTitle(task.title);
    setEditNote(task.description ?? '');
    setEditing(true);
    setTimeout(() => editRef.current?.focus(), 50);
  }

  function startAddSubtask() {
    setAddingSubtask(true);
    setExpanded(true);
    setTimeout(() => subtaskInputRef.current?.focus(), 50);
  }

  if (searchQuery && !matchesSearch && filteredSubtasks.length === 0) return null;

  const indentLeft = depth * 24;

  return (
    <div className="task-row-wrapper" style={{ marginLeft: indentLeft }}>
      <div className={`task-row ${isCompleted ? 'task-row--done' : ''}`}>
        {/* Expand/collapse toggle */}
        <button
          className="task-expand-btn"
          onClick={() => {
            setExpanded((v) => !v);
            if (!expanded) loadSubtasks();
          }}
          aria-label={expanded ? 'Collapse subtasks' : 'Expand subtasks'}
          style={{ opacity: subtaskCount > 0 ? 1 : 0.2, cursor: subtaskCount > 0 ? 'pointer' : 'default' }}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </button>

        {/* Completion check */}
        <button
          className={`task-check ${isCompleted ? 'task-check--done' : ''}`}
          onClick={handleComplete}
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          {isCompleted && (
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10l4 4 8-8" />
            </svg>
          )}
        </button>

        {/* Title / edit */}
        <div className="task-body">
          {editing ? (
            <div className="task-edit-form">
              <input
                ref={editRef}
                className="task-edit-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') setEditing(false);
                }}
                placeholder="Task title"
              />
              <textarea
                className="task-edit-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="Add a note... (optional)"
                rows={2}
              />
              <div className="task-edit-actions">
                <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <span className={`task-title ${isCompleted ? 'task-title--done' : ''}`}>
                {task.title}
              </span>
              {task.description && (
                <p className="task-note-preview">{task.description}</p>
              )}
            </>
          )}
        </div>

        {/* Meta: subtask count badge */}
        {subtaskCount > 0 && !editing && (
          <span className="task-subtask-badge" title={`${subtaskCount} subtask${subtaskCount !== 1 ? 's' : ''}`}>
            {subtaskCount}
          </span>
        )}

        {/* Actions */}
        {!editing && (
          <div className="task-actions">
            <button
              className="task-action-btn"
              onClick={startAddSubtask}
              title="Add subtask"
              aria-label="Add subtask"
            >
              <PlusIcon />
            </button>
            <button
              className={`task-action-btn ${showNote ? 'task-action-btn--active' : ''} ${task.description ? 'task-action-btn--noted' : ''}`}
              onClick={() => {
                setEditNote(task.description ?? '');
                setShowNote((v) => !v);
              }}
              title={task.description ? 'Edit note' : 'Add note'}
              aria-label={task.description ? 'Edit note' : 'Add note'}
            >
              <NoteIcon />
            </button>
            <button
              className="task-action-btn"
              onClick={startEdit}
              title="Edit task"
              aria-label="Edit task"
            >
              <EditIcon />
            </button>
            <button
              className="task-action-btn task-action-btn--danger"
              onClick={handleDelete}
              title="Move to Recycle Bin"
              aria-label="Move to Recycle Bin"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Inline note editor */}
      {showNote && !editing && (
        <div className="task-note-editor" style={{ marginLeft: 42 }}>
          <textarea
            className="task-note-textarea"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
            placeholder="Write a note for this task..."
            rows={3}
            autoFocus
          />
          <div className="task-edit-actions">
            <button className="btn btn-primary btn-sm" onClick={handleSaveNote}>Save Note</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNote(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Inline add subtask */}
      {addingSubtask && (
        <div className="task-add-subtask" style={{ marginLeft: 42 }}>
          <div className="task-subtask-indent-line" />
          <input
            ref={subtaskInputRef}
            className="task-subtask-input"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSubtask();
              if (e.key === 'Escape') { setAddingSubtask(false); setNewSubtaskTitle(''); }
            }}
            placeholder="Subtask title… (Enter to add)"
          />
          <div className="task-edit-actions">
            <button className="btn btn-primary btn-sm" onClick={handleAddSubtask}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setAddingSubtask(false); setNewSubtaskTitle(''); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Subtask list */}
      {visibleSubtasks.length > 0 && (
        <div className="task-subtask-list">
          {visibleSubtasks.map((sub) => (
            <TaskRow
              key={sub.id}
              task={sub}
              depth={depth + 1}
              userId={userId}
              onRefresh={async () => { await loadSubtasks(); onRefresh(); }}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main TasksView ────────────────────────────────────────────── */
export default function TasksView() {
  const { userId, setTodayTaskCount, setOverdueTaskCount, setActiveView } = useAppStore();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const addInputRef = useRef<HTMLInputElement>(null);

  const loadTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let result: LocalTask[];
      if (filter === 'done') {
        result = await listTasks(userId, { status: 'done', includeDeleted: false });
      } else if (filter === 'active') {
        result = await listTasks(userId, { status: 'open', includeDeleted: false });
      } else {
        result = await listTasks(userId, { includeDeleted: false });
      }
      setTasks(result);

      // Update sidebar badges
      const [todayT, overdueT] = await Promise.all([
        getTodayTasks(userId),
        getOverdueTasks(userId),
      ]);
      setTodayTaskCount(todayT.length);
      setOverdueTaskCount(overdueT.length);
    } finally {
      setLoading(false);
    }
  }, [userId, filter, setTodayTaskCount, setOverdueTaskCount]);

  useEffect(() => {
    loadTasks();
    const unsub = onSyncDataChanged(() => { loadTasks(); });
    return unsub;
  }, [loadTasks]);

  async function handleAddTask() {
    if (!userId || !newTaskTitle.trim()) return;
    await createTask(userId, { title: newTaskTitle.trim() });
    setNewTaskTitle('');
    setAdding(false);
    await loadTasks();
    toast.success('Task created');
  }

  // Filtered tasks for search
  const displayedTasks = searchQuery
    ? tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tasks;

  const completedCount = tasks.filter((t) => t.status === 'done').length;
  const activeCount = tasks.filter((t) => t.status !== 'done').length;

  const FILTERS: { key: TaskFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'done', label: 'Completed' },
  ];

  return (
    <div className="task-builder">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="task-builder-header">
        <div className="task-builder-title-row">
          <div>
            <h1 className="task-builder-title">Task Builder</h1>
            <p className="task-builder-subtitle">
              Create and manage your tasks, subtasks, and notes
            </p>
          </div>

          {/* Recycle Bin link */}
          <button
            className="task-bin-link"
            onClick={() => setActiveView('trash')}
            title="Open Recycle Bin"
            id="task-recycle-bin-btn"
          >
            <TrashIcon />
            <span>Recycle Bin</span>
          </button>
        </div>

        {/* Search + Add */}
        <div className="task-builder-controls">
          <div className="task-search-wrap">
            <SearchIcon />
            <input
              className="task-search"
              type="search"
              placeholder="Search tasks and notes…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="task-search-input"
              aria-label="Search tasks"
            />
          </div>

          <button
            className="btn btn-primary task-add-main-btn"
            onClick={() => {
              setAdding(true);
              setTimeout(() => addInputRef.current?.focus(), 50);
            }}
            id="add-main-task-btn"
          >
            <PlusIcon />
            Add Main Task
          </button>
        </div>

        {/* Filters */}
        <div className="task-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`task-filter-tab ${filter === f.key ? 'task-filter-tab--active' : ''}`}
              onClick={() => setFilter(f.key)}
              id={`task-filter-${f.key}`}
              aria-pressed={filter === f.key}
            >
              {f.label}
              {f.key === 'active' && activeCount > 0 && (
                <span className="task-filter-count">{activeCount}</span>
              )}
              {f.key === 'done' && completedCount > 0 && (
                <span className="task-filter-count">{completedCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task List ──────────────────────────────────────── */}
      <div className="task-builder-body">
        {/* Quick-add form */}
        {adding && (
          <div className="task-add-form">
            <div className="task-add-form-inner">
              <div
                className="task-check task-check--placeholder"
                aria-hidden="true"
              />
              <input
                ref={addInputRef}
                className="task-add-input"
                type="text"
                placeholder="Task title…"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddTask();
                  if (e.key === 'Escape') { setAdding(false); setNewTaskTitle(''); }
                }}
                id="new-task-title-input"
                aria-label="New task title"
              />
            </div>
            <div className="task-add-form-actions">
              <button className="btn btn-primary btn-sm" onClick={handleAddTask} disabled={!newTaskTitle.trim()}>
                Add Task
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setNewTaskTitle(''); }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="task-loading">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="task-skeleton">
                <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                <div className="skeleton" style={{ height: 14, flex: 1 }} />
              </div>
            ))}
          </div>
        ) : displayedTasks.length === 0 ? (
          <div className="task-empty">
            {searchQuery ? (
              <>
                <div className="task-empty-icon">🔍</div>
                <p className="task-empty-title">No tasks match your search</p>
                <p className="task-empty-sub">Try different keywords</p>
              </>
            ) : filter !== 'all' ? (
              <>
                <div className="task-empty-icon">
                  {filter === 'done' ? '✅' : '📋'}
                </div>
                <p className="task-empty-title">
                  {filter === 'done' ? 'No completed tasks yet' : 'No active tasks'}
                </p>
                <p className="task-empty-sub">
                  {filter === 'done' ? 'Complete some tasks to see them here.' : 'All tasks are completed!'}
                </p>
              </>
            ) : (
              <>
                <div className="task-empty-icon">🗂️</div>
                <p className="task-empty-title">Your workspace is empty</p>
                <p className="task-empty-sub">Create your first task to get started</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 'var(--space-4)' }}
                  onClick={() => {
                    setAdding(true);
                    setTimeout(() => addInputRef.current?.focus(), 50);
                  }}
                >
                  <PlusIcon /> Add Main Task
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="task-list" role="list">
            {displayedTasks.map((task) => (
              userId && (
                <div key={task.id} role="listitem">
                  <TaskRow
                    task={task}
                    depth={0}
                    userId={userId}
                    onRefresh={loadTasks}
                    searchQuery={searchQuery}
                  />
                </div>
              )
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
