# Vocab

A vocabulary assistant for English readers. Paste a paragraph from a book, highlight a word you don't understand, and Claude explains it *in context* — with similar words and example sentences. Every lookup syncs to a cloud database, so your history follows you across devices.

**Two clients, one backend:**
- **Mac menu bar app** — Electron + React + TypeScript
- **Browser app** — same React renderer, deployable to any static host (use from iPhone Safari, any laptop, etc.)
- **Backend** — Supabase (Postgres + Auth + Edge Function calling Claude)

## Setup

```bash
npm install
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

For first-time Supabase setup (creating the project, applying the schema, deploying the Edge Function, setting the Anthropic key as a secret), follow [`docs/cloud-setup.md`](docs/cloud-setup.md). The Anthropic API key lives only in Supabase — never on your devices.

## Run in dev

```bash
npm run dev          # Mac menu bar (Electron)
npm run dev:web      # Browser version (Vite on :5174, LAN-accessible)
```

Both connect to the same Supabase backend. Sign in once on each, history syncs.

## Use it

1. Open the app (click the tray icon on Mac, or visit the URL in a browser).
2. Paste a paragraph from your book.
3. Highlight the word or phrase you don't understand.
4. Click **Explain in context**.
5. The result (definition in context, similar words, example sentences) shows up below and is saved to **History** — visible on all your devices.

## Build the Mac `.dmg`

```bash
npm run package:mac
```

Output lands in `dist/`. Full install/autostart steps in [`docs/deploy.md`](docs/deploy.md). Update loop for code changes in [`docs/update.md`](docs/update.md).

## Deploy the browser version

```bash
npm run build:web    # outputs to dist-web/
```

`dist-web/` is plain static HTML/JS/CSS — deploy to Vercel, Netlify, Cloudflare Pages, or any static host. Full deployment guide in [`docs/browser-deploy.md`](docs/browser-deploy.md). Once deployed, you can use the app from iPhone Safari (Share → Add to Home Screen for an app-like icon, no Xcode required).

## Project layout

```
src/
├── main/             Electron main process (tray + window only)
├── preload/          contextBridge exposing window.api.quit
├── renderer/         React UI (Lookup / History / Settings) — used by both Mac and browser
│   └── src/lib/      Supabase client, API wrapper, AuthGate
└── shared/           TypeScript types
supabase/
├── migrations/       SQL schema + RLS policies (applied via `supabase db push`)
└── functions/
    └── lookup-word/  Edge function: calls Claude, inserts row, returns lookup
resources/            Tray icon + app icon (see resources/README.md)
vite.web.config.ts    Vite config for the standalone browser build
docs/                 deploy / update / cloud-setup / browser-deploy
```

## Architecture

```
   Mac menu bar app        Browser app (any device)
            │                     │
            └─────────┬───────────┘
                      ▼
              Supabase project
            ┌──────────────────┐
            │ Postgres (RLS)   │
            │ Auth (email OTP) │
            │ Edge: lookup-word│──→ Anthropic Claude API
            └──────────────────┘
```

- Every device reads/writes the same `lookups` table.
- Row-level security ensures each user only sees their own data.
- The Edge Function is the only place that holds the Anthropic key.

## The prompt

Defined in `supabase/functions/lookup-word/index.ts`. Claude Sonnet 4.6 is called with a tool-use schema (`record_word_lookup`) that returns three fields: `explanation` (contextual definition), `synonyms` (3–5 similar words), `examples` (1–2 example sentences). Edit the `SYSTEM_PROMPT` constant to change the style, then redeploy:

```bash
supabase functions deploy lookup-word
```

## Menu bar icon

A 22×22 black-on-transparent template PNG at `resources/iconTemplate.png`. See `resources/README.md` for regenerating it from the SVG source via `resources/src/build-icons.sh`.
