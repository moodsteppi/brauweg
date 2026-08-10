/**
 * Partie-Maschine fuer Skat.
 *
 * Verbindet einzelne Gaben zu einer Partie: Geberrotation, Zwischenstand,
 * Neugabe (wenn alle passen und der Tisch keinen Ramsch spielt) und die
 * Bockrunde nach verlorenem Kontra-Spiel. Wie die Rundenmaschine rein
 * funktional: Aktion rein, neuer Zustand raus.
 *
 * Die eigentliche Skatlogik steckt in round.ts. Diese Ebene kennt nur, was
 * ueber mehrere Gaben hinweg gilt — Punktekonto, Geber, Bock.
 */

import { type Seed, dealSeed } from './deal.js';
import { type GameType } from './order.js';
import { type RuleSet } from './ruleset.js';
import { type DealErgebnis } from './scoring.js';
import {
  type RoundAction,
  type RoundState,
  apply as applyRound,
  createRound,
} from './round.js';

/** Eine Partie ist immer ein Vielfaches von drei Gaben: jeder gibt gleich oft. */
export const ROTATION = 3;

export interface RoundSummary {
  readonly roundIndex: number;
  readonly dealer: number;
  readonly declarer: number | null;
  readonly gameType: GameType | null;
  readonly reizWert: number;
  readonly bockFaktor: number;
  readonly result: DealErgebnis;
  /** Punkte je Sitz nach Bock (das, was ins Konto floss). */
  readonly punkte: Readonly<Record<number, number>>;
}

export interface PartyState {
  readonly rs: RuleSet;
  readonly seats: readonly number[]; // stets [0,1,2]
  readonly botSeats: readonly number[];
  readonly seed: number;
  readonly seedHex: string | null;

  readonly roundIndex: number;
  /** Zaehlt Neugaben derselben Gabe, damit der Seed sich aendert. */
  readonly attempt: number;
  readonly dealerIndex: number;

  readonly current: RoundState | null;
  readonly scores: Readonly<Record<number, number>>;
  readonly history: readonly RoundSummary[];
  readonly leftSeats: readonly number[];
  /** Sitze, die in der Zwischenpause schon "Weiter" getippt haben. */
  readonly weiter: readonly number[];
  /**
   * Rundennummern, die doppelt zaehlen (Bock). Wird beim Auswerten einer
   * verlorenen Kontra-Gabe fuer die naechste Nummer gesetzt.
   */
  readonly bockRunden: readonly number[];

  readonly finished: boolean;
}

export function createParty(
  rs: RuleSet,
  seats: readonly number[],
  seed: number,
  botSeats: readonly number[] = [],
  seedHex: string | null = null,
): PartyState {
  if (seats.length !== ROTATION) {
    throw new Error(`Skat wird zu dritt gespielt, ${ROTATION} Rotationssitze erwartet`);
  }
  if (rs.rounds % ROTATION !== 0) {
    throw new Error(`Rundenzahl muss ein Vielfaches von ${ROTATION} sein (volle Geberrunde)`);
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
    leftSeats: [],
    weiter: [],
    bockRunden: [],
    finished: false,
  };
}

/** Geber der kommenden Gabe. */
export function dealer(party: PartyState): number {
  return party.seats[party.dealerIndex % party.seats.length]!;
}

/** Bock-Faktor der gegebenen Rundennummer (2 im Bock, sonst 1). */
export function bockFaktor(party: PartyState, roundIndex: number): number {
  return party.rs.bock && party.bockRunden.includes(roundIndex) ? 2 : 1;
}

export function startRound(party: PartyState): PartyState {
  if (party.finished) throw new Error('Partie ist beendet');
  if (party.current) throw new Error('Es laeuft bereits eine Gabe');

  // Jede Gabe bekommt einen eigenen Seed aus der geheimen Basis. Ein aus dem
  // Partie-Seed abgeleitetes Geben liesse sich sonst durchprobieren, und wer
  // eine Gabe kennt, kennt die ganze Partie.
  const seed: Seed = party.seedHex
    ? dealSeed(party.seedHex, party.roundIndex * 16 + Math.min(party.attempt, 15))
    : party.seed * 1000 + party.roundIndex * 10 + party.attempt;

  const current = createRound(party.rs, dealer(party), seed);
  return { ...party, current };
}

