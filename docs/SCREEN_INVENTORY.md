# NoteNest / FlowNote AI — Screen & Component Inventory
**Document Version:** 1.0.0  
**Phase:** Phase 00 — Baseline Inventory  

---

## 1. Overview of Screens

The application comprises 12 primary view states and modals across Desktop, Tablet, and Mobile form factors:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Screen Inventory Matrix                          │
├────┬─────────────────────────────┬─────────────────┬────────────────────────┤
│ ID │ Screen Name                 │ View State Key  │ Primary File Path      │
├────┼─────────────────────────────┼─────────────────┼────────────────────────┤
│ S1 │ 3-Pane Notes Workspace      │ 'notes'         │ src/components/views/  │
│    │                             │                 │ NotesView.tsx          │
│ S2 │ Favorites Filter View       │ 'favorites'     │ NotesView.tsx          │
│ S3 │ Tags / Category View        │ 'tags'          │ NotesView.tsx          │
│ S4 │ Instant Capture Canvas      │ 'capture'       │ CaptureView.tsx        │
│ S5 │ Checklist & Tasks Card View │ 'tasks'         │ TasksView.tsx          │
│ S6 │ Today Dashboard Overview    │ 'today'         │ TodayView.tsx          │
│ S7 │ Global Search Overlay/View  │ 'search'        │ SearchView.tsx         │
│ S8 │ Trash & Recovery View       │ 'trash'         │ TrashView.tsx          │
│ S9 │ Archive View                │ 'archive'       │ NotesView.tsx          │
│ S10│ Settings & Backup Export    │ 'settings'      │ SettingsView.tsx       │
│ S11│ Voice Dictation Modal       │ Modal           │ VoiceCaptureModal.tsx  │
│ S12│ Supabase Auth (Login/Signup)│ Route /auth     │ src/app/auth/login/    │
│ S13│ Command Palette (⌘K) Modal  │ Modal (Global)  │ CommandPalette.tsx     │
│ S14│ Mobile Nav Shell & FAB      │ Mobile Layout   │ MobileNav.tsx          │
└────┴─────────────────────────────┴─────────────────┴────────────────────────┘
```

---

## 2. Detailed Screen Analysis

### S1: 3-Pane Notes Workspace (Core NoteNest Screen)
- **Reference Match**: Image 1 & 5 (Laptop View)
- **Path**: `src/components/views/NotesView.tsx`
- **Structure**:
  - **Pane 1 (Left Sidebar)**: `Sidebar.tsx` — NoteNest logo, All Notes, Favorites, Tags, Trash, Settings.
  - **Pane 2 (Middle List)**: `All Notes` header + `+ New Note` blue pill button + Search input + Note list items (title, timestamp right-aligned, excerpt preview, active indicator).
  - **Pane 3 (Right Editor)**: `RichEditor.tsx` — Note title H1, body content, tags pill container (`Ideas`, `Important`), back button `←` on small viewports, options menu `⋮`.
- **State Integration**: Dexie `db.notes`, Zustand `activeNoteId`, `activeView`.
- **Baseline Status**: Working locally; styling and layout refactored in Phase 00 to match reference.

### S2 & S3: Favorites and Tags Views
- **Reference Match**: Image 1 sidebar menu (`Favorites`, `Tags`)
- **Path**: `src/components/views/NotesView.tsx` with filter prop (`favorites` or `tags`)
- **Structure**: Reuses middle list with filtered query (`is_favorite = true` or filtered by selected tag).
- **Interactive Controls**: Star icon toggle, Tag filter pills, `+ New Note` action.

### S4: Instant Capture Canvas
- **Reference Match**: Fast note-taking workflow (Prompt Item 1)
- **Path**: `src/components/views/CaptureView.tsx`
- **Structure**: Minimal distraction-free full editor with live autosave indicator, Voice dictation toggle, and AI Assistant panel.
- **Interactive Controls**: Auto-expanding title textarea, TipTap toolbar, Voice button, AI button, Save button.

### S5: Checklist & Tasks View ("Tech Project Alpha" & "Shopping list")
- **Reference Match**: Image 3 ("Shopping list" checklist) & Image 4 ("Tech Project Alpha" card)
- **Path**: `src/components/views/TasksView.tsx`
- **Structure**:
  - Card container with title, options menu `⋮`.
  - Checklist item rows with circular blue checkmarks (`✔` filled when done, `◯` outline when open).
  - Contextual deadline tags aligned right (`Today`, `Tomorrow`, `Oct 28`, `Oct 30`).
  - Strikethrough completed task list.
  - Bottom rounded quick-add task box: `"Add a task"`.
- **State Integration**: Dexie `db.tasks`, optimistic task status updates.

### S6: Today Dashboard Overview
- **Path**: `src/components/views/TodayView.tsx`
- **Structure**: Metrics grid (total notes, tasks due today, overdue items), quick capture widget, and recent notes feed.

### S7: Global Search View
- **Path**: `src/components/views/SearchView.tsx` & inline header search
- **Structure**: Real-time debounce query against Dexie `content_text` and `title`.

### S8 & S9: Trash and Archive Views
- **Path**: `src/components/views/TrashView.tsx` / `NotesView.tsx (status='archived')`
- **Structure**: Soft-deleted note list with "Restore Note" and "Delete Permanently" safety actions.

### S10: Settings & Data Sovereignty View
- **Path**: `src/components/views/SettingsView.tsx`
- **Structure**: Theme switcher (Light / Dark / System), Sync status telemetry, Account configuration, "Export All Data (JSON)" backup generator.

### S11: Voice Dictation & Audio Recorder Modal
- **Reference Match**: Image 2 & 5 (Voice-to-Text feature)
- **Path**: `src/components/voice/VoiceCaptureModal.tsx`
- **Structure**: Modal overlay with animated pulsating recording ring, live timer, real-time Web Speech transcript streaming, audio playback player, and "Insert into Note" / "AI Meeting Notes" actions.

### S12: Authentication Screen
- **Path**: `src/app/auth/login/page.tsx`
- **Structure**: Email/password authentication, Magic link request, Supabase Auth session listener.

### S15: Template Selector Modal
- **Reference Match**: Phase 02 Instant Capture & Template System
- **Path**: `src/components/editor/TemplateSelector.tsx`
- **Structure**: Modal dialog displaying curated templates (Blank Note, Meeting Notes, Shopping List, Personal Journal, Project Roadmap) with category tags, descriptions, and one-click instant instantiation into `RichEditor`.

### S16: Hierarchical Folder Tree Component
- **Reference Match**: Phase 02 Folder Management
- **Path**: `src/components/app/FolderTree.tsx`
- **Structure**: Interactive nested folder tree in the sidebar with folder creation, subfolder nesting, inline renaming, deletion safety, and active folder filtering for the notes explorer.
