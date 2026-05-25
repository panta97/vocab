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

## 9. Lock down new signups (single-user mode)

By default, anyone with any email can sign up to your Supabase project. They can't see your data (RLS isolates rows by `user_id`), but a stranger's account could still call your `lookup-word` Edge Function — which costs *your* Anthropic credits. After you've signed up your own account (step 8 above), disable new signups:

1. Open the Email provider settings:
   `https://supabase.com/dashboard/project/<your-project-ref>/auth/providers`
2. Find the **Email** provider.
3. Toggle **"Allow new users to sign up"** → **off**.
4. Save.

Effect: your existing account can still sign in. Any new email gets "Signups are disabled" when they try to log in. If you ever need a second account later, flip the toggle back on, sign them up, flip it off.

This is a one-line dashboard change and is the simplest single-user lockdown for a personal app.

## How sign-in works (6-digit OTP flow)

Reference for what's happening under the hood when you click "Send code":

1. **App → Supabase**: renderer calls `supabase.auth.signInWithOtp({ email })`.
2. **Supabase server**:
   - Generates a random 6-digit number.
   - Hashes it and stores the hash in `auth.one_time_tokens` with an expiry (default 1 hour) and the target email.
   - Sends an email using the **Magic Link** template — we replaced its body with `{{ .Token }}` so it shows the raw code, not a link.
3. **You receive the email**, type the code back into the app.
4. **App → Supabase**: renderer calls `supabase.auth.verifyOtp({ email, token, type: 'email' })`.
5. **Supabase server**:
   - Looks up the hash for that email, compares to the submitted code, checks expiry.
   - If valid: invalidates the code (one-time use), issues a JWT session — an `access_token` (1-hour lifetime) plus a `refresh_token` (longer-lived).
6. **SDK** stores both tokens in `localStorage` under `sb-<project-ref>-auth-token`.
7. **Every subsequent request**:
   - SDK auto-attaches `Authorization: Bearer <access_token>`.
   - Postgres reads `auth.uid()` from the JWT → RLS policies scope every query/insert to your `user_id`.
   - When `access_token` is near expiry, the SDK silently refreshes it using `refresh_token`. That's why you don't sign in every hour.

The 6-digit code is a one-time **proof of email ownership**. By typing it back you prove control of the inbox. No password to leak, no password reuse risk, no link that opens in the wrong app.

## Updating the function later

After editing `supabase/functions/lookup-word/index.ts`:

```bash
supabase functions deploy lookup-word
```

After editing the SQL schema (new migration in `supabase/migrations/`):

```bash
supabase db push
```
