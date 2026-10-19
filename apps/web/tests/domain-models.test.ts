import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Note, Task, Folder, Tag } from '../../../packages/domain/src/index';

describe('Domain Models & Entity Invariants', () => {
  test('creates a valid Note entity model', () => {
    const note: Note = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      user_id: 'user-123',
      title: 'Sprint Planning',
      content: '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Plan"}]}]}',
      content_text: 'Plan',
      type: 'note',
      status: 'active',
      folder_id: null,
      is_pinned: false,
      is_favorite: true,
      color: '#4f46e5',
      word_count: 1,
      tags: [{ id: 'tag-1', user_id: 'user-123', name: 'sprint', color: null, created_at: new Date().toISOString() }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      sync_status: 'synced',
      server_updated_at: new Date().toISOString(),
    };

    assert.equal(note.title, 'Sprint Planning');
    assert.equal(note.status, 'active');
    assert.equal(note.is_favorite, true);
    assert.equal(note.tags.length, 1);
  });

  test('creates a valid Task entity model with priority and due date', () => {
    const dueDate = new Date().toISOString();
    const task: Task = {
      id: 'task-101',
      user_id: 'user-123',
      note_id: null,
      parent_task_id: null,
      title: 'Review production migration',
      description: 'Ensure pg_trgm and indexes are tested',
      status: 'open',
      priority: 'urgent',
      due_date: dueDate,
      start_date: null,
      completed_at: null,
      is_deleted: false,
      sort_order: 0,
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    };

    assert.equal(task.priority, 'urgent');
    assert.equal(task.status, 'open');
    assert.equal(task.due_date, dueDate);
    assert.equal(task.is_deleted, false);
  });

  test('supports hierarchical folders and subfolders', () => {
    const parentFolder: Folder = {
      id: 'folder-root',
      user_id: 'user-123',
      name: 'Work',
      parent_id: null,
      color: '#3b82f6',
      icon: 'briefcase',
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    };

    const subFolder: Folder = {
      id: 'folder-sub',
      user_id: 'user-123',
      name: 'Projects',
      parent_id: parentFolder.id,
      color: null,
      icon: null,
      sort_order: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'synced',
    };

    assert.equal(parentFolder.parent_id, null);
    assert.equal(subFolder.parent_id, parentFolder.id);
  });
});
