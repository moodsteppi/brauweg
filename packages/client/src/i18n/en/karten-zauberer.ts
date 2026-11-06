import type { Woerterbuch } from '../woerterbuch';

/**
 * Englische Texte, Bereich „karten-zauberer" — Gegenstück zu
 * `de/karten-zauberer.ts`.
 *
 * NICHT „Wizard" und „Jester": So heißen die Karten im Markenspiel (Amigo /
 * US Games Systems), und der englische Spielname ist aus demselben Grund
 * ein eigener (siehe `game.wizard` in `de/spiele.ts`). „Mage" und „Fool"
 * sind freie Wörter, und ihre Anfangsbuchstaben stoßen mit keinem Wert- oder
 * Farbkürzel zusammen (M, F gegen A, K, Q, J, ♣♠♥♦).
 */
export default {
  'karte.zauberer': 'Mage',
  'karte.narr': 'Fool',
  'karte.kurz.zauberer': 'M',
  'karte.kurz.narr': 'F',
} satisfies Woerterbuch;
