import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

interface QueueItem {
  id?: number;
  entity_type: 'note' | 'task' | 'folder' | 'tag';
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  created_at: string;
  retry_count: number;
  last_error: string | null;
}

describe('Sync Queue Logic & Invariants', () => {
  test('serializes and deserializes payloads reliably', () => {
    const rawPayload = {
      title: 'Offline Note',
      content: 'Local draft written on airplane',
      updated_at: new Date().toISOString(),
    };

    const item: QueueItem = {
      entity_type: 'note',
      entity_id: 'local-note-1',
      operation: 'create',
      payload: JSON.stringify(rawPayload),
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_error: null,
    };

    const parsed = JSON.parse(item.payload);
    assert.equal(parsed.title, 'Offline Note');
    assert.equal(parsed.content, 'Local draft written on airplane');
  });

  test('increments retry count and records last error on sync failure', () => {
    const item: QueueItem = {
      entity_type: 'task',
      entity_id: 'task-55',
      operation: 'update',
      payload: JSON.stringify({ status: 'done' }),
      created_at: new Date().toISOString(),
      retry_count: 0,
      last_error: null,
    };

    // Simulate failure
    const updatedItem: QueueItem = {
      ...item,
      retry_count: item.retry_count + 1,
      last_error: 'Network timeout (504)',
    };

    assert.equal(updatedItem.retry_count, 1);
    assert.equal(updatedItem.last_error, 'Network timeout (504)');
  });

  test('handles FIFO ordering sorting by created_at', () => {
    const items: QueueItem[] = [
      {
        entity_type: 'note',
        entity_id: 'n2',
        operation: 'update',
        payload: '{}',
        created_at: '2026-10-18T10:05:00.000Z',
        retry_count: 0,
        last_error: null,
      },
      {
        entity_type: 'note',
        entity_id: 'n1',
        operation: 'create',
        payload: '{}',
        created_at: '2026-10-18T10:00:00.000Z',
        retry_count: 0,
        last_error: null,
      },
      {
        entity_type: 'note',
        entity_id: 'n3',
        operation: 'delete',
        payload: '{}',
        created_at: '2026-10-18T10:10:00.000Z',
        retry_count: 0,
        last_error: null,
      },
    ];

    const sorted = [...items].sort((a, b) => a.created_at.localeCompare(b.created_at));
    assert.equal(sorted[0].entity_id, 'n1');
    assert.equal(sorted[1].entity_id, 'n2');
    assert.equal(sorted[2].entity_id, 'n3');
  });
});
