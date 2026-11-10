import type { Woerterbuch } from '../woerterbuch';

/**
 * Deutsche Texte, Bereich „karten": Farb- und Wertnamen der Spielkarten.
 *
 * Bis zur Sprachgrundlage standen sie als feste Tabellen (`SUIT_NAMES`,
 * `RANK_NAMES`, `RANKS`) neben den Helfern in i18n.ts — und wären so die
 * einzigen Texte geblieben, die keine zweite Sprache bekommen kann. Der
 * Wortlaut ist unverändert. Die Farbzeichen (♣ ♠ ♥ ♦) stehen weiter im Kern:
 * Sie sind in jeder Sprache dieselben.
 */
export default {
  // Ausgeschriebene Farben, z.B. im alt-Text „Kreuz Dame" und als Trumpf.
  'karte.farbe.C': 'Kreuz',
  'karte.farbe.S': 'Pik',
  'karte.farbe.H': 'Herz',
  'karte.farbe.D': 'Karo',

  // Ausgeschriebene Werte.
  'karte.wert.A': 'Ass',
  'karte.wert.T': 'Zehn',
  'karte.wert.K': 'König',
  'karte.wert.Q': 'Dame',
  'karte.wert.J': 'Bube',
  'karte.wert.9': 'Neun',

  /*
   * Wie Farbe und Wert zum ganzen Namen zusammengehen. Die Wortfolge gehört
   * der Sprache: „Kreuz Dame", aber „Queen of Clubs" — als feste Folge in
   * `cardName` hieße es im Englischen „Clubs Queen".
   */
  'karte.name': '{farbe} {wert}',

  // Kurzzeichen im schmalen Kartenstreifen: deutsch D und B, nicht Q und J.
  'karte.kurz.A': 'A',
  'karte.kurz.T': '10',
  'karte.kurz.K': 'K',
  'karte.kurz.Q': 'D',
  'karte.kurz.J': 'B',
  'karte.kurz.9': '9',
} satisfies Woerterbuch;
