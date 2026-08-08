/**
 * Partie-Maschine.
 *
 * Verbindet Runden zu einer Partie: Geberwechsel, laufender Punktestand,
 * Endstand. Wie die Rundenmaschine rein funktional.
 *
 * Anders als bei Zauberer aendert sich die Handgroesse nicht - jede Runde ist
 * gleich aufgebaut. Dafuer gibt es einen echten Geber-Nachteil: Der Geber
 * kommt als Letzter dran, bevor jemand Cambio rufen kann. Deshalb ist die
 * Rundenzahl ein Vielfaches der Sitzzahl.
 */

import { type Seed, dealSeed } from './deal.js';
import {
  type RoundAction,
  type RoundState,
  apply as applyRound,
  createRound,
} from './round.js';
import type { RoundResult } from './scoring.js';
import type { RuleSet } from './ruleset.js';

export interface RoundSummary {
  readonly roundIndex: number;
  readonly dealer: number;
  readonly caller: number | null;
  readonly callSucceeded: boolean | null;
  /** Handsummen vor der Rufer-Sonderregel. */
  readonly raw: Readonly<Record<number, number>>;
  /** Punkte dieser Runde. */
  readonly scores: Readonly<Record<number, number>>;
  /** Gesamtstand nach dieser Runde - damit die Punktetafel ohne Rechnen auskommt. */
  readonly totals: Readonly<Record<number, number>>;
}

export interface PartyState {
  readonly rs: RuleSet;
  readonly seats: readonly number[];
  readonly seed: number;
  /**
   * Geheime 128-Bit-Basis fuer jedes Geben. Fehlt sie (Tests), faellt die
   * Partie auf den Zahlen-Seed zurueck - reproduzierbar, aber klein genug,
   * dass ein Mitspieler ihn durchprobieren koennte.
   */
  readonly seedHex: string | null;

  readonly roundIndex: number;
  readonly dealerIndex: number;

  readonly current: RoundState | null;
  /**
   * Rundenpause: Die Runde ist abgerechnet, alle Haende liegen offen, und der
   * Tisch zeigt das eine Weile.
   *
   * Sie ist bei Cambio nicht Beiwerk, sondern der Zahltag: Die ganze Runde
   * ueber raet man, was die anderen halten - erst hier erfaehrt man es. Ohne
   * Pause waere die neue Runde da, bevor jemand das Ergebnis gesehen hat.
   *
   * Waehrend der Pause bleibt `current` stehen (mit Phase 'finished'), damit
   * die Sicht die aufgedeckten Haende zeigen kann.
   */
  readonly pause: boolean;
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
  if (rs.rounds < 1) throw new Error('Eine Partie braucht mindestens eine Runde');

  return {
    rs,
    seats,
    seed,
    seedHex,
    roundIndex: 0,
    dealerIndex: 0,
    current: null,
    pause: false,
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
  if (party.pause) throw new Error('Es laeuft noch die Rundenpause');
  if (party.current) throw new Error('Es laeuft bereits eine Runde');

  // Jedes Geben bekommt einen eigenen Seed aus der geheimen Basis: Wer ein
  // Geben erraet, lernt daraus nichts ueber die anderen.
  const seed: Seed = party.seedHex
    ? dealSeed(party.seedHex, party.roundIndex)
    : party.seed * 1000 + party.roundIndex;

  return {
    ...party,
    current: createRound(party.rs, party.seats, dealerOf(party), seed),
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
  const result: RoundResult = round.result!;

  const scores = { ...party.scores };
  for (const seat of party.seats) {
    scores[seat] = (scores[seat] ?? 0) + (result.scores[seat] ?? 0);
  }

  const summary: RoundSummary = {
    roundIndex: party.roundIndex,
    dealer: round.dealer,
    caller: result.caller,
    callSucceeded: result.callSucceeded,
    raw: result.raw,
    scores: result.scores,
    totals: { ...scores },
  };

  // `current` bleibt stehen: Die Runde ist abgerechnet, aber die Sicht soll
  // die aufgedeckten Haende noch zeigen koennen. Weitergezaehlt wird erst,
  // wenn die Pause endet - sonst waere die Partie vorbei, bevor jemand das
  // Ergebnis der letzten Runde gesehen hat.
  return {
    ...party,
    pause: true,
    scores,
    history: [...party.history, summary],
  };
}

/**
 * Beendet die Rundenpause.
 *
 * Erst hier wird weitergezaehlt und gegebenenfalls das Partie-Ende
 * festgestellt. Die Plattform ruft das ueber `advanceInterlude` auf, wenn die
 * Zeit abgelaufen ist.
 */
export function endePause(party: PartyState): PartyState {
  if (!party.pause) return party;

  const roundIndex = party.roundIndex + 1;
  return {
    ...party,
    current: null,
    pause: false,
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

/**
 * Endstand.
 *
 * AUFSTEIGEND sortiert - wenig ist gut. Das ist der einzige Punkt, an dem sich
 * Cambio von allen anderen Spielen der Plattform unterscheidet, und genau hier
 * baut man den Fehler ein, wenn man ihn baut.
 */
export function standings(party: PartyState): Standing[] {
  const sortiert = [...party.seats].sort(
    (a, b) => (party.scores[a] ?? 0) - (party.scores[b] ?? 0),
  );

  return party.seats.map((seat) => {
    const points = party.scores[seat] ?? 0;
    const place = sortiert.findIndex((other) => (party.scores[other] ?? 0) === points) + 1;
    return { seat, points, place, left: party.leftSeats.includes(seat) };
  });
}
