-- Adds updated_at: when the row was last modified. Unlike created_at (fixed at
-- insert), this bumps on every UPDATE — e.g. when etymology is generated for an
-- existing lookup. A trigger keeps it correct no matter what writes the row.

alter table public.lookups
  add column if not exists updated_at timestamptz not null default now();

-- Backfill existing rows so updated_at starts equal to created_at. Must run
-- BEFORE the trigger exists, otherwise the trigger would overwrite it with now().
update public.lookups set updated_at = created_at;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lookups_set_updated_at on public.lookups;
create trigger lookups_set_updated_at
  before update on public.lookups
  for each row
  execute function public.set_updated_at();
