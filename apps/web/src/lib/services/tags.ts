/**
 * NoteNest — Tag Service
 *
 * CRUD for custom user tags and note-tag associations.
 * Tags are stored in LocalTag; associations in LocalNoteTag.
 */
import { v4 as uuidv4 } from 'uuid';
import { getLocalDB, type LocalTag } from '@/lib/db/local';
import { queueSync } from './sync-queue';

// ─── Create ─────────────────────────────────────────────────────
export async function createTag(
  userId: string,
  name: string,
  color?: string | null
): Promise<LocalTag> {
  const db = getLocalDB();

  // Prevent duplicates (case-insensitive)
  const existing = await db.tags
    .where('user_id')
    .equals(userId)
    .filter((t) => t.name.toLowerCase() === name.toLowerCase().trim())
    .first();
  if (existing) return existing;

  const tag: LocalTag = {
    id: uuidv4(),
    user_id: userId,
    name: name.trim(),
    color: color ?? null,
    created_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.tags.put(tag);
  await queueSync('tag', tag.id, 'create', tag);
  return tag;
}

// ─── Delete ──────────────────────────────────────────────────────
export async function deleteTag(id: string): Promise<void> {
  const db = getLocalDB();
  await db.transaction('rw', db.tags, db.note_tags, async () => {
    await db.note_tags.where('tag_id').equals(id).delete();
    await db.tags.delete(id);
  });
  await queueSync('tag', id, 'delete', { id });
}

// ─── Update ──────────────────────────────────────────────────────
export async function updateTag(
  id: string,
  updates: { name?: string; color?: string | null }
): Promise<void> {
  const db = getLocalDB();
  const existing = await db.tags.get(id);
  if (!existing) return;

  const updated: LocalTag = {
    ...existing,
    ...(updates.name ? { name: updates.name.trim() } : {}),
    ...(updates.color !== undefined ? { color: updates.color } : {}),
    sync_status: 'pending',
  };

  await db.tags.put(updated);
  await queueSync('tag', id, 'update', updated);
}

// ─── Fetch ───────────────────────────────────────────────────────
export async function listTags(userId: string): Promise<LocalTag[]> {
  const db = getLocalDB();
  const tags = await db.tags.where('user_id').equals(userId).toArray();
  return tags.sort((a, b) => a.name.localeCompare(b.name));
}

// ─── Usage counts ────────────────────────────────────────────────
export async function getTagUsageCounts(userId: string): Promise<Record<string, number>> {
  const db = getLocalDB();

  // Get all active notes for this user
  const notes = await db.notes
    .where('user_id')
    .equals(userId)
    .filter((n) => n.status === 'active')
    .toArray();

  // Count tag occurrences from note.tags array (legacy flat storage)
  const counts: Record<string, number> = {};
  for (const note of notes) {
    if (note.tags) {
      for (const tag of note.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
  }
  return counts;
}

// ─── Ensure built-in tags exist for user ─────────────────────────
const BUILTIN_TAGS = [
  { name: 'Ideas', color: '#7C3AED' },
  { name: 'Important', color: '#DC2626' },
  { name: 'Personal', color: '#059669' },
  { name: 'Study', color: '#2563EB' },
  { name: 'Work', color: '#D97706' },
  { name: 'Projects', color: '#0891B2' },
];

export async function ensureBuiltinTags(userId: string): Promise<void> {
  const db = getLocalDB();
  const existing = await db.tags.where('user_id').equals(userId).toArray();
  const existingNames = new Set(existing.map((t) => t.name.toLowerCase()));

  for (const bt of BUILTIN_TAGS) {
    if (!existingNames.has(bt.name.toLowerCase())) {
      await createTag(userId, bt.name, bt.color);
    }
  }
}
