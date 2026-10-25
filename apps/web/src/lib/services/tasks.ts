/**
 * LifeMap OS — Tasks Service
 *
 * Offline-first task management with full Recycle Bin support.
 * Soft-delete sets is_deleted + deleted_at; permanent delete removes from local DB.
 */
import { v4 as uuidv4 } from 'uuid';
import { getLocalDB, type LocalTask } from '@/lib/db/local';
import { queueSync } from './sync-queue';

export async function createTask(
  userId: string,
  partial: Partial<LocalTask> = {}
): Promise<LocalTask> {
  const db = getLocalDB();
  const now = new Date().toISOString();

  const task: LocalTask = {
    id: uuidv4(),
    user_id: userId,
    note_id: null,
    parent_task_id: null,
    title: '',
    description: null,
    status: 'open',
    priority: 'none',
    due_date: null,
    start_date: null,
    completed_at: null,
    is_deleted: false,
    deleted_at: null,
    sort_order: Date.now(),
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
    ...partial,
  };

  await db.tasks.put(task);
  await queueSync('task', task.id, 'create', task as unknown as Record<string, unknown>);
  return task;
}

export async function saveTask(
  id: string,
  updates: Partial<LocalTask>
): Promise<void> {
  const db = getLocalDB();
  const existing = await db.tasks.get(id);
  if (!existing) throw new Error(`Task ${id} not found`);

  const updated: LocalTask = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.tasks.put(updated);
  await queueSync('task', id, 'update', updated as unknown as Record<string, unknown>);
}

export async function completeTask(id: string): Promise<void> {
  await saveTask(id, {
    status: 'done',
    completed_at: new Date().toISOString(),
  });
}

export async function uncompleteTask(id: string): Promise<void> {
  await saveTask(id, { status: 'open', completed_at: null });
}

/**
 * Soft-delete: moves task (and all descendants) to Recycle Bin.
 * Sets is_deleted=true and deleted_at=now on the task and all subtasks recursively.
 */
export async function deleteTask(id: string): Promise<void> {
  const now = new Date().toISOString();
  await _softDeleteRecursive(id, now);
}

async function _softDeleteRecursive(id: string, deletedAt: string): Promise<void> {
  const db = getLocalDB();
  // Soft-delete this task
  const existing = await db.tasks.get(id);
  if (!existing) return;
  const updated: LocalTask = {
    ...existing,
    is_deleted: true,
    deleted_at: deletedAt,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };
  await db.tasks.put(updated);
  await queueSync('task', id, 'update', updated as unknown as Record<string, unknown>);

  // Recursively soft-delete all direct children
  const children = await db.tasks
    .where('parent_task_id')
    .equals(id)
    .filter((t) => !t.is_deleted)
    .toArray();
  for (const child of children) {
    await _softDeleteRecursive(child.id, deletedAt);
  }
}

/**
 * Restore a task from the Recycle Bin.
 * Also restores all descendant tasks that share the same deleted_at timestamp.
 * If the parent task is still deleted, re-parents to top-level (null parent).
 */
export async function restoreTask(id: string): Promise<void> {
  const db = getLocalDB();
  const task = await db.tasks.get(id);
  if (!task) return;

  const deletedAt = task.deleted_at;

  // Check if parent is still deleted — if so, orphan to top level
  let parentTaskId = task.parent_task_id;
  if (parentTaskId) {
    const parent = await db.tasks.get(parentTaskId);
    if (!parent || parent.is_deleted) {
      parentTaskId = null;
    }
  }

  // Restore this task
  const updated: LocalTask = {
    ...task,
    is_deleted: false,
    deleted_at: null,
    parent_task_id: parentTaskId,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };
  await db.tasks.put(updated);
  await queueSync('task', id, 'update', updated as unknown as Record<string, unknown>);

  // Restore all descendants that were deleted at the same time as this task
  if (deletedAt) {
    await _restoreDescendants(id, deletedAt);
  }
}

async function _restoreDescendants(parentId: string, deletedAt: string): Promise<void> {
  const db = getLocalDB();
  const children = await db.tasks
    .where('parent_task_id')
    .equals(parentId)
    .filter((t) => t.is_deleted && t.deleted_at === deletedAt)
    .toArray();

  for (const child of children) {
    const updated: LocalTask = {
      ...child,
      is_deleted: false,
      deleted_at: null,
      updated_at: new Date().toISOString(),
      sync_status: 'pending',
    };
    await db.tasks.put(updated);
    await queueSync('task', child.id, 'update', updated as unknown as Record<string, unknown>);
    await _restoreDescendants(child.id, deletedAt);
  }
}

