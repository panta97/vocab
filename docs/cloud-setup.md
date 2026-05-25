# Cloud setup (Supabase)

One-time setup to get the Supabase project running. After this, both the Mac app and the iPhone app point at it.

## 1. Create the project

1. Sign in at [supabase.com](https://supabase.com) and create a new project (free tier is plenty).
2. Pick a region near you. Choose a strong database password and save it.
3. Wait ~2 minutes for provisioning.

## 2. Get URL + anon key

In the Supabase dashboard:

- **Project Settings → API**
- Copy **Project URL** → `VITE_SUPABASE_URL`
- Copy **anon public** key → `VITE_SUPABASE_ANON_KEY`

Create `.env` at the project root from the template:

```bash
cp .env.example .env
# edit .env, paste the two values
```

These are baked into the renderer at build time. After changing `.env`, restart `npm run dev` (or rebuild for production).

## 3. Install the Supabase CLI and link

```bash
brew install supabase/tap/supabase
supabase login
supabase link --project-ref <your-project-ref>
```

Your project ref is the first part of your Project URL (e.g. for `https://abcdwxyz.supabase.co` the ref is `abcdwxyz`).

## 4. Apply the database migration

```bash
supabase db push
```

This runs everything in `supabase/migrations/` against your remote project. It creates the `lookups` table, enables RLS, and adds the per-user policies.

To verify: in the dashboard, **Table Editor → lookups** should appear.

## 5. Set the Anthropic API key as a secret

The Edge Function needs the key — but it lives in Supabase, not on your devices.

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

Verify with `supabase secrets list`.

## 6. Deploy the Edge Function

```bash
supabase functions deploy lookup-word
```

To check it's live: **Edge Functions → lookup-word** in the dashboard. The first request is a ~200-500ms cold start, then warm.

## 7. Enable email auth

The default Supabase auth is already email-based. Confirm in the dashboard:

- **Authentication → Providers → Email** is enabled.
- **Authentication → URL Configuration → Site URL**: set to `http://localhost` (just to satisfy validation — magic-link OTP doesn't actually use redirects).
- The sign-in flow uses a 6-digit OTP code emailed to you. No email-template tweaking required for that flow.

## 8. Smoke test

```bash
npm run dev
```

1. App opens to a sign-in screen — enter your email.
2. Check inbox for a 6-digit code from Supabase, paste it back.
3. You land in the Lookup tab. Paste any paragraph, highlight a word, click "Explain in context".
4. Open the Supabase dashboard → Table Editor → `lookups`. A row should appear, scoped to your `user_id`.

If the lookup call fails, run `supabase functions logs lookup-word --tail` in another terminal and trigger another lookup — the error will print there.

## Updating the function later

After editing `supabase/functions/lookup-word/index.ts`:

```bash
supabase functions deploy lookup-word
```

After editing the SQL schema (new migration in `supabase/migrations/`):

```bash
supabase db push
```
