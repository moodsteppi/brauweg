import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „karten-zauberer": die beiden Sonderkarten des
 * Zauberers. Eigene Datei, damit die Zauberer-Aufgabe sie übersetzen kann,
 * ohne `karten.ts` der Doppelkopf-Aufgabe anzufassen.
 */
export default {
  // Zauberer und Narr haben weder Farbe noch Wert (siehe cardLabel).
  'karte.zauberer': 'Zauberer',
  'karte.narr': 'Narr',
  'karte.kurz.zauberer': 'Z',
  'karte.kurz.narr': 'N',
} satisfies Woerterbuch;
