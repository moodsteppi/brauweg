/**
 * Ablauf eines einzelnen Spiels (eine Gabe).
 *
 * Phasen: reizen → skat (aufnehmen oder Hand) → druecken → ansage → stich →
 * vorbei. Passen alle, wird je nach Tischregel Ramsch gespielt oder neu
 * gegeben. Der Automat ist die einzige Stelle, die Zustand aendert; er prueft
 * jede Aktion (Bedienpflicht, Reizfolge, Ansageregeln).
 */

import { type Card, sumAugen } from './cards.js';
import { deal } from './deal.js';
import { type GameType, legalCards, sortHand, trumpKeys, winningIndex } from './order.js';
import {
  type ReizenState,
  applyReizWeg,
  applyReizWeiter,
  reizAmZug,
  reizSicht,
  startReizen,
} from './reizen.js';
import { type RuleSet } from './ruleset.js';
import { type AbrechnungEingabe, type DealErgebnis, abrechnen } from './scoring.js';

export type Phase = 'reizen' | 'skat' | 'druecken' | 'ansage' | 'stich' | 'vorbei';

/** Was der Alleinspieler ansagt: eine Farbe, Grand oder Null. */
export type AnsageSpiel = 'C' | 'S' | 'H' | 'D' | 'grand' | 'null';

export interface PlayedCard {
  readonly seat: number;
  readonly card: Card;
}
export interface TrickRecord {
  readonly played: readonly PlayedCard[];
  readonly winner: number;
}

export interface RoundState {
  readonly rs: RuleSet;
  readonly seats: readonly number[]; // stets [0,1,2]
  readonly dealer: number;
  readonly deck: readonly Card[];
  readonly austeilung: Readonly<Record<number, readonly Card[]>>; // Anfangshaende, unveraendert
  readonly hands: Readonly<Record<number, readonly Card[]>>;
  readonly skat: readonly Card[];
  readonly phase: Phase;
  readonly reizen: ReizenState;
  readonly declarer: number | null;
  readonly reizWert: number;
  readonly gameType: GameType | null;
  readonly handSpiel: boolean;
  readonly skatGenommen: boolean;
  readonly ouvert: boolean;
  readonly schneiderAngesagt: boolean;
  readonly schwarzAngesagt: boolean;
  readonly gedrueckt: readonly Card[];
  readonly kontra: boolean;
  readonly re: boolean;
  readonly vorhand: number;
  readonly turn: number;
  readonly trick: readonly PlayedCard[];
  readonly tricks: readonly TrickRecord[];
  readonly gewonnen: Readonly<Record<number, readonly Card[]>>;
  readonly result: DealErgebnis | null;
  /** Alle haben gepasst und die Regel sagt „neu geben". */
  readonly neuGeben: boolean;
}

export type RoundAction =
  | { readonly type: 'reizWeiter' }
  | { readonly type: 'reizWeg' }
  | { readonly type: 'skatNehmen' }
  | { readonly type: 'handSpielen' }
  | { readonly type: 'druecken'; readonly cards: readonly number[] }
  | {
      readonly type: 'ansage';
      readonly spiel: AnsageSpiel;
      readonly ouvert?: boolean;
      readonly schneider?: boolean;
      readonly schwarz?: boolean;
    }
  | { readonly type: 'kontra' }
  | { readonly type: 're' }
  | { readonly type: 'karte'; readonly cardId: number };

export class RuleViolation extends Error {}
function fail(msg: string): never {
  throw new RuleViolation(msg);
}

function spielZuGameType(spiel: AnsageSpiel): GameType {
  if (spiel === 'grand') return { kind: 'grand' };
  if (spiel === 'null') return { kind: 'null' };
  return { kind: 'suit', trump: spiel };
}

