/**
 * Erzeugt `arena-szene.json` — den EINEN aufgezeichneten Kampf, den beide
 * Arena-Proben (2D und 3D) abspielen.
 *
 * Aufruf aus dem Wurzelverzeichnis, nachdem `npm run build` gelaufen ist:
 *
 *     node packages/client/src/proben/szene-erzeugen.mjs
 *
 * WARUM EINE AUFZEICHNUNG UND KEIN LAUF ZUR ANZEIGEZEIT: Die beiden Proben
 * sollen NEBENEINANDER dieselbe Szene zeigen. Wuerde jede Probe selbst
 * `simuliereKampf()` aufrufen, haenge der Vergleich an zwei Importen des
 * Spielpakets in den Client — und der Client importiert aus keinem Spielpaket
 * (CLAUDE.md). Eine Datei ist die einzige Fassung, die beide teilen koennen.
 *
 * Die Datei wird bewusst mitgeliefert und nicht beim Bauen erzeugt: Ohne sie
 * zeigt die Probe nichts, und ein Bauschritt fuer eine Wegwerf-Probe waere
 * mehr Apparat als Ertrag. Dieses Skript ist die Quittung, wie sie entstand.
 *
 * DIE AUFSTELLUNG erfuellt die Vorgabe der Aufgabe: vier Einheiten je Seite,
 * eine Wache vorn (Brettreihe 0), ein Schuetze hinten (Brettreihe 1), ein
 * Meuchler am Rand (Spalte 0 bzw. 4). Dazu je eine fuenfte Rolle, damit alle
 * fuenf Figurensaetze der Probe auch wirklich zu sehen sind: Beistand auf
 * Seite 0, Magier auf Seite 1.
 *
 * WARUM GENAU DIESE: Von fuenf durchgerechneten Aufstellungen ist es die
 * kuerzeste, die trotzdem alles zeigt, was die Aufgabe verlangt — 19,3 s,
 * 6 Bewegungen, 97 Treffer, 6 Tode, Ende durch Ausloeschung. Die anderen
 * liefen 23 bis 30 s, ohne mehr zu zeigen.
 *
 * DIE SAAT ist hier fast folgenlos: Die Simulation ist deterministisch, der
 * Zufall entscheidet nur, wer innerhalb eines Taktes zuerst zieht. Ueber die
 * ersten 59 Saaten kam bei dieser Aufstellung jedes Mal derselbe Bericht
 * heraus. Sie steht trotzdem im Bericht, weil ein Bericht ohne seine Saat
 * nicht nachspielbar ist.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { simuliereKampf } from '../../../game-tafelrunde/dist/src/kampf.js';

/** Brettplatz = reihe * 5 + spalte. Reihe 0 ist die vordere, an der Mittellinie. */
function brettseite(paare) {
  const felder = Array.from({ length: 10 }, () => null);
  for (const [platz, id] of paare) felder[platz] = { id, stufe: 1 };
  return felder;
}

const SEITE_0 = brettseite([
  [1, 'grimmbart'], // Wache, vorn
  [0, 'klingentaenzerin'], // Meuchler, vorn am linken Rand
  [8, 'bogenmeisterin'], // Schuetze, hintere Reihe
  [9, 'moosheiler'], // Beistand, hintere Reihe
]);

const SEITE_1 = brettseite([
  [3, 'dorfwache'], // Wache, vorn
  [4, 'schattenklinge'], // Meuchler, vorn am rechten Rand
  [6, 'nachtpfeil'], // Schuetze, hintere Reihe
  [5, 'funkenlehrling'], // Magier, hintere Reihe
]);

const bericht = simuliereKampf([SEITE_0, SEITE_1], 'arena-probe');

const zaehle = (art) => bericht.ereignisse.filter((e) => e.art === art).length;
if (bericht.grund !== 'ausgeloescht') throw new Error('Die Szene soll nicht an der Zeit enden');
if (zaehle('tod') < 2) throw new Error('Die Szene braucht mindestens zwei Tode');
if (zaehle('bewegung') < 1) throw new Error('Die Szene braucht Bewegung');

const ziel = fileURLToPath(new URL('./arena-szene.json', import.meta.url));
writeFileSync(ziel, `${JSON.stringify(bericht, null, 2)}\n`, 'utf8');

console.log(
  `arena-szene.json geschrieben: ${bericht.dauerMs} ms, ${bericht.ereignisse.length} Ereignisse ` +
    `(${zaehle('bewegung')} Bewegungen, ${zaehle('treffer')} Treffer, ${zaehle('tod')} Tode), ` +
    `Sieger Seite ${bericht.sieger}.`,
);
