/**
 * Die Kampfarena — das Gitter, auf dem zwei Bretthaelften gegeneinander
 * antreten.
 *
 * Zur Vorbereitung hat jeder Spieler seine eigene Haelfte mit vier Reihen zu
 * fuenf Spalten (brett.ts). Fuer den Kampf werden zwei davon zu EINEM Gitter
 * zusammengesetzt: die eine Seite oben, die andere unten, und dazwischen zwei
 * leere Reihen (`ARENA_LUECKE`). Nur so laesst sich ein Abstand zwischen einer
 * Einheit hier und einer Einheit drueben ueberhaupt ausrechnen — mit zwei
 * getrennten Koordinatensystemen gaebe es keinen.
 *
 * Reine Geometrie: kein Zustand, keine Uhr, kein Zufall. Wer den Kampf sucht,
 * findet ihn in kampf.ts.
 *
 * WARUM EINE PUNKTSPIEGELUNG UND KEIN UMSORTIEREN: Seite 1 wird ueber
 * `(spalte, reihe) -> (letzteSpalte - spalte, letzteReihe - reihe)` in die
 * Arena gelegt, also um 180 Grad gedreht wie ein Brett, das dem Gegner
 * gegenuebersteht. Das ist eine abstandstreue Abbildung (eine Probe prueft das
 * ueber alle Feldpaare), und genau darauf steht die Fairness des Kampfes:
 * Tauscht man die beiden Aufstellungen UND den Erstzieher, laeuft derselbe
 * Kampf gespiegelt ab. Wuerde man Seite 1 nur nach unten schieben statt zu
 * drehen, waere die Aufstellung des einen Spielers gegenueber der des anderen
 * verdreht — und eine Einheit auf demselben Feld haette je nach Seite eine
 * andere Stellung.
 *
 * DEN ERSTZIEHER MITZUTAUSCHEN GEHOERT ZUR ZUSICHERUNG und ist keine
 * Feinheit: Wer im Takt vorn ist, raeumt und besetzt Felder vor dem anderen,
 * und beide Seiten teilen sich EINE Belegungskarte. Bleibt der Erstzieher
 * beim Tauschen derselbe Sitz, bekommt die andere Aufstellung den Vorteil,
 * und dann ist es nicht mehr derselbe Kampf. Genau das ist der Grund, warum
 * ein Spiegelkampf (dasselbe Brett gegen sich selbst) NICHT immer der
 * Erstzieher gewinnt — siehe kampf.test.ts, "bevorzugt im Spiegelkampf keine
 * der beiden Seiten".
 *
 * ABSTANDSTREUE ALLEIN GENUEGT NICHT, und daran ist die Zusicherung bis zum
 * 06.09.2026 gescheitert: Der Kampf entscheidet Gleichstaende beim Ziehen
 * ueber die Reihenfolge der Nachbarfelder, und die ist im odd-r-Raster von
 * der Paritaet der Reihe abhaengig — die Spiegelung wechselt sie. Gemessen
 * liefen 498 von 500 Spiegelpaaren auseinander. Deshalb fragt der Kampf
 * seine Nachbarn heute ueber `arenaNachbarnFuer(platz, seite)` ab; die
 * Begruendung steht dort.
 *
 * DASS DAS AUFGEHT, HAENGT AN EINER GERADEN ZAHL: In einem odd-r-Raster
 * verschiebt sich mit jeder Reihe der Versatz. Eine Spiegelung ueber
 * `ARENA_REIHEN` Reihen ist nur dann eine Drehung, wenn `ARENA_REIHEN` gerade
 * ist — dann hebt sich der Versatz weg (`floor((R-1-x)/2) + floor(x/2)` ist
 * konstant). Bei einer ungeraden Reihenzahl kaeme dieselbe Formel um ein
 * halbes Feld verschoben heraus, und die Probe "erhaelt alle Abstaende"
 * fiele. Weil `ARENA_REIHEN` aus `BRETT_REIHEN * 2 + ARENA_LUECKE` entsteht,
 * heisst das: **die Luecke muss gerade sein**, und die Bretthoehe aendert man
 * in Zweierschritten. Beides faengt eine Probe in arena.test.ts ab.
 *
 * WARUM UEBERHAUPT EINE LUECKE, gemessen am 06.09.2026 ueber 34.600 Kaempfe
 * (docs/TAFELRUNDE-LAUFWEGE.md): Ohne sie standen die beiden vorderen Reihen
 * ueber die Mittellinie hinweg genau EIN Feld auseinander, die hinteren zwei.
 * Damit stand jede Einheit mit Reichweite 2 oder mehr vom ersten Takt an im
 * Ziel — Schuetze und Magier liefen so gut wie nie, 24 von 29.460 gemessenen
 * Einheiten machten ueberhaupt einen Schritt. Das war kein Fehler des
 * Kampfes, sondern seiner Geometrie, und deshalb wurde sie hier geaendert
 * und nicht an den Reichweiten (die sind nachweislich nicht die bindende
 * Groesse).
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

/**
 * Leere Reihen zwischen den beiden Haelften — der Startabstand.
 *
 * Auf ihnen steht nie eine Einheit: Aufgestellt wird nur auf dem eigenen
 * Brett, und `nachArena` bildet nur dorthin ab. Sie sind trotzdem echte
 * Arenafelder, denn der Kampf laeuft ueber sie (`arenaNachbarn`), und die
 * Anzeige zeichnet sie als leere Reihen in der Mitte.
 *
 * ZWEI UND NICHT EINE: Eine ungerade Luecke macht `ARENA_REIHEN` ungerade und
 * damit die Punktspiegelung unfair — siehe den Kopf dieser Datei. Zwei ist
 * die kleinste, die geht.
 */
