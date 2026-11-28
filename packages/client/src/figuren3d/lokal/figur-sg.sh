#!/usr/bin/env bash
# Eine Figur auf dem verbesserten Weg (docs/ASSETS-TAFELRUNDE-NEU.md):
# Form von TripoSG, Farbe vorn aus dem Konzeptbild, Rest aus TripoSR.
#
#   figur-sg.sh <name> [drehung]
#
# Erwartet $WERK/stilprobe/konzept/<name>.png und <name>.punkte.json.
# Ergebnis unter $WERK/stilprobe/sg/<name>/. Schritte, deren Ergebnis schon
# da ist, werden uebersprungen (Form neu: form.obj loeschen).
set -euo pipefail
name="$1"
drehung="${2:-40}"
WERK="${WERK:-/d/Claude/tools/3d-lokal}"
REPO="${REPO:-/d/Claude/Repos/moodsteppi/brauweg-domain}"
HIER="$(cd "$(dirname "$0")" && pwd)"
ziel="$WERK/stilprobe/sg/$name"
konzept="$WERK/stilprobe/konzept/$name.png"
mkdir -p "$ziel/vorschau"
export HF_HOME="$WERK/hf-cache"
m() { cygpath -m "$1"; }

t0=$(date +%s)
[ -f "$ziel/eingang.png" ] || "$WERK/venv/Scripts/python" "$HIER/vorbereiten.py" "$konzept" "$ziel/eingang.png" >/dev/null
[ -f "$ziel/form.obj" ] || "$WERK/venv-sg/Scripts/python" "$HIER/triposg_lauf.py" "$konzept" "$ziel/form.obj" 2>&1 | grep "\[triposg\]"
t1=$(date +%s)
[ -f "$ziel/textur/texture.png" ] || "$WERK/venv/Scripts/python" "$HIER/texturieren.py" "$konzept" "$ziel/eingang.png" "$ziel/form.obj" "$ziel/textur" 2>&1 | grep "\[texturieren\] Anteil"
t2=$(date +%s)
"$WERK/blender-4.5.17-windows-x64/blender.exe" -b -P "$HIER/riggen.py" -- \
    --eingang "$(m "$ziel/textur/mesh.obj")" --ausgang "$(m "$ziel/$name.glb")" \
    --punkte "$(m "$WERK/stilprobe/konzept/$name.punkte.json")" \
    --vorschau "$(m "$ziel/vorschau")" --drehen-z -90 2>&1 | grep -E "ohne Gewicht|Koerper"
t3=$(date +%s)
( cd "$REPO" && node packages/client/src/figuren3d/bildfolgen-rendern.mjs --modell "$ziel/$name.glb" \
    --name "$name" --ausgabe "$ziel/blatt" --kante 256 --drehung "$drehung" | tail -1 )
t4=$(date +%s)
cp "$konzept" "$ziel/konzept.png"
echo "$name: Form $((t1 - t0)) s, Farbe $((t2 - t1)) s, Rig $((t3 - t2)) s, Blatt $((t4 - t3)) s"
