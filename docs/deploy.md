# Deploying Vocab to your menu bar

Three steps: **build → install → autostart**.

## 1. Build a `.app`

```bash
cd /Users/rooseveltpantaleon/Developer/react/vocab
npm run package:mac
```

This produces a `.dmg` and a `.app` in `dist/`. Since you're on Apple Silicon (Darwin 25 on an M-series Mac), you can speed up the build by editing `electron-builder.yml` and dropping the `x64` arch — just leave `arm64`:

```yaml
mac:
  target:
    - target: dmg
      arch:
        - arm64
```

`LSUIElement: true` is already in the config, so the `.app` has no Dock icon — it's a pure menu bar app.

## 2. Install

- Open `dist/Vocab-0.1.0-arm64.dmg` and drag **Vocab.app** to `/Applications`.
- **First launch will be blocked** because the app isn't code-signed. Two options:
  - Right-click the app in Finder → **Open** → confirm. macOS remembers after that.
  - Or run once: `xattr -d com.apple.quarantine /Applications/Vocab.app`
- After it opens, the tray icon appears in the menu bar.

(If you skip signing forever, this is fine for personal use. To get rid of the warning entirely you'd need an Apple Developer ID — $99/year — and add signing config to `electron-builder.yml`.)

## 3. Make it launch at login

Two routes — pick one:

**Manual (no code change)**
System Settings → General → **Login Items & Extensions** → **+** → pick `Vocab.app`. Done.

**Built-in toggle**
Add a "Launch at login" checkbox in the Settings tab using Electron's `app.setLoginItemSettings({ openAtLogin: true })`. Not implemented yet — see `src/renderer/src/components/SettingsView.tsx` if you want to wire it up.

---

**Note on sign-in after install:** Your Supabase session is stored in `localStorage`, which lives in the per-bundle-id user-data directory. The packaged `.app` and `npm run dev` share the same bundle ID, so signing in once in dev also signs you in for the installed app. The Anthropic API key isn't stored on your Mac at all — it lives in Supabase secrets.
