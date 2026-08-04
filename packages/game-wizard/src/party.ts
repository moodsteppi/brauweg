/**
 * Partie-Maschine.
 *
 * Verbindet Runden zu einer Partie: wachsende Handgroesse, Geberwechsel,
 * laufender Punktestand, Endstand. Wie die Rundenmaschine rein funktional.
 *
 * Anders als beim Doppelkopf gibt es hier keine Neugabe, keine Bockrunden und
 * keinen Pflichtzyklus - eine Partie ist schlicht Runde 1 bis Runde n.
 */

import type { Card, Suit } from './cards.js';
import { fullRounds } from './cards.js';
import { type Seed, dealSeed } from './deal.js';
import {
  type RoundAction,
  type RoundState,
  apply as applyRound,
  createRound,
} from './round.js';
import type { RuleSet } from './ruleset.js';

export interface RoundSummary {
  readonly roundIndex: number;
  /** 1-basiert, zugleich die Handgroesse dieser Runde. */
  readonly roundNumber: number;
  readonly dealer: number;
  readonly upcard: Card | null;
  readonly trump: Suit | null;
  readonly bids: Readonly<Record<number, number>>;
  readonly tricks: Readonly<Record<number, number>>;
  /** Punkte dieser Runde. */
  readonly scores: Readonly<Record<number, number>>;
  /** Gesamtstand nach dieser Runde - damit die Punktetafel ohne Rechnen auskommt. */
  readonly totals: Readonly<Record<number, number>>;
}

export interface PartyState {
  readonly rs: RuleSet;
  /** Alle Sitze in Tischreihenfolge. */
  readonly seats: readonly number[];
  readonly seed: number;
  /**
   * Geheime 128-Bit-Basis fuer jedes Geben. Fehlt sie (Tests), faellt die
   * Partie auf den Zahlen-Seed zurueck - der ist reproduzierbar, aber klein
   * genug, dass ein Mitspieler ihn aus den eigenen Karten durchprobieren
   * koennte.
   */
  readonly seedHex: string | null;

  readonly roundIndex: number;
  readonly dealerIndex: number;

  readonly current: RoundState | null;
  readonly scores: Readonly<Record<number, number>>;
  readonly history: readonly RoundSummary[];
  readonly leftSeats: readonly number[];
  readonly finished: boolean;
}

export function createParty(
  rs: RuleSet,
  seats: readonly number[],
  seed: number,
  seedHex: string | null = null,
): PartyState {
  if (seats.length !== rs.tableSize) {
    throw new Error(`Tischgroesse ${rs.tableSize} erwartet ${rs.tableSize} Sitze`);
  }
  const max = fullRounds(seats.length);
  if (rs.rounds < 1 || rs.rounds > max) {
    throw new Error(`Rundenzahl muss zwischen 1 und ${max} liegen`);
  }

  return {
    rs,
    seats,
    seed,
    seedHex,
    roundIndex: 0,
    dealerIndex: 0,
    current: null,
    scores: Object.fromEntries(seats.map((seat) => [seat, 0])),
    history: [],
    leftSeats: [],
    finished: false,
  };
}

/** Geber der kommenden Runde. */
export function dealerOf(party: PartyState): number {
  return party.seats[party.dealerIndex % party.seats.length]!;
}

export function startRound(party: PartyState): PartyState {
  if (party.finished) throw new Error('Partie ist beendet');
  if (party.current) throw new Error('Es laeuft bereits eine Runde');

  // Jedes Geben bekommt einen eigenen Seed aus der geheimen Basis: Wer ein
  // Geben erraet, lernt daraus nichts ueber die anderen.
  const seed: Seed = party.seedHex
    ? dealSeed(party.seedHex, party.roundIndex)
    : party.seed * 1000 + party.roundIndex;

  return {
    ...party,
    current: createRound(party.rs, party.seats, dealerOf(party), party.roundIndex + 1, seed),
  };
}

export function act(party: PartyState, action: RoundAction): PartyState {
  if (!party.current) throw new Error('Es laeuft keine Runde');
  const next = applyRound(party.current, action);
  const updated = { ...party, current: next };
  return next.phase === 'finished' ? finalizeRound(updated) : updated;
}

function finalizeRound(party: PartyState): PartyState {
  const round = party.current!;
  const result = round.result!;

  const scores = { ...party.scores };
  for (const seat of party.seats) {
    scores[seat] = (scores[seat] ?? 0) + (result.scores[seat] ?? 0);
  }

  const summary: RoundSummary = {
    roundIndex: party.roundIndex,
    roundNumber: round.roundNumber,
    dealer: round.dealer,
    upcard: round.upcard,
    trump: round.trump,
    bids: result.bids,
    tricks: result.tricks,
    scores: result.scores,
    totals: { ...scores },
  };

  const roundIndex = party.roundIndex + 1;

  return {
    ...party,
    current: null,
    scores,
    history: [...party.history, summary],
    roundIndex,
    dealerIndex: party.dealerIndex + 1,
    finished: roundIndex >= party.rs.rounds,
  };
}

/** Meldet einen Aussteiger. Die Partie laeuft mit Bot weiter. */
export function markLeft(party: PartyState, seat: number): PartyState {
  if (party.leftSeats.includes(seat)) return party;
  return { ...party, leftSeats: [...party.leftSeats, seat] };
}

export interface Standing {
  readonly seat: number;
  readonly points: number;
  /** 1 = bester Platz. Gleichstand vergibt denselben Rang mehrfach. */
  readonly place: number;
  readonly left: boolean;
}

export function standings(party: PartyState): Standing[] {
  const sortiert = [...party.seats].sort(
    (a, b) => (party.scores[b] ?? 0) - (party.scores[a] ?? 0),
  );

  return party.seats.map((seat) => {
    const points = party.scores[seat] ?? 0;
    const place = sortiert.findIndex((other) => (party.scores[other] ?? 0) === points) + 1;
    return { seat, points, place, left: party.leftSeats.includes(seat) };
  });
}