export function createRound(rs: RuleSet, dealer: number, seed: number | string): RoundState {
  const g = deal(seed);
  const seats = [0, 1, 2];
  const hands: Record<number, readonly Card[]> = {};
  const austeilung: Record<number, readonly Card[]> = {};
  for (const s of seats) {
    hands[s] = g.hands[s]!;
    austeilung[s] = g.hands[s]!;
  }
  return {
    rs,
    seats,
    dealer,
    deck: g.hands.flat().concat(g.skat).sort((a, b) => a.id - b.id),
    austeilung,
    hands,
    skat: g.skat,
    phase: 'reizen',
    reizen: startReizen(dealer),
    declarer: null,
    reizWert: 0,
    gameType: null,
    handSpiel: false,
    skatGenommen: false,
    ouvert: false,
    schneiderAngesagt: false,
    schwarzAngesagt: false,
    gedrueckt: [],
    kontra: false,
    re: false,
    vorhand: (dealer + 1) % 3,
    turn: (dealer + 1) % 3,
    trick: [],
    tricks: [],
    gewonnen: { 0: [], 1: [], 2: [] },
    result: null,
    neuGeben: false,
  };
}

export function currentActor(s: RoundState): number | null {
  switch (s.phase) {
    case 'reizen':
      return reizAmZug(s.reizen);
    case 'skat':
    case 'druecken':
    case 'ansage':
      return s.declarer;
    case 'stich':
      return s.turn;
    default:
      return null;
  }
}

export function apply(s: RoundState, seat: number, a: RoundAction): RoundState {
  switch (a.type) {
    case 'reizWeiter':
    case 'reizWeg':
      return applyReiz(s, seat, a.type);
    case 'skatNehmen':
    case 'handSpielen':
      return applySkatWahl(s, seat, a.type);
    case 'druecken':
      return applyDruecken(s, seat, a.cards);
    case 'ansage':
      return applyAnsage(s, seat, a);
    case 'kontra':
      return applyKontra(s, seat);
    case 're':
      return applyRe(s, seat);
    case 'karte':
      return applyKarte(s, seat, a.cardId);
    default:
      return s;
  }
}

function applyReiz(s: RoundState, seat: number, art: 'reizWeiter' | 'reizWeg'): RoundState {
  if (s.phase !== 'reizen') fail('Es wird gerade nicht gereizt');
  if (reizAmZug(s.reizen) !== seat) fail('Dieser Sitz ist beim Reizen nicht am Zug');
  const reizen = art === 'reizWeiter' ? applyReizWeiter(s.reizen) : applyReizWeg(s.reizen);
  if (reizen.phase !== 'fertig') return { ...s, reizen };

  // Reizen vorbei: Alleinspieler oder alle gepasst.
  if (reizen.gewinner === null) {
    if (s.rs.ramsch) return startRamsch({ ...s, reizen });
    return { ...s, reizen, phase: 'vorbei', neuGeben: true };
  }
  return { ...s, reizen, declarer: reizen.gewinner, reizWert: reizen.wert, phase: 'skat' };
}

function startRamsch(s: RoundState): RoundState {
  return {
    ...s,
    phase: 'stich',
    gameType: { kind: 'ramsch' },
    declarer: null,
    turn: s.vorhand,
  };
}

function applySkatWahl(s: RoundState, seat: number, art: 'skatNehmen' | 'handSpielen'): RoundState {
  if (s.phase !== 'skat') fail('Der Skat steht gerade nicht zur Wahl');
  if (seat !== s.declarer) fail('Nur der Alleinspieler entscheidet ueber den Skat');
  if (art === 'handSpielen') {
    return { ...s, handSpiel: true, skatGenommen: false, phase: 'ansage' };
  }
  const hand = [...s.hands[seat]!, ...s.skat];
  return { ...s, hands: { ...s.hands, [seat]: hand }, skatGenommen: true, handSpiel: false, phase: 'druecken' };
}

