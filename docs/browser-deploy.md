# Browser version

The same React renderer the Mac app uses, served as a regular web app. Works in any modern browser (desktop and mobile Safari/Chrome).

## Local dev

```bash
npm run dev:web
```

Vite serves at **http://localhost:5174**. Because `vite.web.config.ts` sets `host: true`, the dev server is also reachable from other devices on your LAN at `http://<your-mac-ip>:5174` — so you can open it in Safari on your iPhone while iterating.

To find your Mac's LAN IP:

```bash
ipconfig getifaddr en0   # Wi-Fi
ipconfig getifaddr en1   # Ethernet
```

## Production build

```bash
npm run build:web
```

Outputs a fully static site to **`dist-web/`** — plain HTML, JS, CSS. Deploy that folder to any static host.

To smoke-test the production build locally:

```bash
npm run preview:web
```

## Recommended: deploy to Vercel

The smoothest hosting for a Vite/React app. Free tier is plenty.

### One-time setup

1. Push this repo to GitHub (if not already).
2. Go to [vercel.com/new](https://vercel.com/new), import the GitHub repo.
3. Vercel auto-detects Vite. Override the defaults:
   - **Build Command**: `npm run build:web`
   - **Output Directory**: `dist-web`
   - **Install Command**: `npm install` (default)
4. **Environment Variables** — add both:
   - `VITE_SUPABASE_URL` = `https://spvoiygpducryabaxkjl.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your `sb_publishable_...` key
5. Click **Deploy**. You'll get a `https://<project>.vercel.app` URL in ~30 seconds.

### After every code change

Just `git push` — Vercel auto-deploys on every push to main. Preview deploys for branches.

### Custom domain (optional)

Vercel → Project Settings → Domains → add your domain, follow DNS instructions.

## Alternative: Netlify / Cloudflare Pages

Same idea, same config:

- Build command: `npm run build:web`
- Publish directory: `dist-web`
- Set both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars

## Alternative: just `scp` to your server

`dist-web/` is plain static files. Upload via `scp -r dist-web/ user@host:/var/www/vocab/` and serve with any web server.

## Notes

- **Supabase Site URL**: with the OTP-code sign-in flow we use, no redirect is involved — so you don't need to add your deployed URL to Supabase's URL Configuration. (Only matters if you switch back to magic-link flow later.)
- **CSP**: the meta-tag CSP in `src/renderer/index.html` allows connections to `https://*.supabase.co`. If you add other API endpoints later, update that list.
- **iPhone install**: since the browser version works on iPhone Safari, just **Share → Add to Home Screen** to get an icon and a near-native app feel — no Xcode, no Apple Developer account, no 7-day expiry.
