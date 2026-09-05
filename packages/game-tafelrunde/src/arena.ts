/**
 * Die Kampfarena — das Gitter, auf dem zwei Bretthaelften gegeneinander
 * antreten.
 *
 * Zur Vorbereitung hat jeder Spieler seine eigene Haelfte mit zwei Reihen zu
 * fuenf Spalten (brett.ts). Fuer den Kampf werden zwei davon zu EINEM Gitter
 * mit vier Reihen zusammengesetzt: die eine Seite oben, die andere unten. Nur
 * so laesst sich ein Abstand zwischen einer Einheit hier und einer Einheit
 * drueben ueberhaupt ausrechnen — mit zwei getrennten Koordinatensystemen
 * gaebe es keinen.
 *
 * Reine Geometrie: kein Zustand, keine Uhr, kein Zufall. Wer den Kampf sucht,
 * findet ihn in kampf.ts.
 *
 * WARUM EINE PUNKTSPIEGELUNG UND KEIN UMSORTIEREN: Seite 1 wird ueber
 * `(spalte, reihe) -> (letzteSpalte - spalte, letzteReihe - reihe)` in die
 * Arena gelegt, also um 180 Grad gedreht wie ein Brett, das dem Gegner
 * gegenuebersteht. Das ist eine abstandstreue Abbildung (eine Probe prueft das
 * ueber alle Feldpaare), und genau darauf steht die Fairness des Kampfes:
 * Tauscht man die beiden Aufstellungen, laeuft derselbe Kampf gespiegelt ab.
 * Wuerde man Seite 1 nur nach unten schieben statt zu drehen, waere die
 * Aufstellung des einen Spielers gegenueber der des anderen verdreht — und
 * eine Einheit auf demselben Feld haette je nach Seite eine andere Stellung.
 *
 * DASS DAS AUFGEHT, HAENGT AN EINER GERADEN ZAHL: In einem odd-r-Raster
 * verschiebt sich mit jeder Reihe der Versatz. Eine Spiegelung ueber
 * `BRETT_REIHEN` Reihen ist nur dann eine Drehung, wenn `BRETT_REIHEN` gerade
 * ist — dann hebt sich der Versatz weg (`floor((R-1-x)/2) + floor(x/2)` ist
 * konstant). Bei einer ungeraden Reihenzahl kaeme dieselbe Formel um ein
 * halbes Feld verschoben heraus, und die Probe "erhaelt alle Abstaende"
 * fiele. Wer die Bretthoehe aendert, aendert sie also in Zweierschritten.
 *
 * WAS DIESE MASSE FUER DEN KAMPF BEDEUTEN, ist am 06.09.2026 ueber 34.600
 * Kaempfe ausgemessen worden (docs/TAFELRUNDE-LAUFWEGE.md): Weil die beiden
 * vorderen Reihen ueber die Mittellinie hinweg genau EIN Feld auseinander
 * stehen und die hinteren zwei, steht jede Einheit mit Reichweite 2 oder mehr
 * vom ersten Takt an im Ziel. Schuetze und Magier laufen deshalb so gut wie
 * nie — 24 von 29.460 gemessenen Einheiten machten ueberhaupt einen Schritt.
 * Das ist kein Fehler dieser Datei, aber es ist der Grund, aus dem eine
 * Aenderung an den Brettmassen zuerst hier ansetzen wuerde.
 */

import { BRETT_FELDER, BRETT_REIHEN, BRETT_SPALTEN, hexAbstand, hexNachbarn } from './brett.js';

/**
 * Welche der beiden Seiten der Arena. Ein Kampf hat immer genau zwei.
 *
 * Ausdruecklich NICHT "Sitz" genannt, obwohl der Vorgaenger das tat: Ein Sitz
 * ist an diesem Tisch eine Zahl von 0 bis 7, und ein Kampf zwischen Sitz 3
 * und Sitz 6 haette dann zwei Bedeutungen von 0 und 1 nebeneinander. Wer
 * welchen Sitz auf welche Seite stellt, entscheidet partie.ts.
 */
export type Seite = 0 | 1;

/** Beide Seiten in fester Reihenfolge — zum Durchlaufen ohne Zahlenakrobatik. */
export const SEITEN: readonly Seite[] = [0, 1];

/** Die jeweils andere Seite. */
export function gegenseite(seite: Seite): Seite {
  return seite === 0 ? 1 : 0;
}

