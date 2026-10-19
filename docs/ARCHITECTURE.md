# FlowNote AI — System Architecture & Design Specification

## 1. Architectural Philosophy

FlowNote AI is architected on five non-negotiable core pillars:
1. **Local-First & Offline-Native**: All write operations (captures, updates, deletions) occur instantly against the local persistent IndexedDB storage engine. The application UI responds with sub-millisecond latency and is fully functional without any internet connection.
2. **Deterministic Background Synchronization**: A dedicated background sync engine processes local mutations asynchronously via a transactional sync queue, replicating state to the Supabase PostgreSQL backend using Last-Write-Wins (LWW) conflict resolution backed by client and server monotonic timestamps.
3. **Strict Zero-Trust Privacy & Security**: User content is sandboxed per user with PostgreSQL Row Level Security (RLS). Server API routes guard AI operations; AI keys never reach client bundles.
4. **Instant Capture Experience**: Opening the application bypasses unnecessary onboarding and immediately focuses the rich text composition engine with automatic draft persistence.
5. **Modern Fluid Design System**: Rich, curated typography, accessible contrast, smooth micro-interactions, and instant Dark/Light theme switching.

---

## 2. Monorepo Topology

```
flow-note/
├── apps/
│   └── web/                     # Next.js 14/16 App Router web application
│       ├── src/
│       │   ├── app/             # App router pages, layouts, and API routes
│       │   │   ├── api/ai/      # Server-side AI processing endpoint
│       │   │   ├── app/         # Main workspace route
│       │   │   ├── auth/        # Supabase auth routes (login/signup)
│       │   │   └── globals.css  # Design system tokens & component utilities
│       │   ├── components/      # UI components by domain
│       │   │   ├── app/         # Shell, sidebar, offline banner
│       │   │   ├── editor/      # TipTap rich text editor & floating toolbar
│       │   │   ├── views/       # Capture, Notes, Tasks, Today, Search, Trash, Settings
│       │   │   └── voice/       # Voice dictation & audio recording modal
│       │   ├── lib/
│       │   │   ├── db/          # Dexie.js local database schema
│       │   │   ├── services/    # Business services (notes, tasks, sync, AI, voice)
│       │   │   └── supabase/    # Supabase client/server/middleware bindings
│       │   └── store/           # Zustand application state store
│       └── tests/               # Unit and integration test suites
├── packages/
│   ├── database/                # Supabase PostgreSQL schema, migrations, seed
│   │   └── migrations/
│   │       └── 001_initial_schema.sql
│   └── domain/                  # Shared TypeScript domain models & schemas
│       └── src/
│           └── index.ts
└── docs/                        # Architecture, PRD, API, & deployment docs
```

---

## 3. Data Flow & Sync Engine Architecture

### 3.1 Local-First Pipeline
```
[User Action] ──> [Zustand Cache Update (0ms)]
                       │
                       ▼
              [Dexie IndexedDB Write]
                       │
                       ▼
              [Sync Queue Mutation Item Enqueued]
                       │
                       ▼ (Online Detection)
              [Sync Worker Heartbeat / Event]
                       │
                       ▼
              [Supabase REST / PostgREST Upsert]
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
      [Success]                   [Error]
  Dequeue Item &           Increment Retry Count &
  Mark Synced in Dexie      Log Error for Backoff
```

### 3.2 Conflict Resolution: Last-Write-Wins (LWW)
Every record maintains:
- `created_at`: Immutable entity creation timestamp.
- `updated_at`: Client mutation timestamp (ISO 8601 UTC).
- `server_updated_at`: PostgreSQL trigger timestamp (`now()`).

When the background worker reconciles mutations:
1. If local `updated_at > server_updated_at`, local changes are pushed to PostgreSQL.
2. If remote changes occurred while client was offline, changes are pulled and applied to Dexie.
3. In case of concurrent modifications, pre-AI or conflicting versions are preserved in `note_versions` to prevent data loss.

---

## 4. Voice Transcription & AI Pipeline

### 4.1 Voice Capture Module
- **Live Real-time Speech-to-Text**: Utilizes browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) for zero-latency, local transcript generation.
- **Audio Recording**: Captures high-fidelity WebM/MP4 audio streams via `MediaRecorder` API for export or audio playback.
- **AI Transformations**: One-click actions to convert speech transcripts into executive summaries, meeting minutes, and extracted action items.

### 4.2 AI Service Boundaries
- Clients never talk directly to OpenAI.
- Requests pass through `POST /api/ai/process`, which verifies:
  1. Supabase User Authentication (if configured)
  2. Input length limits (20,000 characters max to prevent denial-of-wallet)
  3. Validated prompt templates with deterministic system roles.
- When `OPENAI_API_KEY` is not present, the service returns a graceful `503 Unavailable` status with actionable instructions, never breaking the UI.

---

## 5. Security Architecture

- **PostgreSQL Row Level Security (RLS)**: Enforced on all tables (`notes`, `tasks`, `folders`, `tags`, `profiles`).
- **Data Isolation**: All queries enforce `user_id = auth.uid()`.
- **Content Sanitization**: Editor content uses TipTap JSON schema representations to eliminate XSS risks from raw HTML strings.
- **Environment Isolation**: Secret keys (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) remain strictly server-side.
