/**
 * Bot.
 *
 * Arbeitet ausschliesslich auf der gefilterten Sicht - er kann deshalb
 * bauartbedingt nicht schummeln. Alles, was er weiss, weiss auch ein Mensch am
 * selben Platz.
 *
 * Zwei Gedanken tragen sein Spiel:
 *
 *   1. Die Ansage ist eine Schaetzung sicherer Stiche. Ein Zauberer ist einer,
 *      ein hoher Trumpf fast einer, eine hohe Fehlkarte gelegentlich einer.
 *   2. Danach zaehlt nur noch die Differenz zwischen Soll und Ist. Wer Stiche
 *      braucht, holt sie so billig wie moeglich; wer genug hat, wirft ab.
 *
 * Bewusst nicht gebaut: ein Gedaechtnis fuer bereits gespielte Zauberer und
 * Truempfe. Das kommt spaeter und aendert nichts an der Schnittstelle.
 */

import { type Card, type Suit, SUITS, isJester, isSuitCard, isWizard, value } from './cards.js';
import type { RoundAction } from './round.js';
import { type Played, leadSuit, winnerOf } from './trick.js';
import type { PlayerView } from './view.js';

// ---------------------------------------------------------------------------
// Kartenstaerke
// ---------------------------------------------------------------------------

/** Grobe Staerke einer Karte im aktuellen Spiel. Nur zum Vergleichen. */
function power(card: Card, trump: Suit | null): number {
  if (isWizard(card)) return 1000;
  if (isJester(card)) return -1;
  if (trump && isSuitCard(card) && card.suit === trump) return 100 + value(card);
  return value(card);
}

/**
 * Wie wahrscheinlich diese Karte einen Stich bringt, zwischen 0 und 1.
 *
 * Die Zahlen sind Erfahrungswerte, keine Rechnung: Ein Zauberer ist sicher,
 * ein hoher Trumpf fast sicher, eine blanke Dreizehn nur, solange niemand
 * abwirft. Mit mehr Mitspielern wird alles ausser dem Zauberer unsicherer,
 * weil mehr Haende dagegenhalten.
 */
function trickChance(card: Card, trump: Suit | null, seats: number): number {
  if (isWizard(card)) return 1;
  if (isJester(card)) return 0;

  const gegner = Math.max(2, seats - 1);
  const daempfung = 3 / gegner;

  const v = value(card);
  if (trump && isSuitCard(card) && card.suit === trump) {
    if (v >= 11) return Math.min(0.95, 0.9 * daempfung + 0.1);
    if (v >= 8) return 0.55 * daempfung;
    if (v >= 5) return 0.3 * daempfung;
    return 0.12 * daempfung;
  }

  if (v === 13) return 0.7 * daempfung;
  if (v === 12) return 0.45 * daempfung;
  if (v === 11) return 0.25 * daempfung;
  return 0.05 * daempfung;
}

// ---------------------------------------------------------------------------
// Ansage
// ---------------------------------------------------------------------------

function bidFor(view: PlayerView): number {
  const erlaubt = view.legalBids;
  if (erlaubt.length === 0) throw new Error('Keine Ansage erlaubt');

  const schaetzung = view.blind
    ? blindSchaetzung(view)
    : view.hand.reduce(
        (acc, card) => acc + trickChance(card, view.trump, view.seats.length),
        0,
      );

  // Was die anderen schon beansprucht haben. Sind die Stiche rechnerisch
  // vergeben, ist Zurueckhaltung richtig - die Ansagen der anderen sind
  // oeffentlich, ausser sie sind ausdruecklich verdeckt.
  const beansprucht = Object.entries(view.bids)
    .filter(([seat]) => Number(seat) !== view.seat)
    .reduce((acc, [, bid]) => acc + bid, 0);
  const knapp = view.bidsRevealed || Object.keys(view.bids).length > 0
    ? Math.max(0, beansprucht - view.handSize) * 0.35
    : 0;

  const ziel = Math.round(Math.max(0, schaetzung - knapp));
  return naechsteErlaubte(ziel, erlaubt);
}

/**
 * Ansage in der blinden Runde.
 *
 * Die eigene Karte ist unbekannt, dafuer liegen alle anderen offen. Ist ein
 * Zauberer darunter, ist der Stich weg - dann sagt man null. Sind alle
 * sichtbaren Karten schwach, lohnt die Eins.
 */
function blindSchaetzung(view: PlayerView): number {
  const fremd = Object.values(view.blindHands ?? {}).flat();
  if (fremd.length === 0) return 0;
  if (fremd.some((card) => isWizard(card))) return 0;

  const staerkste = Math.max(...fremd.map((card) => power(card, view.trump)));
  // Ueber der Grenze haelt mindestens einer eine Karte, gegen die eine
  // Durchschnittskarte nichts ausrichtet.
  return staerkste < 60 ? 1 : 0;
}