/** Vier Reihen: die zwei der einen Haelfte ueber den zwei der anderen. */
export const ARENA_REIHEN = BRETT_REIHEN * 2;

/** Die Arena ist genauso breit wie eine Bretthaelfte. */
export const ARENA_SPALTEN = BRETT_SPALTEN;

/** Felder der Arena: 20. Beide Haelften zusammen, ohne Rest und ohne Luecke. */
export const ARENA_FELDER = ARENA_REIHEN * ARENA_SPALTEN;

/** Liegt die Zahl auf der Arena? */
export function istArenaplatz(platz: unknown): boolean {
  return (
    typeof platz === 'number' && Number.isInteger(platz) && platz >= 0 && platz < ARENA_FELDER
  );
}

/**
 * Die Nachbarn eines Arenaplatzes, die noch in der Arena liegen.
 *
 * Dieselbe Rechnung wie auf dem Brett, nur mit vier Reihen — genau der Fall,
 * fuer den `hexNachbarn` seine Parameter hat. Die Reihenfolge ist damit
 * dieselbe und fest. Beim Ziehen entscheidet sie den Gleichstand zwischen zwei
 * gleich guten Feldern; waere sie zufaellig, waere der ganze Kampf es auch.
 */
export function arenaNachbarn(platz: number): number[] {
  return hexNachbarn(platz, ARENA_REIHEN, ARENA_SPALTEN);
}

/** Abstand zweier Arenaplaetze in Feldern. */
export function arenaAbstand(a: number, b: number): number {
  return hexAbstand(a, b, ARENA_SPALTEN);
}

/**
 * Wo ein Brettplatz dieser Seite in der Arena liegt.
 *
 * Seite 0 rutscht um zwei Reihen nach unten, Seite 1 wird punktgespiegelt.
 * Damit liegt bei BEIDEN die eigene Reihe 0 an der Mittellinie: Reihe 0 ist
 * die vorderste Reihe, in der man seine Wachen aufstellt, Reihe 1 die hintere
 * fuer Schuetzen und Magier. Das gilt fuer beide Spieler gleich — eine
 * Aufstellung wirkt nicht anders, je nachdem, auf welcher Seite man steht.
 */
export function nachArena(brettPlatz: number, seite: Seite): number {
  const reihe = Math.floor(brettPlatz / BRETT_SPALTEN);
  const spalte = brettPlatz % BRETT_SPALTEN;
  if (seite === 0) return (reihe + BRETT_REIHEN) * ARENA_SPALTEN + spalte;
  return (BRETT_REIHEN - 1 - reihe) * ARENA_SPALTEN + (BRETT_SPALTEN - 1 - spalte);
}

/**
 * Der Rueckweg: welcher Brettplatz dieser Seite zu einem Arenaplatz gehoert.
 *
 * Gebraucht wird er von der Anzeige, die einen Kampf abspielt und daneben das
 * eigene Brett zeigt — und von den Proben, die `nachArena` gegenpruefen.
 * Wirft, wenn der Arenaplatz gar nicht auf der Haelfte dieser Seite liegt:
 * Ein stiller Platz ausserhalb des Bretts waere im Aufrufer nicht zu bemerken.
 */
export function vonArena(arenaPlatz: number, seite: Seite): number {
  if (!istArenaplatz(arenaPlatz)) throw new Error(`Arenaplatz ${arenaPlatz} gibt es nicht`);
  if (haelfteVon(arenaPlatz) !== seite) {
    throw new Error(`Arenaplatz ${arenaPlatz} gehoert nicht zu Seite ${seite}`);
  }
  const reihe = Math.floor(arenaPlatz / ARENA_SPALTEN);
  const spalte = arenaPlatz % ARENA_SPALTEN;
  if (seite === 0) return (reihe - BRETT_REIHEN) * BRETT_SPALTEN + spalte;
  return (BRETT_REIHEN - 1 - reihe) * BRETT_SPALTEN + (BRETT_SPALTEN - 1 - spalte);
}

/** Welcher Seite die Haelfte gehoert, auf der dieser Arenaplatz liegt. */
export function haelfteVon(arenaPlatz: number): Seite {
  return Math.floor(arenaPlatz / ARENA_SPALTEN) < BRETT_REIHEN ? 1 : 0;
}
