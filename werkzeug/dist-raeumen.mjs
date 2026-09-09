// Raeumt das dist/ des aufrufenden Pakets, BEVOR tsc laeuft.
//
// WARUM: Die Tests laufen nicht aus den .ts, sondern aus dist/test/*.js
// ("node --test dist/test/**/*.test.js"). tsc loescht dabei nichts, was es
// nicht selbst neu schreibt — eine kompilierte Testdatei, deren .ts es nicht
// mehr gibt, bleibt liegen und wird weiter mitgelaufen. Und weil dist/ in
// .gitignore steht, raeumt auch kein Zweigwechsel auf.
// Getroffen hat es Tafelrunde zweimal (04.09.2026, Reste des abgeloesten
// Regelkerns und des Kampfsimulations-Zweigs) und den Server einmal
// (suche.test.js): rote Testlaeufe mit "does not provide an export named ...",
// obwohl an der Quelle nichts falsch war — und gesucht wird der Fehler dann in
// der eigenen Aenderung.
//
// Kein "rm -rf" im package.json: npm-Skripte laufen unter Windows durch
// cmd.exe, das kennt weder rm noch -rf. Die Worker-Rechner sind Windows.

import { rmSync } from 'node:fs'
import { basename, resolve, sep } from 'node:path'

// Nur dist/ unterhalb des Arbeitsverzeichnisses — ein vertippter Aufruf soll
// nicht das halbe Repo mitnehmen (am 5. August hat schon einmal ein Befehl
// 932 Dateien geloescht).
const ziel = resolve(process.cwd(), process.argv[2] ?? 'dist')
if (basename(ziel) !== 'dist' || !ziel.startsWith(resolve(process.cwd()) + sep)) {
  console.error(`dist-raeumen: "${ziel}" ist kein dist/ im Arbeitsverzeichnis — nichts geloescht.`)
  process.exit(1)
}

rmSync(ziel, { recursive: true, force: true })
