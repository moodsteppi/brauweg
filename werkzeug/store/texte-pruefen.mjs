#!/usr/bin/env node
/**
 * Prueft die Store-Texte in docs/store/TEXTE.md gegen die Grenzen der Stores.
 *
 *   node werkzeug/store/texte-pruefen.mjs     # aus dem Wurzelverzeichnis, braucht kein npm ci
 *
 * Jeder Textblock traegt davor eine Marke:
 *   <!-- feld: apple.de.name max=30 -->              Zeichen (Unicode-Codepunkte)
 *   <!-- feld: apple.de.schluesselwoerter max=100 bytes -->   Apple zaehlt hier UTF-8-Bytes
 *   <!-- feld: play.de.beschreibung max=4000 gleich=apple.de.beschreibung -->
 *
 * Warum ein Skript: Wer „passt schon" nach Augenmass sagt, erfaehrt es erst in
 * App Store Connect — und bei den Schluesselwoertern nicht einmal dort, weil
 * Apple still abschneidet. Ein Umlaut kostet zwei Bytes; „Spieleabend,Kneipe"
 * und „Spieleabende,Kneipen" liegen zwei Bytes auseinander, nicht zwei Zeichen.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATEI = fileURLToPath(new URL('../../docs/store/TEXTE.md', import.meta.url));

/** Marken Dritter, die in keinem Store-Text stehen duerfen (Auftrag 23.09.2026). */
const FREMDE_MARKEN = /\b(wizard|kosmos|amigo|among us|uno|monopoly|tabu|activity|jenga|werwolf von)\b/i;

const text = (await readFile(DATEI, 'utf8')).replace(/\r\n/g, '\n');
const muster = /<!-- feld: (\S+) max=(\d+)( bytes)?(?: gleich=(\S+))? -->\n```text\n([\s\S]*?)\n```/g;

const felder = new Map();
const fehler = [];
for (const [, name, max, bytes, gleich, inhalt] of text.matchAll(muster)) {
  felder.set(name, inhalt);
  const laenge = bytes ? Buffer.byteLength(inhalt, 'utf8') : [...inhalt].length;
  const einheit = bytes ? 'Bytes' : 'Zeichen';
  const ok = laenge <= Number(max);
  console.log(`${ok ? 'ok  ' : 'ZU LANG'} ${name.padEnd(28)} ${String(laenge).padStart(5)} / ${max} ${einheit}`);
  if (!ok) fehler.push(`${name}: ${laenge} ${einheit}, erlaubt ${max}`);
  if (FREMDE_MARKEN.test(inhalt)) fehler.push(`${name}: Marke eines Dritten („${inhalt.match(FREMDE_MARKEN)[0]}")`);
  if (gleich) {
    const vorbild = felder.get(gleich);
    if (vorbild === undefined) fehler.push(`${name}: gleich=${gleich}, aber das Feld steht nicht davor`);
    else if (vorbild !== inhalt) fehler.push(`${name}: weicht von ${gleich} ab — beide gemeinsam aendern`);
  }
}

// Schluesselwoerter: kommagetrennt ohne Leerzeichen danach (die zaehlen mit),
// jedes laenger als zwei Zeichen, keins aus dem App-Namen (Apple wertet den
// Namen ohnehin, eine Wiederholung verschenkt Platz).
for (const [name, inhalt] of felder) {
  if (!name.endsWith('.schluesselwoerter')) continue;
  const appName = felder.get(name.replace('schluesselwoerter', 'name')) ?? '';
  const imNamen = new Set(appName.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean));
  const woerter = inhalt.split(',');
  for (const w of woerter) {
    if (w !== w.trim()) fehler.push(`${name}: „${w}" hat Leerzeichen am Rand`);
    if (w.trim().length <= 2) fehler.push(`${name}: „${w}" ist zu kurz`);
    for (const teil of w.toLowerCase().split(/\s+/)) {
      if (imNamen.has(teil)) fehler.push(`${name}: „${teil}" steht schon im Namen`);
    }
  }
  if (new Set(woerter.map((w) => w.toLowerCase())).size !== woerter.length) fehler.push(`${name}: doppeltes Wort`);
}

if (felder.size === 0) fehler.push('keine Felder gefunden — stimmt das Format der Marken noch?');
if (fehler.length) {
  console.log(`\n${fehler.length} Fehler:\n- ${fehler.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`\n${felder.size} Felder, alle innerhalb der Grenzen.`);
}
