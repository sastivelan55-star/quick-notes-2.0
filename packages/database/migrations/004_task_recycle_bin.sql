-- ============================================================
-- LifeMap OS — Migration 004: Task Recycle Bin & Schema Healing
-- Safe, additive migration — ensures all task columns exist,
-- adds is_deleted and deleted_at, and creates indexes.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Ensure all task columns exist (in case tasks table had a minimal schema)
alter table tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table tasks add column if not exists note_id uuid references notes(id) on delete set null;
alter table tasks add column if not exists parent_task_id uuid references tasks(id) on delete cascade;
alter table tasks add column if not exists title text not null default '';
alter table tasks add column if not exists description text;
alter table tasks add column if not exists status text not null default 'open';
alter table tasks add column if not exists priority text not null default 'none';
alter table tasks add column if not exists due_date date;
alter table tasks add column if not exists start_date date;
alter table tasks add column if not exists completed_at timestamptz;
alter table tasks add column if not exists is_deleted boolean not null default false;
alter table tasks add column if not exists deleted_at timestamptz;
alter table tasks add column if not exists sort_order bigint not null default 0;
alter table tasks add column if not exists created_at timestamptz not null default now();
alter table tasks add column if not exists updated_at timestamptz not null default now();

-- 2. Ensure sort_order accommodates large millisecond timestamps safely
do $$
begin
  alter table tasks alter column sort_order type bigint;
exception when others then null;
end $$;

-- 3. Backfill: for any already soft-deleted tasks, set deleted_at = updated_at
--    so existing deleted tasks appear in the Recycle Bin with a sensible date.
update tasks
  set deleted_at = coalesce(updated_at, now())
  where is_deleted = true
    and deleted_at is null;

-- 4. Indexes for fast Recycle Bin & Task queries
create index if not exists tasks_user_deleted_at_idx
  on tasks(user_id, deleted_at desc)
  where is_deleted = true;

create index if not exists tasks_user_active_idx
  on tasks(user_id, sort_order desc)
  where is_deleted = false;

create index if not exists tasks_parent_task_id_idx
  on tasks(parent_task_id);

create index if not exists tasks_user_updated_idx
  on tasks(user_id, updated_at desc);

-- 5. Ensure Row Level Security is enabled
alter table tasks enable row level security;

-- 6. Ensure RLS Policy exists
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'tasks' and policyname = 'Users manage own tasks'
  ) then
    create policy "Users manage own tasks" on tasks for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- ── Verification ──────────────────────────────────────────────
-- After running, verify with:
--   select column_name, data_type, is_nullable
--   from information_schema.columns
--   where table_name = 'tasks'
--   order by ordinal_position;
