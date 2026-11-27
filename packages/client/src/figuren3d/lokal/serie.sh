#!/usr/bin/env bash
# Alle Figuren nacheinander durch figur-sg.sh (die Grafikkarte nimmt eine zur Zeit).
cd "$(dirname "$0")"
for n in "$@"; do
  if bash figur-sg.sh "$n" 40 > "../stilprobe/sg-$n.log" 2>&1; then
    echo "fertig $n: $(tail -1 ../stilprobe/sg-$n.log)"
  else
    echo "FEHLER $n (siehe stilprobe/sg-$n.log)"
  fi
done
echo "serie fertig"
