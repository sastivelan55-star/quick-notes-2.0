/**
 * FlowNote AI — Notes Service
 *
 * All note operations write locally first, then queue for sync.
 * This ensures the editor is never blocked by network operations.
 */
import { v4 as uuidv4 } from 'uuid';
import { getLocalDB, type LocalNote, type LocalNoteTag } from '@/lib/db/local';
import { queueSync } from './sync-queue';

const DRAFT_ID = 'DRAFT_NOTE';

// ─── Create ─────────────────────────────────────────────────────
export async function createNote(
  userId: string,
  partial: Partial<LocalNote> = {}
): Promise<LocalNote> {
  const db = getLocalDB();
  const now = new Date().toISOString();

  const note: LocalNote = {
    id: uuidv4(),
    user_id: userId,
    title: '',
    content: '{"type":"doc","content":[{"type":"paragraph"}]}',
    content_text: '',
    type: 'note',
    status: 'active',
    folder_id: null,
    is_pinned: false,
    is_favorite: false,
    color: null,
    word_count: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    sync_status: 'pending',
    server_updated_at: null,
    ...partial,
  };

  await db.notes.put(note);
  await queueSync('note', note.id, 'create', note);
  return note;
}

// ─── Save / Update ───────────────────────────────────────────────
export async function saveNote(
  id: string,
  updates: Partial<LocalNote>
): Promise<void> {
  const db = getLocalDB();
  const existing = await db.notes.get(id);
  if (!existing) throw new Error(`Note ${id} not found`);

  const updated: LocalNote = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.notes.put(updated);
  await queueSync('note', id, 'update', updated);
}

// ─── Draft recovery ──────────────────────────────────────────────
export async function getOrCreateDraft(userId: string): Promise<LocalNote> {
  const db = getLocalDB();
  const existing = await db.notes.get(DRAFT_ID);

  if (existing && existing.user_id === userId) {
    return existing;
  }

  const draft: LocalNote = {
    id: DRAFT_ID,
    user_id: userId,
    title: '',
    content: '{"type":"doc","content":[{"type":"paragraph"}]}',
    content_text: '',
    type: 'note',
    status: 'active',
    folder_id: null,
    is_pinned: false,
    is_favorite: false,
    color: null,
    word_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    sync_status: 'local',
    server_updated_at: null,
    is_draft: true,
  };

  await db.notes.put(draft);
  return draft;
}

export async function promoteDraft(userId: string): Promise<LocalNote | null> {
  const db = getLocalDB();
  const draft = await db.notes.get(DRAFT_ID);
  if (!draft) return null;

  // Only promote if the draft has actual content
  const hasContent =
    draft.title.trim().length > 0 || draft.content_text.trim().length > 0;
  if (!hasContent) return null;

  const now = new Date().toISOString();
  const promoted: LocalNote = {
    ...draft,
    id: uuidv4(),
    is_draft: false,
    sync_status: 'pending',
    created_at: now,
    updated_at: now,
  };

  await db.transaction('rw', db.notes, async () => {
    await db.notes.put(promoted);
    await db.notes.delete(DRAFT_ID);
  });

  await queueSync('note', promoted.id, 'create', promoted);
  return promoted;
}

export async function clearDraft(): Promise<void> {
  const db = getLocalDB();
  await db.notes.delete(DRAFT_ID);
}

// ─── Fetch ───────────────────────────────────────────────────────
export async function getNote(id: string): Promise<LocalNote | null> {
  const db = getLocalDB();
  return (await db.notes.get(id)) ?? null;
}

export async function listNotes(
  userId: string,
  options: {
    status?: 'active' | 'archived' | 'deleted';
    folder_id?: string | null;
    limit?: number;
    offset?: number;
  } = {}
): Promise<LocalNote[]> {
  const db = getLocalDB();
  const { status = 'active', folder_id, limit = 50, offset = 0 } = options;

  let collection = db.notes
    .where('user_id')
    .equals(userId)
    .filter((n) => n.status === status && n.id !== DRAFT_ID);

  if (folder_id !== undefined) {
    collection = collection.filter((n) => n.folder_id === folder_id);
  }

  const all = await collection.toArray();
  all.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return b.updated_at.localeCompare(a.updated_at);
  });

  return all.slice(offset, offset + limit);
}

// ─── Local Search ─────────────────────────────────────────────────
export async function searchNotesLocal(
  userId: string,
  query: string,
  limit = 20
): Promise<LocalNote[]> {
  const db = getLocalDB();
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const results = await db.notes
    .where('user_id')
    .equals(userId)
    .filter(
      (n) =>
        n.status === 'active' &&
        n.id !== DRAFT_ID &&
        (n.title.toLowerCase().includes(q) ||
          n.content_text.toLowerCase().includes(q))
    )
    .limit(limit)
    .toArray();

  // Sort by relevance: title match first
  return results.sort((a, b) => {
    const aTitle = a.title.toLowerCase().includes(q) ? 1 : 0;
    const bTitle = b.title.toLowerCase().includes(q) ? 1 : 0;
    if (aTitle !== bTitle) return bTitle - aTitle;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

// ─── Archive / Delete ────────────────────────────────────────────
export async function archiveNote(id: string): Promise<void> {
  await saveNote(id, { status: 'archived' });
}

export async function trashNote(id: string): Promise<void> {
  await saveNote(id, { status: 'deleted', deleted_at: new Date().toISOString() });
}

export async function restoreNote(id: string): Promise<void> {
  await saveNote(id, { status: 'active', deleted_at: null });
}

export async function permanentlyDeleteNote(id: string): Promise<void> {
  const db = getLocalDB();
  await db.transaction('rw', db.notes, db.note_tags, db.sync_queue, async () => {
    await db.note_tags.where('note_id').equals(id).delete();
    await db.notes.delete(id);
  });
  await queueSync('note', id, 'delete', { id });
}

// ─── Pin / Favorite ──────────────────────────────────────────────
export async function togglePin(id: string): Promise<void> {
  const note = await getNote(id);
  if (!note) return;
  await saveNote(id, { is_pinned: !note.is_pinned });
}

export async function toggleFavorite(id: string): Promise<void> {
  const note = await getNote(id);
  if (!note) return;
  await saveNote(id, { is_favorite: !note.is_favorite });
}

// ─── Tags ────────────────────────────────────────────────────────
export async function getNoteTags(noteId: string): Promise<LocalNoteTag[]> {
  const db = getLocalDB();
  return db.note_tags.where('note_id').equals(noteId).toArray();
}

export async function setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  const db = getLocalDB();
  await db.transaction('rw', db.note_tags, async () => {
    await db.note_tags.where('note_id').equals(noteId).delete();
    await db.note_tags.bulkPut(tagIds.map((tag_id) => ({ note_id: noteId, tag_id })));
  });
}

// ─── Content helpers ─────────────────────────────────────────────
export function extractTextFromTipTap(json: string): string {
  try {
    const doc = JSON.parse(json);
    return extractText(doc);
  } catch {
    return '';
  }
}

function extractText(node: Record<string, unknown>): string {
  if (node.type === 'text') return (node.text as string) ?? '';
  const content = node.content as Record<string, unknown>[] | undefined;
  if (!content) return '';
  return content.map(extractText).join(' ');
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
