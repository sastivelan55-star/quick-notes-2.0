-- ============================================================
-- FlowNote AI / NoteNest — Migration 003: Cross-Device Sync Hardening
-- Safe, non-destructive forward-only performance & realtime migration
-- Run this in your Supabase SQL Editor if realtime sync is desired
-- ============================================================

-- 1. Ensure compound indexes for fast delta sync by user and updated_at
create index if not exists notes_user_updated_idx on notes(user_id, updated_at desc);
create index if not exists tasks_user_updated_idx on tasks(user_id, updated_at desc);
create index if not exists folders_user_updated_idx on folders(user_id, updated_at desc);
create index if not exists note_tags_user_lookup_idx on note_tags(note_id, tag_id);

-- 2. Enable Realtime publication for bidirectional client change notifications
-- Wrapped in safe block to avoid errors if tables are already published
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table notes;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table tasks;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table folders;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table tags;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
