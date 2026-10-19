# FlowNote AI — Product Requirements Document (PRD)

## 1. Product Summary & Vision

FlowNote AI is an intelligent, privacy-conscious personal knowledge and task operating system designed for knowledge workers, developers, researchers, and busy professionals. It combines instant note capture, structured task management, voice dictation, and serverless AI assistance into a unified, offline-native interface.

---

## 2. Personas & Core User Journeys

### 2.1 Persona A: The Speed Note-Taker (Elena, Tech Lead)
- **Goal**: Capture thoughts, code snippets, and meeting points instantly during conversations without waiting for a database roundtrip.
- **Journey**:
  1. Opens FlowNote AI (`/app`).
  2. Cursor is already blinking in the title input.
  3. Writes notes with Markdown formatting, headings, bullet points, and code blocks.
  4. Autosave writes to IndexedDB in real time.
  5. Presses `⌘S` or switches to another task; the note is safely stored and queued for sync.

### 2.2 Persona B: The Multitasking Meeting Lead (Marcus, Product Manager)
- **Goal**: Dictate meeting takeaways and automatically transform raw conversation into action items.
- **Journey**:
  1. Clicks "Voice" in the Instant Capture toolbar.
  2. Speaks into the microphone; speech transcribes into real-time text with audio wave indicator.
  3. Clicks "Meeting Notes (AI)" or "Extract Tasks (AI)".
  4. System generates structured meeting minutes with owners and due dates.
  5. Clicks "Insert into Note".

### 2.3 Persona C: The Focused Task Manager (Liam, Student/Researcher)
- **Goal**: Track tasks alongside reference notes with priority levels and due dates.
- **Journey**:
  1. Opens the "Tasks" view.
  2. Adds tasks with priorities (Low, Medium, High, Urgent) and due dates.
  3. Filters tasks by Open / Completed / Priority.
  4. Checks off tasks, observing instant optimistic UI update.

---

## 3. Detailed Feature Specifications

### 3.1 Instant Capture & Rich Text Editor
- **Autofocus**: On app launch, title input is immediately focused.
- **TipTap Formatting Engine**:
  - Headings (H1, H2, H3)
  - Bold, Italic, Strikethrough, Underline, Code inline
  - Blockquotes, Bullet Lists, Numbered Lists, Task Checklists
  - Tables (insertion, row/column operations)
  - Syntax-highlighted code blocks
  - Character and word count live telemetry.
- **Autosave Engine**:
  - Debounced autosave (800ms) prevents disk thrashing.
  - Distinct state indicators: `Saving...`, `Saved X ago`, `Offline (Saved locally)`.
- **Draft Recovery**:
  - Unsaved active drafts are stored with stable UUIDs so refreshing or closing the browser never causes lost thoughts.

### 3.2 Voice Capture & Dictation
- Web Speech API live stream transcription.
- MediaRecorder audio stream capture with audio playback preview.
- One-click copy, insert into active note, or transform via AI.

### 3.3 Task System
- Task statuses: `open`, `in_progress`, `blocked`, `waiting`, `done`.
- Task priorities: `none`, `low`, `medium`, `high`, `urgent`.
- Filter bar for quick triage.
- Instant toggle with completed timestamp tracking.

### 3.4 Today Dashboard
- High-level overview of note count, open tasks, urgent action items, and recent edits.
- Quick capture widget directly on dashboard.

### 3.5 Full-Text Search
- Instant local search across note titles and plain-text contents using Dexie IndexedDB indices.
- Server-side full-text search capability via PostgreSQL `pg_trgm` GIN indexes.

### 3.6 Settings & Data Sovereignty
- Single-click **Export All Data (JSON)** bundle containing all notes, tasks, folders, and tags.
- Appearance: Dark Mode / Light Mode with instant CSS custom property switching.
- Local-only mode indicator when operating without cloud credentials.