function applyDruecken(s: RoundState, seat: number, cards: readonly number[]): RoundState {
  if (s.phase !== 'druecken') fail('Es wird gerade nicht gedrueckt');
  if (seat !== s.declarer) fail('Nur der Alleinspieler drueckt');
  if (cards.length !== 2 || cards[0] === cards[1]) fail('Genau zwei verschiedene Karten druecken');
  const hand = s.hands[seat]!;
  const weg = cards.map((id) => hand.find((c) => c.id === id));
  if (weg.some((c) => !c)) fail('Gedrueckte Karte ist nicht auf der Hand');
  const rest = hand.filter((c) => !cards.includes(c.id));
  return {
    ...s,
    hands: { ...s.hands, [seat]: rest },
    gedrueckt: weg as Card[],
    phase: 'ansage',
  };
}

function applyAnsage(
  s: RoundState,
  seat: number,
  a: Extract<RoundAction, { type: 'ansage' }>,
): RoundState {
  if (s.phase !== 'ansage') fail('Es wird gerade nichts angesagt');
  if (seat !== s.declarer) fail('Nur der Alleinspieler sagt an');
  const gt = spielZuGameType(a.spiel);
  const ouvert = !!a.ouvert;
  let schneider = !!a.schneider;
  let schwarz = !!a.schwarz;

  if (gt.kind === 'null') {
    // Null kennt weder Schneider noch Schwarz; Ouvert ist erlaubt (auch als Hand).
    schneider = false;
    schwarz = false;
  } else {
    // Zusatzansagen gibt es nur im Handspiel; Schwarz setzt Schneider voraus,
    // Ouvert setzt Schwarz (angesagt) voraus.
    if ((schneider || schwarz || ouvert) && !s.handSpiel) {
      fail('Schneider, Schwarz und Ouvert gehen nur im Handspiel');
    }
    if (ouvert) {
      schneider = true;
      schwarz = true;
    }
    if (schwarz) schneider = true;
  }

  return {
    ...s,
    gameType: gt,
    ouvert,
    schneiderAngesagt: schneider,
    schwarzAngesagt: schwarz,
    phase: 'stich',
    turn: s.vorhand,
  };
}

/** Kontra darf ein Gegner sagen, solange keine Karte liegt. */
function applyKontra(s: RoundState, seat: number): RoundState {
  if (!s.rs.kontraRe) fail('Kontra ist an diesem Tisch aus');
  if (s.phase !== 'stich' || s.gameType?.kind === 'ramsch') fail('Kontra geht jetzt nicht');
  if (s.tricks.length > 0 || s.trick.length > 0) fail('Kontra nur vor der ersten Karte');
  if (seat === s.declarer) fail('Nur die Gegenpartei sagt Kontra');
  if (s.kontra) fail('Kontra steht schon');
  return { ...s, kontra: true };
}

/** Re darf der Alleinspieler auf ein Kontra hin sagen. */
function applyRe(s: RoundState, seat: number): RoundState {
  if (s.phase !== 'stich') fail('Re geht jetzt nicht');
  if (s.tricks.length > 0 || s.trick.length > 0) fail('Re nur vor der ersten Karte');
  if (seat !== s.declarer) fail('Nur der Alleinspieler sagt Re');
  if (!s.kontra || s.re) fail('Re setzt ein offenes Kontra voraus');
  return { ...s, re: true };
}

function applyKarte(s: RoundState, seat: number, cardId: number): RoundState {
  if (s.phase !== 'stich') fail('Es wird gerade nicht gespielt');
  if (s.turn !== seat) fail('Dieser Sitz ist nicht am Zug');
  const hand = s.hands[seat]!;
  const karte = hand.find((c) => c.id === cardId);
  if (!karte) fail('Karte ist nicht auf der Hand');
  const gt = s.gameType!;
  const trickKarten = s.trick.map((p) => p.card);
  if (!legalCards(hand, trickKarten, gt).some((c) => c.id === cardId)) fail('Karte bedient nicht');

  const trick = [...s.trick, { seat, card: karte }];
  const hands = { ...s.hands, [seat]: hand.filter((c) => c.id !== cardId) };

  if (trick.length < 3) {
    return { ...s, hands, trick, turn: (seat + 1) % 3 };
  }

  // Stich voll: Gewinner bestimmen.
  const gewinnerIdx = winningIndex(trick.map((p) => p.card), gt);
  const gewinner = trick[gewinnerIdx]!.seat;
  const record: TrickRecord = { played: trick, winner: gewinner };
  const gewonnen = {
    ...s.gewonnen,
    [gewinner]: [...s.gewonnen[gewinner]!, ...trick.map((p) => p.card)],
  };
  const tricks = [...s.tricks, record];
  const rest = { ...s, hands, trick: [], tricks, gewonnen, turn: gewinner };

  if (tricks.length < 10) return rest;

  // Alle zehn Stiche gespielt: abrechnen.
  return abrechnenUndBeenden(rest, gewinner);
}

