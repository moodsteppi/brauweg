import type { Farbe, Versuch } from './sicht';

/**
 * Welche Farbe eine Taste traegt: die beste, die ihr Buchstabe in einem
 * Versuch bekommen hat — gruen vor gelb vor grau. Steht ein Buchstabe einmal
 * gruen und einmal grau (doppelt geraten, nur einmal im Wort), bleibt die
 * Taste gruen.
 *
 * Keine Regel des Spiels, sondern Buchhaltung ueber die Farben, die der
 * Server geschickt hat (CLAUDE.md: Der Client rechnet nichts nach).
 */
export function tastenFarben(versuche: readonly Versuch[]): ReadonlyMap<string, Farbe> {
  const rang: Record<Farbe, number> = { x: 0, v: 1, g: 2 };
  const karte = new Map<string, Farbe>();
  for (const versuch of versuche) {
    [...versuch.wort].forEach((buchstabe, i) => {
      const farbe = versuch.farben[i];
      if (!farbe) return;
      const bisher = karte.get(buchstabe);
      if (bisher === undefined || rang[farbe] > rang[bisher]) karte.set(buchstabe, farbe);
    });
  }
  return karte;
}

/** Die Tastatur: deutsches QWERTZ mit Umlauten, ohne ß (es gibt kein Wort damit). */
export const TASTEN_REIHEN: readonly (readonly string[])[] = [
  ['Q', 'W', 'E', 'R', 'T', 'Z', 'U', 'I', 'O', 'P', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ö', 'Ä'],
  ['ENTER', 'Y', 'X', 'C', 'V', 'B', 'N', 'M', 'LOESCHEN'],
];

/** Ein Tastendruck der echten Tastatur als Buchstabe, oder null. */
export function buchstabeVon(taste: string): string | null {
  const gross = taste.toLocaleUpperCase('de-DE');
  return /^[A-ZÄÖÜ]$/.test(gross) ? gross : null;
}
