/**
 * Baut eine BRETTVARIANTE zum Messen — ohne das Spiel zu aendern.
 *
 *     node packages/game-tafelrunde/werkzeug/laufwege-variante.mjs breit6 --spalten 6
 *     node packages/game-tafelrunde/werkzeug/laufwege.mjs \
 *          --dist packages/game-tafelrunde/tmp-varianten/breit6 --marke "6 Spalten"
 *
 * WARUM ES DAS GIBT: Brettbreite, Reihenzahl, Reichweiten und der Abstand der
 * beiden Haelften stehen als Konstanten im Modul — anders als Zeitraffer und
 * Startleben lassen sie sich nicht von aussen drehen (`Kampfregler` in
 * kampf.ts, `TafelrundeRegeln` in regeln.ts). Um zu beantworten, was ein
 * breiteres Brett am Kampf aendern WUERDE, muss man sie trotzdem drehen
 * koennen. Die beiden Auswege waeren gewesen:
 *
 *   a) die Geometrie durch Partie, Bot und Sicht durchreichen — ein Eingriff
 *      in das Spiel, ueber das erst noch entschieden wird, und
 *   b) den Kampf im Messstand nachbauen — dann misst man seine eigene Kopie
 *      und nicht das Spiel (siehe den Kopf von test/messen.ts).
 *
 * Dieser Weg ist der dritte: Das uebersetzte `dist/` wird KOPIERT, in der
 * Kopie wird genau eine Zahl ersetzt, und gemessen wird die Kopie. Am Spiel
 * aendert sich nichts, im Repository bleibt nichts liegen: Der Ordner
 * `tmp-varianten` faellt unter den `tmp`-Eintrag der .gitignore. (Das
 * Sternchen dieses Musters steht hier absichtlich nicht ausgeschrieben — die
 * Zeichenfolge aus Stern und Schraegstrich wuerde diesen Kommentar
 * schliessen.)
 *
 * WAS ES NICHT KANN: eine Variante bauen, die es im Quelltext nicht gaebe.
 * Die Ersetzungen unten sind absichtlich stur und pruefen jede einzelne — wo
 * eine nicht greift, bricht der Lauf ab, statt still das Original zu messen.
 *
 * ACHTUNG BEI UNGERADER REIHENZAHL: Die Punktspiegelung in arena.ts ist nur
 * abstandstreu, wenn die Reihen je Seite GERADE sind (der Versatz des
 * odd-r-Rasters hebt sich sonst nicht weg — siehe Kopf von arena.ts). Eine
 * Variante mit 3 Reihen laesst sich rechnen, ihre Zahlen sind aber
 * INDIKATIV: Auf ihr sind die Nachbarschaften der beiden Haelften nicht mehr
 * dieselben. Das Werkzeug sagt es beim Bauen dazu.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HIER = dirname(fileURLToPath(import.meta.url));
const PAKET = resolve(HIER, '..');
const QUELLE = resolve(PAKET, 'dist');

function schalter(name, vorgabe) {
  const stelle = process.argv.indexOf(`--${name}`);
  if (stelle < 0 || stelle + 1 >= process.argv.length) return vorgabe;
  return process.argv[stelle + 1];
}

const NAME = process.argv[2];
if (!NAME || NAME.startsWith('--')) {
  console.error('Aufruf: laufwege-variante.mjs <name> [--spalten N] [--reihen N] ' +
    '[--luecke N] [--reichweite-minus N]');
  process.exit(1);
}
if (!existsSync(resolve(QUELLE, 'test/messen.js'))) {
  console.error('Erst uebersetzen:  npm run build --workspace @brauweg/game-tafelrunde');
  process.exit(1);
}

const SPALTEN = Number(schalter('spalten', '0'));
const REIHEN = Number(schalter('reihen', '0'));
const LUECKE = Number(schalter('luecke', '0'));
const REICHWEITE_MINUS = Number(schalter('reichweite-minus', '0'));

const ZIEL = resolve(PAKET, 'tmp-varianten', NAME);
rmSync(ZIEL, { recursive: true, force: true });
mkdirSync(dirname(ZIEL), { recursive: true });
cpSync(QUELLE, ZIEL, { recursive: true });

/** Ersetzt genau einmal und bricht ab, wenn die Stelle fehlt. */
function ersetze(datei, alt, neu) {
  const pfad = resolve(ZIEL, datei);
  const text = readFileSync(pfad, 'utf8');
  if (!text.includes(alt)) {
    console.error(`Stelle nicht gefunden in ${datei}:\n  ${alt}`);
    process.exit(1);
  }
  writeFileSync(pfad, text.replace(alt, neu));
}

