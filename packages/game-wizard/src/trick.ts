/**
 * Stich: Bedienpflicht und Gewinner.
 *
 * Das ganze Spiel haengt an diesen beiden Funktionen. Sie sind rein - Karten
 * rein, Antwort raus - und werden von Runde, Bot und Sichtfilter gleichermassen
 * benutzt, damit es nur eine Wahrheit gibt.
 */

import { type Card, type Suit, isJester, isSuitCard, isWizard, value } from './cards.js';

export interface Played {
  readonly seat: number;
  readonly card: Card;
}

/**
 * Die zu bedienende Farbe.
 *
 * Null heisst: keine Pflicht. Das ist der Fall bei leerem Stich, bei
 * angespieltem Zauberer (dann spielen alle frei) und solange nur Narren
 * liegen - dort setzt erst die naechste echte Karte die Farbe.
 */
export function leadSuit(played: readonly Played[]): Suit | null {
  for (const entry of played) {
    if (isWizard(entry.card)) return null;
    if (isJester(entry.card)) continue;
    if (isSuitCard(entry.card)) return entry.card.suit;
  }
  return null;
}

/**
 * Spielbare Karten.
 *
 * Zauberer und Narr duerfen IMMER gespielt werden, auch wenn man bedienen
 * koennte. Sie sind die einzige Ausnahme von der Bedienpflicht. Trumpf muss
 * nie bedient werden.
 */
export function legalCards(
  hand: readonly Card[],
  played: readonly Played[],
  _trump: Suit | null,
): Card[] {
  const lead = leadSuit(played);
  if (lead === null) return [...hand];

  const kannBedienen = hand.some((card) => isSuitCard(card) && card.suit === lead);
  if (!kannBedienen) return [...hand];

  return hand.filter(
    (card) => isWizard(card) || isJester(card) || (isSuitCard(card) && card.suit === lead),
  );
}

/**
 * Wer den Stich gewinnt.
 *
 * In dieser Reihenfolge: erster gespielter Zauberer, sonst hoechster Trumpf,
 * sonst hoechste Karte der zu bedienenden Farbe, sonst - wenn nur Narren
 * liegen - der erste Narr.
 *
 * `lastSpecialWins` dreht die erste und die letzte Zeile um: Dann gewinnt der
 * zuletzt gelegte Zauberer, und bei einem Stich aus lauter Narren der letzte
 * Narr. Trumpf und Farbe bleiben davon unberuehrt - dort entscheidet die
 * Hoehe, nicht die Reihenfolge.
 */
export function winnerOf(
  played: readonly Played[],
  trump: Suit | null,
  lastSpecialWins = false,
): number {
  if (played.length === 0) throw new Error('Leerer Stich hat keinen Gewinner');

  const zauberer = lastSpecialWins
    ? [...played].reverse().find((entry) => isWizard(entry.card))
    : played.find((entry) => isWizard(entry.card));
  if (zauberer) return zauberer.seat;

  const lead = leadSuit(played);
  // Nur Narren: einer muss den Stich bekommen, obwohl keiner ihn gewinnen
  // will. Der Standard gibt ihn dem ersten, die Hausregel dem letzten.
  if (lead === null) return (lastSpecialWins ? played[played.length - 1]! : played[0]!).seat;

  const hoechste = (farbe: Suit): Played | undefined =>
    played
      .filter((entry) => isSuitCard(entry.card) && entry.card.suit === farbe)
      .reduce<Played | undefined>(
        (best, entry) => (!best || value(entry.card) > value(best.card) ? entry : best),
        undefined,
      );

  if (trump) {
    const bester = hoechste(trump);
    if (bester) return bester.seat;
  }

  return hoechste(lead)!.seat;
}