/** Aktionen der Partie: alles aus der Gabe plus das "Weiter" der Pause. */
export type PartyAction = RoundAction | { readonly type: 'weiter' };

export function act(party: PartyState, seat: number, action: PartyAction): PartyState {
  if (action.type === 'weiter') return weiter(party, seat);
  if (!party.current) throw new Error('Es laeuft keine Gabe');
  if (inPause(party)) throw new Error('Zwischenpause: Es geht erst mit Weiter voran');

  const next = applyRound(party.current, seat, action);
  const updated: PartyState = { ...party, current: next };

  if (next.phase === 'vorbei') {
    return next.neuGeben ? finalizeRedeal(updated) : finalizeRound(updated);
  }
  return updated;
}

/** Laeuft gerade die Zwischenpause mit Abrechnung? */
export function inPause(party: PartyState): boolean {
  return party.current?.phase === 'vorbei' && party.current.result !== null;
}

/** Sitze, deren "Weiter" zaehlt: anwesende Menschen. */
export function pauseSeats(party: PartyState): number[] {
  return party.seats.filter((s) => !party.botSeats.includes(s) && !party.leftSeats.includes(s));
}

export function weiter(party: PartyState, seat: number): PartyState {
  // Zu spaet oder doppelt getippt ist kein Verstoss: Der Tisch ist ohnehin da,
  // wo der Tipper hinwollte.
  if (!inPause(party)) return party;
  if (party.weiter.includes(seat)) return party;
  const next: PartyState = { ...party, weiter: [...party.weiter, seat] };
  const offen = pauseSeats(next).filter((s) => !next.weiter.includes(s));
  return offen.length === 0 ? endePause(next) : next;
}

export function endePause(party: PartyState): PartyState {
  if (!inPause(party)) throw new Error('Es laeuft keine Zwischenpause');
  const cleared: PartyState = { ...party, current: null, weiter: [] };
  return party.roundIndex >= party.rs.rounds ? finishParty(cleared) : cleared;
}

/** Neugabe: gleiche Nummer, gleicher Geber, neuer Seed. */
function finalizeRedeal(party: PartyState): PartyState {
  return { ...party, current: null, attempt: party.attempt + 1 };
}

function finalizeRound(party: PartyState): PartyState {
  const round = party.current!;
  const ergebnis = round.result!;
  const faktor = bockFaktor(party, party.roundIndex);

  const punkte: Record<number, number> = {};
  const scores = { ...party.scores };
  for (const s of party.seats) {
    const p = (ergebnis.punkte[s] ?? 0) * faktor;
    punkte[s] = p;
    scores[s] = (scores[s] ?? 0) + p;
  }

  // Bock nach verlorenem Kontra-Spiel: die naechste Gabe zaehlt doppelt. Nur
  // wenn der Tisch Bock spielt und wirklich Kontra gesagt war und der
  // Alleinspieler verloren hat.
  const bockRunden = [...party.bockRunden];
  if (
    party.rs.bock &&
    round.kontra &&
    ergebnis.declarer !== null &&
    !ergebnis.gewonnen &&
    !bockRunden.includes(party.roundIndex + 1)
  ) {
    bockRunden.push(party.roundIndex + 1);
  }

  const summary: RoundSummary = {
    roundIndex: party.roundIndex,
    dealer: dealer(party),
    declarer: ergebnis.declarer,
    gameType: round.gameType,
    reizWert: round.reizWert,
    bockFaktor: faktor,
    result: ergebnis,
    punkte,
  };

  const next: PartyState = {
    ...party,
    scores,
    history: [...party.history, summary],
    roundIndex: party.roundIndex + 1,
    attempt: 0,
    dealerIndex: party.dealerIndex + 1,
    bockRunden,
    weiter: [],
  };

  // Ohne Menschen liest niemand die Abrechnung: gleich abraeumen.
  return pauseSeats(next).length === 0 ? endePause(next) : next;
}

export function markLeft(party: PartyState, seat: number): PartyState {
  if (party.leftSeats.includes(seat)) return party;
  return { ...party, leftSeats: [...party.leftSeats, seat] };
}

export function finishParty(party: PartyState): PartyState {
  return { ...party, finished: true };
}

/** Bock-Faktor der naechsten Gabe, fuer die Anzeige im Client. */
export function upcomingBock(party: PartyState): number {
  return bockFaktor(party, party.roundIndex);
}
