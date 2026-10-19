# FlowNote AI — API Reference Specification

## 1. Overview & Authentication

FlowNote AI utilizes a hybrid architecture:
1. **Client-Side Data Operations**: Direct interaction with local IndexedDB via Dexie.js for instant zero-latency UI interactions.
2. **Replication Sync Layer**: Direct HTTPS calls to Supabase PostgREST endpoints using authenticated JWT bearer tokens.
3. **Internal Serverless Endpoints**: Next.js server route handlers for sensitive operations (AI processing, secure webhooks).

---

## 2. Server API Routes

### 2.1 AI Processing Endpoint

**`POST /api/ai/process`**

Processes text content through OpenAI models while keeping API keys strictly server-side.

#### Request Headers
| Header | Value | Description |
|---|---|---|
| `Content-Type` | `application/json` | Required |
| `Authorization` | `Bearer <supabase_jwt>` | Optional (Required if Supabase auth is active) |

#### Request Body Schema
```json
{
  "operation": "summarize",
  "content": "Meeting notes content here...",
  "options": {
    "style": "concise",
    "tone": "professional",
    "language": "English"
  }
}
```

#### Supported Operations
- `summarize`: Generates 2-4 sentence executive summary.
- `extract_tasks`: Extracts actionable checklist items into JSON array.
- `suggest_title`: Generates concise title (max 8 words).
- `suggest_tags`: Generates 3-5 relevant tags.
- `rewrite`: Rewrites content with specified style or clarity.
- `fix_grammar`: Corrects spelling, punctuation, and syntax errors.
- `change_tone`: Adjusts tone (`professional`, `casual`, `academic`, etc.).
- `translate`: Translates text into target language.
- `generate_outline`: Builds hierarchical document outline.
- `meeting_summary`: Formats raw notes or transcript into executive summary, discussion points, decisions, action items, and open questions.

#### Success Response (`200 OK`)
```json
{
  "result": "Here is the summarized content...",
  "tokens_used": 142,
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

#### Error Responses
- **`400 Bad Request`**:
  ```json
  { "error": "Invalid operation or missing content" }
  ```
  *(Returned if content exceeds 20,000 characters or missing required fields).*
- **`401 Unauthorized`**:
  ```json
  { "error": "Unauthorized" }
  ```
  *(Returned if Supabase is configured and the user session is invalid).*
- **`503 Service Unavailable`**:
  ```json
  { "error": "AI is not configured. Add OPENAI_API_KEY to your .env.local file." }
  ```
  *(Returned gracefully when OpenAI key is not configured, preventing crash).*

---

## 3. Database Entities Schema (Supabase REST)

When syncing, mutations target the following Supabase tables:

### 3.1 Notes (`/rest/v1/notes`)
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | References `auth.users(id)` |
| `title` | `text` | Note title |
| `content` | `text` | Serialized TipTap JSON document |
| `content_text` | `text` | Plain text for full-text search indexing |
| `type` | `text` | `note`, `meeting`, `journal`, `task_list`, etc. |
| `status` | `text` | `active`, `archived`, `deleted` |
| `folder_id` | `uuid` | Nullable foreign key to `folders(id)` |
| `is_pinned` | `boolean` | Pinned flag |
| `is_favorite` | `boolean` | Favorite flag |
| `color` | `text` | Hex color code or null |
| `word_count` | `integer` | Computed word count |
| `created_at` | `timestamptz` | Entity creation timestamp |
| `updated_at` | `timestamptz` | Client update timestamp |

### 3.2 Tasks (`/rest/v1/tasks`)
| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary Key |
| `user_id` | `uuid` | References `auth.users(id)` |
| `note_id` | `uuid` | Optional association with a note |
| `parent_task_id` | `uuid` | Optional parent task for subtask hierarchies |
| `title` | `text` | Task title |
| `status` | `text` | `open`, `in_progress`, `blocked`, `waiting`, `done` |
| `priority` | `text` | `none`, `low`, `medium`, `high`, `urgent` |
| `due_date` | `timestamptz` | Optional deadline |
| `completed_at` | `timestamptz` | Timestamp when marked done |
| `is_deleted` | `boolean` | Soft delete flag |
