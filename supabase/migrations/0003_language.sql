-- Adds language column (target language of the lookup) to lookups.
-- We do NOT translate between languages: for a lookup tagged 'es', the word,
-- paragraph, explanation, word_class, synonyms and examples are all in Spanish.
-- Existing rows default to 'en' since every lookup so far was English.

alter table public.lookups
  add column if not exists language text not null default 'en';

-- History is browsed one language at a time, so filter by (user_id, language)
-- ordered by recency.
create index if not exists lookups_user_language_created_idx
  on public.lookups (user_id, language, created_at desc);
