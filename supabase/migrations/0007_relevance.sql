-- Relevance: counts how often the user re-engages with a lookup (etymology
-- traced, card expanded in history, term looked up again, exact search hit).
alter table public.lookups
  add column if not exists relevance integer not null default 0;

-- Backfill: an existing etymology counts as one engagement.
-- Disable the updated_at trigger so backfill doesn't mark rows "edited".
alter table public.lookups disable trigger lookups_set_updated_at;
update public.lookups set relevance = 1 where etymology <> '';
alter table public.lookups enable trigger lookups_set_updated_at;

-- Supports the "Most relevant" sort in History.
create index if not exists lookups_user_relevance_idx
  on public.lookups (user_id, relevance desc, created_at desc, id desc);

-- Atomic +1 by id. security invoker: RLS policy lookups_update_own applies.
create or replace function public.increment_relevance(p_id uuid)
returns void
language sql
security invoker
as $$
  update public.lookups set relevance = relevance + 1 where id = p_id;
$$;

-- Atomic +1 for all of the caller's rows matching a term+language, optionally
-- excluding one id (the just-inserted row).
create or replace function public.increment_term_relevance(
  p_term text,
  p_language text,
  p_exclude_id uuid default null
)
returns void
language sql
security invoker
as $$
  update public.lookups
     set relevance = relevance + 1
   where lower(term) = lower(trim(p_term))
     and language = p_language
     and (p_exclude_id is null or id <> p_exclude_id);
$$;
