#!/usr/bin/env bash
# Abschluss der Serie: alle Figuren mit Koerper-Normierung neu riggen und
# dann in EINEM Durchgang rendern (gemeinsamer Ausschnitt, gleiche Groesse).
# Form und Farbe kommen aus stilprobe/sg/<name>/ und werden nicht neu erzeugt.
#   serie-final.sh <name>...
set -uo pipefail
WERK="${WERK:-/d/Claude/tools/3d-lokal}"
REPO="${REPO:-/d/Claude/Repos/moodsteppi/brauweg-domain}"
HIER="$(cd "$(dirname "$0")" && pwd)"
ziel="$WERK/stilprobe/final"
mkdir -p "$ziel/modelle" "$ziel/blatt"
m() { cygpath -m "$1"; }
for name in "$@"; do
  quelle="$WERK/stilprobe/sg/$name"
  if [ ! -f "$quelle/textur/mesh.obj" ]; then echo "FEHLT $name (keine Form/Farbe)"; continue; fi
  "$WERK/blender-4.5.17-windows-x64/blender.exe" -b -P "$HIER/riggen.py" -- \
    --eingang "$(m "$quelle/textur/mesh.obj")" --ausgang "$(m "$ziel/modelle/$name.glb")" \
    --punkte "$(m "$WERK/stilprobe/konzept/$name.punkte.json")" --drehen-z -90 2>&1 \
    | grep -E "ohne Gewicht|Koerper" | tr '\n' ' '
  echo " <- $name"
done
( cd "$REPO" && node packages/client/src/figuren3d/bildfolgen-rendern.mjs --modelle "$ziel/modelle" \
    --ausgabe "$ziel/blatt" --kante 256 --drehung 40 )
echo "final fertig"
