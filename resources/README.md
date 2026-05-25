# Resources

Generated assets used by the packaged app:

- `iconTemplate.png` (22×22) + `iconTemplate@2x.png` (44×44) — menu bar tray icon, black-on-transparent template image (macOS auto-tints for light/dark mode).
- `icon.icns` — full multi-resolution app icon (used by electron-builder for the `.app` bundle).
- `icon.png` (1024×1024) — raw PNG fallback.

## Editing the icons

The SVG sources live in `src/`:

- `src/tray-icon.svg` — open-book silhouette for the menu bar
- `src/app-icon.svg` — colored squircle with open book + yellow highlight for the app bundle
- `src/render.html` — wrapper used to render the SVGs via headless Chrome

After editing either SVG, regenerate all PNG sizes and the `.icns` with:

```bash
resources/src/build-icons.sh
```

The script uses Google Chrome (already on your Mac), `sips`, and `iconutil` — no extra tooling required.

If `iconTemplate.png` is ever missing the app falls back to a small built-in placeholder, so the tray icon always appears.