const getan = [];

if (SPALTEN > 0) {
  ersetze('src/brett.js', 'export const BRETT_SPALTEN = 5;', `export const BRETT_SPALTEN = ${SPALTEN};`);
  getan.push(`${SPALTEN} Spalten`);
}

if (REIHEN > 0) {
  ersetze('src/brett.js', 'export const BRETT_REIHEN = 2;', `export const BRETT_REIHEN = ${REIHEN};`);
  getan.push(`${REIHEN} Reihen je Seite`);
  if (REIHEN % 2 === 1) {
    console.warn(
      `ACHTUNG: ${REIHEN} Reihen je Seite sind UNGERADE. Die Punktspiegelung in ` +
        'arena.ts ist dann nicht abstandstreu — die Zahlen dieser Variante sind ' +
        'indikativ und keine Entscheidungsgrundlage.',
    );
  }
}

if (LUECKE > 0) {
  // Eine Luecke von leeren Reihen zwischen den beiden Haelften: der
  // Startabstand als Stellschraube. Sie muss GERADE sein, sonst kippt die
  // Spiegelung (dieselbe Rechnung wie bei der Reihenzahl).
  ersetze(
    'src/arena.js',
    'export const ARENA_REIHEN = BRETT_REIHEN * 2;',
    `export const ARENA_REIHEN = BRETT_REIHEN * 2 + ${LUECKE};`,
  );
  ersetze(
    'src/arena.js',
    'return (reihe + BRETT_REIHEN) * ARENA_SPALTEN + spalte;',
    `return (reihe + BRETT_REIHEN + ${LUECKE}) * ARENA_SPALTEN + spalte;`,
  );
  getan.push(`Startabstand +${LUECKE}`);
  if (LUECKE % 2 === 1) {
    console.warn(
      `ACHTUNG: Eine Luecke von ${LUECKE} ist UNGERADE — die Spiegelung ist dann ` +
        'nicht abstandstreu. Die Zahlen sind indikativ.',
    );
  }
}

if (REICHWEITE_MINUS > 0) {
  // Jede Reichweite im Katalog um N gesenkt, Untergrenze 1: Eine Reichweite
  // von 0 gaebe es im Spiel nicht — die Einheit koennte nie treffen und der
  // Kampf liefe in jede Hoechstdauer.
  const pfad = resolve(ZIEL, 'src/katalog.js');
  const text = readFileSync(pfad, 'utf8');
  let treffer = 0;
  const neu = text.replace(/reichweite: (\d+),/g, (_, zahl) => {
    treffer++;
    return `reichweite: ${Math.max(1, Number(zahl) - REICHWEITE_MINUS)},`;
  });
  if (treffer === 0) {
    console.error('Keine Reichweite im Katalog gefunden');
    process.exit(1);
  }
  writeFileSync(pfad, neu);
  getan.push(`Reichweiten -${REICHWEITE_MINUS} (Untergrenze 1, ${treffer} Einheiten)`);
}

if (getan.length === 0) {
  console.error('Keine Aenderung angegeben — das waere eine Kopie des Originals.');
  process.exit(1);
}

console.log(`${NAME}: ${getan.join(', ')}`);
console.log(ZIEL);
