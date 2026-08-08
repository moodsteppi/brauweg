/**
 * Rundenmaschine.
 *
 * Rein funktional: Zustand plus Aktion ergibt neuen Zustand. Kein Zufall ausser
 * dem uebergebenen Seed, keine Uhr, kein Netz.
 *
 * Der Unterschied zu einem Stichspiel: EIN ZUG HAT MEHRERE SCHRITTE. Wer zieht,
 * ist danach noch am Zug und muss entscheiden, was mit der Karte geschieht;
 * wirft er eine Aktionskarte ab, kommt ein dritter Schritt dazu. Deshalb gibt
 * es eine Phase je Zwischenschritt, und `currentActor` bleibt derselbe Sitz.
 * Fuer die Plattform sieht das aus wie mehrere Zuege kurz hintereinander - der
 * Zugtimer laeuft je Schritt, was richtig ist: Auch das Entscheiden dauert.
 *
 * Phasen:
 *
 *   turn      am Zug: ziehen, vom Ablagestapel nehmen oder Cambio rufen
 *   decide    Karte gezogen und angesehen: tauschen oder abwerfen
 *   action    Aktionskarte abgeworfen: ihr Ziel benennen
 *   finished  aufgedeckt und abgerechnet
 */

import { type ActionKind, type Card, actionOf } from './cards.js';
import { type Seed, deal, makeRng, shuffle } from './deal.js';
import { type RoundResult, scoreRound } from './scoring.js';
import { HAND_SIZE, type RuleSet } from './ruleset.js';

export type Phase = 'turn' | 'decide' | 'action' | 'finished';

/** Ein Platz in einer Hand: Sitz plus Position 0..3. */
export interface Slot {
  readonly seat: number;
  readonly index: number;
}

export type RoundAction =
  /** Vom verdeckten Nachziehstapel ziehen. */
  | { readonly type: 'drawStock'; readonly seat: number }
  /** Oberste Karte des Ablagestapels nehmen und gegen eigene tauschen. */
  | { readonly type: 'takeDiscard'; readonly seat: number; readonly index: number }
  /** Cambio rufen: alle anderen noch einmal, dann Schluss. */
  | { readonly type: 'callCambio'; readonly seat: number }
  /** Gezogene Karte gegen eigene tauschen. */
  | { readonly type: 'swap'; readonly seat: number; readonly index: number }
  /** Gezogene Karte abwerfen. Aktionskarten wirken hier. */
  | { readonly type: 'discardDrawn'; readonly seat: number }
  /** Ziel einer Aktion benennen. */
  | { readonly type: 'resolveAction'; readonly seat: number; readonly targets: readonly Slot[] }
  /** Bei der Dame: nach dem Ansehen NICHT tauschen. */
  | { readonly type: 'skipAction'; readonly seat: number };

export interface RoundState {
  readonly rs: RuleSet;
  readonly seats: readonly number[];
  readonly dealer: number;
  /** Links vom Geber: beginnt. */
  readonly vorhand: number;

  /** Vier Plaetze je Sitz. Eine Karte kann nie fehlen. */
  readonly hands: Readonly<Record<number, readonly Card[]>>;
  readonly stock: readonly Card[];
  readonly discard: readonly Card[];

  /**
   * Was ein Sitz ueber Karten WEISS - je Sitz die Menge der ihm bekannten
   * Plaetze als "seat:index".
   *
   * Das ist der Kern des Spiels und der Grund, warum `viewFor` hier nicht
   * einfach die Hand ausblendet: Wissen ist persoenlich. Wer die Dame spielt
   * und eine fremde Karte sieht, weiss danach etwas, das sonst niemand weiss -
   * auch nicht der Besitzer der Karte, falls dieser sie selbst nie ansah.
   */
  readonly known: Readonly<Record<number, readonly string[]>>;

  readonly phase: Phase;
  readonly turn: number;

  /** Gezogene Karte, solange sie in der Hand des Ziehenden liegt. */
  readonly drawn: Card | null;
  /** Aktion, deren Ziel noch fehlt. */
  readonly pendingAction: ActionKind | null;
  /**
   * Bei der Dame: der bereits angesehene Platz. Der Tausch im zweiten Schritt
   * bezieht sich darauf.
   */
  readonly lookedAt: Slot | null;

