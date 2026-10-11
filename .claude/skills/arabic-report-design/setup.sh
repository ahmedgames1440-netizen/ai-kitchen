#!/usr/bin/env bash
# Prepares a work dir for building a designed Arabic report (PDF + Word).
# Usage: bash setup.sh <workdir>
set -euo pipefail
W="${1:?workdir}"; mkdir -p "$W/fonts" "$W/img" && cd "$W"
[ -f package.json ] || npm init -y >/dev/null
npm install --silent playwright-core @phosphor-icons/core @expo-google-fonts/cairo
pip install -q fonttools brotli python-docx pillow 2>/dev/null || true
if [ ! -f fonts/Cairo-Regular.ttf ]; then
  G=node_modules/@expo-google-fonts/cairo
  cp "$G/400Regular/Cairo_400Regular.ttf" fonts/Cairo-Regular.ttf
  cp "$G/600SemiBold/Cairo_600SemiBold.ttf" fonts/Cairo-SemiBold.ttf
  cp "$G/700Bold/Cairo_700Bold.ttf" fonts/Cairo-Bold.ttf
  cp "$G/800ExtraBold/Cairo_800ExtraBold.ttf" fonts/Cairo-ExtraBold.ttf
  python3 - <<'PY'
from fontTools.ttLib import TTFont
# Word-friendly copies (family "Cairo", styles Regular/Bold) for embedding in .docx
for src, dst, bold in [("Regular", "CairoW-Regular", False), ("Bold", "CairoW-Bold", True)]:
    f = TTFont(f"fonts/Cairo-{src}.ttf"); sub = "Bold" if bold else "Regular"; nm = f["name"]
    for r in list(nm.names):
        if r.nameID in (1, 2, 3, 4, 6, 16, 17, 21, 22, 25): nm.removeNames(nameID=r.nameID)
    for pid, eid, lid in [(3, 1, 0x409), (1, 0, 0)]:
        nm.setName("Cairo", 1, pid, eid, lid); nm.setName(sub, 2, pid, eid, lid)
        nm.setName("Cairo Bold" if bold else "Cairo", 4, pid, eid, lid)
        nm.setName(f"Cairo-{sub}", 6, pid, eid, lid); nm.setName(f"Cairo-{sub}-1.0", 3, pid, eid, lid)
    o = f["OS/2"]; o.usWeightClass = 700 if bold else 400
    o.fsSelection = (o.fsSelection & ~0x61) | (0x20 if bold else 0x40); f["head"].macStyle = 1 if bold else 0; o.fsType = 0
    f.save(f"fonts/{dst}.ttf")
PY
fi
mkdir -p ~/.fonts && cp fonts/CairoW-*.ttf ~/.fonts/ && fc-cache -f >/dev/null 2>&1 || true
echo "ready: $W"
