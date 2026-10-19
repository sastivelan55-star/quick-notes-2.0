-- ============================================================
-- FlowNote AI — Migration 001: Initial Schema
-- Run this in your Supabase SQL Editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";
-- Enable full-text search
create extension if not exists "pg_trgm";

-- ─── Profiles ───────────────────────────────────────────────
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  default_note_type text not null default 'note',
  editor_font_size integer not null default 16,
  editor_line_height numeric not null default 1.6,
  ai_enabled boolean not null default false,
  ai_provider text check (ai_provider in ('openai', 'gemini')),
  voice_enabled boolean not null default false,
  language text not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Folders ────────────────────────────────────────────────
create table if not exists folders (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references folders(id) on delete set null,
  color text,
  icon text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists folders_user_id_idx on folders(user_id);

-- ─── Tags ───────────────────────────────────────────────────
create table if not exists tags (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create index if not exists tags_user_id_idx on tags(user_id);

-- ─── Notes ──────────────────────────────────────────────────
create table if not exists notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  content text not null default '{}',
  content_text text not null default '',
  type text not null default 'note',
  status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
  folder_id uuid references folders(id) on delete set null,
  is_pinned boolean not null default false,
  is_favorite boolean not null default false,
  color text,
  word_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- full text search vector
  search_vector tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content_text, '')), 'B')
  ) stored
);

create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_folder_id_idx on notes(folder_id);
create index if not exists notes_status_idx on notes(status);
create index if not exists notes_updated_at_idx on notes(updated_at desc);
create index if not exists notes_search_idx on notes using gin(search_vector);
create index if not exists notes_content_trgm_idx on notes using gin(content_text gin_trgm_ops);

-- ─── Note-Tag Relations ─────────────────────────────────────
create table if not exists note_tags (
  note_id uuid not null references notes(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists note_tags_tag_id_idx on note_tags(tag_id);

-- ─── Note Versions ──────────────────────────────────────────
create table if not exists note_versions (
  id uuid primary key default uuid_generate_v4(),
  note_id uuid not null references notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  content_text text not null default '',
  title text not null default '',
  reason text not null default 'autosave' check (reason in ('autosave', 'manual', 'pre_ai_edit', 'restore')),
  created_at timestamptz not null default now()
);

create index if not exists note_versions_note_id_idx on note_versions(note_id);

-- ─── Tasks ──────────────────────────────────────────────────
create table if not exists tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,
  parent_task_id uuid references tasks(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'open' check (status in ('open', 'in_progress', 'blocked', 'waiting', 'done')),
  priority text not null default 'none' check (priority in ('none', 'low', 'medium', 'high', 'urgent')),
  due_date date,
  start_date date,
  completed_at timestamptz,
  is_deleted boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_user_id_idx on tasks(user_id);
create index if not exists tasks_note_id_idx on tasks(note_id);
create index if not exists tasks_parent_task_id_idx on tasks(parent_task_id);
create index if not exists tasks_status_idx on tasks(status);
create index if not exists tasks_due_date_idx on tasks(due_date);

-- ─── AI Jobs ────────────────────────────────────────────────
create table if not exists ai_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note_id uuid references notes(id) on delete set null,
  operation text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'unavailable')),
  input_hash text not null,
  result text,
  error text,
  provider text,
  model text,
  tokens_used integer,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_jobs_user_id_idx on ai_jobs(user_id);
create index if not exists ai_jobs_note_id_idx on ai_jobs(note_id);
create index if not exists ai_jobs_status_idx on ai_jobs(status);

-- ─── Row Level Security ─────────────────────────────────────
alter table profiles enable row level security;
alter table folders enable row level security;
alter table tags enable row level security;
alter table notes enable row level security;
alter table note_tags enable row level security;
alter table note_versions enable row level security;
alter table tasks enable row level security;
alter table ai_jobs enable row level security;

-- Profiles: users see only their own
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Folders: users see only their own
create policy "Users manage own folders" on folders for all using (auth.uid() = user_id);

-- Tags: users see only their own
create policy "Users manage own tags" on tags for all using (auth.uid() = user_id);

-- Notes: users see only their own
create policy "Users manage own notes" on notes for all using (auth.uid() = user_id);

-- Note-tag: note must belong to user
create policy "Users manage own note_tags" on note_tags for all
  using (exists (select 1 from notes where notes.id = note_tags.note_id and notes.user_id = auth.uid()));

-- Note versions: note must belong to user
create policy "Users manage own note_versions" on note_versions for all using (auth.uid() = user_id);

-- Tasks: users see only their own
create policy "Users manage own tasks" on tasks for all using (auth.uid() = user_id);

-- AI jobs: users see only their own
create policy "Users manage own ai_jobs" on ai_jobs for all using (auth.uid() = user_id);

-- ─── Auto-create Profile on Signup ──────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Full-text search function ───────────────────────────────
create or replace function search_notes(
  p_user_id uuid,
  p_query text,
  p_limit integer default 20,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  content_text text,
  type text,
  status text,
  updated_at timestamptz,
  folder_id uuid,
  rank real
)
language sql stable security definer
as $$
  select
    n.id,
    n.title,
    n.content_text,
    n.type,
    n.status,
    n.updated_at,
    n.folder_id,
    ts_rank(n.search_vector, websearch_to_tsquery('english', p_query)) as rank
  from notes n
  where
    n.user_id = p_user_id
    and n.status = 'active'
    and n.search_vector @@ websearch_to_tsquery('english', p_query)
  order by rank desc, n.updated_at desc
  limit p_limit
  offset p_offset;
$$;
