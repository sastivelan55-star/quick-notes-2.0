# FlowNote AI — Deployment & Infrastructure Guide

This guide provides step-by-step instructions for deploying FlowNote AI to production on Vercel, Docker, or self-hosted environments.

---

## 1. Prerequisites & Environment Variables

Create `.env.local` inside `apps/web/` (or set environment variables in your deployment hosting dashboard):

```bash
# ─── Supabase Configuration ─────────────────────────────────────
# Found in your Supabase project settings -> API
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# ─── AI Integration ─────────────────────────────────────────────
# OpenAI API key (server-side only, never exposed to browser)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini # optional, defaults to gpt-4o-mini

# ─── Application Settings ───────────────────────────────────────
NEXT_PUBLIC_APP_NAME="FlowNote AI"
NEXT_PUBLIC_APP_URL=https://flownote.yourdomain.com
```

> **Note:** If `NEXT_PUBLIC_SUPABASE_URL` is omitted, FlowNote AI automatically operates in **Local-Only Offline Mode**, allowing users to use all editor, task, search, voice, and export capabilities entirely in the browser using IndexedDB.

---

## 2. Supabase Database Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** tab in the Supabase Dashboard.
3. Open `packages/database/migrations/001_initial_schema.sql` from this repository.
4. Paste the entire SQL script and click **Run**.
   - This creates all tables (`profiles`, `notes`, `note_versions`, `folders`, `tags`, `note_tags`, `tasks`, `attachments`, `ai_jobs`).
   - Enables `uuid-ossp` and `pg_trgm` extensions.
   - Creates full-text search indexes.
   - Configures PostgreSQL Row Level Security (RLS) policies for complete user data isolation.

---

## 3. Deploying to Vercel

FlowNote AI is built with Next.js 16 and is fully optimized for Vercel edge and serverless runtimes.

### Option A: Using the Vercel CLI
```bash
# Install Vercel CLI
npm install -g vercel

# Navigate to web application directory
cd apps/web

# Deploy
vercel
```

### Option B: Deploying from GitHub / GitLab
1. Push your repository to GitHub.
2. In Vercel, click **Add New Project** and select the repository.
3. Set the **Root Directory** to `apps/web`.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENAI_API_KEY`
5. Click **Deploy**.

---

## 4. Docker Self-Hosted Deployment

FlowNote AI can be containerized using Node.js:

```dockerfile
# Multi-stage Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY apps/web/package*.json apps/web/
COPY packages/domain/package*.json packages/domain/

RUN npm ci

COPY . .
RUN npm run build --workspace=apps/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/web/.next apps/web/.next
COPY --from=builder /app/apps/web/public apps/web/public
COPY --from=builder /app/apps/web/package*.json apps/web/
COPY --from=builder /app/node_modules node_modules

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
```

---

## 5. Verification Checklist Post-Deployment

- [ ] Visit `https://your-domain.com/` — confirms redirect to `/app` or `/auth/login`.
- [ ] Create a new note in Instant Capture — verify local IndexedDB write.
- [ ] Check network tab for background sync heartbeat.
- [ ] Test Dark / Light mode toggle in Settings.
- [ ] Test JSON export functionality.
- [ ] Verify SSL certificates and HSTS headers.
