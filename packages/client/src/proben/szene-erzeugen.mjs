/**
 * Erzeugt `arena-szene.json` — den aufgezeichneten Kampf, den BEIDE Proben
 * abspielen (A in 2D, B in 3D).
 *
 * NICHT Teil des Builds. Die JSON-Datei liegt im Repo; dieses Skript steht
 * daneben, damit sie nachrechenbar bleibt. Neu erzeugen:
 *
 *   node packages/client/src/proben/szene-erzeugen.mjs
 *
 * (setzt voraus, dass `packages/game-tafelrunde` gebaut ist — `npm run build`
 * im Wurzelverzeichnis).
 *
 * WARUM EINE AUFGEZEICHNETE DATEI UND KEIN AUFRUF ZUR LAUFZEIT: Die beiden
 * Proben sollen DIESELBE Szene zeigen, sonst vergleicht man am Bildschirm
 * zwei Kaempfe statt zwei Darstellungen. Ausserdem darf der Client die
 * Spielpakete nicht importieren (CLAUDE.md: er beschreibt jede Sicht ein
 * zweites Mal und importiert sonst nichts aus den Spielpaketen) — eine
 * abgelegte Aufzeichnung umgeht das sauber.
 *
 * WIE DIE AUFSTELLUNG ZUSTANDE KAM: gesucht wurde ueber alle Paarungen aus
 * 2- und 3-Gold-Einheiten (4374 Aufstellungen, drei Saaten) nach einem
 * Kampf, der
 *   - alle FUENF Rollen zeigt (Wache, Schuetze, Magier, Meuchler, Beistand),
 *     damit jede der fuenf Figuren wenigstens einmal auf dem Feld steht,
 *   - auf BEIDEN Seiten Tote hat (sonst sieht man die Todesanimation nur an
 *     einer Farbe),
 *   - unter 19 Sekunden bleibt und
 *   - genug Bewegung enthaelt, dass die Laufanimation ueberhaupt vorkommt.
 * Von 10.893 Treffern blieben 105 uebrig; genommen wurde der mit der
 * ausgeglichensten Verlustbilanz (2 zu 4).
 *
 * WARUM DIE EINHEITEN AUF DEN PLAETZEN 0, 1, 5 UND 6 STEHEN: Die Arena legt
 * die Gegenseite PUNKTGESPIEGELT an (arena.ts) — wer links aufstellt, steht
 * dem Gegner diagonal gegenueber. Bei der ueblichen Aufstellung (Wachen
 * mittig vorne) stehen sich beide Seiten sofort im Nacken und es gibt so gut
 * wie keine Bewegung: gemessen 7 Schritte gegen 11 hier. Fuer eine Probe, in
 * der die LAUFANIMATION beurteilt werden soll, waere das die falsche Szene.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { simuliereKampf } from '../../../game-tafelrunde/dist/src/kampf.js';
import { einheit } from '../../../game-tafelrunde/dist/src/katalog.js';

const HIER = dirname(fileURLToPath(import.meta.url));

/** Die Saat entscheidet im Modul nur ueber den Erstzieher — siehe kampf.ts. */
const SAAT = 'tafelrunde-probe';

/** Brettplaetze: 0 und 1 sind die vordere Reihe links, 5 und 6 die hintere. */
const AUFSTELLUNG = [
  [
    [0, 'grimmbart'],
    [1, 'schattenklinge'],
    [5, 'drachenkind'],
    [6, 'sturmrufer'],
  ],
  [
    [0, 'grimmbart'],
    [1, 'schattenklinge'],
    [5, 'nachtpfeil'],
    [6, 'runenpriester'],
  ],
];

function brett(paare) {
  const felder = Array.from({ length: 10 }, () => null);
  for (const [platz, id] of paare) felder[platz] = { id, stufe: 1 };
  return felder;
}

const bericht = simuliereKampf([brett(AUFSTELLUNG[0]), brett(AUFSTELLUNG[1])], SAAT);

/**
 * Die Aufzeichnung traegt zu jeder Einheit Name und Rolle mit.
 *
 * Der Bericht des Moduls nennt nur die `einheitId`. Der Client duerfte den
 * Katalog nachschlagen — dann stuenden die 22 Einheiten aber ein zweites Mal
 * in `packages/client`, und beim naechsten Balancing waere die Probe still
 * veraltet. Beides steht deshalb hier mit in der Datei.
 */
const figuren = bericht.start.map((k) => {
  const e = einheit(k.einheitId);
  return { id: k.id, name: e.name, rolle: e.rolle, reichweite: e.reichweite };
});

const zaehlung = { bewegung: 0, treffer: 0, tod: 0, ende: 0 };
for (const e of bericht.ereignisse) zaehlung[e.art]++;

const szene = {
  _hinweis:
    'Erzeugt von szene-erzeugen.mjs — nicht von Hand aendern. Gemeinsame Vorlage der Arena-Proben A (2D) und B (3D).',
  saat: SAAT,
  aufstellung: AUFSTELLUNG,
  figuren,
  bericht,
};

const ziel = join(HIER, 'arena-szene.json');
await writeFile(ziel, `${JSON.stringify(szene, null, 2)}\n`, 'utf8');

console.log('geschrieben:', ziel);
console.log(
  `Dauer ${bericht.dauerMs} ms, Sieger Seite ${bericht.sieger}, Grund ${bericht.grund}`,
);
console.log(
  `Ereignisse: ${bericht.ereignisse.length} (${zaehlung.bewegung} Bewegung, ${zaehlung.treffer} Treffer, ${zaehlung.tod} Tod, ${zaehlung.ende} Ende)`,
);
for (const f of figuren) {
  const seite = bericht.start.find((k) => k.id === f.id).seite;
  console.log(`  Seite ${seite}  ${f.rolle.padEnd(9)} ${f.name}`);
}
