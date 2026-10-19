// ============================================================
// FlowNote AI — Shared Domain Types
// All entities use stable UUIDs and are user-scoped.
// ============================================================

// ─── Primitives ─────────────────────────────────────────────
export type UUID = string;
export type ISODateString = string;

// ─── Note Types ─────────────────────────────────────────────
export type NoteType =
  | 'note'
  | 'meeting'
  | 'journal'
  | 'task_list'
  | 'idea'
  | 'research'
  | 'reference'
  | 'template';

export type NoteStatus = 'active' | 'archived' | 'deleted';

export interface Note {
  id: UUID;
  user_id: UUID;
  title: string;
  content: string; // TipTap JSON string
  content_text: string; // plain-text for search
  type: NoteType;
  status: NoteStatus;
  folder_id: UUID | null;
  is_pinned: boolean;
  is_favorite: boolean;
  color: string | null;
  word_count: number;
  tags: Tag[];
  created_at: ISODateString;
  updated_at: ISODateString;
  deleted_at: ISODateString | null;
  // Sync metadata
  local_id?: string; // Dexie auto-increment or UUID
  sync_status: SyncStatus;
  server_updated_at: ISODateString | null;
}

export interface NoteVersion {
  id: UUID;
  note_id: UUID;
  user_id: UUID;
  content: string;
  content_text: string;
  title: string;
  created_at: ISODateString;
  reason: 'autosave' | 'manual' | 'pre_ai_edit' | 'restore';
}

// ─── Folders ────────────────────────────────────────────────
export interface Folder {
  id: UUID;
  user_id: UUID;
  name: string;
  parent_id: UUID | null;
  color: string | null;
  icon: string | null;
  sort_order: number;
  created_at: ISODateString;
  updated_at: ISODateString;
  sync_status: SyncStatus;
}

// ─── Tags ───────────────────────────────────────────────────
export interface Tag {
  id: UUID;
  user_id: UUID;
  name: string;
  color: string | null;
  created_at: ISODateString;
}

// ─── Tasks ──────────────────────────────────────────────────
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'waiting' | 'done';
export type TaskPriority = 'none' | 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: UUID;
  user_id: UUID;
  note_id: UUID | null;
  parent_task_id: UUID | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: ISODateString | null;
  start_date: ISODateString | null;
  completed_at: ISODateString | null;
  is_deleted: boolean;
  sort_order: number;
  tags: Tag[];
  subtasks?: Task[];
  created_at: ISODateString;
  updated_at: ISODateString;
  sync_status: SyncStatus;
}

// ─── Sync ───────────────────────────────────────────────────
export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict' | 'error';

export interface SyncQueueItem {
  id?: number; // Dexie auto-increment
  entity_type: 'note' | 'task' | 'folder' | 'tag';
  entity_id: UUID;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  created_at: ISODateString;
  retry_count: number;
  last_error: string | null;
}

// ─── AI ─────────────────────────────────────────────────────
export type AIJobStatus = 'pending' | 'running' | 'done' | 'failed' | 'unavailable';
export type AIOperation =
  | 'summarize'
  | 'extract_tasks'
  | 'suggest_title'
  | 'suggest_tags'
  | 'rewrite'
  | 'fix_grammar'
  | 'change_tone'
  | 'translate'
  | 'generate_outline'
  | 'meeting_summary';

export interface AIJob {
  id?: number; // Dexie
  note_id: UUID | null;
  operation: AIOperation;
  status: AIJobStatus;
  input_hash: string; // to deduplicate
  result: string | null;
  error: string | null;
  provider: string;
  model: string;
  tokens_used: number | null;
  created_at: ISODateString;
  completed_at: ISODateString | null;
}

// ─── Search ─────────────────────────────────────────────────
export interface SearchResult {
  id: UUID;
  type: 'note' | 'task';
  title: string;
  snippet: string;
  matched_on: ('title' | 'content' | 'tag')[];
  updated_at: ISODateString;
  folder_id: UUID | null;
  tags: Tag[];
}

// ─── User Profile ───────────────────────────────────────────
export interface UserProfile {
  id: UUID;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  theme: 'light' | 'dark' | 'system';
  default_note_type: NoteType;
  editor_font_size: number;
  editor_line_height: number;
  ai_enabled: boolean;
  ai_provider: 'openai' | 'gemini' | null;
  voice_enabled: boolean;
  language: string;
  created_at: ISODateString;
  updated_at: ISODateString;
}

// ─── Export ──────────────────────────────────────────────────
export interface ExportBundle {
  version: '1.0';
  exported_at: ISODateString;
  user_email: string;
  notes: Note[];
  folders: Folder[];
  tags: Tag[];
  tasks: Task[];
}