  /** Wer Cambio gerufen hat, sonst null. */
  readonly caller: number | null;
  /** Sitze, die nach dem Ruf ihren letzten Zug schon hatten. */
  readonly afterCall: readonly number[];

  readonly result: RoundResult | null;
}

// ---------------------------------------------------------------------------
// Aufbau
// ---------------------------------------------------------------------------

function nextSeat(seats: readonly number[], seat: number): number {
  const i = seats.indexOf(seat);
  if (i === -1) throw new Error(`Sitz ${seat} sitzt nicht an diesem Tisch`);
  return seats[(i + 1) % seats.length]!;
}

export function slotKey(seat: number, index: number): string {
  return `${seat}:${index}`;
}

/**
 * Startwissen: die beiden aeusseren eigenen Karten, falls die Hausregel es
 * erlaubt. Fremde Karten kennt zu Beginn niemand.
 */
function startWissen(seats: readonly number[], rs: RuleSet): Record<number, string[]> {
  const known: Record<number, string[]> = {};
  for (const seat of seats) {
    known[seat] = rs.peekTwoAtStart
      ? [slotKey(seat, 0), slotKey(seat, HAND_SIZE - 1)]
      : [];
  }
  return known;
}

export function createRound(
  rs: RuleSet,
  seats: readonly number[],
  dealer: number,
  seed: Seed,
): RoundState {
  const gegeben = deal(seats.length, HAND_SIZE, seed);
  const hands: Record<number, Card[]> = {};
  seats.forEach((seat, i) => {
    hands[seat] = [...gegeben.hands[i]!];
  });

  return {
    rs,
    seats,
    dealer,
    vorhand: nextSeat(seats, dealer),
    hands,
    stock: gegeben.stock,
    discard: [gegeben.discard],
    known: startWissen(seats, rs),
    phase: 'turn',
    turn: nextSeat(seats, dealer),
    drawn: null,
    pendingAction: null,
    lookedAt: null,
    caller: null,
    afterCall: [],
    result: null,
  };
}

// ---------------------------------------------------------------------------
// Abfragen
// ---------------------------------------------------------------------------

export function currentActor(state: RoundState): number | null {
  return state.phase === 'finished' ? null : state.turn;
}

/** Oberste Karte des Ablagestapels. Sie liegt immer da - der Stapel startet mit einer. */
export function topDiscard(state: RoundState): Card {
  return state.discard[state.discard.length - 1]!;
}

/** Kennt dieser Sitz diesen Platz? */
export function weiss(state: RoundState, seat: number, slot: Slot): boolean {
  return (state.known[seat] ?? []).includes(slotKey(slot.seat, slot.index));
}

/**
 * Wirkt die Aktion dieser Karte nach dem aktuellen Regelsatz?
 *
 * Trennt bewusst zwischen "die Karte hat diese Aktion" (cards.ts, fest) und
 * "sie wirkt an diesem Tisch" (hier, schaltbar).
 */
export function effectOf(card: Card, rs: RuleSet): ActionKind | null {
  const art = actionOf(card);
  if (!art) return null;
  if (art === 'peekOwn' && !rs.peekOwn) return null;
  if (art === 'peekOther' && !rs.peekOther) return null;
  if (art === 'blindSwap' && !rs.blindSwap) return null;
  if (art === 'lookAndSwap' && !rs.lookAndSwap) return null;
  return art;
}

/**
 * Wie viele Ziele eine Aktion braucht.
 *
 * Die Dame laeuft in zwei Schritten: erst ein Ziel ansehen, dann wahlweise
 * mit einer eigenen Karte tauschen. `lookedAt` unterscheidet die Schritte.
 */
export function targetCount(art: ActionKind, lookedAt: Slot | null): number {
  switch (art) {
    case 'peekOwn':
    case 'peekOther':
      return 1;
    case 'blindSwap':
      return 2;
    case 'lookAndSwap':
      return lookedAt ? 1 : 1;
  }
}