export const ARENA_LUECKE = 2;

/** Zehn Reihen: vier je Haelfte und die zwei leeren dazwischen. */
export const ARENA_REIHEN = BRETT_REIHEN * 2 + ARENA_LUECKE;

/** Die Arena ist genauso breit wie eine Bretthaelfte. */
export const ARENA_SPALTEN = BRETT_SPALTEN;

/** Felder der Arena: 50. Beide Haelften und die leeren Reihen dazwischen. */
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
 * Dieselbe Rechnung wie auf dem Brett, nur mit zehn Reihen — genau der Fall,
 * fuer den `hexNachbarn` seine Parameter hat. Die Reihenfolge ist damit
 * dieselbe und fest. Beim Ziehen entscheidet sie den Gleichstand zwischen zwei
 * gleich guten Feldern; waere sie zufaellig, waere der ganze Kampf es auch.
 *
 * WER ZIEHT, NIMMT NICHT DIESE LISTE, sondern `arenaNachbarnFuer` — diese
 * hier kennt die Seite nicht und ist deshalb nicht spiegelaequivariant. Sie
 * bleibt, weil die Nachbarschaft als MENGE von keiner Seite abhaengt: Sie ist
 * die Grundlage, auf der `arenaNachbarnFuer` die Ordnung je Seite dreht, und
 * die Form, in der die Proben in arena.test.ts das Raster nachmessen. Wer eine
 * neue Stelle damit baut, an der jemand ZIEHT, baut die Schieflage wieder ein.
 */
export function arenaNachbarn(platz: number): number[] {
  return hexNachbarn(platz, ARENA_REIHEN, ARENA_SPALTEN);
}

/**
 * Derselbe Platz von der anderen Seite aus gesehen — die Punktspiegelung der
 * Arena als eine Zeile.
 *
 * `(reihe, spalte) -> (ARENA_REIHEN - 1 - reihe, ARENA_SPALTEN - 1 - spalte)`
 * ist auf der durchnummerierten Arena genau `ARENA_FELDER - 1 - platz`. Es ist
 * dieselbe Abbildung, die `nachArena` fuer Seite 1 anwendet — deshalb steht
 * sie hier einmal mit Namen und wird nicht an jeder Stelle nachgerechnet.
 */
export function gespiegelterPlatz(arenaPlatz: number): number {
  return ARENA_FELDER - 1 - arenaPlatz;
}

/**
 * Die Nachbarn eines Arenaplatzes IN DER ORDNUNG DIESER SEITE.
 *
 * Warum das noetig ist: Im odd-r-Raster haengt die Reihenfolge der sechs
 * Versaetze davon ab, ob die Reihe gerade oder ungerade ist (`hexNachbarn`
 * schreibt beide Faelle aus). Die Punktspiegelung dreht Reihe `r` auf
 * `ARENA_REIHEN - 1 - r` und wechselt damit die Paritaet — die MENGE der
 * Nachbarn spiegelt sauber mit, ihre REIHENFOLGE nicht. Und die Reihenfolge
 * ist keine Nebensache: `schrittZiel` in kampf.ts bricht mit ihr den
 * Gleichstand zwischen zwei gleich guten Zielfeldern.
 *
 * WAS DAS GEKOSTET HAT, gemessen am 06.09.2026 ueber 500 Spiegelpaare
 * (dasselbe Brettpaar einmal so und einmal getauscht aufgestellt, Erstzieher
 * mitgetauscht): 498 der 500 Kaempfe liefen AUSEINANDER, und die erste
 * Abweichung war jedes Mal ein Ausweichschritt in die andere Richtung. Der
 * Kopf dieser Datei versprach das Gegenteil.
 *
 * Der Ausweg ist keine zweite Versatzliste, sondern die Spiegelung selbst:
 * Seite 1 liegt punktgespiegelt in der Arena (`nachArena`), also fragt sie
 * ihre Nachbarn auch punktgespiegelt ab. Damit gilt fuer jeden Platz
 * `arenaNachbarnFuer(gespiegelterPlatz(p), 1) === arenaNachbarn(p).map(gespiegelterPlatz)`
 * — die Ordnung ist unter der Spiegelung invariant, und der Kampf ist es
 * mit ihr. Eine Probe in arena.test.ts haelt das fest, eine in
 * kampf.test.ts prueft den ganzen Ablauf.
 *
 * Anschaulich: Jede Seite bricht den Gleichstand in der Ordnung ihres EIGENEN
 * Bretts. Dass Seite 0 dabei die ungedrehte Liste bekommt, ist reine
 * Bezugswahl — gespiegelt wird immer nur die andere.
 */
