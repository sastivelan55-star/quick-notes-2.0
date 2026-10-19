/**
 * NoteNest — Note Revisions Service
 *
 * Manages autosave snapshots for revision history and draft recovery.
 * Keeps the last N revisions per note to bound storage usage.
 */
import { getLocalDB, type LocalNoteRevision } from '@/lib/db/local';

const MAX_REVISIONS_PER_NOTE = 30;
const MIN_REVISION_INTERVAL_MS = 30_000; // 30 seconds minimum between autosaves

// ─── Save revision snapshot ──────────────────────────────────────
export async function saveRevision(
  noteId: string,
  data: {
    title: string;
    content: string;
    content_text: string;
    word_count: number;
    revision_type?: LocalNoteRevision['revision_type'];
  }
): Promise<void> {
  const db = getLocalDB();
  const now = new Date().toISOString();

  // Rate-limit autosaves: skip if a recent autosave exists in the last interval
  if (data.revision_type === 'autosave' || !data.revision_type) {
    const lastAutosave = await db.note_revisions
      .where('note_id')
      .equals(noteId)
      .filter((r) => r.revision_type === 'autosave')
      .last();

    if (lastAutosave) {
      const elapsed = Date.now() - new Date(lastAutosave.saved_at).getTime();
      if (elapsed < MIN_REVISION_INTERVAL_MS) {
        return; // Too soon, skip
      }
    }
  }

  await db.note_revisions.put({
    note_id: noteId,
    title: data.title,
    content: data.content,
    content_text: data.content_text,
    word_count: data.word_count,
    saved_at: now,
    revision_type: data.revision_type ?? 'autosave',
  });

  // Prune old revisions to keep storage bounded
  await pruneRevisions(noteId);
}

// ─── Get revisions for a note ────────────────────────────────────
export async function getRevisions(
  noteId: string,
  limit = 20
): Promise<LocalNoteRevision[]> {
  const db = getLocalDB();
  const all = await db.note_revisions
    .where('note_id')
    .equals(noteId)
    .toArray();

  return all
    .sort((a, b) => b.saved_at.localeCompare(a.saved_at))
    .slice(0, limit);
}

// ─── Get single revision by ID ───────────────────────────────────
export async function getRevision(id: number): Promise<LocalNoteRevision | null> {
  const db = getLocalDB();
  return (await db.note_revisions.get(id)) ?? null;
}

// ─── Prune old revisions ─────────────────────────────────────────
async function pruneRevisions(noteId: string): Promise<void> {
  const db = getLocalDB();
  const all = await db.note_revisions
    .where('note_id')
    .equals(noteId)
    .toArray();

  if (all.length <= MAX_REVISIONS_PER_NOTE) return;

  // Keep the N newest, delete the rest (but always keep manual saves)
  const sorted = all.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  const toDelete = sorted
    .slice(MAX_REVISIONS_PER_NOTE)
    .filter((r) => r.revision_type !== 'manual')
    .map((r) => r.id as number);

  if (toDelete.length > 0) {
    await db.note_revisions.bulkDelete(toDelete);
  }
}

// ─── Delete all revisions for a note ─────────────────────────────
export async function deleteNoteRevisions(noteId: string): Promise<void> {
  const db = getLocalDB();
  await db.note_revisions.where('note_id').equals(noteId).delete();
}
