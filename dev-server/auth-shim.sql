-- Local-dev shim so the real supabase/migrations/*.sql apply to vanilla
-- Postgres. Supabase provides these in prod; locally we only need enough for
-- the migrations to parse and the lookups.user_id FK to resolve. Idempotent.

create schema if not exists auth;

-- Minimal stand-in for Supabase's auth.users — only the columns we reference.
create table if not exists auth.users (
  id    uuid primary key,
  email text
);

-- Stub of Supabase's auth.uid(). The RLS policies in 0001_init.sql reference
-- it at creation time; they are never enforced locally because the dev server
-- connects as the table owner.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select null::uuid
$$;

-- The single local user every dev-mode lookup belongs to. Must match
-- LOCAL_USER_ID in dev-server/db.ts and the fake session in the renderer.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-000000000001', 'local@dev')
on conflict (id) do nothing;
