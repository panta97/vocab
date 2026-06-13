// Postgres access for the local dev server. On startup it creates the
// vocab_dev database if needed, applies dev-server/auth-shim.sql, then applies
// the real supabase/migrations/*.sql in order — tracked in _local_migrations
// so each file runs exactly once (0004's rename and 0006's backfill are not
// rerunnable). New prod migrations are picked up on the next server start.

import { readFileSync, readdirSync } from 'node:fs'
import { userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const HERE = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(HERE, '..', 'supabase', 'migrations')

// Must match auth-shim.sql and the fake session in src/renderer/src/lib/local.ts.
export const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000001'

const DATABASE_URL =
  process.env.LOCAL_DATABASE_URL ??
  `postgres://${userInfo().username}@127.0.0.1:5432/vocab_dev`

const pool = new pg.Pool({ connectionString: DATABASE_URL })

// Row as it comes back from pg: jsonb → string[], timestamptz → Date
// (JSON.stringify turns Dates into ISO strings, matching the Supabase wire shape).
export interface LookupRow {
  id: string
  user_id: string
  type: string
  term: string
  word_class: string
  paragraph: string
  explanation: string
  synonyms: string[]
  examples: string[]
  language: string
  etymology: string
  created_at: Date
  updated_at: Date
}

async function ensureDatabase(): Promise<void> {
  const url = new URL(DATABASE_URL)
  const dbName = url.pathname.replace(/^\//, '')
  const adminUrl = new URL(DATABASE_URL)
  adminUrl.pathname = '/postgres'

  const admin = new pg.Client({ connectionString: adminUrl.toString() })
  try {
    await admin.connect()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(
      `Could not reach Postgres at ${url.host} (${msg}). ` +
        'Is it running? Try: brew services start postgresql@14'
    )
  }
  try {
    const { rowCount } = await admin.query(
      'select 1 from pg_database where datname = $1',
      [dbName]
    )
    if (!rowCount) {
      await admin.query(`create database "${dbName}"`)
      console.log(`[db] created database ${dbName}`)
    }
  } finally {
    await admin.end()
  }
}

export async function bootstrap(): Promise<void> {
  await ensureDatabase()

  const client = await pool.connect()
  try {
    await client.query(readFileSync(join(HERE, 'auth-shim.sql'), 'utf8'))
    await client.query(
      `create table if not exists public._local_migrations (
         version    text primary key,
         applied_at timestamptz not null default now()
       )`
    )

    const applied = new Set(
      (await client.query('select version from public._local_migrations')).rows.map(
        (r) => r.version as string
      )
    )
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()

    for (const file of files) {
      if (applied.has(file)) continue
      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      await client.query('begin')
      try {
        await client.query(sql)
        await client.query(
          'insert into public._local_migrations (version) values ($1)',
          [file]
        )
        await client.query('commit')
        console.log(`[db] applied migration ${file}`)
      } catch (e) {
        await client.query('rollback')
        const msg = e instanceof Error ? e.message : String(e)
        throw new Error(`Migration ${file} failed: ${msg}`)
      }
    }
  } finally {
    client.release()
  }
}

export interface InsertLookupFields {
  type: 'word' | 'phrase'
  term: string
  wordClass: string
  paragraph: string
  explanation: string
  synonyms: string[]
  examples: string[]
  language: string
}

export async function insertLookup(f: InsertLookupFields): Promise<LookupRow> {
  const { rows } = await pool.query(
    `insert into public.lookups
       (user_id, type, term, word_class, paragraph, explanation, synonyms, examples, language)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning *`,
    [
      LOCAL_USER_ID,
      f.type,
      f.term,
      f.wordClass,
      f.paragraph,
      f.explanation,
      JSON.stringify(f.synonyms),
      JSON.stringify(f.examples),
      f.language
    ]
  )
  return rows[0]
}

export async function getLookup(id: string): Promise<LookupRow | null> {
  try {
    const { rows } = await pool.query(
      'select * from public.lookups where id = $1 and user_id = $2',
      [id, LOCAL_USER_ID]
    )
    return rows[0] ?? null
  } catch {
    return null // e.g. id is not a valid uuid
  }
}

// The updated_at trigger from migration 0006 fires on this update, same as prod.
export async function setEtymology(id: string, etymology: string): Promise<LookupRow | null> {
  const { rows } = await pool.query(
    'update public.lookups set etymology = $2 where id = $1 and user_id = $3 returning *',
    [id, etymology, LOCAL_USER_ID]
  )
  return rows[0] ?? null
}

export interface ListLookupOptions {
  language?: string
  type?: string
  before?: string
  search?: string
  limit: number
}

// Mirrors listHistory in src/renderer/src/lib/api.ts: newest first, cursor on
// created_at, ILIKE search over term and paragraph with %/_ escaped.
export async function listLookups(opts: ListLookupOptions): Promise<LookupRow[]> {
  const where: string[] = []
  const params: unknown[] = []

  where.push(`user_id = $${params.push(LOCAL_USER_ID)}`)
  if (opts.language) where.push(`language = $${params.push(opts.language)}`)
  if (opts.type) where.push(`type = $${params.push(opts.type)}`)
  if (opts.before) where.push(`created_at < $${params.push(opts.before)}`)
  if (opts.search) {
    const safe = opts.search.replace(/[%_]/g, '\\$&')
    const idx = params.push(`%${safe}%`)
    where.push(`(term ilike $${idx} or paragraph ilike $${idx})`)
  }

  const { rows } = await pool.query(
    `select * from public.lookups
     where ${where.join(' and ')}
     order by created_at desc, id desc
     limit $${params.push(opts.limit)}`,
    params
  )
  return rows
}

export async function deleteLookup(id: string): Promise<void> {
  await pool.query('delete from public.lookups where id = $1 and user_id = $2', [
    id,
    LOCAL_USER_ID
  ])
}
