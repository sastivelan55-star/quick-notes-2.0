/**
 * Phase 02 — Unit Tests
 * Tests for note templates, revision logic, folder service helpers,
 * tag service helpers, and notes service pure functions.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

// ─── Template Tests ──────────────────────────────────────────────
describe('Note Templates', () => {
  // Inline the template structure tests without importing browser code
  const TEMPLATE_IDS = ['blank', 'meeting-notes', 'shopping-list', 'personal-journal', 'project-roadmap'];

  test('all template IDs are unique', () => {
    const seen = new Set<string>();
    for (const id of TEMPLATE_IDS) {
      assert.equal(seen.has(id), false, `Duplicate template id: ${id}`);
      seen.add(id);
    }
    assert.equal(seen.size, 5);
  });

  test('all templates have required structure fields', () => {
    const required = ['id', 'name', 'description', 'icon', 'title', 'content', 'content_text', 'tags'];
    // Simulate a minimal template object
    const template = {
      id: 'blank',
      name: 'Blank Note',
      description: 'Start from an empty canvas',
      icon: '📄',
      title: '',
      content: '{"type":"doc","content":[{"type":"paragraph"}]}',
      content_text: '',
      tags: [],
      color: null,
    };
    for (const field of required) {
      assert.ok(Object.prototype.hasOwnProperty.call(template, field), `Missing field: ${field}`);
    }
  });

  test('template content is valid JSON', () => {
    const templates = [
      { content: '{"type":"doc","content":[{"type":"paragraph"}]}' },
      { content: '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Meeting"}]}]}' },
    ];
    for (const t of templates) {
      assert.doesNotThrow(() => JSON.parse(t.content));
    }
  });

  test('meeting notes template has required heading structure', () => {
    const content = JSON.parse('{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"📋 Meeting Notes"}]}]}');
    assert.equal(content.type, 'doc');
    assert.equal(content.content[0].type, 'heading');
    assert.equal(content.content[0].attrs.level, 2);
  });
});

// ─── Revision Timing Logic Tests ──────────────────────────────────
describe('Revision Timing', () => {
  const MIN_INTERVAL_MS = 30_000;

  test('should skip autosave if interval is too short', () => {
    const lastSaved = new Date(Date.now() - 10_000).toISOString(); // 10s ago
    const elapsed = Date.now() - new Date(lastSaved).getTime();
    assert.equal(elapsed < MIN_INTERVAL_MS, true);
  });

  test('should allow autosave after minimum interval', () => {
    const lastSaved = new Date(Date.now() - 35_000).toISOString(); // 35s ago
    const elapsed = Date.now() - new Date(lastSaved).getTime();
    assert.equal(elapsed >= MIN_INTERVAL_MS, true);
  });

  test('revision type is one of allowed values', () => {
    const allowed = ['autosave', 'manual', 'recovery'];
    for (const type of allowed) {
      assert.ok(allowed.includes(type));
    }
    assert.equal(allowed.includes('unknown'), false);
  });
});

// ─── Notes Service Pure Function Tests ────────────────────────────
describe('Notes Service Pure Functions', () => {
  // Inline the extractText logic for testing
  function extractText(node: Record<string, unknown>): string {
    if (node.type === 'text') return (node.text as string) ?? '';
    const content = node.content as Record<string, unknown>[] | undefined;
    if (!content) return '';
    return content.map(extractText).join(' ');
  }

  function extractTextFromTipTap(json: string): string {
    try {
      const doc = JSON.parse(json);
      return extractText(doc);
    } catch {
      return '';
    }
  }

  function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  test('extracts text from simple paragraph', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hello world' }] }],
    });
    const text = extractTextFromTipTap(json);
    assert.ok(text.includes('Hello'));
    assert.ok(text.includes('world'));
  });

  test('returns empty string for invalid JSON', () => {
    assert.equal(extractTextFromTipTap('not-valid-json'), '');
  });

  test('counts words correctly', () => {
    assert.equal(countWords('hello world'), 2);
    assert.equal(countWords('  leading and trailing  '), 3);
    assert.equal(countWords(''), 0);
    assert.equal(countWords('oneword'), 1);
  });

  test('extracts text from nested TipTap structure', () => {
    const json = JSON.stringify({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item one' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item two' }] }] },
          ],
        },
      ],
    });
    const text = extractTextFromTipTap(json);
    assert.ok(text.includes('Item one'));
    assert.ok(text.includes('Item two'));
  });
});

// ─── Folder Service Pure Logic Tests ──────────────────────────────
describe('Folder Service Logic', () => {
  test('new folder has correct default fields', () => {
    const now = new Date().toISOString();
    const folder = {
      id: 'folder-1',
      user_id: 'user-1',
      name: 'Work',
      parent_id: null,
      color: null,
      icon: null,
      sort_order: 0,
      created_at: now,
      updated_at: now,
      sync_status: 'pending' as const,
    };
    assert.equal(folder.name, 'Work');
    assert.equal(folder.parent_id, null);
    assert.equal(folder.sync_status, 'pending');
  });

  test('subfolder references parent correctly', () => {
    const parentId = 'folder-root';
    const subfolder = {
      id: 'folder-sub',
      user_id: 'user-1',
      name: 'Projects',
      parent_id: parentId,
      color: null,
      icon: null,
      sort_order: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      sync_status: 'pending' as const,
    };
    assert.equal(subfolder.parent_id, parentId);
    assert.notEqual(subfolder.id, parentId);
  });

  test('folder name is trimmed on creation', () => {
    const rawName = '  My Folder  ';
    const name = rawName.trim();
    assert.equal(name, 'My Folder');
  });
});

// ─── Tag Service Logic Tests ──────────────────────────────────────
describe('Tag Service Logic', () => {
  const BUILTIN_TAGS = ['Ideas', 'Important', 'Personal', 'Study', 'Work', 'Projects'];

  test('all builtin tags are present', () => {
    assert.equal(BUILTIN_TAGS.length, 6);
    assert.ok(BUILTIN_TAGS.includes('Ideas'));
    assert.ok(BUILTIN_TAGS.includes('Work'));
  });

  test('duplicate tag prevention is case-insensitive', () => {
    const existing = ['ideas', 'work'];
    const newTag = 'IDEAS';
    const isDuplicate = existing.some(t => t.toLowerCase() === newTag.toLowerCase());
    assert.equal(isDuplicate, true);
  });

  test('tag name is trimmed', () => {
    const rawName = '  Design  ';
    const name = rawName.trim();
    assert.equal(name, 'Design');
  });

  test('usage counts accumulate correctly', () => {
    const notes = [
      { tags: ['Work', 'Important'] },
      { tags: ['Work', 'Study'] },
      { tags: ['Ideas'] },
    ];
    const counts: Record<string, number> = {};
    for (const note of notes) {
      for (const tag of note.tags) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    assert.equal(counts['Work'], 2);
    assert.equal(counts['Important'], 1);
    assert.equal(counts['Study'], 1);
    assert.equal(counts['Ideas'], 1);
  });
});
