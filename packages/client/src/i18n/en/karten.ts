import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „karten" — Gegenstück zu `de/karten.ts`.
 *
 * Die Kartennamen sind englisch (Jack, Queen, King, Ace; Clubs, Spades,
 * Hearts, Diamonds), auch beim Doppelkopf: Wer Englisch eingestellt hat,
 * kennt die Karten unter diesen Namen. Deutsch bleiben nur die Fachwörter
 * des Spiels (Re, Kontra, Hochzeit, Schweinchen, Solo-Namen) — siehe
 * `en/tisch.ts` und `en/regeln-doppelkopf.ts`.
 */
export default {
  'karte.farbe.C': 'Clubs',
  'karte.farbe.S': 'Spades',
  'karte.farbe.H': 'Hearts',
  'karte.farbe.D': 'Diamonds',

  'karte.wert.A': 'Ace',
  'karte.wert.T': 'Ten',
  'karte.wert.K': 'King',
  'karte.wert.Q': 'Queen',
  'karte.wert.J': 'Jack',
  'karte.wert.9': 'Nine',

  // „Queen of Clubs", nicht „Clubs Queen".
  'karte.name': '{wert} of {farbe}',

  // Im schmalen Kartenstreifen die englischen Buchstaben: Q und J statt D und B.
  'karte.kurz.A': 'A',
  'karte.kurz.T': '10',
  'karte.kurz.K': 'K',
  'karte.kurz.Q': 'Q',
  'karte.kurz.J': 'J',
  'karte.kurz.9': '9',
} satisfies Woerterbuch;
