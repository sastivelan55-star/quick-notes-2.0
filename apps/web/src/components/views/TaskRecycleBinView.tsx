'use client';

/**
 * LifeMap OS — Task Recycle Bin View
 *
 * Displays soft-deleted tasks with restore and permanent delete options.
 * Preserves task hierarchy metadata; restore re-parents orphaned subtasks to top level.
 * Empty Bin affects only the authenticated user's deleted tasks.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import {
  listDeletedTasks,
  restoreTask,
  permanentDeleteTask,
  emptyTaskRecycleBin,
} from '@/lib/services/tasks';
import type { LocalTask } from '@/lib/db/local';
import toast from 'react-hot-toast';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { onSyncDataChanged } from '@/lib/services/sync-worker';

/* ─── Icons ─────────────────────────────────────────────────────── */
const RestoreIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 10a7 7 0 1 0 2-4.9" />
    <path d="M3 3v4h4" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 6h12l-1 11H5L4 6zM2 6h16M8 6V4h4v2M8 10v5M12 10v5" />
  </svg>
);
const BackIcon = () => (
  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 10H5M5 10l5-5M5 10l5 5" />
  </svg>
);

/* ─── Confirm Modal ─────────────────────────────────────────────── */
interface ConfirmModalProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDanger?: boolean;
}
function ConfirmModal({ message, confirmLabel, onConfirm, onCancel, isDanger = true }: ConfirmModalProps) {
  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-box">
        <p className="modal-message">{message}</p>
        <div className="modal-actions">
          <button
            className={`btn btn-sm ${isDanger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */
export default function TaskRecycleBinView() {
  const { userId, setActiveView } = useAppStore();
  const [deletedTasks, setDeletedTasks] = useState<LocalTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<
    null | { type: 'single'; taskId: string } | { type: 'empty' }
  >(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const tasks = await listDeletedTasks(userId);
      setDeletedTasks(tasks);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const unsub = onSyncDataChanged(() => load());
    return unsub;
  }, [load]);

  async function handleRestore(taskId: string) {
    await restoreTask(taskId);
    await load();
    toast.success('Task restored');
  }

  async function handlePermanentDelete(taskId: string) {
    await permanentDeleteTask(taskId);
    await load();
    toast.success('Task permanently deleted');
    setConfirm(null);
  }

  async function handleEmptyBin() {
    if (!userId) return;
    await emptyTaskRecycleBin(userId);
    await load();
    toast.success('Recycle Bin emptied');
    setConfirm(null);
  }

  function formatDeletedDate(task: LocalTask): string {
    const ts = task.deleted_at ?? task.updated_at;
    try {
      return formatDistanceToNow(parseISO(ts), { addSuffix: true });
    } catch {
      return ts;
    }
  }

  return (
    <div className="task-builder">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="task-builder-header">
        <div className="task-builder-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setActiveView('tasks')}
              title="Back to Task Builder"
              id="back-to-tasks-btn"
              style={{ gap: 'var(--space-2)' }}
            >
              <BackIcon />
              Back
            </button>
            <div>
              <h1 className="task-builder-title">Recycle Bin</h1>
              <p className="task-builder-subtitle">
                Deleted tasks — restore or permanently remove them
              </p>
            </div>
          </div>

          {deletedTasks.length > 0 && (
            <button
              className="btn btn-sm btn-danger-outline"
              onClick={() => setConfirm({ type: 'empty' })}
              id="empty-recycle-bin-btn"
              title="Permanently delete all items"
            >
              <TrashIcon />
              Empty Bin
            </button>
          )}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────── */}
      <div className="task-builder-body">
        {loading ? (
          <div className="task-loading">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="task-skeleton">
                <div className="skeleton" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                <div className="skeleton" style={{ height: 14, flex: 1 }} />
              </div>
            ))}
          </div>
        ) : deletedTasks.length === 0 ? (
          <div className="task-empty">
            <div className="task-empty-icon">🗑️</div>
            <p className="task-empty-title">Recycle Bin is empty</p>
            <p className="task-empty-sub">Deleted tasks will appear here</p>
            <button
              className="btn btn-ghost"
              style={{ marginTop: 'var(--space-4)' }}
              onClick={() => setActiveView('tasks')}
            >
              <BackIcon /> Back to Task Builder
            </button>
          </div>
        ) : (
          <div className="task-list" role="list">
            {deletedTasks.map((task) => (
              <div key={task.id} className="recycle-bin-row" role="listitem">
                <div className="recycle-bin-info">
                  <span className="recycle-bin-title">{task.title}</span>
                  {task.description && (
                    <p className="recycle-bin-note">{task.description}</p>
                  )}
                  <span className="recycle-bin-date">
                    Deleted {formatDeletedDate(task)}
                  </span>
                </div>

                <div className="recycle-bin-actions">
                  <button
                    className="task-action-btn task-action-btn--restore"
                    onClick={() => handleRestore(task.id)}
                    title="Restore task"
                    aria-label="Restore task"
                  >
                    <RestoreIcon />
                    <span>Restore</span>
                  </button>
                  <button
                    className="task-action-btn task-action-btn--danger"
                    onClick={() => setConfirm({ type: 'single', taskId: task.id })}
                    title="Delete permanently"
                    aria-label="Delete permanently"
                  >
                    <TrashIcon />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Confirm modals ─────────────────────────────────── */}
      {confirm?.type === 'single' && (
        <ConfirmModal
          message="Permanently delete this task and all its subtasks? This cannot be undone."
          confirmLabel="Delete Forever"
          onConfirm={() => handlePermanentDelete((confirm as { type: 'single'; taskId: string }).taskId)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.type === 'empty' && (
        <ConfirmModal
          message={`Permanently delete all ${deletedTasks.length} item${deletedTasks.length !== 1 ? 's' : ''} in the Recycle Bin? This cannot be undone.`}
          confirmLabel="Empty Recycle Bin"
          onConfirm={handleEmptyBin}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
