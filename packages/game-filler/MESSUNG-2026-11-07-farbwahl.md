# Messung 07.11.2026 — Farbwahl ohne Selbsteinsperren, Mauerprüfung zwei Züge

Umbau auf diesem Zweig: `941e5d08` (bot.ts: Farbwahl in Stufen — selbst
eingesperrt / Gegner sperrt in 1 bzw. 2 Farbzügen ein / sicher, gierig nur
innerhalb der besten Stufe; Mauern über der Schwelle werden gemieden, wenn sie
eine Falle öffnen, die ohne sie zu wäre: meine Farbe, seine Antwort, mein
Folgezug) und `9f2c8402` (Fingerabdrücke). Gemessen wurde nur — `src/` und
`test/` sind in diesem Lauf unverändert.

**Vorher** ist `origin/staging` `8fad9ead` (Filler dort gleich dem
Ausgangsstand `081cda1e` dieses Zweigs, also mit dem Ausgleich aus der
Vorgängerkarte), in einem eigenen Worktree gebaut; dessen `dist/src` geht
als `--dist` bzw. `--alt` in dieselben Skripte dieses Zweigs.

    npm run build -w @brauweg/game-api && npm run build -w @brauweg/game-filler
    node packages/game-filler/werkzeug/einsperren.mjs --teil 1 --start 1000 --klar 200 --build 200 --extreme 200 --faeden 4 [--dist <alt>/dist/src]
    node packages/game-filler/werkzeug/bot-duell.mjs --alt <alt>/dist/src --start 1000 --klar 200 --build 200 --extreme 200

Saaten 1000–1199 (neu, an keiner davon wurde eingestellt). Linux, 8 Kerne.
Nur Teil 1 von einsperren.mjs (Bot gegen sich selbst) — Teil 2/3 messen den
„Vorsichtigen" des Skripts, nicht den Bot.

## 1. Eingesperrt (Bot gegen sich selbst)

_läuft_

## 2. Neu gegen alt

_läuft_
