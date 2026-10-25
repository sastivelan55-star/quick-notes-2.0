/**
 * FlowNote AI — Background Sync Worker
 *
 * Provides bidirectional synchronization between local IndexedDB and Supabase:
 * 1. PUSH: Flushes local mutations to Supabase in FIFO order with retries.
 * 2. PULL: Retrieves remote records, reconciles via Last-Write-Wins, and updates local state.
 * 3. REACTIVITY: Emits events when remote changes arrive to update open UI views instantly.
 * 4. REALTIME: Listens for remote Postgres changes and triggers sync on visibility/focus/reconnect.
 */
import { v4 as uuidv4 } from 'uuid';
import { createClient, type SupabaseClient } from '@/lib/supabase/client';
import { getLocalDB } from '@/lib/db/local';
import { getPendingItems, markSynced, markFailed, getQueueSize, registerQueueTrigger } from './sync-queue';

const MAX_RETRY = 5;
const SYNC_INTERVAL_MS = 8000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let isSyncing = false;
let realtimeChannel: ReturnType<SupabaseClient['channel']> | null = null;
let currentRealtimeUserId: string | null = null;

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncDiagnostics {
  status: SyncStatus;
  isConfigured: boolean;
  userId: string | null;
  userMaskedId: string | null;
  pendingCount: number;
  lastSyncAttempt: string | null;
  lastSuccessfulPush: string | null;
  lastSuccessfulPull: string | null;
  pulledNotesCount: number;
  pushedNotesCount: number;
  failedCount: number;
  lastError: string | null;
}

const diagnostics: SyncDiagnostics = {
  status: 'idle',
  isConfigured: true,
  userId: null,
  userMaskedId: null,
  pendingCount: 0,
  lastSyncAttempt: null,
  lastSuccessfulPush: null,
  lastSuccessfulPull: null,
  pulledNotesCount: 0,
  pushedNotesCount: 0,
  failedCount: 0,
  lastError: null,
};

type SyncStatusListener = (status: SyncStatus) => void;
type DataChangedListener = () => void;
type DiagnosticsListener = (diag: SyncDiagnostics) => void;

const statusListeners = new Set<SyncStatusListener>();
const dataChangedListeners = new Set<DataChangedListener>();
const diagnosticsListeners = new Set<DiagnosticsListener>();

export function onSyncStatus(cb: SyncStatusListener) {
  statusListeners.add(cb);
  return () => {
    statusListeners.delete(cb);
  };
}

export function onSyncDataChanged(cb: DataChangedListener) {
  dataChangedListeners.add(cb);
  return () => {
    dataChangedListeners.delete(cb);
  };
}

export function onSyncDiagnostics(cb: DiagnosticsListener) {
  diagnosticsListeners.add(cb);
  return () => {
    diagnosticsListeners.delete(cb);
  };
}

export function getSyncDiagnostics(): SyncDiagnostics {
  return { ...diagnostics };
}

function notifyStatus(status: SyncStatus) {
  diagnostics.status = status;
  statusListeners.forEach((cb) => {
    try {
      cb(status);
    } catch {
      // Ignore listener error
    }
  });
  notifyDiagnostics();
}

export function notifyDataChanged() {
  dataChangedListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // Ignore listener error
    }
  });
}

function notifyDiagnostics() {
  diagnosticsListeners.forEach((cb) => {
    try {
      cb({ ...diagnostics });
    } catch {
      // Ignore listener error
    }
  });
}

// ─── Lifecycle Control ───────────────────────────────────────────
let workerStarted = false;

export function startSyncWorker() {
  if (typeof window === 'undefined') return;
  if (workerStarted) return;
  workerStarted = true;

  // Immediately hook into queue insertions so local mutations trigger upload without waiting for interval
  registerQueueTrigger(() => schedulSync(100));

  // Immediate initial schedule
  schedulSync(300);

  // Network and window lifecycle listeners
  window.addEventListener('online', () => schedulSync(0));
  window.addEventListener('focus', () => schedulSync(0));

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        schedulSync(0);
      }
    });
  }
}