function naechsteErlaubte(ziel: number, erlaubt: readonly number[]): number {
  return [...erlaubt].sort(
    (a, b) => Math.abs(a - ziel) - Math.abs(b - ziel) || a - b,
  )[0]!;
}

// ---------------------------------------------------------------------------
// Trumpfwahl
// ---------------------------------------------------------------------------

function trumpFor(view: PlayerView): Suit {
  // Blind gewaehlt: keine Hand, also keine Grundlage. Damit die Wahl nicht
  // immer auf dieselbe Farbe faellt, haengt sie an Runde und Sitz - das bleibt
  // reproduzierbar, was die Engine verlangt.
  if (view.hand.length === 0) {
    return SUITS[(view.roundNumber + (view.seat ?? 0)) % SUITS.length]!;
  }

  let beste: Suit = SUITS[0]!;
  let bestwert = -1;
  for (const suit of SUITS) {
    const wert = view.hand
      .filter((card) => isSuitCard(card) && card.suit === suit)
      // Menge zaehlt, Hoehe zaehlt mehr.
      .reduce((acc, card) => acc + 3 + value(card), 0);
    if (wert > bestwert) {
      bestwert = wert;
      beste = suit;
    }
  }
  return beste;
}

// ---------------------------------------------------------------------------
// Kartenwahl
// ---------------------------------------------------------------------------

/** Wuerde diese Karte den Stich gewinnen, wenn er jetzt endete? */
function gewinnt(view: PlayerView, card: Card): boolean {
  const stich: Played[] = [...view.currentTrick, { seat: view.seat ?? -1, card }];
  return winnerOf(stich, view.trump) === (view.seat ?? -1);
}

function cardFor(view: PlayerView): Card {
  const legal = view.legal;
  if (legal.length === 0) throw new Error('Keine spielbare Karte');

  const soll = view.bids[view.seat ?? -1] ?? 0;
  const habe = view.tricks[view.seat ?? -1] ?? 0;
  const brauchtStiche = soll - habe > 0;

  const stark = (a: Card, b: Card): number => power(a, view.trump) - power(b, view.trump);
  const sortiert = [...legal].sort(stark);

  // Aufspiel: nichts liegt, also entscheidet allein das eigene Soll.
  if (view.currentTrick.length === 0) {
    if (!brauchtStiche) return sortiert[0]!;
    // Ein Zauberer holt den Stich sicher - aber er ist auch spaeter noch
    // sicher. Zuerst versuchen, ihn mit einer hohen Farbkarte zu sparen.
    const ohneZauberer = sortiert.filter((card) => !isWizard(card));
    const hoch = ohneZauberer[ohneZauberer.length - 1];
    if (hoch && power(hoch, view.trump) >= 100) return hoch;
    return sortiert[sortiert.length - 1]!;
  }

  const gewinner = sortiert.filter((card) => gewinnt(view, card));
  const verlierer = sortiert.filter((card) => !gewinnt(view, card));

  if (brauchtStiche) {
    // So billig wie moeglich gewinnen; Zauberer bleiben liegen, solange es
    // ohne geht.
    const ohneZauberer = gewinner.filter((card) => !isWizard(card));
    if (ohneZauberer.length > 0) return ohneZauberer[0]!;
    if (gewinner.length > 0) return gewinner[0]!;
    // Nichts zu holen: die schwaechste Karte wegwerfen und die starken behalten.
    return sortiert[0]!;
  }

  // Genug Stiche: moeglichst hoch abwerfen, ohne den Stich zu nehmen. So sind
  // die gefaehrlichen Karten weg, bevor sie zum Problem werden.
  if (verlierer.length > 0) return verlierer[verlierer.length - 1]!;
  // Alles gewinnt - dann wenigstens so schwach wie moeglich.
  return sortiert[0]!;
}

// ---------------------------------------------------------------------------
// Einstieg
// ---------------------------------------------------------------------------

export function botAction(view: PlayerView): RoundAction | null {
  const seat = view.seat;
  if (seat === null) throw new Error('Bot darf nicht auf Zuschauersicht laufen');

  if (view.phase === 'trump') {
    if (view.awaitingTrump !== seat) return null;
    return { type: 'chooseTrump', seat, suit: trumpFor(view) };
  }

  if (view.phase === 'bidding') {
    if (!view.isMyTurn) return null;
    return { type: 'bid', seat, tricks: bidFor(view) };
  }

  if (view.phase === 'playing') {
    if (!view.isMyTurn) return null;
    if (view.blind) return { type: 'playBlind', seat };
    return { type: 'playCard', seat, cardId: cardFor(view).id };
  }

  return null;
}

/** Nur fuer Tests: die Farbe, die gerade bedient werden muss. */
export const _leadSuit = leadSuit;
