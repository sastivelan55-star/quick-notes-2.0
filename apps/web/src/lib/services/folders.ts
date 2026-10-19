/**
 * NoteNest — Folder Service
 *
 * CRUD operations for note folders.
 * All operations are local-first (IndexedDB) and queue for sync.
 */
import { v4 as uuidv4 } from 'uuid';
import { getLocalDB, type LocalFolder } from '@/lib/db/local';
import { queueSync } from './sync-queue';

// ─── Create ─────────────────────────────────────────────────────
export async function createFolder(
  userId: string,
  partial: {
    name: string;
    parent_id?: string | null;
    color?: string | null;
    icon?: string | null;
  }
): Promise<LocalFolder> {
  const db = getLocalDB();
  const now = new Date().toISOString();

  const siblings = await db.folders
    .where('user_id')
    .equals(userId)
    .filter((f) => f.parent_id === (partial.parent_id ?? null))
    .toArray();

  const folder: LocalFolder = {
    id: uuidv4(),
    user_id: userId,
    name: partial.name.trim(),
    parent_id: partial.parent_id ?? null,
    color: partial.color ?? null,
    icon: partial.icon ?? null,
    sort_order: siblings.length,
    created_at: now,
    updated_at: now,
    sync_status: 'pending',
  };

  await db.folders.put(folder);
  await queueSync('folder', folder.id, 'create', folder);
  return folder;
}

// ─── Update ──────────────────────────────────────────────────────
export async function updateFolder(
  id: string,
  updates: Partial<Pick<LocalFolder, 'name' | 'color' | 'icon' | 'parent_id' | 'sort_order'>>
): Promise<void> {
  const db = getLocalDB();
  const existing = await db.folders.get(id);
  if (!existing) throw new Error(`Folder ${id} not found`);

  const updated: LocalFolder = {
    ...existing,
    ...updates,
    ...(updates.name ? { name: updates.name.trim() } : {}),
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  };

  await db.folders.put(updated);
  await queueSync('folder', id, 'update', updated);
}

// ─── Delete ──────────────────────────────────────────────────────
export async function deleteFolder(
  id: string,
  opts: { moveNotesToRoot?: boolean } = { moveNotesToRoot: true }
): Promise<void> {
  const db = getLocalDB();

  // Recursively collect all descendant folder IDs
  const allIds = await collectDescendantIds(db, id);
  allIds.push(id);

  await db.transaction('rw', db.folders, db.notes, db.sync_queue, async () => {
    for (const fid of allIds) {
      if (opts.moveNotesToRoot) {
        await db.notes.where('folder_id').equals(fid).modify({ folder_id: null });
      }
      await db.folders.delete(fid);
    }
  });

  for (const fid of allIds) {
    await queueSync('folder', fid, 'delete', { id: fid });
  }
}

async function collectDescendantIds(
  db: ReturnType<typeof getLocalDB>,
  parentId: string
): Promise<string[]> {
  const children = await db.folders.where('parent_id').equals(parentId).toArray();
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    const grandchildren = await collectDescendantIds(db, child.id);
    ids.push(...grandchildren);
  }
  return ids;
}

// ─── Fetch ───────────────────────────────────────────────────────
export async function listFolders(userId: string): Promise<LocalFolder[]> {
  const db = getLocalDB();
  const folders = await db.folders.where('user_id').equals(userId).toArray();
  return folders.sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return a.name.localeCompare(b.name);
  });
}

export async function getFolder(id: string): Promise<LocalFolder | null> {
  const db = getLocalDB();
  return (await db.folders.get(id)) ?? null;
}

// ─── Move note to folder ─────────────────────────────────────────
export async function moveNoteToFolder(
  noteId: string,
  folderId: string | null
): Promise<void> {
  const db = getLocalDB();
  const note = await db.notes.get(noteId);
  if (!note) return;
  await db.notes.put({
    ...note,
    folder_id: folderId,
    updated_at: new Date().toISOString(),
    sync_status: 'pending',
  });
}

// ─── Note count per folder ───────────────────────────────────────
export async function getFolderNoteCounts(userId: string): Promise<Record<string, number>> {
  const db = getLocalDB();
  const notes = await db.notes
    .where('user_id')
    .equals(userId)
    .filter((n) => n.status === 'active' && n.folder_id !== null)
    .toArray();

  const counts: Record<string, number> = {};
  for (const note of notes) {
    if (note.folder_id) {
      counts[note.folder_id] = (counts[note.folder_id] ?? 0) + 1;
    }
  }
  return counts;
}