export function stopSyncWorker() {
  if (syncTimer) clearTimeout(syncTimer);
  workerStarted = false;
  if (realtimeChannel) {
    try {
      realtimeChannel.unsubscribe();
    } catch {
      // Ignore cleanup error
    }
    realtimeChannel = null;
    currentRealtimeUserId = null;
  }
}

export function schedulSync(delayMs = SYNC_INTERVAL_MS) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(runSync, delayMs);
}

export function triggerSyncNow() {
  schedulSync(0);
}

// ─── Main Bidirectional Sync Execution ───────────────────────────
export async function runSync() {
  if (typeof window === 'undefined') return;

  if (!navigator.onLine) {
    notifyStatus('offline');
    schedulSync(15000);
    return;
  }

  if (isSyncing) return;
  isSyncing = true;

  diagnostics.lastSyncAttempt = new Date().toISOString();

  const supabase = createClient();
  if (!supabase) {
    diagnostics.isConfigured = false;
    notifyStatus('idle');
    isSyncing = false;
    return;
  }
  diagnostics.isConfigured = true;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || user.id === 'local') {
      // Unauthenticated or local guest mode — no cloud sync
      diagnostics.userId = null;
      diagnostics.userMaskedId = null;
      notifyStatus('idle');
      isSyncing = false;
      schedulSync(SYNC_INTERVAL_MS * 2);
      return;
    }

    diagnostics.userId = user.id;
    diagnostics.userMaskedId = `${user.id.slice(0, 8)}...${user.id.slice(-4)}`;

    // Set up Realtime listener if user changed
    setupRealtime(supabase, user.id);

    notifyStatus('syncing');

    // ── Phase A: PUSH pending mutations to Supabase ───────────────
    let hasPushError = false;
    let pushCount = 0;
    const pending = await getPendingItems();
    diagnostics.pendingCount = pending.length;

    for (const item of pending) {
      if (item.id == null) continue;
      if (item.retry_count >= MAX_RETRY) {
        diagnostics.failedCount++;
        continue;
      }

      // Purge and acknowledge any local draft items that might have entered queue
      if (item.entity_id === 'DRAFT_NOTE') {
        await markSynced(item.id);
        continue;
      }

      try {
        const payload = JSON.parse(item.payload);

        if (payload?.id === 'DRAFT_NOTE' || payload?.is_draft) {
          await markSynced(item.id);
          continue;
        }

        // Security check: ensure item belongs to currently authenticated user
        if (payload.user_id && payload.user_id !== user.id && payload.user_id !== 'local') {
          // Skip items belonging to another user account
          continue;
        }

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
        await updateLocalSyncStatus(item.entity_type, item.entity_id, 'synced');
        pushCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        diagnostics.lastError = msg;
        diagnostics.failedCount++;
        await markFailed(item.id, msg);
        await updateLocalSyncStatus(item.entity_type, item.entity_id, 'error');
        hasPushError = true;
      }
    }

    if (pushCount > 0) {
      diagnostics.lastSuccessfulPush = new Date().toISOString();
      diagnostics.pushedNotesCount += pushCount;
    }
    diagnostics.pendingCount = await getQueueSize();

    // ── Phase B: PULL remote changes from Supabase ───────────────
    let hasPullError = false;
    let pullResult = { notesUpdated: 0, tasksUpdated: 0, foldersUpdated: 0, tagsUpdated: 0 };

    try {
      pullResult = await pullRemoteChanges(supabase, user.id);
      diagnostics.lastSuccessfulPull = new Date().toISOString();
      diagnostics.pulledNotesCount += pullResult.notesUpdated;
    } catch (pullErr: unknown) {
      const msg = pullErr instanceof Error ? pullErr.message : String(pullErr);
      diagnostics.lastError = msg;
      hasPullError = true;
    }

    // If local state was updated by remote records, trigger UI re-render
    const totalRemoteUpdates =
      pullResult.notesUpdated +
      pullResult.tasksUpdated +
      pullResult.foldersUpdated +
      pullResult.tagsUpdated;

    if (totalRemoteUpdates > 0) {
      notifyDataChanged();
    }

    notifyStatus(hasPushError || hasPullError ? 'error' : 'idle');
  } catch (globalErr: unknown) {
    const msg = globalErr instanceof Error ? globalErr.message : String(globalErr);
    diagnostics.lastError = msg;
    notifyStatus('error');
  } finally {
    isSyncing = false;
    schedulSync(SYNC_INTERVAL_MS);
  }
}