function abrechnenUndBeenden(s: RoundState, letzterStichGewinner: number): RoundState {
  const gt = s.gameType!;
  let gewonnen = s.gewonnen;
  let declarerExtra: readonly Card[] = [];

  if (gt.kind === 'ramsch') {
    // Der Skat faellt dem Sitz zu, der den letzten Stich nahm.
    gewonnen = {
      ...gewonnen,
      [letzterStichGewinner]: [...gewonnen[letzterStichGewinner]!, ...s.skat],
    };
  } else {
    // Skat bzw. Gedrueckte zaehlen dem Alleinspieler.
    declarerExtra = s.skatGenommen ? s.gedrueckt : s.skat;
  }

  const stiche: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  for (const t of s.tricks) stiche[t.winner]!++;

  const eingabe: AbrechnungEingabe = {
    gameType: gt,
    declarer: s.declarer,
    reizWert: s.reizWert,
    hand: s.handSpiel,
    ouvert: s.ouvert,
    schneiderAngesagt: s.schneiderAngesagt,
    schwarzAngesagt: s.schwarzAngesagt,
    kontra: s.kontra,
    re: s.re,
    seats: s.seats,
    gewonneneKarten: gewonnen,
    stiche,
    declarerExtra,
    matadorKarten:
      s.declarer !== null ? [...s.austeilung[s.declarer]!, ...s.skat] : [],
    deck: s.deck,
  };
  return { ...s, gewonnen, phase: 'vorbei', result: abrechnen(eingabe) };
}

// ---------------------------------------------------------------------------
// Zulaessige Aktionen (der Client baut daraus die Knoepfe)
// ---------------------------------------------------------------------------

