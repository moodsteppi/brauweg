#!/usr/bin/env bash
# Erzeugt Bilder aus <name>.prompt.txt per codex, drei gleichzeitig.
#   grafik.sh <ordner> <name>...
set -uo pipefail
cd "$1"; shift
REF="D:/Claude/Repos/moodsteppi/brauweg-domain/packages/client/public/hub/pinguin.png"
eins() {
  local n="$1" start sitzung
  start=$(date +%s)
  codex exec --skip-git-repo-check --sandbox read-only --image "$REF" - < "$n.prompt.txt" > "$n.codex.log" 2>&1
  sitzung=$(grep -o "session id: [0-9a-f-]*" "$n.codex.log" | head -1 | cut -d' ' -f3)
  if ls ~/.codex/generated_images/"$sitzung"/*.png >/dev/null 2>&1; then
    cp "$(ls -t ~/.codex/generated_images/"$sitzung"/*.png | head -1)" "$n.png"
    echo "fertig $n $(( $(date +%s) - start )) s"
  else
    echo "FEHLER $n"
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