export function arenaNachbarnFuer(platz: number, seite: Seite): number[] {
  if (seite === 0) return arenaNachbarn(platz);
  return arenaNachbarn(gespiegelterPlatz(platz)).map(gespiegelterPlatz);
}

/** Abstand zweier Arenaplaetze in Feldern. */
export function arenaAbstand(a: number, b: number): number {
  return hexAbstand(a, b, ARENA_SPALTEN);
}

/**
 * Wo ein Brettplatz dieser Seite in der Arena liegt.
 *
 * Seite 0 rutscht hinter Haelfte und Luecke nach unten, Seite 1 wird
 * punktgespiegelt. Damit liegt bei BEIDEN die eigene Reihe 0 an der Luecke:
 * Reihe 0 ist die vorderste Reihe, in der man seine Wachen aufstellt, Reihe 3
 * die hinterste fuer Schuetzen und Magier. Das gilt fuer beide Spieler gleich
 * — eine Aufstellung wirkt nicht anders, je nachdem, auf welcher Seite man
 * steht.
 */
export function nachArena(brettPlatz: number, seite: Seite): number {
  const reihe = Math.floor(brettPlatz / BRETT_SPALTEN);
  const spalte = brettPlatz % BRETT_SPALTEN;
  if (seite === 0) return (reihe + BRETT_REIHEN + ARENA_LUECKE) * ARENA_SPALTEN + spalte;
  return (BRETT_REIHEN - 1 - reihe) * ARENA_SPALTEN + (BRETT_SPALTEN - 1 - spalte);
}

/**
 * Der Rueckweg: welcher Brettplatz dieser Seite zu einem Arenaplatz gehoert.
 *
 * Gebraucht wird er von der Anzeige, die einen Kampf abspielt und daneben das
 * eigene Brett zeigt — und von den Proben, die `nachArena` gegenpruefen.
 * Wirft, wenn der Arenaplatz gar nicht auf der Haelfte dieser Seite liegt:
 * Ein stiller Platz ausserhalb des Bretts waere im Aufrufer nicht zu bemerken.
 * Das gilt seit der Luecke auch fuer die beiden mittleren Reihen — sie
 * gehoeren zu keinem Brett, und ein Ergebnis dafuer gaebe es nicht.
 */
export function vonArena(arenaPlatz: number, seite: Seite): number {
  if (!istArenaplatz(arenaPlatz)) throw new Error(`Arenaplatz ${arenaPlatz} gibt es nicht`);
  if (haelfteVon(arenaPlatz) !== seite) {
    throw new Error(`Arenaplatz ${arenaPlatz} gehoert nicht zu Seite ${seite}`);
  }
  const reihe = Math.floor(arenaPlatz / ARENA_SPALTEN);
  const spalte = arenaPlatz % ARENA_SPALTEN;
  if (seite === 0) return (reihe - BRETT_REIHEN - ARENA_LUECKE) * BRETT_SPALTEN + spalte;
  return (BRETT_REIHEN - 1 - reihe) * BRETT_SPALTEN + (BRETT_SPALTEN - 1 - spalte);
}

/**
 * Welcher Seite die Haelfte gehoert, auf der dieser Arenaplatz liegt — und
 * `null` fuer die leeren Reihen dazwischen.
 *
 * DER DRITTE FALL IST NEU und der Grund, aus dem diese Funktion nicht mehr
 * `Seite` zurueckgibt: Seit `ARENA_LUECKE` gehoert nicht mehr jede Arenareihe
 * zu einer Seite. Im Kampf faellt das nicht auf (dort wird nur ueber
 * `nachArena` hineingerechnet), in der Anzeige schon — sie zeichnet die
 * Luecke als leere Mitte.
 */
export function haelfteVon(arenaPlatz: number): Seite | null {
  const reihe = Math.floor(arenaPlatz / ARENA_SPALTEN);
  if (reihe < BRETT_REIHEN) return 1;
  if (reihe >= BRETT_REIHEN + ARENA_LUECKE) return 0;
  return null;
}