export function legalActions(s: RoundState, seat: number): RoundAction[] {
  const out: RoundAction[] = [];
  switch (s.phase) {
    case 'reizen':
      if (reizAmZug(s.reizen) === seat) {
        out.push({ type: 'reizWeiter' }, { type: 'reizWeg' });
      }
      break;
    case 'skat':
      if (seat === s.declarer) out.push({ type: 'skatNehmen' }, { type: 'handSpielen' });
      break;
    case 'druecken':
      // Das Auswaehlen der zwei Karten macht der Client; hier keine fertige Aktion.
      break;
    case 'ansage':
      // Die Ansage baut der Client aus Farbe/Grand/Null plus Zusatzflaggen.
      break;
    case 'stich': {
      if (s.gameType?.kind !== 'ramsch' && (s.tricks.length === 0 && s.trick.length === 0)) {
        if (s.rs.kontraRe && seat !== s.declarer && !s.kontra) out.push({ type: 'kontra' });
        if (s.rs.kontraRe && seat === s.declarer && s.kontra && !s.re) out.push({ type: 're' });
      }
      if (s.turn === seat) {
        for (const c of legalCards(s.hands[seat]!, s.trick.map((p) => p.card), s.gameType!)) {
          out.push({ type: 'karte', cardId: c.id });
        }
      }
      break;
    }
    default:
      break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sicht
// ---------------------------------------------------------------------------

export interface PlayerView {
  readonly seat: number;
  readonly phase: Phase;
  readonly dealer: number;
  readonly hand: readonly Card[];
  readonly legal: readonly Card[];
  readonly handCounts: Readonly<Record<number, number>>;
  readonly trick: readonly PlayedCard[];
  readonly lastTrick: TrickRecord | null;
  readonly turn: number | null;
  readonly gameType: GameType | null;
  readonly trumpfKeys: readonly string[];
  readonly reiz: {
    readonly wert: number;
    readonly gebot: number | null;
    readonly amZug: number | null;
    readonly rolle: 'sager' | 'hoerer' | 'vh' | null;
  };
  readonly declarer: number | null;
  readonly reizWert: number;
  readonly handSpiel: boolean;
  readonly ouvert: boolean;
  readonly schneiderAngesagt: boolean;
  readonly schwarzAngesagt: boolean;
  readonly kontra: boolean;
  readonly re: boolean;
  readonly trickCounts: Readonly<Record<number, number>>;
  readonly augen: Readonly<Record<number, number>>;
  /** Offene Hand des Alleinspielers bei Ouvert (für alle sichtbar). */
  readonly ouvertHand: readonly Card[] | null;
  readonly result: DealErgebnis | null;
  readonly isMyTurn: boolean;
  readonly neuGeben: boolean;
  /** Spielt der Tisch Ramsch, wenn alle passen? (Sonst wird neu gegeben.) */
  readonly ramschAn: boolean;
  /**
   * Nicht-Karten-Aktionen, die dieser Sitz gerade ausfuehren darf, als Typen
   * (z.B. 'reizWeiter', 'skatNehmen', 'kontra'). Der Client baut daraus seine
   * Knoepfe, ohne die Regeln nachzubilden. Druecken und Ansage stehen NICHT
   * darin — die baut der Client aus der Sicht (Kartenauswahl bzw. Spielwahl).
   */
  readonly aktionen: readonly string[];
}

export function viewFor(s: RoundState, seat: number): PlayerView {
  const gt = s.gameType;
  const rs = reizSicht(s.reizen);
  const augen: Record<number, number> = {};
  for (const t of s.seats) augen[t] = sumAugen([...s.gewonnen[t]!]);
  const trickCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0 };
  for (const t of s.tricks) trickCounts[t.winner]!++;
  const handCounts: Record<number, number> = {};
  for (const t of s.seats) handCounts[t] = s.hands[t]!.length;

  const zeigeOuvert =
    s.ouvert && s.declarer !== null && s.phase === 'stich'
      ? sortHand([...s.hands[s.declarer]!], gt!)
      : null;

  return {
    seat,
    phase: s.phase,
    dealer: s.dealer,
    hand: gt ? sortHand([...s.hands[seat]!], gt) : sortHand([...s.hands[seat]!], { kind: 'grand' }),
    legal:
      s.phase === 'stich' && s.turn === seat
        ? legalCards(s.hands[seat]!, s.trick.map((p) => p.card), gt!)
        : [],
    handCounts,
    trick: s.trick,
    lastTrick: s.tricks[s.tricks.length - 1] ?? null,
    turn: currentActor(s),
    gameType: gt,
    trumpfKeys: gt && gt.kind !== 'null' ? trumpKeys(gt, s.deck) : gt ? nullOrder(s.deck) : [],
    reiz: { wert: rs.wert, gebot: rs.gebot, amZug: reizAmZug(s.reizen), rolle: rs.rolle },
    declarer: s.declarer,
    reizWert: s.reizWert,
    handSpiel: s.handSpiel,
    ouvert: s.ouvert,
    schneiderAngesagt: s.schneiderAngesagt,
    schwarzAngesagt: s.schwarzAngesagt,
    kontra: s.kontra,
    re: s.re,
    trickCounts,
    augen,
    ouvertHand: seat === s.declarer ? null : zeigeOuvert,
    result: s.result,
    isMyTurn: currentActor(s) === seat,
    neuGeben: s.neuGeben,
    ramschAn: s.rs.ramsch,
    aktionen: legalActions(s, seat)
      .filter((a) => a.type !== 'karte')
      .map((a) => a.type),
  };
}

// Null hat keinen Trumpf; fuer die Sortierung reicht eine leere Trumpfliste.
function nullOrder(_deck: readonly Card[]): string[] {
  return [];
}
