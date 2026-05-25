#!/bin/bash
# Builds all icon PNGs + the .icns from the SVG sources.
# Requires: Google Chrome, sips, iconutil (all on macOS by default).

set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
OUT_DIR="$(cd "$SRC_DIR/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

render() {
  # render <svg-name> <size> <output-path>
  local svg="$1" size="$2" out="$3"
  "$CHROME" --headless=new --disable-gpu --no-sandbox \
    --hide-scrollbars \
    --default-background-color=00000000 \
    --force-device-scale-factor=1 \
    --virtual-time-budget=2000 \
    --window-size="${size},${size}" \
    --screenshot="$out" \
    "file://$SRC_DIR/render.html?src=$svg" >/dev/null 2>&1
}

echo "==> Tray icon (template image, black on transparent)"
# Render high-res once, downscale to 44 and 22 (crisper anti-aliasing).
render tray-icon.svg 512 "$SRC_DIR/_tray_hi.png"
sips -z 44 44 "$SRC_DIR/_tray_hi.png" --out "$OUT_DIR/iconTemplate@2x.png" >/dev/null
sips -z 22 22 "$SRC_DIR/_tray_hi.png" --out "$OUT_DIR/iconTemplate.png" >/dev/null
rm "$SRC_DIR/_tray_hi.png"
echo "    -> $OUT_DIR/iconTemplate.png (22x22)"
echo "    -> $OUT_DIR/iconTemplate@2x.png (44x44)"

echo "==> App icon (.iconset + .icns)"
ICONSET="$SRC_DIR/_icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"

# Apple iconset spec: pairs of sizes with @2x variants.
declare -a sizes=(16 32 128 256 512)
for s in "${sizes[@]}"; do
  s2=$((s * 2))
  # 1x rendered at native size.
  render app-icon.svg "$s" "$ICONSET/icon_${s}x${s}.png"
  # @2x rendered at native @2x.
  render app-icon.svg "$s2" "$ICONSET/icon_${s}x${s}@2x.png"
done

# Tiny viewports sometimes render empty; if so, derive from a larger render via sips.
render app-icon.svg 1024 "$SRC_DIR/_app_1024.png"
for f in "$ICONSET"/*.png; do
  bytes=$(stat -f%z "$f")
  if [ "$bytes" -lt 1000 ]; then
    # Likely empty render — replace by downscaling the 1024 source.
    base=$(basename "$f" .png)
    case "$base" in
      icon_16x16)        target_size=16  ;;
      icon_16x16@2x)     target_size=32  ;;
      icon_32x32)        target_size=32  ;;
      icon_32x32@2x)     target_size=64  ;;
      icon_128x128)      target_size=128 ;;
      icon_128x128@2x)   target_size=256 ;;
      icon_256x256)      target_size=256 ;;
      icon_256x256@2x)   target_size=512 ;;
      icon_512x512)      target_size=512 ;;
      icon_512x512@2x)   target_size=1024 ;;
    esac
    echo "    fallback: $base (rendered tiny, downscaling from 1024 -> ${target_size})"
    sips -z "$target_size" "$target_size" "$SRC_DIR/_app_1024.png" --out "$f" >/dev/null
  fi
done
rm "$SRC_DIR/_app_1024.png"

iconutil -c icns "$ICONSET" -o "$OUT_DIR/icon.icns"
# Also keep a 1024 PNG fallback for any tool that wants raw PNG.
cp "$ICONSET/icon_512x512@2x.png" "$OUT_DIR/icon.png"
rm -rf "$ICONSET"

echo "    -> $OUT_DIR/icon.icns"
echo "    -> $OUT_DIR/icon.png (1024x1024)"
echo "Done."
