/**
 * NoteNest — Note Templates
 *
 * Pre-built TipTap JSON document structures for common note types.
 * Each template returns { title, content (JSON string), content_text, tags }.
 */

export interface NoteTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  title: string;
  content: string;   // TipTap JSON string
  content_text: string;
  tags: string[];
  color: string | null;
}

// ─── Meeting Notes ──────────────────────────────────────────────
const meetingNotes: NoteTemplate = {
  id: 'meeting-notes',
  name: 'Meeting Notes',
  description: 'Agenda, attendees, decisions, and action items',
  icon: '👥',
  title: 'Meeting Notes',
  tags: ['Work'],
  color: null,
  content_text: 'Date / Time\nAttendees\nAgenda\nDiscussion\nDecisions\nAction Items',
  content: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '📋 Meeting Notes' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Date / Time: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Attendees: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Agenda' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Discussion' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Decisions' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '✅ Action Items' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
    ],
  }),
};

// ─── Shopping List ──────────────────────────────────────────────
const shoppingList: NoteTemplate = {
  id: 'shopping-list',
  name: 'Shopping List',
  description: 'Organized checklist for grocery or shopping trips',
  icon: '🛒',
  title: 'Shopping List',
  tags: ['Personal'],
  color: null,
  content_text: 'Produce\nDairy\nMeat\nPantry\nOther',
  content: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '🛒 Shopping List' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Produce' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Dairy' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Meat & Seafood' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Pantry' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Other' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
    ],
  }),
};

// ─── Personal Journal ────────────────────────────────────────────
const personalJournal: NoteTemplate = {
  id: 'personal-journal',
  name: 'Personal Journal',
  description: 'Daily reflection, mood, and gratitude entry',
  icon: '📔',
  title: 'Journal Entry',
  tags: ['Personal'],
  color: null,
  content_text: 'How I feel today\nWhat went well\nChallenges\nGrateful for\nTomorrow',
  content: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '📔 Journal Entry' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Date: ' },
          { type: 'text', text: new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '💭 How I feel today' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '✨ What went well' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🌊 Challenges' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🙏 Grateful for' }],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🎯 Tomorrow' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
    ],
  }),
};

// ─── Project Roadmap ─────────────────────────────────────────────
const projectRoadmap: NoteTemplate = {
  id: 'project-roadmap',
  name: 'Project Roadmap',
  description: 'Goal, milestones, timeline, and status tracking',
  icon: '🗺️',
  title: 'Project Roadmap',
  tags: ['Work', 'Projects'],
  color: null,
  content_text: 'Goal\nMilestones\nTimeline\nRisks\nSuccess Metrics',
  content: JSON.stringify({
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '🗺️ Project Roadmap' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Project: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Owner: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Target Date: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🎯 Goal' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: '' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '🏁 Milestones' }],
      },
      {
        type: 'taskList',
        content: [
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 1: ' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 2: ' }] }],
          },
          {
            type: 'taskItem',
            attrs: { checked: false },
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Phase 3: ' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '⚠️ Risks & Dependencies' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: '📊 Success Metrics' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
          },
        ],
      },
    ],
  }),
};

// ─── Blank Note ──────────────────────────────────────────────────
const blankNote: NoteTemplate = {
  id: 'blank',
  name: 'Blank Note',
  description: 'Start from an empty canvas',
  icon: '📄',
  title: '',
  tags: [],
  color: null,
  content_text: '',
  content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph' }] }),
};

// ─── All Templates ────────────────────────────────────────────────
export const NOTE_TEMPLATES: NoteTemplate[] = [
  blankNote,
  meetingNotes,
  shoppingList,
  personalJournal,
  projectRoadmap,
];

export function getTemplate(id: string): NoteTemplate | undefined {
  return NOTE_TEMPLATES.find((t) => t.id === id);
}
