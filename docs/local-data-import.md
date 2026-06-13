# Import your Supabase data into the local database

Pulls your lookup history from the production Supabase project into the local
`vocab_dev` Postgres database used by dev mode (see "Run fully locally" in the
main README), so the app has your real data while testing.

Safe to re-run anytime: the import only adds rows that aren't already present,
so you can pull a fresh export whenever prod has new lookups.

## Prerequisites

- Local Postgres running with the `vocab_dev` database already created
  (start the dev server once: `npm run dev:server`).
- Your **database password** from the Supabase dashboard:
  Project Settings → Database. This is not your Supabase account password.

## Step 1 — Export from prod

The connection URL below is the project's session pooler (also saved in
`supabase/.temp/pooler-url`). The command prompts for the database password,
then writes the whole `lookups` table to a CSV:

```bash
psql "postgresql://postgres.spvoiygpducryabaxkjl@aws-1-us-west-2.pooler.supabase.com:5432/postgres" \
  -c "\copy (select * from public.lookups) to '/tmp/lookups-prod.csv' csv header"
```

## Step 2 — Import into the local database

The rows can't be copied in as-is: in prod they belong to your real Supabase
user id, which doesn't exist in the local stand-in `auth.users` table — and
local mode runs everything as the fixed dev user
(`00000000-0000-0000-0000-000000000001`, shown as `local@dev`). The dev server
only lists that user's rows, so the import stages the CSV in a temp table and
rewrites `user_id` on the way in:

Note the staging table gets an extra `relevance` column: prod has it, but it
isn't in any migration file (schema drift — added outside the migrations) and
the app doesn't use it, so the import reads it from the CSV and drops it.

```bash
psql vocab_dev -v ON_ERROR_STOP=1 <<'SQL'
create temp table lookups_import (like public.lookups including defaults);
alter table lookups_import add column relevance text;
\copy lookups_import from '/tmp/lookups-prod.csv' csv header
insert into public.lookups
  (id, user_id, term, paragraph, explanation, synonyms, examples,
   created_at, word_class, language, type, etymology, updated_at)
select
  id, '00000000-0000-0000-0000-000000000001', term, paragraph, explanation,
  synonyms, examples, created_at, word_class, language, type, etymology, updated_at
from lookups_import
on conflict (id) do nothing;
SQL
```

Row ids and timestamps are preserved, so History ordering matches prod, and
`on conflict (id) do nothing` keeps the import idempotent.

## Verify

```bash
psql vocab_dev -c "select count(*), max(created_at) from public.lookups"
```

Then open the app in local mode (`npm run dev:local`) — your prod history
should appear under the History tab.

## Notes

- One-way only: this pulls prod → local. Nothing here writes to prod (step 1
  is a read-only `select`).
- Lookups created locally in dev mode stay local; deleting them or wiping the
  table (`psql vocab_dev -c "delete from public.lookups"`) never affects prod.
- If the table gains new columns later (new migration), the explicit column
  lists above need updating to match.
- Prod's `lookups` table has a `relevance` column (0/1 flag) that exists in no
  migration file and is unused by the app. Either drop it in prod or capture it
  in a new migration so the schemas converge; until then the staging-table
  workaround above absorbs it.
