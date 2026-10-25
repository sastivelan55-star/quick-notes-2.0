/**
 * FlowNote AI — Sync Queue Service
 *
 * Every local mutation is added to a sync queue.
 * A background worker picks these up and replicates to Supabase.
 */
import { getLocalDB, type LocalSyncQueueItem } from '@/lib/db/local';

type QueueTriggerCallback = () => void;
let queueTriggerCallback: QueueTriggerCallback | null = null;

export function registerQueueTrigger(cb: QueueTriggerCallback) {
  queueTriggerCallback = cb;
}

export async function queueSync(
  entityType: LocalSyncQueueItem['entity_type'],
  entityId: string,
  operation: LocalSyncQueueItem['operation'],
  payload: unknown
): Promise<void> {
  // Never enqueue local drafts into cloud sync queue
  if (entityId === 'DRAFT_NOTE') {
    return;
  }

  try {
    const db = getLocalDB();
    const item: LocalSyncQueueItem = {
      entity_type: entityType,
      entity_id: entityId,
      operation,
      payload: JSON.stringify(payload),
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_error: null,
    };
    await db.sync_queue.put(item);

    // Immediately notify sync worker to process in-flight mutation without waiting for periodic polling
    if (queueTriggerCallback) {
      try {
        queueTriggerCallback();
      } catch {
        // Safe trigger
      }
    }
  } catch (e) {
    // Sync queue failure should never break local editing
    console.warn('[SyncQueue] Failed to enqueue:', e);
  }
}

export async function getPendingItems(): Promise<LocalSyncQueueItem[]> {
  const db = getLocalDB();
  return db.sync_queue.orderBy('created_at').toArray();
}

export async function markSynced(id: number): Promise<void> {
  const db = getLocalDB();
  await db.sync_queue.delete(id);
}

export async function markFailed(id: number, error: string): Promise<void> {
  const db = getLocalDB();
  const item = await db.sync_queue.get(id);
  if (!item) return;
  await db.sync_queue.put({
    ...item,
    retry_count: item.retry_count + 1,
    last_error: error,
  });
}

export async function getQueueSize(): Promise<number> {
  const db = getLocalDB();
  return db.sync_queue.count();
}