/** Darf `slot` Ziel dieser Aktion sein? */
export function zielErlaubt(
  state: RoundState,
  art: ActionKind,
  slot: Slot,
  lookedAt: Slot | null,
): boolean {
  if (!state.seats.includes(slot.seat)) return false;
  if (slot.index < 0 || slot.index >= HAND_SIZE) return false;

  switch (art) {
    case 'peekOwn':
      return slot.seat === state.turn;
    case 'peekOther':
      return slot.seat !== state.turn;
    case 'blindSwap':
      // Zwei beliebige Plaetze, auch beide eigene. Das ist selten sinnvoll,
      // aber nicht verboten - und es zu verbieten waere eine Regel, die es
      // am Tisch nicht gibt.
      return true;
    case 'lookAndSwap':
      // Erst eine fremde ansehen, dann gegen eine eigene tauschen.
      return lookedAt ? slot.seat === state.turn : slot.seat !== state.turn;
  }
}

/** Alle Aktionen, die dieser Sitz gerade ausfuehren darf. */
export function legalActions(state: RoundState, seat: number): RoundAction[] {
  if (state.phase === 'finished' || state.turn !== seat) return [];

  const out: RoundAction[] = [];

  if (state.phase === 'turn') {
    out.push({ type: 'drawStock', seat });
    for (let i = 0; i < HAND_SIZE; i++) {
      out.push({ type: 'takeDiscard', seat, index: i });
    }
    // Nach dem Ruf darf niemand mehr rufen - die Runde laeuft ja schon aus.
    if (state.caller === null) out.push({ type: 'callCambio', seat });
    return out;
  }

  if (state.phase === 'decide') {
    for (let i = 0; i < HAND_SIZE; i++) out.push({ type: 'swap', seat, index: i });
    out.push({ type: 'discardDrawn', seat });
    return out;
  }

  if (state.phase === 'action' && state.pendingAction) {
    const art = state.pendingAction;
    const ziele: Slot[] = [];
    for (const s of state.seats) {
      for (let i = 0; i < HAND_SIZE; i++) {
        const slot = { seat: s, index: i };
        if (zielErlaubt(state, art, slot, state.lookedAt)) ziele.push(slot);
      }
    }

    if (art === 'blindSwap') {
      for (const a of ziele) {
        for (const b of ziele) {
          if (a.seat === b.seat && a.index === b.index) continue;
          out.push({ type: 'resolveAction', seat, targets: [a, b] });
        }
      }
    } else {
      for (const ziel of ziele) out.push({ type: 'resolveAction', seat, targets: [ziel] });
    }

    // Die Dame darf nach dem Ansehen auf den Tausch verzichten. Bei den
    // uebrigen Aktionen gibt es nichts zu ueberspringen - sie sind mit dem
    // Ansehen erledigt.
    if (art === 'lookAndSwap' && state.lookedAt) out.push({ type: 'skipAction', seat });
    return out;
  }

  return out;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function fail(msg: string): never {
  throw new Error(msg);
}

export function apply(state: RoundState, action: RoundAction): RoundState {
  if (state.phase === 'finished') fail('Runde ist beendet');
  if (action.seat !== state.turn) fail(`Sitz ${action.seat} ist nicht an der Reihe`);

  switch (action.type) {
    case 'drawStock':
      return drawStock(state);
    case 'takeDiscard':
      return takeDiscard(state, action.index);
    case 'callCambio':
      return callCambio(state);
    case 'swap':
      return swap(state, action.index);
    case 'discardDrawn':
      return discardDrawn(state);
    case 'resolveAction':
      return resolveAction(state, action.targets);
    case 'skipAction':
      return skipAction(state);
  }
}

/**
 * Nachziehstapel leer? Dann wandert der Ablagestapel bis auf die oberste Karte
 * zurueck und wird neu gemischt.
 *
 * Gemischt wird aus dem Zustand heraus deterministisch: Der Seed ergibt sich
 * aus den Karten selbst, damit dieselbe Partie beim Nachspielen dieselbe
 * Reihenfolge bekommt.
 */
function nachfuellen(state: RoundState): RoundState {
  if (state.stock.length > 0) return state;

  const oben = topDiscard(state);
  const rest = state.discard.slice(0, -1);
  if (rest.length === 0) return state;

  const seed = rest.reduce((acc, card) => acc * 31 + card.id, 7) >>> 0;
  return { ...state, stock: shuffle(rest, makeRng(seed)), discard: [oben] };
}

function drawStock(state: RoundState): RoundState {
  if (state.phase !== 'turn') fail('Ziehen geht nur zu Beginn des Zuges');
  const gefuellt = nachfuellen(state);
  const karte = gefuellt.stock[gefuellt.stock.length - 1];
  if (!karte) fail('Nachziehstapel ist leer');

  return {
    ...gefuellt,
    stock: gefuellt.stock.slice(0, -1),
    drawn: karte,
    phase: 'decide',
  };
}

/**
 * Vom Ablagestapel nehmen. Nur im Tausch - eine Karte vom Ablagestapel zu
 * nehmen und sofort wieder abzuwerfen waere ein Zug ohne Wirkung.
 *
 * Aktionen loesen hier bewusst NICHT aus: Sonst liesse sich dieselbe Dame
 * beliebig oft spielen, indem man sie aufnimmt und wieder ablegt.
 */
function takeDiscard(state: RoundState, index: number): RoundState {
  if (state.phase !== 'turn') fail('Nehmen geht nur zu Beginn des Zuges');
  if (index < 0 || index >= HAND_SIZE) fail('Ungueltiger Platz');

  const seat = state.turn;
  const genommen = topDiscard(state);
  const hand = [...(state.hands[seat] ?? [])];
  const abgelegt = hand[index]!;
  hand[index] = genommen;

  return zugEnde({
    ...state,
    hands: { ...state.hands, [seat]: hand },
    discard: [...state.discard.slice(0, -1), abgelegt],
    // Man weiss jetzt, was auf diesem Platz liegt - man hat es selbst hingelegt.
    known: merken(state.known, seat, { seat, index }),
  });
}

function callCambio(state: RoundState): RoundState {
  if (state.phase !== 'turn') fail('Cambio geht nur zu Beginn des Zuges');
  if (state.caller !== null) fail('Es hat bereits jemand Cambio gerufen');
  return zugEnde({ ...state, caller: state.turn });
}

function swap(state: RoundState, index: number): RoundState {
  if (state.phase !== 'decide') fail('Tauschen geht nur mit gezogener Karte');
  if (index < 0 || index >= HAND_SIZE) fail('Ungueltiger Platz');
  const karte = state.drawn ?? fail('Keine gezogene Karte');

  const seat = state.turn;
  const hand = [...(state.hands[seat] ?? [])];
  const abgelegt = hand[index]!;
  hand[index] = karte;

  return zugEnde({
    ...state,
    hands: { ...state.hands, [seat]: hand },
    discard: [...state.discard, abgelegt],
    drawn: null,
    known: merken(state.known, seat, { seat, index }),
  });
}

function discardDrawn(state: RoundState): RoundState {
  if (state.phase !== 'decide') fail('Abwerfen geht nur mit gezogener Karte');
  const karte = state.drawn ?? fail('Keine gezogene Karte');

  const mitAblage: RoundState = {
    ...state,
    discard: [...state.discard, karte],
    drawn: null,
  };

  const art = effectOf(karte, state.rs);
  if (!art) return zugEnde(mitAblage);

  // Aktion ohne moegliches Ziel (etwa "fremde Karte ansehen" am Zweiertisch,
  // wenn es gar keine gibt) darf den Zug nicht blockieren.
  const wartend: RoundState = { ...mitAblage, phase: 'action', pendingAction: art, lookedAt: null };
  return legalActions(wartend, state.turn).length === 0 ? zugEnde(mitAblage) : wartend;
}

function resolveAction(state: RoundState, targets: readonly Slot[]): RoundState {
  if (state.phase !== 'action') fail('Gerade ist keine Aktion offen');
  const art = state.pendingAction ?? fail('Keine offene Aktion');
  const seat = state.turn;

  for (const ziel of targets) {
    if (!zielErlaubt(state, art, ziel, state.lookedAt)) fail('Unzulaessiges Ziel');
  }

  if (art === 'peekOwn' || art === 'peekOther') {
    const ziel = targets[0] ?? fail('Ziel fehlt');
    return zugEnde({ ...state, known: merken(state.known, seat, ziel), pendingAction: null });
  }

  if (art === 'blindSwap') {
    const [a, b] = targets;
    if (!a || !b) fail('Blindtausch braucht zwei Ziele');
    if (a.seat === b.seat && a.index === b.index) fail('Zwei verschiedene Plaetze noetig');
    return zugEnde({ ...tauschen(state, a, b), pendingAction: null });
  }

  // Dame, Schritt 1: ansehen. Schritt 2: tauschen.
  if (!state.lookedAt) {
    const ziel = targets[0] ?? fail('Ziel fehlt');
    return {
      ...state,
      known: merken(state.known, seat, ziel),
      lookedAt: ziel,
    };
  }

  const eigen = targets[0] ?? fail('Ziel fehlt');
  return zugEnde({
    ...tauschen(state, state.lookedAt, eigen),
    pendingAction: null,
    lookedAt: null,
  });
}

function skipAction(state: RoundState): RoundState {
  if (state.phase !== 'action') fail('Gerade ist keine Aktion offen');
  if (state.pendingAction !== 'lookAndSwap' || !state.lookedAt) {
    fail('Nur nach dem Ansehen darf man verzichten');
  }
  return zugEnde({ ...state, pendingAction: null, lookedAt: null });
}

// ---------------------------------------------------------------------------
// Hilfen
// ---------------------------------------------------------------------------

function merken(
  known: Readonly<Record<number, readonly string[]>>,
  seat: number,
  slot: Slot,
): Record<number, readonly string[]> {
  const key = slotKey(slot.seat, slot.index);
  const bisher = known[seat] ?? [];
  if (bisher.includes(key)) return { ...known };
  return { ...known, [seat]: [...bisher, key] };
}

/**
 * Tauscht zwei Plaetze und raeumt das Wissen darueber auf.
 *
 * Wichtig und leicht zu uebersehen: Nach einem Tausch stimmt das Wissen ALLER
 * ueber beide Plaetze nicht mehr - ausser beim Tauschenden, wenn er beide
 * Karten kannte. Es einfach stehenzulassen hiesse, dass Mitspieler dauerhaft
 * Falsches "wissen"; das waere kein Gedaechtnisspiel mehr, sondern Zufall.
 * Deshalb wird es geloescht, und nur wer sicher weiss, was wohin ging,
 * behaelt es.
 */
function tauschen(state: RoundState, a: Slot, b: Slot): RoundState {
  const handA = [...(state.hands[a.seat] ?? [])];
  const handB = a.seat === b.seat ? handA : [...(state.hands[b.seat] ?? [])];

  const karteA = handA[a.index]!;
  const karteB = handB[b.index]!;
  handA[a.index] = karteB;
  handB[b.index] = karteA;

  const hands = { ...state.hands, [a.seat]: handA, [b.seat]: handB };

  const keyA = slotKey(a.seat, a.index);
  const keyB = slotKey(b.seat, b.index);
  const known: Record<number, readonly string[]> = {};
  for (const seat of state.seats) {
    const bisher = state.known[seat] ?? [];
    const kannteA = bisher.includes(keyA);
    const kannteB = bisher.includes(keyB);
    // Wer beide kannte, weiss auch nach dem Tausch beide. Wer nur einen
    // kannte, weiss jetzt keinen von beiden mehr.
    const behalten = bisher.filter((k) => k !== keyA && k !== keyB);
    known[seat] = kannteA && kannteB ? [...behalten, keyA, keyB] : behalten;
  }

  return { ...state, hands, known };
}

/**
 * Zug abschliessen und weitergeben - oder abrechnen.
 *
 * Nach dem Cambio-Ruf ist jeder andere noch genau einmal dran. Sobald alle
 * dran waren, wird aufgedeckt.
 */
function zugEnde(state: RoundState): RoundState {
  const zwischen: RoundState = {
    ...state,
    drawn: null,
    pendingAction: null,
    lookedAt: null,
  };

  if (zwischen.caller === null) {
    return { ...zwischen, phase: 'turn', turn: nextSeat(zwischen.seats, zwischen.turn) };
  }

  // Der Ruf selbst zaehlt nicht als Nachzug des Rufers.
  const afterCall =
    zwischen.turn === zwischen.caller
      ? zwischen.afterCall
      : [...zwischen.afterCall, zwischen.turn];

  const offen = zwischen.seats.filter(
    (seat) => seat !== zwischen.caller && !afterCall.includes(seat),
  );

  if (offen.length === 0) {
    return {
      ...zwischen,
      afterCall,
      phase: 'finished',
      result: scoreRound(zwischen.rs, zwischen.seats, zwischen.hands, zwischen.caller),
    };
  }

  return {
    ...zwischen,
    afterCall,
    phase: 'turn',
    turn: nextSeat(zwischen.seats, zwischen.turn),
  };
}
