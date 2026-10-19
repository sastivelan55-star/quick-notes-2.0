/**
 * FlowNote AI — Local Database (IndexedDB via Dexie)
 *
 * This is the offline-first local store. All writes happen here first.
 * A sync layer then replicates to Supabase when online.
 */
import Dexie, { type Table } from 'dexie';

// ─── Local Schema (mirrors server schema with sync metadata) ────
export interface LocalNote {
  id: string;           // UUID (server-compatible)
  user_id: string;
  title: string;
  content: string;      // TipTap JSON serialized
  content_text: string; // plain text for local search
  type: string;
  status: 'active' | 'archived' | 'deleted';
  folder_id: string | null;
  is_pinned: boolean;
  is_favorite: boolean;
  color: string | null;
  word_count: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Sync fields
  sync_status: 'local' | 'pending' | 'synced' | 'conflict' | 'error';
  server_updated_at: string | null;
  // Local tags and draft recovery
  tags?: string[];
  is_draft?: boolean;
}

export interface LocalFolder {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  sync_status: 'local' | 'pending' | 'synced' | 'conflict' | 'error';
}

export interface LocalTag {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
  sync_status: 'local' | 'pending' | 'synced' | 'conflict' | 'error';
}

export interface LocalNoteTag {
  note_id: string;
  tag_id: string;
}

export interface LocalTask {
  id: string;
  user_id: string;
  note_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done';
  priority: 'none' | 'low' | 'medium' | 'high' | 'urgent';
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  is_deleted: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  sync_status: 'local' | 'pending' | 'synced' | 'conflict' | 'error';
}

export interface LocalSyncQueueItem {
  id?: number; // auto-increment
  entity_type: 'note' | 'task' | 'folder' | 'tag';
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string; // JSON string
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

export interface LocalAIJob {
  id?: number;
  note_id: string | null;
  operation: string;
  status: 'pending' | 'running' | 'done' | 'failed' | 'unavailable';
  input_hash: string;
  result: string | null;
  error: string | null;
  provider: string;
  model: string;
  tokens_used: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface LocalNoteRevision {
  id?: number;        // auto-increment
  note_id: string;
  title: string;
  content: string;    // TipTap JSON serialized
  content_text: string;
  word_count: number;
  saved_at: string;   // ISO timestamp
  revision_type: 'autosave' | 'manual' | 'recovery';
}

export interface AppSettings {
  key: string;
  value: string;
}

// ─── Database Class ─────────────────────────────────────────────
class FlowNoteDB extends Dexie {
  notes!: Table<LocalNote>;
  folders!: Table<LocalFolder>;
  tags!: Table<LocalTag>;
  note_tags!: Table<LocalNoteTag>;
  tasks!: Table<LocalTask>;
  sync_queue!: Table<LocalSyncQueueItem>;
  ai_jobs!: Table<LocalAIJob>;
  settings!: Table<AppSettings>;
  note_revisions!: Table<LocalNoteRevision>;

  constructor() {
    super('FlowNoteDB');

    this.version(1).stores({
      notes: 'id, user_id, status, folder_id, updated_at, sync_status, is_pinned, is_favorite, is_draft',
      folders: 'id, user_id, parent_id, sync_status',
      tags: 'id, user_id, name, sync_status',
      note_tags: '[note_id+tag_id], note_id, tag_id',
      tasks: 'id, user_id, note_id, parent_task_id, status, priority, due_date, is_deleted, sync_status',
      sync_queue: '++id, entity_type, entity_id, created_at',
      ai_jobs: '++id, note_id, status, created_at',
      settings: 'key',
    });

    // v2 — adds revision history table for autosave snapshots
    this.version(2).stores({
      notes: 'id, user_id, status, folder_id, updated_at, sync_status, is_pinned, is_favorite, is_draft',
      folders: 'id, user_id, parent_id, sync_status',
      tags: 'id, user_id, name, sync_status',
      note_tags: '[note_id+tag_id], note_id, tag_id',
      tasks: 'id, user_id, note_id, parent_task_id, status, priority, due_date, is_deleted, sync_status',
      sync_queue: '++id, entity_type, entity_id, created_at',
      ai_jobs: '++id, note_id, status, created_at',
      settings: 'key',
      note_revisions: '++id, note_id, saved_at, revision_type',
    });
  }
}

// Singleton instance — safe to use in server-side contexts too (will fail gracefully)
let db: FlowNoteDB | null = null;

export function getLocalDB(): FlowNoteDB {
  if (typeof window === 'undefined') {
    throw new Error('LocalDB is only available in the browser');
  }
  if (!db) {
    db = new FlowNoteDB();
  }
  return db;
}

// ─── Helper: get/set app settings ───────────────────────────────
export async function getSetting(key: string): Promise<string | null> {
  try {
    const db = getLocalDB();
    const row = await db.settings.get(key);
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    const db = getLocalDB();
    await db.settings.put({ key, value });
  } catch (e) {
    console.error('[LocalDB] setSetting error:', e);
  }
}
