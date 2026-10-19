/**
 * FlowNote AI — Tasks Service
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

export async function deleteTask(id: string): Promise<void> {
  await saveTask(id, { is_deleted: true });
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
    limit = 100,
  } = options;

  let collection = db.tasks.where('user_id').equals(userId).filter((t) => {
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

export async function getSubtasks(parentId: string): Promise<LocalTask[]> {
  const db = getLocalDB();
  return db.tasks
    .where('parent_task_id')
    .equals(parentId)
    .filter((t) => !t.is_deleted)
    .toArray();
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
