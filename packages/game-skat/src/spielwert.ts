/**
 * Spielwert, Spitzen und die Reizleiter.
 *
 * Der Wert eines Farb- oder Grandspiels ist Grundwert × Spielstufe. Die
 * Spielstufe zaehlt sich aus den „Spitzen" (mit/ohne wie viele der obersten
 * Truempfe der Alleinspieler haelt) plus je einer Stufe fuer das Spiel selbst,
 * Hand, Schneider, Schneider angesagt, Schwarz, Schwarz angesagt und Ouvert.
 *
 * Null hat feste Werte und keine Spitzen.
 *
 * Der Reizwert, den ein Spieler beim Reizen ruft, ist ein moeglicher solcher
 * Spielwert. Faellt der tatsaechliche Spielwert am Ende unter das Gebot, ist
 * das Spiel „ueberreizt" und gilt als verloren — deshalb muss die Engine die
 * Werte exakt rechnen.
 */

import { type Card, type Suit, SUITS, isJack } from './cards.js';
import { type GameType, isTrump } from './order.js';

/** Grundwert: Karo 9, Herz 10, Pik 11, Kreuz 12, Grand 24. */
export function grundwert(gt: GameType): number {
  if (gt.kind === 'grand' || gt.kind === 'ramsch') return 24;
  if (gt.kind === 'suit') return { D: 9, H: 10, S: 11, C: 12 }[gt.trump];
  return 0; // Null hat feste Werte, kein Grundwert
}

/** Feste Nullwerte. */
export const NULL_WERTE = { null: 23, nullHand: 35, nullOuvert: 46, nullOuvertHand: 59 } as const;

/**
 * Die obersten Truempfe von oben nach unten: Kreuz-Bube, Pik-, Herz-,
 * Karo-Bube, dann (im Farbspiel) die Trumpffarbe A, 10, K, D, 9, 8, 7.
 * An dieser Reihe entlang werden die Spitzen gezaehlt.
 */
export function trumpfLeiter(gt: GameType, deck: readonly Card[]): Card[] {
  const buben = SUITS.map((s) => deck.find((c) => c.suit === s && isJack(c))!);
  if (gt.kind !== 'suit') return buben; // Grand/Ramsch: nur die Buben
  const reihen: Card['rank'][] = ['A', 'T', 'K', 'Q', '9', '8', '7'];
  const farbe = reihen.map((r) => deck.find((c) => c.suit === gt.trump && c.rank === r)!);
  return [...buben, ...farbe];
}

/**
 * Spitzen: mit oder ohne, und wie viele. Gezaehlt an den Karten, die der
 * Alleinspieler haelt (im Handspiel ohne den Skat, sonst mit).
 */
export function spitzen(alleinspielerKarten: readonly Card[], gt: GameType, deck: readonly Card[]): number {
  if (gt.kind === 'null') return 0;
  const halten = new Set(alleinspielerKarten.filter((c) => isTrump(c, gt)).map((c) => c.id));
  const leiter = trumpfLeiter(gt, deck);
  const hatKreuzBube = halten.has(leiter[0]!.id);
  let n = 0;
  for (const karte of leiter) {
    const hat = halten.has(karte.id);
    // „Mit": zaehle die fuehrende Serie, die man HAT. „Ohne": die man NICHT hat.
    if (hat === hatKreuzBube) n++;
    else break;
  }
  return n;
}

export interface Spielstufen {
  readonly spitzenN: number;
  readonly hand: boolean;
  readonly schneider: boolean;
  readonly schneiderAngesagt: boolean;
  readonly schwarz: boolean;
  readonly schwarzAngesagt: boolean;
  readonly ouvert: boolean;
}

/** Spielwert eines Farb-/Grandspiels: Grundwert × Summe der Stufen. */
export function farbGrandWert(gt: GameType, s: Spielstufen): number {
  const stufe =
    s.spitzenN +
    1 + // das Spiel selbst
    (s.hand ? 1 : 0) +
    (s.schneider ? 1 : 0) +
    (s.schneiderAngesagt ? 1 : 0) +
    (s.schwarz ? 1 : 0) +
    (s.schwarzAngesagt ? 1 : 0) +
    (s.ouvert ? 1 : 0);
  return grundwert(gt) * stufe;
}

/**
 * Die Reizleiter: alle Zahlen, die als Gebot vorkommen koennen, aufsteigend.
 *
 * Erzeugt aus den Grundwerten mal Stufe (ab 2, weil jedes Spiel mindestens
 * „mit/ohne 1" plus Spiel ist) und den festen Nullwerten. So steht die Leiter
 * an einer Stelle und nicht als abgetippte Zahlenreihe, die veralten kann.
 */
export function reizLeiter(): number[] {
  const werte = new Set<number>();
  for (const grund of [9, 10, 11, 12, 24]) {
    for (let stufe = 2; stufe <= 18; stufe++) werte.add(grund * stufe);
  }
  for (const w of Object.values(NULL_WERTE)) werte.add(w);
  return [...werte].sort((a, b) => a - b);
}

/** Naechster gueltiger Reizwert ueber `wert`, oder null am oberen Ende. */
export function naechsterReiz(wert: number): number | null {
  return reizLeiter().find((w) => w > wert) ?? null;
}

/** Farb-Grundwert einer Trumpffarbe fuer die Anzeige. */
export function farbeName(suit: Suit): string {
  return { C: 'Kreuz', S: 'Pik', H: 'Herz', D: 'Karo' }[suit];
}
