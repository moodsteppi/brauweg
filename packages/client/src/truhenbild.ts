import type { Grad } from './api';

/**
 * Die gemalten Truhen des neuen Hubs, eine Zeile je Grad.
 *
 * Steht an EINER Stelle, weil Shop, „Heute" und der Trophäenweg dieselbe Truhe
 * zeigen: Drei eigene Tabellen liefen beim ersten nachgelieferten Bild
 * auseinander, und dieselbe Goldtruhe sähe im Shop anders aus als auf dem Weg.
 *
 * `truhe-bronze.webp` und `truhe-diamant.webp` kommen mit einem eigenen PR
 * (feature/truhen-bronze-diamant), der vor diesem gemergt wird — deshalb hier
 * fest zugeordnet und ohne Rückfall. Wer diese Datei ohne die beiden Bilder
 * auf einen Zweig bringt, bekommt an Bronze und Diamant ein leeres Bild.
 */
const DATEI: Record<Grad, string> = {
  holz: 'truhe-holz',
  bronze: 'truhe-bronze',
  silber: 'truhe-silber',
  gold: 'truhe-gold',
  diamant: 'truhe-diamant',
};

/** Pfad des Truhenbilds; ein unbekannter Grad fällt auf die Holztruhe. */
export function truhenBild(grad: Grad): string {
  return `/hub/${DATEI[grad] ?? 'truhe-holz'}.webp`;
}
