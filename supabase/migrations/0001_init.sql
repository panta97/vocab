-- Vocab cloud schema. Mirrors the original SQLite lookups table,
-- with per-user isolation via RLS.

create extension if not exists "pgcrypto";

create table if not exists public.lookups (
  id           uuid           primary key default gen_random_uuid(),
  user_id      uuid           not null references auth.users (id) on delete cascade,
  word         text           not null,
  paragraph    text           not null,
  explanation  text           not null,
  synonyms     jsonb          not null default '[]'::jsonb,
  examples     jsonb          not null default '[]'::jsonb,
  created_at   timestamptz    not null default now()
);

create index if not exists lookups_user_created_idx
  on public.lookups (user_id, created_at desc);

-- RLS: every user only sees / writes their own rows.
alter table public.lookups enable row level security;

drop policy if exists "lookups_select_own" on public.lookups;
create policy "lookups_select_own"
  on public.lookups for select
  using (auth.uid() = user_id);

drop policy if exists "lookups_insert_own" on public.lookups;
create policy "lookups_insert_own"
  on public.lookups for insert
  with check (auth.uid() = user_id);

drop policy if exists "lookups_delete_own" on public.lookups;
create policy "lookups_delete_own"
  on public.lookups for delete
  using (auth.uid() = user_id);

-- Updates are not used by the app, but keep RLS consistent if it's added later.
drop policy if exists "lookups_update_own" on public.lookups;
create policy "lookups_update_own"
  on public.lookups for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
