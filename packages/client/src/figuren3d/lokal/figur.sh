#!/usr/bin/env bash
# Eine Figur von Konzeptbild bis Blatt, ohne Cloud (docs/ASSETS-TAFELRUNDE-NEU.md).
#
#   figur.sh <name>
#
# Erwartet: $WERK/stilprobe/konzept/<name>.png und <name>.punkte.json.
# Ergebnis: $WERK/stilprobe/lokal/<name>/{<name>.glb, blatt/<name>.webp, ...}
# WERK (Werkzeugordner) und REPO lassen sich von aussen setzen.
set -euo pipefail
name="$1"
WERK="${WERK:-/d/Claude/tools/3d-lokal}"
REPO="${REPO:-/d/Claude/Repos/moodsteppi/brauweg-domain}"
HIER="$(cd "$(dirname "$0")" && pwd)"
ziel="$WERK/stilprobe/lokal/$name"
mkdir -p "$ziel/triposr/0" "$ziel/vorschau"
export HF_HOME="$WERK/hf-cache"

t0=$(date +%s)
"$WERK/venv/Scripts/python" "$HIER/vorbereiten.py" "$WERK/stilprobe/konzept/$name.png" "$ziel/eingang.png"
( cd "$WERK/TripoSR" && "$WERK/venv/Scripts/python" run.py "$ziel/eingang.png" \
    --output-dir "$(cygpath -m "$ziel/triposr")" --no-remove-bg --bake-texture \
    --texture-resolution 1024 --mc-resolution 256 --model-save-format obj 2>&1 | grep "INFO" | tail -1 )
t1=$(date +%s)
# TripoSR liefert Z oben, Gesicht nach +X; das Skelett erwartet Gesicht nach -Y.
"$WERK/blender-4.5.17-windows-x64/blender.exe" -b -P "$HIER/riggen.py" -- \
    --eingang "$(cygpath -m "$ziel/triposr/0/mesh.obj")" --ausgang "$(cygpath -m "$ziel/$name.glb")" \
    --punkte "$(cygpath -m "$WERK/stilprobe/konzept/$name.punkte.json")" \
    --vorschau "$(cygpath -m "$ziel/vorschau")" --drehen-z -90 2>&1 | grep "\[riggen\]"
t2=$(date +%s)
( cd "$REPO" && node packages/client/src/figuren3d/bildfolgen-rendern.mjs --modell "$ziel/$name.glb" \
    --name "$name" --ausgabe "$ziel/blatt" --kante 256 | tail -1 )
t3=$(date +%s)
cp "$WERK/stilprobe/konzept/$name.png" "$ziel/konzept.png"
echo "$name: 3D $((t1 - t0)) s, Rig $((t2 - t1)) s, Blatt $((t3 - t2)) s"
