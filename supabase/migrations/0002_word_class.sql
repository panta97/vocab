-- Adds word_class column (part of speech in context) to lookups.
-- Existing rows default to '' since we don't backfill old lookups.

alter table public.lookups
  add column if not exists word_class text not null default '';
