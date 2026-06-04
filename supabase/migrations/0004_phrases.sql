-- Adds support for idiom / phrase lookups alongside single words.
--
-- A "phrase" is pasted on its own with no surrounding paragraph, so its meaning
-- is the most common / popular one rather than a contextual reading. Phrases
-- reuse this same table: the headword column holds either a word or a phrase,
-- `paragraph` is left empty (''), and `type` distinguishes the two.

-- The headword column now holds either a word or a phrase.
alter table public.lookups rename column word to term;

-- 'word' (default, every existing row) or 'phrase'.
alter table public.lookups
  add column if not exists type text not null default 'word';

-- History can be filtered by type (All / Words / Phrases), one language at a time.
create index if not exists lookups_user_type_lang_created_idx
  on public.lookups (user_id, type, language, created_at desc);
