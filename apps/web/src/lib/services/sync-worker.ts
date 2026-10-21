/**
 * FlowNote AI — Background Sync Worker
 *
 * Runs in the browser to flush the sync queue to Supabase.
 * Uses exponential backoff and respects online/offline state.
 */
import { createClient } from '@/lib/supabase/client';
import { getLocalDB } from '@/lib/db/local';
import { getPendingItems, markSynced, markFailed } from './sync-queue';

const MAX_RETRY = 5;
const SYNC_INTERVAL_MS = 5000;
const MAX_BACKOFF_MS = 60000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;

type SyncStatusListener = (status: 'idle' | 'syncing' | 'error' | 'offline') => void;
const listeners = new Set<SyncStatusListener>();

export function onSyncStatus(cb: SyncStatusListener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(status: 'idle' | 'syncing' | 'error' | 'offline') {
  listeners.forEach((cb) => cb(status));
}

export function startSyncWorker() {
  if (typeof window === 'undefined') return;
  schedulSync();
  window.addEventListener('online', () => schedulSync(0));
  window.addEventListener('focus', () => schedulSync(0));
}

export function stopSyncWorker() {
  if (syncTimer) clearTimeout(syncTimer);
}

function schedulSync(delayMs = SYNC_INTERVAL_MS) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delayMs);
}

async function runSync() {
  if (!navigator.onLine) {
    notify('offline');
    schedulSync();
    return;
  }

  if (isSyncing) return;
  isSyncing = true;

  const supabase = createClient();
  if (!supabase) {
    // Not configured — skip sync
    isSyncing = false;
    schedulSync();
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    isSyncing = false;
    schedulSync();
    return;
  }

  const pending = await getPendingItems();
  if (pending.length === 0) {
    notify('idle');
    isSyncing = false;
    schedulSync();
    return;
  }

  notify('syncing');

  let hasError = false;

  for (const item of pending) {
    if (item.id == null) continue;
    if (item.retry_count >= MAX_RETRY) continue;

    try {
      const payload = JSON.parse(item.payload);

      if (item.entity_type === 'note') {
        await syncNote(supabase, item.operation, payload, user.id);
      } else if (item.entity_type === 'task') {
        await syncTask(supabase, item.operation, payload, user.id);
      } else if (item.entity_type === 'folder') {
        await syncFolder(supabase, item.operation, payload, user.id);
      } else if (item.entity_type === 'tag') {
        await syncTag(supabase, item.operation, payload, user.id);
      }

      await markSynced(item.id);

      // Update local sync status
      await updateLocalSyncStatus(item.entity_type, item.entity_id, 'synced');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[LifeMap OS Sync] Item sync failed:', item.entity_type, item.entity_id, msg);
      await markFailed(item.id, msg);
      await updateLocalSyncStatus(item.entity_type, item.entity_id, 'error');
      hasError = true;
    }
  }

  notify(hasError ? 'error' : 'idle');
  isSyncing = false;
  schedulSync();
}

async function updateLocalSyncStatus(
  type: string,
  id: string,
  status: 'synced' | 'error'
) {
  try {
    const db = getLocalDB();
    if (type === 'note') {
      const note = await db.notes.get(id);
      if (note) await db.notes.put({ ...note, sync_status: status });
    } else if (type === 'task') {
      const task = await db.tasks.get(id);
      if (task) await db.tasks.put({ ...task, sync_status: status });
    }
  } catch {
    // Local update failed — not critical
  }
}

// ─── Per-entity sync functions ────────────────────────────────────
async function syncNote(
  supabase: ReturnType<typeof createClient>,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;

  if (operation === 'delete') {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const allowedNoteFields = [
    'id', 'title', 'content', 'content_text', 'type', 'status',
    'folder_id', 'is_pinned', 'is_favorite', 'color', 'word_count',
    'created_at', 'updated_at', 'deleted_at'
  ];
  const cleanPayload: Record<string, unknown> = { user_id: userId };
  for (const field of allowedNoteFields) {
    if (field in payload) {
      cleanPayload[field] = payload[field];
    }
  }

  const { error } = await supabase.from('notes').upsert(
    cleanPayload,
    { onConflict: 'id', ignoreDuplicates: false }
  );

  if (error) throw new Error(error.message);
}

async function syncTask(
  supabase: ReturnType<typeof createClient>,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;

  if (operation === 'delete') {
    const { error } = await supabase
      .from('tasks')
      .update({ is_deleted: true })
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const allowedTaskFields = [
    'id', 'note_id', 'parent_task_id', 'title', 'description',
    'status', 'priority', 'due_date', 'start_date', 'completed_at',
    'is_deleted', 'sort_order', 'created_at', 'updated_at'
  ];
  const cleanPayload: Record<string, unknown> = { user_id: userId };
  for (const field of allowedTaskFields) {
    if (field in payload) {
      cleanPayload[field] = payload[field];
    }
  }

  const { error } = await supabase.from('tasks').upsert(
    cleanPayload,
    { onConflict: 'id' }
  );

  if (error) throw new Error(error.message);
}

async function syncFolder(
  supabase: ReturnType<typeof createClient>,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;

  if (operation === 'delete') {
    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const allowedFolderFields = [
    'id', 'name', 'parent_id', 'color', 'icon', 'sort_order',
    'created_at', 'updated_at'
  ];
  const cleanPayload: Record<string, unknown> = { user_id: userId };
  for (const field of allowedFolderFields) {
    if (field in payload) {
      cleanPayload[field] = payload[field];
    }
  }

  const { error } = await supabase.from('folders').upsert(
    cleanPayload,
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

async function syncTag(
  supabase: ReturnType<typeof createClient>,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;

  if (operation === 'delete') {
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const allowedTagFields = [
    'id', 'name', 'color', 'created_at'
  ];
  const cleanPayload: Record<string, unknown> = { user_id: userId };
  for (const field of allowedTagFields) {
    if (field in payload) {
      cleanPayload[field] = payload[field];
    }
  }

  const { error } = await supabase.from('tags').upsert(
    cleanPayload,
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}
