import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { AI_PROMPTS, type AIOperation } from '../src/lib/services/ai.ts';

describe('AI Service Prompts', () => {
  const sampleNote = 'Meeting with engineering team regarding architecture for FlowNote AI offline-first sync engine.';

  test('summarize prompt contains content and formatting instruction', () => {
    const prompt = AI_PROMPTS.summarize(sampleNote, {});
    assert.ok(prompt.includes(sampleNote));
    assert.ok(prompt.toLowerCase().includes('summarize'));
  });

  test('extract_tasks prompt requests JSON array of strings', () => {
    const prompt = AI_PROMPTS.extract_tasks(sampleNote, {});
    assert.ok(prompt.includes(sampleNote));
    assert.ok(prompt.includes('JSON array'));
  });

  test('meeting_summary prompt asks for executive summary and action items', () => {
    const prompt = AI_PROMPTS.meeting_summary(sampleNote, {});
    assert.ok(prompt.includes('Executive summary'));
    assert.ok(prompt.includes('Action items'));
    assert.ok(prompt.includes('Decisions made'));
  });

  test('suggest_title prompt enforces concise title constraint', () => {
    const prompt = AI_PROMPTS.suggest_title(sampleNote, {});
    assert.ok(prompt.includes('concise'));
  });

  test('all operations in AIOperation have a registered prompt generator', () => {
    const operations: AIOperation[] = [
      'summarize',
      'extract_tasks',
      'suggest_title',
      'suggest_tags',
      'rewrite',
      'fix_grammar',
      'change_tone',
      'translate',
      'generate_outline',
      'meeting_summary',
    ];

    for (const op of operations) {
      assert.ok(typeof AI_PROMPTS[op] === 'function', `Missing prompt generator for ${op}`);
      const result = AI_PROMPTS[op]('test content', {});
      assert.ok(result.length > 0, `Prompt generator for ${op} returned empty string`);
    }
  });
});
