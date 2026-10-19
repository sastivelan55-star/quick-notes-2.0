# FlowNote AI

> A local-first, AI-powered notes and personal productivity platform.

## Quick Start

### Prerequisites
- Node.js >= 20
- npm >= 10
- A Supabase account and project (free tier works)
- (Optional) OpenAI API key for AI features

### 1. Clone / open the project

```bash
cd "c:\life note"
```

### 2. Configure environment variables

```bash
cp apps/web/.env.example apps/web/.env.local
# Edit apps/web/.env.local with your credentials
```

See [apps/web/.env.example](apps/web/.env.example) for all required variables.

### 3. Set up the database

1. Create a Supabase project at https://supabase.com
2. Run the SQL migrations in `packages/database/migrations/` in order inside Supabase SQL editor
3. Copy your project URL and anon key into `.env.local`

### 4. Install dependencies and run

```bash
npm install
npm run dev
```

Open http://localhost:3000

---

## Project Structure

```
apps/
  web/              Next.js 14 web application
packages/
  domain/           Shared TypeScript types and validation
  database/         Supabase schema, migrations, seeds
  ui/               Design tokens and reusable components
docs/               Architecture and product documentation
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Product Requirements](docs/PRODUCT_REQUIREMENTS.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [API Reference](docs/API.md)

## Feature Status

| Feature | Status |
|---|---|
| Instant capture / rich-text editor (TipTap) | ✅ Implemented |
| Local autosave (IndexedDB via Dexie) | ✅ Implemented |
| Draft recovery | ✅ Implemented |
| Notes management (create, edit, delete, archive) | ✅ Implemented |
| Folders and tags | ✅ Implemented |
| Tasks with priority & due dates | ✅ Implemented |
| Today dashboard overview | ✅ Implemented |
| Full-text local search | ✅ Implemented |
| Dark / light theme switching | ✅ Implemented |
| Supabase authentication & RLS | ✅ Implemented (requires credentials) |
| Cloud sync with background queue | ✅ Implemented |
| Offline-first local mode | ✅ Implemented |
| Voice capture & live dictation | ✅ Implemented |
| Export (JSON bundle) | ✅ Implemented |
| Trash and recovery | ✅ Implemented |
| AI assistant (summarize, extract, rewrite) | ⚙️ Ready (requires OPENAI_API_KEY) |
| Automated unit & integration tests | ✅ Implemented (`npm test`) |
| Mobile app scaffold (React Native / Expo) | 📅 Phase 2 |

Legend: ✅ Implemented and tested | ⚙️ Requires external credentials | 📅 Planned