/**
 * Permanently delete a single task from local DB and queue server delete.
 * Recursively deletes all subtasks too.
 */
export async function permanentDeleteTask(id: string): Promise<void> {
  const db = getLocalDB();
  // Delete children first
  const children = await db.tasks.where('parent_task_id').equals(id).toArray();
  for (const child of children) {
    await permanentDeleteTask(child.id);
  }
  await db.tasks.delete(id);
  await queueSync('task', id, 'delete', { id });
}

/**
 * Empty the Recycle Bin: permanently delete all soft-deleted tasks for this user.
 * Only affects tasks with is_deleted=true. Active tasks are never touched.
 */
export async function emptyTaskRecycleBin(userId: string): Promise<void> {
  const db = getLocalDB();
  const deletedTasks = await db.tasks
    .where('user_id')
    .equals(userId)
    .filter((t) => t.is_deleted)
    .toArray();

  for (const task of deletedTasks) {
    await db.tasks.delete(task.id);
    await queueSync('task', task.id, 'delete', { id: task.id });
  }
}

export async function listTasks(
  userId: string,
  options: {
    noteId?: string;
    status?: LocalTask['status'];
    priority?: LocalTask['priority'];
    dueBefore?: string;
    includeDeleted?: boolean;
    limit?: number;
  } = {}
): Promise<LocalTask[]> {
  const db = getLocalDB();
  const {
    noteId,
    status,
    priority,
    dueBefore,
    includeDeleted = false,
    limit = 500,
  } = options;

  const collection = db.tasks.where('user_id').equals(userId).filter((t) => {
    if (!includeDeleted && t.is_deleted) return false;
    if (status && t.status !== status) return false;
    if (priority && t.priority !== priority) return false;
    if (noteId && t.note_id !== noteId) return false;
    if (dueBefore && t.due_date && t.due_date > dueBefore) return false;
    if (t.parent_task_id) return false; // top-level only (use getSubtasks for nested)
    return true;
  });

  const tasks = await collection.limit(limit).toArray();
  tasks.sort((a, b) => a.sort_order - b.sort_order);
  return tasks;
}

/**
 * List all soft-deleted tasks for the Recycle Bin.
 * Only returns top-level deleted tasks (parent is not also deleted, or parent itself deleted).
 */
export async function listDeletedTasks(userId: string): Promise<LocalTask[]> {
  const db = getLocalDB();
  const deleted = await db.tasks
    .where('user_id')
    .equals(userId)
    .filter((t) => t.is_deleted)
    .toArray();

  // Return only "root" deleted tasks: ones whose parent is either null or not deleted
  const deletedIds = new Set(deleted.map((t) => t.id));
  const roots = deleted.filter(
    (t) => !t.parent_task_id || !deletedIds.has(t.parent_task_id)
  );
  roots.sort((a, b) => {
    // Sort by deleted_at descending (most recently deleted first)
    const da = a.deleted_at ?? a.updated_at;
    const db2 = b.deleted_at ?? b.updated_at;
    return db2.localeCompare(da);
  });
  return roots;
}

export async function getSubtasks(parentId: string): Promise<LocalTask[]> {
  const db = getLocalDB();
  const subtasks = await db.tasks
    .where('parent_task_id')
    .equals(parentId)
    .filter((t) => !t.is_deleted)
    .toArray();
  subtasks.sort((a, b) => a.sort_order - b.sort_order);
  return subtasks;
}

export async function getOverdueTasks(userId: string): Promise<LocalTask[]> {
  const today = new Date().toISOString().split('T')[0];
  const db = getLocalDB();
  return db.tasks
    .where('user_id')
    .equals(userId)
    .filter(
      (t) =>
        !t.is_deleted &&
        t.status !== 'done' &&
        t.due_date !== null &&
        t.due_date < today
    )
    .toArray();
}

export async function getTodayTasks(userId: string): Promise<LocalTask[]> {
  const today = new Date().toISOString().split('T')[0];
  const db = getLocalDB();
  return db.tasks
    .where('user_id')
    .equals(userId)
    .filter(
      (t) =>
        !t.is_deleted &&
        t.status !== 'done' &&
        t.due_date !== null &&
        t.due_date <= today
    )
    .toArray();
}
