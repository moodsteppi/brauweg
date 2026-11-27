#!/usr/bin/env bash
# Erzeugt Konzeptbilder per codex, drei gleichzeitig.
#   konzepte.sh <kennung>...
# Pinguine: _einleitung.txt + _pose-stil.txt, Freunde: die -freunde-Fassungen.
# Zweite Vorlage ist immer die abgenommene Dorfwache.
set -uo pipefail
K="${WERK:-/d/Claude/tools/3d-lokal}/stilprobe/konzept"
REF1="D:/Claude/Repos/moodsteppi/brauweg-domain/packages/client/public/hub/pinguin.png"
REF2="$(cygpath -m "$K/dorfwache.png")"
cd "$K"
eins() {
  local n="$1" art start ein pose sitzung
  art=$(node -e "console.log(require('./serie.json')['$n'])")
  if [ "$art" = "freund" ]; then ein=_einleitung-freunde.txt; pose=_pose-stil-freunde.txt; else ein=_einleitung.txt; pose=_pose-stil.txt; fi
  start=$(date +%s)
  cat "$ein" "$n.subjekt.txt" "$pose" | codex exec --skip-git-repo-check --sandbox read-only --image "$REF1" "$REF2" - > "$n.codex.log" 2>&1
  sitzung=$(grep -o "session id: [0-9a-f-]*" "$n.codex.log" | head -1 | cut -d' ' -f3)
  if ls ~/.codex/generated_images/"$sitzung"/*.png >/dev/null 2>&1; then
    cp "$(ls -t ~/.codex/generated_images/"$sitzung"/*.png | head -1)" "$n.png"
    echo "fertig $n $(( $(date +%s) - start )) s"
  else
    echo "FEHLER $n (kein Bild, siehe $n.codex.log)"
  fi
}
laufend=0
for n in "$@"; do
  eins "$n" &
  laufend=$((laufend + 1))
  if [ $laufend -ge 3 ]; then wait -n; laufend=$((laufend - 1)); fi
done
wait
echo "alle fertig"
