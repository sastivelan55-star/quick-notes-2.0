-- ============================================================
-- LifeMap OS — Migration 002: Row Level Security Hardening
-- Safe, non-destructive incremental security patch
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Fix search_notes RPC privilege escalation
-- Previously, search_notes was SECURITY DEFINER and trusted client-provided p_user_id,
-- allowing any authenticated user to search another user's private notes.
-- Hardening: Strictly enforce auth.uid() inside the security definer function.
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
set search_path = public
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
    -- Strictly isolate to authenticated user (ignore unverified p_user_id if mismatched)
    n.user_id = auth.uid()
    and n.status = 'active'
    and n.search_vector @@ websearch_to_tsquery('english', p_query)
  order by rank desc, n.updated_at desc
  limit p_limit
  offset p_offset;
$$;

-- 2. Harden note_tags policy against cross-user tag association
-- Previously, only note.user_id = auth.uid() was checked, allowing users
-- to link another user's tag_id to their own notes.
drop policy if exists "Users manage own note_tags" on note_tags;

create policy "Users manage own note_tags" on note_tags for all
  using (
    exists (select 1 from notes where notes.id = note_tags.note_id and notes.user_id = auth.uid())
    and
    exists (select 1 from tags where tags.id = note_tags.tag_id and tags.user_id = auth.uid())
  )
  with check (
    exists (select 1 from notes where notes.id = note_tags.note_id and notes.user_id = auth.uid())
    and
    exists (select 1 from tags where tags.id = note_tags.tag_id and tags.user_id = auth.uid())
  );

-- 3. Harden folders policy with explicit WITH CHECK
drop policy if exists "Users manage own folders" on folders;

create policy "Users manage own folders" on folders for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (parent_id is null or exists (select 1 from folders f where f.id = folders.parent_id and f.user_id = auth.uid()))
  );

-- 4. Harden notes policy with explicit WITH CHECK ensuring folder belongs to user
drop policy if exists "Users manage own notes" on notes;

create policy "Users manage own notes" on notes for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (folder_id is null or exists (select 1 from folders f where f.id = notes.folder_id and f.user_id = auth.uid()))
  );

-- 5. Harden tasks policy with explicit WITH CHECK ensuring note & parent_task belong to user
drop policy if exists "Users manage own tasks" on tasks;

create policy "Users manage own tasks" on tasks for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (note_id is null or exists (select 1 from notes n where n.id = tasks.note_id and n.user_id = auth.uid()))
    and (parent_task_id is null or exists (select 1 from tasks pt where pt.id = tasks.parent_task_id and pt.user_id = auth.uid()))
  );
