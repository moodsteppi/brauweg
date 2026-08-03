/**
 * Partie-Maschine.
 *
 * Verbindet Runden zu einer Partie: Geberrotation, Pflichtsolo-Zyklus mit
 * Vorfuehrung, Bock-Fenster zwischen den Runden, Endstand und Trophaeen.
 *
 * Wie die Rundenmaschine ist auch diese hier rein funktional: Aktion rein,
 * neuer Zustand raus.
 */

import { type Seed, dealSeed } from './deal.js';
import { BockState } from './bock.js';
import { PflichtsoloState } from './pflichtsolo.js';
import { type RuleSet, rotationSize } from './ruleset.js';
import type { GameType } from './order.js';
import type { Announcements, RoundResult } from './scoring.js';
import {
  type RoundAction,
  type RoundState,
  apply as applyRound,
  createRound,
} from './round.js';
import { type TrophyResult, awardTrophies } from './trophies.js';

export interface RoundSummary {
  readonly roundIndex: number;
  readonly dealer: number;
  readonly vorhand: number;
  readonly gameType: GameType;
  readonly soloSeat: number | null;
  readonly multiplier: number;
  readonly announcements: Announcements;
  readonly result: RoundResult;
  readonly triggeredBock: boolean;
}

export interface PartyState {
  readonly rs: RuleSet;
  /** Alle Sitze der Geberrotation, in Sitzreihenfolge. */
  readonly seats: readonly number[];
  /** Sitze, die dauerhaft von einem Bot besetzt sind (3er-Tisch). */
  readonly botSeats: readonly number[];
  readonly seed: number;
  /**
   * Geheime 128-Bit-Basis fuer jedes Geben, als Hexkette.
   *
   * Ohne sie faellt die Partie auf den Zahlen-Seed zurueck - das ist nur fuer
   * Tests gedacht. Im Betrieb kommt die Basis aus einer kryptografischen
   * Quelle des Servers: Ein Zahlen-Seed hat 32 Bit, und wer seine eigenen
   * zwoelf Karten kennt, kann die alle durchprobieren und damit jede Hand am
   * Tisch berechnen.
   */
  readonly seedHex: string | null;

  readonly roundIndex: number;
  /** Zaehlt Neugaben derselben Runde, damit der Seed sich aendert. */
  readonly attempt: number;
  readonly dealerIndex: number;

  readonly current: RoundState | null;
  readonly scores: Readonly<Record<number, number>>;
  readonly history: readonly RoundSummary[];
  readonly soloPlayed: readonly number[];
  readonly leftSeats: readonly number[];

  readonly finished: boolean;
  readonly trophies: readonly TrophyResult[] | null;

  /** Intern: Bock-Fenster. Nicht serialisieren, aus history rekonstruierbar. */
  readonly bock: BockState;
}

export function createParty(
  rs: RuleSet,
  seats: readonly number[],
  seed: number,
  botSeats: readonly number[] = [],
  seedHex: string | null = null,
): PartyState {
  const expected = rotationSize(rs.tableSize);
  if (seats.length !== expected) {
    throw new Error(
      `Bei Tischgroesse ${rs.tableSize} werden ${expected} Rotationssitze erwartet`,
    );
  }
  if (rs.rounds % expected !== 0) {
    throw new Error(
      `Rundenzahl muss ein Vielfaches von ${expected} sein (volle Geberrunde)`,
    );
  }

  return {
    rs,
    seats,
    botSeats,
    seed,
    seedHex,
    roundIndex: 0,
    attempt: 0,
    dealerIndex: 0,
    current: null,
    scores: Object.fromEntries(seats.map((s) => [s, 0])),
    history: [],
    soloPlayed: [],
    leftSeats: [],
    finished: false,
    trophies: null,
    bock: new BockState(rs),
  };
}

/** Geber, aktive Sitze und Vorhand der kommenden Runde. */
export function seating(party: PartyState): {
  dealer: number;
  active: number[];
  vorhand: number;
} {
  const n = party.seats.length;
  const dealer = party.seats[party.dealerIndex % n];
  const after: number[] = [];
  for (let i = 1; i <= n; i++) {
    after.push(party.seats[(party.dealerIndex + i) % n]);
  }
  // Am 5er-Tisch setzt der Geber aus, gespielt wird immer zu viert.
  const active = after.slice(0, 4);
  return { dealer, active, vorhand: active[0] };
}

/** Sitze, die ein Pflichtsolo schulden. Bots sind ausgenommen. */
function pflichtsoloSeats(party: PartyState): number[] {
  return party.seats.filter((s) => !party.botSeats.includes(s));
}

/**
 * Wird in dieser Runde jemand vorgefuehrt?
 *
 * Vorgefuehrt wird, sobald die verbleibenden Runden nur noch so viele sind wie
 * offene Pflichtsolos. Am 5er-Tisch kann der eigentlich faellige Spieler gerade
 * aussetzen; dann rueckt der naechste offene aktive Sitz nach.
 */
