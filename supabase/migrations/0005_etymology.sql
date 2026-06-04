-- Optional etymology / origin of the term (where the word or phrase comes from).
--
-- Blank by default: a lookup never auto-populates this on creation. It is filled
-- in on demand via the `etymology` edge function when the reader asks for it, and
-- then shown in the result/history card. Written in the lookup's own language,
-- like every other field — we never translate between languages.
alter table public.lookups
  add column if not exists etymology text not null default '';
