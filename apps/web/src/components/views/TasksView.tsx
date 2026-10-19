'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  listTasks,
  createTask,
  saveTask,
  completeTask,
  uncompleteTask,
  deleteTask,
  getOverdueTasks,
  getTodayTasks,
} from '@/lib/services/tasks';
import type { LocalTask } from '@/lib/db/local';
import { format, isToday, isPast, parseISO } from 'date-fns';
import toast from 'react-hot-toast';

type TaskFilter = 'all' | 'today' | 'overdue' | 'done';

function formatDeadlineText(dueDateStr: string | null): { text: string; isUrgent?: boolean; isTodayDate?: boolean } | null {
  if (!dueDateStr) return null;
  try {
    const d = parseISO(dueDateStr);
    if (isToday(d)) return { text: 'Today', isTodayDate: true };
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return { text: 'Tomorrow' };
    if (isPast(d)) return { text: format(d, 'MMM d'), isUrgent: true };
    return { text: format(d, 'MMM d') };
  } catch {
    return null;
  }
}

export default function TasksView() {
  const { userId, setTodayTaskCount, setOverdueTaskCount } = useAppStore();
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [loading, setLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const loadTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      let result: LocalTask[];

      if (filter === 'today') {
        result = await getTodayTasks(userId);
      } else if (filter === 'overdue') {
        result = await getOverdueTasks(userId);
      } else if (filter === 'done') {
        result = await listTasks(userId, { status: 'done' });
      } else {
        result = await listTasks(userId, { includeDeleted: false });
      }

      setTasks(result);

      // Update badges
      const todayT = await getTodayTasks(userId);
      const overdueT = await getOverdueTasks(userId);
      setTodayTaskCount(todayT.length);
      setOverdueTaskCount(overdueT.length);
    } finally {
      setLoading(false);
    }
  }, [userId, filter, setTodayTaskCount, setOverdueTaskCount]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function handleAddTask() {
    if (!userId || !newTaskTitle.trim()) return;
    await createTask(userId, { title: newTaskTitle.trim() });
    setNewTaskTitle('');
    await loadTasks();
    toast.success('Task added');
  }

  async function handleComplete(task: LocalTask) {
    if (task.status === 'done') {
      await uncompleteTask(task.id);
      toast.success('Task reopened');
    } else {
      await completeTask(task.id);
      toast.success('Task completed! 🎉');
    }
    await loadTasks();
  }

  async function handleDelete(id: string) {
    await deleteTask(id);
    await loadTasks();
    toast.success('Task deleted');
  }

  const FILTERS: { key: TaskFilter; label: string }[] = [
    { key: 'all', label: 'All Tasks' },
    { key: 'today', label: 'Today' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'done', label: 'Completed' },
  ];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-secondary)' }}>
      {/* Workspace Header with Filter Tabs */}
      <div className="workspace-header" style={{ justifyContent: 'space-between', background: 'var(--bg-primary)' }}>
        <h1 style={{ fontSize: 'var(--font-size-base)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--text-primary)' }}>
          Tasks & Checklists
        </h1>

        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`btn btn-sm ${filter === f.key ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => setFilter(f.key)}
              style={{
                borderRadius: 'var(--radius-full)',
                fontWeight: filter === f.key ? 'var(--font-weight-semibold)' : 'var(--font-weight-regular)',
                background: filter === f.key ? 'var(--bg-brand-subtle)' : 'transparent',
                color: filter === f.key ? 'var(--text-brand)' : 'var(--text-secondary)',
              }}
              id={`task-filter-${f.key}`}
              aria-pressed={filter === f.key}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Checklist Card Area (Reference Image 4: "Tech Project Alpha") */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-8) var(--space-4)' }}>
        <div className="checklist-card">
          {/* Card Header */}
          <div className="checklist-card-header">
            <h2 className="checklist-card-title">
              {filter === 'today' ? 'Today’s Priorities' : filter === 'overdue' ? 'Overdue Items' : filter === 'done' ? 'Completed Tasks' : 'Tech Project Alpha'}
            </h2>
            <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label="Card options">
              <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>
          </div>

          {/* Checklist Items */}
          <div style={{ minHeight: 120 }}>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'center' }}>
                  <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                  <div className="skeleton" style={{ height: 14, flex: 1 }} />
                </div>
              ))
            ) : tasks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-6) 0', color: 'var(--text-tertiary)' }}>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>No tasks here. Add one below!</p>
              </div>
            ) : (
              tasks.map((task) => {
                const deadline = formatDeadlineText(task.due_date);
                const isCompleted = task.status === 'done';

                return (
                  <div key={task.id} className="checklist-item">
                    {/* Blue Round Checkmark (Reference Image 4) */}
                    <button
                      className={`task-check-circle ${isCompleted ? 'checked' : ''}`}
                      onClick={() => handleComplete(task)}
                      aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {isCompleted && (
                        <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 10l3 3L15 6" />
                        </svg>
                      )}
                    </button>

                    {/* Task Title */}
                    <span className={`checklist-item-title ${isCompleted ? 'completed' : ''}`}>
                      {task.title}
                    </span>

                    {/* Deadline Badge */}
                    {deadline && (
                      <span className={`task-due-badge ${deadline.isUrgent ? 'urgent' : deadline.isTodayDate ? 'today' : ''}`}>
                        {deadline.text}
                      </span>
                    )}

                    {/* Quick Delete */}
                    <button
                      className="icon-btn"
                      onClick={() => handleDelete(task.id)}
                      style={{ width: 20, height: 20, opacity: 0.4 }}
                      title="Delete task"
                      aria-label="Delete task"
                    >
                      <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4l12 12M16 4L4 16" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Rounded Quick-Add Input (Reference Image 4) */}
          <div className="checklist-quick-add">
            <input
              className="checklist-quick-input"
              type="text"
              placeholder="Add a task..."
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddTask();
              }}
              id="new-task-quick-input"
              aria-label="Add a task"
            />
            {newTaskTitle.trim() && (
              <button
                className="btn-pill-primary"
                onClick={handleAddTask}
                style={{ padding: '4px 12px', fontSize: '11px' }}
              >
                Add
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