export function forcedSoloSeat(party: PartyState): number | null {
  const { rs } = party;
  if (!rs.pflichtsolo) return null;

  const st = new PflichtsoloState(rs, pflichtsoloSeats(party));
  for (const s of party.soloPlayed) st.register(s);

  const remaining = rs.rounds - party.roundIndex;
  const { active, vorhand } = seating(party);
  const open = st.open();
  if (open.length === 0 || remaining > open.length) return null;

  const start = active.indexOf(vorhand);
  for (let i = 0; i < active.length; i++) {
    const seat = active[(start + i) % active.length];
    if (open.includes(seat)) return seat;
  }
  return null;
}

export function startRound(party: PartyState): PartyState {
  if (party.finished) throw new Error('Partie ist beendet');
  if (party.current) throw new Error('Es laeuft bereits eine Runde');

  const { active, vorhand } = seating(party);
  // Jedes Geben bekommt einen eigenen Seed aus der geheimen Basis. Frueher
  // stand hier eine Rechnung aus dem Partie-Seed - wer ein Geben erriet,
  // kannte damit die ganze Partie.
  const seed: Seed = party.seedHex
    ? dealSeed(party.seedHex, party.roundIndex * 16 + Math.min(party.attempt, 15))
    : party.seed * 1000 + party.roundIndex * 10 + party.attempt;

  const current = createRound(party.rs, active, vorhand, seed, {
    multiplier: party.bock.multiplier(party.roundIndex),
    forcedSoloSeat: forcedSoloSeat(party),
    soloPlayed: party.soloPlayed,
  });

  return { ...party, current };
}

export function act(party: PartyState, action: RoundAction): PartyState {
  if (!party.current) throw new Error('Es laeuft keine Runde');
  const next = applyRound(party.current, action);
  const updated = { ...party, current: next };

  if (next.phase === 'redeal') return finalizeRedeal(updated);
  if (next.phase === 'finished') return finalizeRound(updated);
  return updated;
}

/** Neugabe: gleiche Runde, gleicher Geber, neuer Seed. */
function finalizeRedeal(party: PartyState): PartyState {
  const round = party.current!;
  const bock = party.bock;
  if (round.triggersBock && party.rs.bockTriggers.includes('schmeiss')) {
    bock.trigger(party.roundIndex);
  }
  return {
    ...party,
    current: null,
    attempt: party.attempt + 1,
    bock,
  };
}

function finalizeRound(party: PartyState): PartyState {
  const round = party.current!;
  const result = round.result!;
  const { dealer } = seating(party);

  const scores = { ...party.scores };
  for (const [seat, value] of Object.entries(result.scores)) {
    scores[Number(seat)] += value;
  }

  // Solo-Historie fuer den Pflichtsolo-Zyklus.
  const soloPlayed = [...party.soloPlayed];
  const soloSeat =
    round.gameType.kind === 'solo'
      ? round.reSeats[0]
      : round.stilleHochzeit
        ? round.reSeats[0]
        : null;
  if (soloSeat !== undefined && soloSeat !== null && !soloPlayed.includes(soloSeat)) {
    soloPlayed.push(soloSeat);
  }

  // Bock-Ausloeser pruefen und registrieren.
  const bock = party.bock;
  let triggeredBock = false;
  if (party.rs.bock) {
    const t = party.rs.bockTriggers;
    const fires =
      (t.includes('zeroResult') && result.winner === null) ||
      (t.includes('reAndKontra') &&
        round.announcements.re &&
        round.announcements.kontra) ||
      (t.includes('solo') && round.gameType.kind === 'solo') ||
      (t.includes('lostRe') &&
        round.announcements.re &&
        result.winner === 'kontra');
    if (fires) {
      bock.trigger(party.roundIndex);
      triggeredBock = true;
    }
  }

  const summary: RoundSummary = {
    roundIndex: party.roundIndex,
    dealer,
    vorhand: round.vorhand,
    gameType: round.gameType,
    soloSeat: soloSeat ?? null,
    multiplier: round.multiplier,
    announcements: round.announcements,
    result,
    triggeredBock,
  };

  const roundIndex = party.roundIndex + 1;
  const done = roundIndex >= party.rs.rounds;

  const next: PartyState = {
    ...party,
    current: null,
    scores,
    soloPlayed,
    history: [...party.history, summary],
    roundIndex,
    attempt: 0,
    dealerIndex: party.dealerIndex + 1,
    bock,
    finished: done,
    trophies: null,
  };

  return done ? finishParty(next) : next;
}

/** Meldet einen Aussteiger. Er wird am Ende als Letzter gewertet. */
export function markLeft(party: PartyState, seat: number): PartyState {
  if (party.leftSeats.includes(seat)) return party;
  return { ...party, leftSeats: [...party.leftSeats, seat] };
}

export function finishParty(party: PartyState): PartyState {
  const standings = party.seats.map((seat) => ({
    seat,
    score: party.scores[seat],
    left: party.leftSeats.includes(seat),
  }));

  // 3er-Tische zaehlen nicht fuer die globale Rangliste, der Botsitz bekommt
  // deshalb gar keine Trophaeen.
  const scored = standings.filter((s) => !party.botSeats.includes(s.seat));

  return {
    ...party,
    finished: true,
    trophies:
      party.rs.training || scored.length < 3
        ? []
        : awardTrophies(scored, { training: party.rs.training }),
  };
}

/** Bock-Multiplikator der naechsten Runde, fuer die Anzeige im Client. */
export function upcomingMultiplier(party: PartyState): number {
  return party.bock.multiplier(party.roundIndex);
}