// ─── Realtime Postgres Change Subscription ───────────────────────
function setupRealtime(supabase: SupabaseClient, userId: string) {
  if (typeof window === 'undefined') return;
  if (realtimeChannel && currentRealtimeUserId === userId) return;

  if (realtimeChannel) {
    try {
      realtimeChannel.unsubscribe();
    } catch {
      // Ignore
    }
    realtimeChannel = null;
  }

  currentRealtimeUserId = userId;

  try {
    realtimeChannel = supabase
      .channel(`user-sync-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notes', filter: `user_id=eq.${userId}` },
        () => {
          schedulSync(300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => {
          schedulSync(300);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'folders', filter: `user_id=eq.${userId}` },
        () => {
          schedulSync(300);
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          // Fall back gracefully to polling
          console.warn('[SyncWorker] Realtime channel closed; polling active');
        }
      });
  } catch (err) {
    console.warn('[SyncWorker] Could not initialize realtime channel:', err);
  }
}

// ─── Local Status Updater ────────────────────────────────────────
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
    // Non-critical local metadata update
  }
}

interface RemoteFolderRow {
  id: string;
  user_id: string;
  name: string;
  parent_id?: string | null;
  color?: string | null;
  icon?: string | null;
  sort_order?: number | null;
  created_at: string;
  updated_at: string;
}

interface RemoteTagRow {
  id: string;
  user_id: string;
  name: string;
  color?: string | null;
  created_at: string;
}

interface RemoteNoteRow {
  id: string;
  user_id: string;
  title?: string | null;
  content?: string | null;
  content_text?: string | null;
  type?: 'note' | 'journal' | 'task_list' | null;
  status?: string | null;
  folder_id?: string | null;
  is_pinned?: boolean | null;
  is_favorite?: boolean | null;
  color?: string | null;
  word_count?: number | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

interface RemoteTaskRow {
  id: string;
  user_id: string;
  note_id?: string | null;
  parent_task_id?: string | null;
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  sort_order?: number | null;
  created_at: string;
  updated_at: string;
}

function mapRemoteNoteStatus(
  status?: string | null,
  fallback: 'active' | 'archived' | 'deleted' = 'active'
): 'active' | 'archived' | 'deleted' {
  if (status === 'trashed' || status === 'deleted') return 'deleted';
  if (status === 'archived') return 'archived';
  if (status === 'active') return 'active';
  return fallback;
}

function mapRemoteTaskStatus(
  status?: string | null,
  fallback: 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done' = 'open'
): 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done' {
  if (status === 'completed' || status === 'done') return 'done';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'blocked') return 'blocked';
  if (status === 'waiting') return 'waiting';
  if (status === 'open' || status === 'pending') return 'open';
  return fallback;
}

function mapRemoteTaskPriority(
  priority?: string | null,
  fallback: 'none' | 'low' | 'medium' | 'high' | 'urgent' = 'none'
): 'none' | 'low' | 'medium' | 'high' | 'urgent' {
  if (priority === 'urgent' || priority === 'high' || priority === 'medium' || priority === 'low') {
    return priority;
  }
  return fallback;
}

// ─── Cloud-to-Local Reconciler (PULL) ────────────────────────────
async function pullRemoteChanges(
  supabase: SupabaseClient,
  userId: string
): Promise<{ notesUpdated: number; tasksUpdated: number; foldersUpdated: number; tagsUpdated: number }> {
  const db = getLocalDB();
  let notesUpdated = 0;
  let tasksUpdated = 0;
  let foldersUpdated = 0;
  let tagsUpdated = 0;

  // 1. Fetch remote folders, tags, notes, tasks, and note_tags in parallel with pagination
  const [
    remoteFolders,
    remoteTags,
    remoteNotes,
    remoteTasks,
    remoteNoteTags,
  ] = await Promise.all([
    fetchAllUserRecords<RemoteFolderRow>(supabase, 'folders', userId),
    fetchAllUserRecords<RemoteTagRow>(supabase, 'tags', userId),
    fetchAllUserRecords<RemoteNoteRow>(supabase, 'notes', userId),
    fetchAllUserRecords<RemoteTaskRow>(supabase, 'tasks', userId),
    fetchAllNoteTags(supabase),
  ]);

  // 2. Reconcile Folders
  for (const rf of remoteFolders) {
    const local = await db.folders.get(rf.id);
    if (!local) {
      await db.folders.put({
        id: rf.id,
        user_id: rf.user_id,
        name: rf.name,
        parent_id: rf.parent_id ?? null,
        color: rf.color ?? null,
        icon: rf.icon ?? null,
        sort_order: rf.sort_order ?? 0,
        created_at: rf.created_at,
        updated_at: rf.updated_at,
        sync_status: 'synced',
      });
      foldersUpdated++;
    } else if (rf.updated_at > local.updated_at) {
      const pendingItem = await db.sync_queue.where('entity_id').equals(rf.id).first();
      if (!pendingItem) {
        await db.folders.put({
          ...local,
          name: rf.name,
          parent_id: rf.parent_id ?? null,
          color: rf.color ?? null,
          icon: rf.icon ?? null,
          sort_order: rf.sort_order ?? 0,
          updated_at: rf.updated_at,
          sync_status: 'synced',
        });
        foldersUpdated++;
      }
    }
  }

  // 3. Reconcile Tags
  const tagMapById = new Map<string, string>();
  for (const rt of remoteTags) {
    tagMapById.set(rt.id, rt.name);
    const local = await db.tags.get(rt.id);
    if (!local) {
      await db.tags.put({
        id: rt.id,
        user_id: rt.user_id,
        name: rt.name,
        color: rt.color ?? null,
        created_at: rt.created_at,
        sync_status: 'synced',
      });
      tagsUpdated++;
    }
  }

  // Map note_id -> string[] of tag names
  const tagsByNoteId = new Map<string, string[]>();
  for (const nt of remoteNoteTags) {
    const tagName = tagMapById.get(nt.tag_id);
    if (tagName) {
      const list = tagsByNoteId.get(nt.note_id) ?? [];
      if (!list.includes(tagName)) {
        list.push(tagName);
      }
      tagsByNoteId.set(nt.note_id, list);
    }
  }

  // 4. Reconcile Notes
  const remoteNoteIds = new Set<string>();

  for (const rn of remoteNotes) {
    remoteNoteIds.add(rn.id);
    const local = await db.notes.get(rn.id);
    const attachedTags = tagsByNoteId.get(rn.id) ?? [];

    if (!local) {
      // Fresh note from another device
      await db.notes.put({
        id: rn.id,
        user_id: rn.user_id,
        title: rn.title ?? '',
        content: rn.content ?? '{"type":"doc","content":[{"type":"paragraph"}]}',
        content_text: rn.content_text ?? '',
        type: rn.type ?? 'note',
        status: mapRemoteNoteStatus(rn.status),
        folder_id: rn.folder_id ?? null,
        is_pinned: Boolean(rn.is_pinned),
        is_favorite: Boolean(rn.is_favorite),
        color: rn.color ?? null,
        word_count: rn.word_count ?? 0,
        tags: attachedTags,
        created_at: rn.created_at,
        updated_at: rn.updated_at,
        deleted_at: rn.deleted_at ?? null,
        sync_status: 'synced',
        server_updated_at: rn.updated_at,
      });
      notesUpdated++;
    } else {
      // Local copy exists: inspect pending queue and timestamps
      const pendingItem = await db.sync_queue.where('entity_id').equals(rn.id).first();

      if (!pendingItem) {
        // No local edits in flight: apply server state if server is newer or equal with differing content
        const isServerNewer = rn.updated_at > local.updated_at;
        const isContentDifferent = rn.title !== local.title || rn.content !== local.content || rn.status !== local.status;
        const shouldApply = isServerNewer || (rn.updated_at === local.updated_at && isContentDifferent) || local.sync_status !== 'synced';

        if (shouldApply) {
          if (isContentDifferent) {
            await db.note_revisions.put({
              note_id: local.id,
              title: local.title,
              content: local.content,
              content_text: local.content_text,
              word_count: local.word_count,
              saved_at: new Date().toISOString(),
              revision_type: 'recovery',
            });
          }
          await db.notes.put({
            ...local,
            title: rn.title ?? '',
            content: rn.content ?? local.content,
            content_text: rn.content_text ?? '',
            type: rn.type ?? local.type,
            status: mapRemoteNoteStatus(rn.status, local.status),
            folder_id: rn.folder_id ?? null,
            is_pinned: Boolean(rn.is_pinned),
            is_favorite: Boolean(rn.is_favorite),
            color: rn.color ?? null,
            word_count: rn.word_count ?? local.word_count,
            tags: attachedTags,
            updated_at: rn.updated_at,
            deleted_at: rn.deleted_at ?? null,
            sync_status: 'synced',
            server_updated_at: rn.updated_at,
          });
          notesUpdated++;
        }
      } else {
        // Pending local edit in flight! Last-Write-Wins comparison
        if (rn.updated_at > local.updated_at) {
          // Server is newer (conflict): preserve local draft into revisions before applying server version
          await db.note_revisions.put({
            note_id: local.id,
            title: local.title,
            content: local.content,
            content_text: local.content_text,
            word_count: local.word_count,
            saved_at: new Date().toISOString(),
            revision_type: 'recovery',
          });

          await db.notes.put({
            ...local,
            title: rn.title ?? '',
            content: rn.content ?? local.content,
            content_text: rn.content_text ?? '',
            status: mapRemoteNoteStatus(rn.status, local.status),
            folder_id: rn.folder_id ?? null,
            is_pinned: Boolean(rn.is_pinned),
            is_favorite: Boolean(rn.is_favorite),
            tags: attachedTags,
            updated_at: rn.updated_at,
            deleted_at: rn.deleted_at ?? null,
            sync_status: 'synced',
            server_updated_at: rn.updated_at,
          });
          notesUpdated++;
        }
      }
    }
  }

  // Handle permanent remote deletions:
  // If a note exists locally as 'synced', has NO pending queue item, but is missing from remoteNotes:
  const allLocalNotes = await db.notes.where('user_id').equals(userId).toArray();
  for (const ln of allLocalNotes) {
    if (ln.id === 'DRAFT_NOTE') continue;
    if (!remoteNoteIds.has(ln.id) && ln.sync_status === 'synced') {
      const pendingItem = await db.sync_queue.where('entity_id').equals(ln.id).first();
      if (!pendingItem) {
        await db.notes.delete(ln.id);
        notesUpdated++;
      }
    }
  }

  // 5. Reconcile Tasks
  for (const rt of remoteTasks) {
    const local = await db.tasks.get(rt.id);
    if (!local) {
      await db.tasks.put({
        id: rt.id,
        user_id: rt.user_id,
        note_id: rt.note_id ?? null,
        parent_task_id: rt.parent_task_id ?? null,
        title: rt.title,
        description: rt.description ?? null,
        status: mapRemoteTaskStatus(rt.status),
        priority: mapRemoteTaskPriority(rt.priority),
        due_date: rt.due_date ?? null,
        start_date: rt.start_date ?? null,
        completed_at: rt.completed_at ?? null,
        is_deleted: Boolean(rt.is_deleted),
        deleted_at: rt.deleted_at ?? null,
        sort_order: rt.sort_order ?? 0,
        created_at: rt.created_at,
        updated_at: rt.updated_at,
        sync_status: 'synced',
      });
      tasksUpdated++;
    } else if (rt.updated_at > local.updated_at) {
      const pendingItem = await db.sync_queue.where('entity_id').equals(rt.id).first();
      if (!pendingItem) {
        await db.tasks.put({
          ...local,
          note_id: rt.note_id ?? null,
          parent_task_id: rt.parent_task_id ?? null,
          title: rt.title,
          description: rt.description ?? null,
          status: mapRemoteTaskStatus(rt.status, local.status),
          priority: mapRemoteTaskPriority(rt.priority, local.priority),
          due_date: rt.due_date ?? null,
          start_date: rt.start_date ?? null,
          completed_at: rt.completed_at ?? null,
          is_deleted: Boolean(rt.is_deleted),
          deleted_at: rt.deleted_at ?? null,
          sort_order: rt.sort_order ?? 0,
          updated_at: rt.updated_at,
          sync_status: 'synced',
        });
        tasksUpdated++;
      }
    }
  }

  return { notesUpdated, tasksUpdated, foldersUpdated, tagsUpdated };
}

// ─── Supabase Data Access Helpers ────────────────────────────────
async function fetchAllUserRecords<T>(
  supabase: SupabaseClient,
  table: string,
  userId: string,
  selectQuery = '*'
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  let allRecords: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(table)
      .select(selectQuery)
      .eq('user_id', userId)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Failed to fetch ${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allRecords = allRecords.concat(data as T[]);

    if (data.length < PAGE_SIZE) {
      hasMore = false;
    } else {
      from += PAGE_SIZE;
    }
  }

  return allRecords;
}

async function fetchAllNoteTags(
  supabase: SupabaseClient
): Promise<{ note_id: string; tag_id: string }[]> {
  try {
    const { data, error } = await supabase
      .from('note_tags')
      .select('note_id, tag_id');

    if (error) {
      console.warn('[SyncWorker] note_tags query error:', error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

// ─── Per-Entity Push Functions ───────────────────────────────────
async function syncNote(
  supabase: SupabaseClient,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;
  const noteId = String(payload.id);
  if (!noteId || noteId === 'DRAFT_NOTE') return;

  if (operation === 'delete') {
    // Delete note_tags associations first
    try {
      await supabase.from('note_tags').delete().eq('note_id', noteId);
    } catch {
      // Ignore
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
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
    if (field in payload && payload[field] !== undefined) {
      let val = payload[field];
      // Sanitize empty strings to null for PostgreSQL foreign keys and timestamps
      if (val === '' && (field === 'folder_id' || field === 'deleted_at' || field === 'color')) {
        val = null;
      }
      cleanPayload[field] = val;
    }
  }

  // Ensure default string values
  if (cleanPayload.title === undefined || cleanPayload.title === null) cleanPayload.title = '';
  if (cleanPayload.content === undefined || cleanPayload.content === null) cleanPayload.content = '';
  if (cleanPayload.content_text === undefined || cleanPayload.content_text === null) cleanPayload.content_text = '';
  if (!cleanPayload.type) cleanPayload.type = 'note';
  if (!cleanPayload.status) cleanPayload.status = 'active';

  const { error } = await supabase.from('notes').upsert(
    cleanPayload,
    { onConflict: 'id', ignoreDuplicates: false }
  );

  if (error) throw new Error(error.message);

  // Synchronize note tags if present
  if (Array.isArray(payload.tags)) {
    await syncNoteTags(supabase, noteId, payload.tags as string[], userId);
  }
}

async function syncNoteTags(
  supabase: SupabaseClient,
  noteId: string,
  tagNames: string[],
  userId: string
) {
  try {
    const trimmedNames = Array.from(new Set(tagNames.map((t) => t.trim()).filter(Boolean)));
    if (trimmedNames.length === 0) {
      await supabase.from('note_tags').delete().eq('note_id', noteId);
      return;
    }

    const targetTagIds: string[] = [];
    for (const name of trimmedNames) {
      // Query existing tag for this user
      const { data: existing } = await supabase
        .from('tags')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', name)
        .maybeSingle();

      if (existing?.id) {
        targetTagIds.push(existing.id);
      } else {
        const newId = uuidv4();
        // Safe upsert with user_id, name conflict handling
        const { data: upserted } = await supabase
          .from('tags')
          .upsert(
            { id: newId, user_id: userId, name },
            { onConflict: 'user_id, name' }
          )
          .select('id')
          .maybeSingle();

        if (upserted?.id) {
          targetTagIds.push(upserted.id);
        } else {
          // Re-fetch in case conflict occurred without return
          const { data: recheck } = await supabase
            .from('tags')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', name)
            .maybeSingle();
          if (recheck?.id) {
            targetTagIds.push(recheck.id);
          }
        }
      }
    }

    if (targetTagIds.length === 0) return;

    // Query current note_tags
    const { data: currentLinks } = await supabase
      .from('note_tags')
      .select('tag_id')
      .eq('note_id', noteId);

    const currentTagIds = new Set((currentLinks ?? []).map((l: { tag_id: string }) => l.tag_id));
    const targetTagIdSet = new Set(targetTagIds);

    // Delete unassociated
    for (const tagId of currentTagIds) {
      if (!targetTagIdSet.has(tagId)) {
        await supabase
          .from('note_tags')
          .delete()
          .eq('note_id', noteId)
          .eq('tag_id', tagId);
      }
    }

    // Insert new associations
    for (const tagId of targetTagIds) {
      if (!currentTagIds.has(tagId)) {
        await supabase
          .from('note_tags')
          .insert({ note_id: noteId, tag_id: tagId });
      }
    }
  } catch (err) {
    console.warn('[SyncWorker] Tag sync error:', err);
  }
}

async function syncTask(
  supabase: SupabaseClient,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;

  if (operation === 'delete') {
    // permanentDeleteTask sends a 'delete' operation — hard-delete from server
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const allowedTaskFields = [
    'id', 'note_id', 'parent_task_id', 'title', 'description',
    'status', 'priority', 'due_date', 'start_date', 'completed_at',
    'is_deleted', 'deleted_at', 'sort_order', 'created_at', 'updated_at'
  ];
  const cleanPayload: Record<string, unknown> = { user_id: userId };
  for (const field of allowedTaskFields) {
    if (field in payload && payload[field] !== undefined) {
      let val = payload[field];
      if (val === '' && (field === 'note_id' || field === 'parent_task_id' || field === 'due_date' || field === 'start_date' || field === 'completed_at' || field === 'description' || field === 'deleted_at')) {
        val = null;
      }
      cleanPayload[field] = val;
    }
  }

  const { error } = await supabase.from('tasks').upsert(
    cleanPayload,
    { onConflict: 'id' }
  );

  if (error) throw new Error(error.message);
}

async function syncFolder(
  supabase: SupabaseClient,
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
    if (field in payload && payload[field] !== undefined) {
      let val = payload[field];
      if (val === '' && (field === 'parent_id' || field === 'color' || field === 'icon')) {
        val = null;
      }
      cleanPayload[field] = val;
    }
  }

  const { error } = await supabase.from('folders').upsert(
    cleanPayload,
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

async function syncTag(
  supabase: SupabaseClient,
  operation: string,
  payload: Record<string, unknown>,
  userId: string
) {
  if (!supabase) return;

  if (operation === 'delete') {
    try {
      await supabase.from('note_tags').delete().eq('tag_id', payload.id);
    } catch {
      // Ignore
    }
    const { error } = await supabase
      .from('tags')
      .delete()
      .eq('id', payload.id)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }

  const allowedTagFields = ['id', 'name', 'color', 'created_at'];
  const cleanPayload: Record<string, unknown> = { user_id: userId };
  for (const field of allowedTagFields) {
    if (field in payload && payload[field] !== undefined) {
      let val = payload[field];
      if (val === '' && field === 'color') {
        val = null;
      }
      cleanPayload[field] = val;
    }
  }

  const { error } = await supabase.from('tags').upsert(
    cleanPayload,
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}
