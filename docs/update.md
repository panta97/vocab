# Updating the installed app after a code change

Short version: rebuild, replace the `.app`, relaunch. Your DB and API key survive — they live outside the app bundle.

## The loop

```bash
# 1. Quit the running app first (right-click tray icon → Quit, or the ✕ button)
#    macOS won't replace a running .app cleanly.

# 2. Rebuild
npm run package:mac

# 3. Replace /Applications/Vocab.app with the fresh build
rm -rf /Applications/Vocab.app
cp -R dist/mac-arm64/Vocab.app /Applications/

# 4. Open it
open /Applications/Vocab.app
```

You can collapse those into one command for convenience:

```bash
pkill -f Vocab.app 2>/dev/null; \
npm run package:mac && \
rm -rf /Applications/Vocab.app && \
cp -R dist/mac-arm64/Vocab.app /Applications/ && \
open /Applications/Vocab.app
```

Add it as an `npm run deploy:local` script in `package.json` if you'll do it often.

## Things that *don't* need redoing

- **Your lookups** — live in Supabase, untouched by app updates. All devices stay in sync regardless.
- **Your sign-in** — Supabase session token is stored in `localStorage`, which lives in the per-bundle-id user-data directory (`~/Library/Application Support/vocab/`) and survives reinstalls.
- **Your `.env` file** — lives at the project root and is read at build time. Only change/rebuild if you switch Supabase projects.
- **Gatekeeper approval** — only the *downloaded* `.dmg` gets the quarantine flag. Locally-built `.app` bundles copied straight from `dist/` aren't quarantined, so no warning on subsequent installs.
- **Login Items** — keeps pointing at `/Applications/Vocab.app`, which is the path you're replacing.

## When you don't need to repackage at all

For day-to-day code changes, just use `npm run dev` — electron-vite hot-reloads the renderer instantly and restarts the main process on changes. Only repackage when you want to test the *production* build or when you're done iterating and want the change live in the menu bar version.

## If you want zero-friction updates later

`electron-updater` (same publisher as `electron-builder`) can auto-download and apply updates from a GitHub release. Requires code signing to be smooth, so it's worth it once you have a Developer ID — not before.
