/**
 * Par in der Anzeige: Birdie, Bogey, Eagle je Loch und „zu Par" im Endstand.
 *
 * Seit dem 22.09.2026. Vorher stand `par` an jeder Bahn und oben im HUD, floss
 * aber nirgends ein — wer ein Loch mit 2 auf Par 4 spielte, sah dieselbe
 * nackte „2" wie jemand mit 2 auf Par 2. Robins Entscheidung dazu: Par wird
 * ANGEZEIGT, gewertet wird weiter die Schlagsumme (`platzierungen` in
 * `physik.ts`). Trophäen hängen am Platz des Moduls und bleiben, wie sie sind.
 *
 * **Warum das die Rangfolge nicht verschieben KANN.** Alle Sitze spielen
 * dieselben Löcher, die Parsumme ist also für alle gleich. „Zu Par" ist damit
 * die Schlagsumme minus einer Konstanten — gleiche Summe, gleiches zu Par,
 * wie verschieden die Birdies und Bogeys auch verteilt sind. Deshalb rechnet
 * hier nichts eine eigene Rangfolge; die Endtafel sortiert weiter nach
 * `platzierungen`, und diese Datei liefert nur Namen und Schreibweisen.
 *
 * **Woher das Par je gespieltem Loch kommt.** Aus `reihenfolge` im
 * Partiezustand und den Bahnen, in die sie zeigt. Seit #206 (Bahnen als
 * Daten) sind das die Bahnen DER PARTIE (`Golfnetz.karten`), nicht der
 * Katalog — gegen den Katalog gelesen zeigte die Endtafel das Par der ersten
 * Katalogbahnen (behoben 22.09.2026, siehe abschluss.ts). Über die Leitung
 * geht dafür nichts, an Sicht, Protokoll und Physik ändert sich nichts.
 *
 * Rein und ohne React, damit die Prüfung ohne Leinwand auskommt.
 */

import { t } from '../../i18n';

/**
 * Par je GESPIELTEM Loch, in Spielreihenfolge.
 *
 * Eine Lücke (Kartenindex ohne Karte — nur, wenn Client und Partie
 * verschiedene Kataloge hätten) wird zu Par 0 statt zu einem Absturz; die
 * Anzeige zeigt dann „+N", was falsch aussieht und damit auffällt, statt still
 * einen Birdie zu erfinden.
 */
export function parJeLoch(
  reihenfolge: readonly number[],
  karten: readonly { par: number }[],
): number[] {
  return reihenfolge.map((index) => karten[index]?.par ?? 0);
}

/*
 * Das echte Minuszeichen (U+2212), nicht der Bindestrich: In der Tafel steht
 * „−2" neben „+3", und ein Bindestrich ist dort sichtbar kürzer als das Plus.
 */
const MINUS = String.fromCharCode(0x2212);

/**
 * Golf-Schreibweise einer Differenz zu Par: „−2", „E", „+3".
 *
 * „E" (even) ist die Schreibweise auf jeder Golf-Anzeigetafel; eine „0" läse
 * sich in der Endtafel wie „null Schläge".
 */
export function zuPar(summe: number): string {
  if (summe === 0) return t('golf.par.gleich');
  return summe < 0 ? `${MINUS}${-summe}` : `+${summe}`;
}

/**
 * Schlüssel im Wörterbuch je Differenz; was fehlt, schreibt sich als Zahl.
 *
 * **Condor bei −4.** Der Auftrag ließ ihn nur mit Begründung zu, und die ist
 * da: Unter den 40 Bahnen stehen drei mit Par 5 und eine mit Par 6 (Stand
 * 22.09.2026), −4 ist hier also erreichbar — ein Hole-in-one auf Par 5 oder
 * eine Zwei auf Par 6. Und das Wort ist kein erfundenes, sondern der
 * gebräuchliche Name für vier unter Par. Unter −4 gibt es keinen
 * gebräuchlichen Namen mehr; dort steht die Zahl, genau wie ab +4.
 */
const STUFEN: Record<number, string> = {
  [-4]: 'golf.par.condor',
  [-3]: 'golf.par.albatros',
  [-2]: 'golf.par.eagle',
  [-1]: 'golf.par.birdie',
  0: 'golf.par.par',
  1: 'golf.par.bogey',
  2: 'golf.par.doppelBogey',
  3: 'golf.par.tripleBogey',
};

/** Name einer Differenz Schläge minus Par: „Birdie", „Bogey", ab +4 „+4". */
export function parName(differenz: number): string {
  const schluessel = STUFEN[differenz];
  return schluessel === undefined ? zuPar(differenz) : t(schluessel);
}

/**
 * Name eines gespielten Lochs, wie ihn Zwischenstand und Ruf zeigen.
 *
 * Zwei Fälle stehen VOR der Differenz:
 *
 *   - **Nicht eingelocht.** Wer das Schlag- oder Zeitlimit reißt oder
 *     aussteigt, bekommt Schlaglimit+1 angeschrieben (`machFertig` in
 *     `physik.ts`). Das ist eine Strafzahl, kein gespieltes Ergebnis — ein
 *     „Triple-Bogey" dafür behauptete, er hätte eingelocht.
 *   - **Hole-in-one.** Ein Schlag ist ein eigenes Ereignis, egal auf welchem
 *     Par: Auf Par 2 wäre es sonst nur ein „Birdie", und genau der Moment,
 *     an den sich alle am Tisch erinnern, sähe aus wie jeder andere.
 */
export function lochName(schlaege: number, par: number, eingelocht: boolean): string {
  if (!eingelocht) return t('golf.par.ohne');
  if (schlaege === 1) return t('golf.par.holeInOne');
  return parName(schlaege - par);
}

/**
 * Summe von Schläge minus Par über alle abgeschlossenen Löcher eines Sitzes.
 *
 * Strafzahlen zählen roh mit, wie in der Schlagsumme: Zeigte „zu Par" etwas
 * anderes als die Summe minus Parsumme, stünden zwei Zahlen in einer Zeile,
 * die sich widersprechen.
 */
export function zuParSumme(
  ergebnis: readonly (readonly number[] | undefined)[],
  parJeLoch: readonly number[],
  sitz: number,
): number {
  let summe = 0;
  for (let i = 0; i < ergebnis.length; i += 1) {
    const reihe = ergebnis[i];
    const par = parJeLoch[i];
    if (reihe === undefined || par === undefined) continue;
    summe += (reihe[sitz] ?? 0) - par;
  }
  return summe;
}
