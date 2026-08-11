/**
 * Rundenablauf-Maschine.
 *
 * Der Automat ist die EINZIGE Stelle, die Zustand aendert. Er nimmt eine
 * Aktion entgegen und gibt einen neuen Zustand zurueck. Keine Seiteneffekte,
 * kein Zufall ausser dem Seed.
 *
 * Jede Aktion wird hier validiert, auch wenn der Client sie schon geprueft hat.
 * Der Server ist die einzige Wahrheit.
 *
 * Ablauf:
 *   vorbehalt -> (armutExchange) -> playing -> finished
 *                                          \-> redeal (Schmeissen, Armut ohne Abnehmer)
 *
 * Schmeissen ist ein Vorbehalt in der normalen Abfrage und keine eigene Phase.
 */

import { type Card, isClubQueen, sumValues } from './cards.js';
import { type Seed, deal } from './deal.js';
import {
  type CardOrder,
  type GameType,
  buildOrder,
  detectSchweinchen,
  isTrump,
  legalCards,
  servingSuit,
} from './order.js';
import type { RuleSet, SoloKind } from './ruleset.js';
import { resolveTrick, type PlayedCard } from './trick.js';
import {
  type AbsageLevel,
  type Announcements,
  type Party,
  type RoundResult,
  type TrickRecord,
  NO_ANNOUNCEMENTS,
  scoreRound,
} from './scoring.js';
import {
  checkPflichtansage,
  mayAnnounce,
  nextOpenLevel,
  type PflichtansageReason,
} from './pflichtansage.js';
import { type VorbehaltKind, resolveVorbehalte } from './vorbehalte.js';
import { canAnnounceArmut, handoverSize } from './armut.js';
import { schmeissOption } from './schmeiss.js';
import { resolveHochzeit } from './hochzeit.js';

export type RoundPhase =
  | 'vorbehalt'
  | 'armutExchange'
  | 'playing'
  | 'finished'
  | 'redeal';

export interface VorbehaltEntry {
  readonly seat: number;
  readonly kind: VorbehaltKind | null;
  readonly solo?: SoloKind;
}

/**
 * Wie ein Vorbehalt fremden Sitzen WAEHREND der Abfrage gezeigt wird: Ob
 * jemand "gesund" ist oder einen Vorbehalt hat, hoert man am Tisch sofort —
 * WELCHEN aber nicht. `'verdeckt'` steht fuer "hat einen Vorbehalt, Art noch
 * geheim". Erst wenn alle erklaert haben, wird die Art offengelegt. Ohne das
 * verriete ein frueh angesagtes Solo/Hochzeit einem noch unentschlossenen
 * Solisten, wer was auf der Hand hat.
 */
export interface SichtbarerVorbehalt {
  readonly seat: number;
  readonly kind: VorbehaltKind | 'verdeckt' | null;
  readonly solo?: SoloKind;
}

/**
 * Wer was angesagt hat, in der Reihenfolge der Ansagen.
 *
 * Die Announcements-Struktur haelt nur fest, OB Re und Kontra gefallen
 * sind — nicht, wer sie gesagt hat. Am Tisch hoert das aber jeder, und
 * ohne diese Angabe kann die Oberflaeche eine Ansage weder anzeigen noch
 * dem Ansagenden zuordnen.
 */
export interface AnsageEntry {
  readonly seat: number;
  readonly level: AbsageLevel;
}

export interface ArmutStage {
  readonly seat: number;
  /** Sitze, die bereits abgelehnt haben, in Reihenfolge der Abfrage. */
  readonly declined: readonly number[];
  readonly partnerSeat: number | null;
  /** Vom Ansager abgegebene Karten. Null, solange er noch nicht abgegeben hat. */
  readonly given: readonly Card[] | null;
  readonly handoverDone: boolean;
  readonly returnedTrumps: number | null;
}

export interface PendingPflichtansage {
  readonly seat: number;
  readonly trickPoints: number;
  readonly canDecline: boolean;
  /**
   * Woher die Pflicht kommt. Die Oberflaeche benennt damit den Grund — "30
   * Augen im ersten Stich" ist etwas anderes als "du haeltst die Schweine",
   * und nur die Stich-Pflicht verlaengert die Kette auf den zweiten Stich.
   */
  readonly reason: PflichtansageReason;
}

export interface RoundOptions {
  /** Bock-Multiplikator dieser Runde, von der Partie-Maschine gesetzt. */
  readonly multiplier?: number;
  /** Sitz, der vorgefuehrt wird: er MUSS ein Solo ansagen. */
  readonly forcedSoloSeat?: number | null;
  /** Sitze, die in dieser Partie bereits ein Solo gespielt haben. */
  readonly soloPlayed?: readonly number[];
}

export interface RoundState {
  readonly rs: RuleSet;
  readonly seed: Seed;
  readonly multiplier: number;
  readonly forcedSoloSeat: number | null;
  readonly soloPlayed: readonly number[];
  /** Sitze der vier aktiven Spieler, in Spielreihenfolge. */
  readonly seats: readonly number[];
  readonly vorhand: number;

  readonly phase: RoundPhase;
  readonly hands: Readonly<Record<number, readonly Card[]>>;
  readonly gameType: GameType;
  readonly order: CardOrder;
  /** Aktuelle Re-Partei. Bei ungeklaerter Hochzeit nur die Braut. */
  readonly reSeats: readonly number[];

  readonly vorbehalte: readonly VorbehaltEntry[];
  readonly armut: ArmutStage | null;
  readonly hochzeitBride: number | null;
  readonly hochzeitResolved: boolean;
  /** Stille Hochzeit: ein Spieler haelt beide Kreuz-Damen ohne Ansage. */
  readonly stilleHochzeit: boolean;

  readonly turn: number;
  readonly currentTrick: readonly PlayedCard[];
  readonly tricks: readonly TrickRecord[];
  readonly cardsPlayed: Readonly<Record<number, number>>;

  readonly announcements: Announcements;
  /** Protokoll der Ansagen mit Sitz, fuer Anzeige und Zuordnung. */
  readonly ansagen: readonly AnsageEntry[];
  readonly pendingPflichtansage: PendingPflichtansage | null;
  /**
   * Im Bezugsstich ist eine Pflicht- oder eine zugestimmte moralische Ansage
   * zustande gekommen. Nur dann wird auch der Stich danach geprueft.
   */
  readonly pflichtansageKette: boolean;
  /**
   * Der Bezugsstich der Pflichtansage.
   *
   * Normalerweise der erste Stich. Bei einer Hochzeit dagegen der
   * Klaerungsstich: Vorher stehen die Parteien nicht fest, und eine Pflicht
   * ohne bekannte Partei waere nicht zuzuordnen. Weil die Klaerung bis zum
   * dritten Stich dauern kann, ist die Nummer nicht vorhersagbar und muss
   * mitgeschrieben werden — an ihr haengt, welcher Stich als naechster zaehlt.
   */
  readonly pflichtansageRefTrick: number | null;
  /**
   * Weitere offene Pflichten hinter der sichtbaren.
   *
   * Armut und Schweine schlagen beide vor dem ersten Stich zu, es koennen also
   * zwei Pflichten gleichzeitig offen sein. Sichtbar ist immer nur der Kopf
   * (`pendingPflichtansage`) — Protokoll, Adapter und Client bleiben dadurch
   * unveraendert und sehen weiter genau eine Abfrage auf einmal.
   */
  readonly pflichtansageWarteschlange: readonly PendingPflichtansage[];

  readonly result: RoundResult | null;
  readonly triggersBock: boolean;
  readonly schweinchen: Readonly<Record<number, boolean>>;
}

export type RoundAction =
  | { type: 'vorbehalt'; seat: number; kind: VorbehaltKind | null; solo?: SoloKind }
  | { type: 'armutAccept'; seat: number }
  | { type: 'armutDecline'; seat: number }
  | { type: 'armutHandover'; seat: number; cards: readonly number[] }
  | { type: 'armutReturn'; seat: number; cards: readonly number[] }
  | { type: 'playCard'; seat: number; cardId: number }
  | { type: 'announce'; seat: number; level: AbsageLevel }
  | { type: 'confirmPflichtansage'; seat: number; accept: boolean };

export class RuleViolation extends Error {}

function fail(msg: string): never {
  throw new RuleViolation(msg);
}

function nextSeat(state: RoundState, seat: number): number {
  const i = state.seats.indexOf(seat);
  return state.seats[(i + 1) % state.seats.length];
}

function seatOrderFrom(
  seats: readonly number[],
  start: number,
): readonly number[] {
  const i = seats.indexOf(start);
  return [...seats.slice(i), ...seats.slice(0, i)];
}

// --- Aufbau -----------------------------------------------------------------

export function createRound(
  rs: RuleSet,
  seats: readonly number[],
  vorhand: number,
  seed: Seed,
  opts: RoundOptions = {},
): RoundState {
  if (seats.length !== 4) fail('Eine Runde wird immer zu viert gespielt');

  const dealt = deal(rs, seed);
  const hands: Record<number, readonly Card[]> = {};
  seatOrderFrom(seats, vorhand).forEach((seat, i) => {
    hands[seat] = dealt.hands[i];
  });

  const gameType: GameType = { kind: 'normal' };
  const schweinchen: Record<number, boolean> = {};
  for (const seat of seats) {
    schweinchen[seat] = detectSchweinchen(hands[seat], rs, gameType).schweinchen;
  }

  return {
    rs,
    seed,
    multiplier: opts.multiplier ?? 1,
    forcedSoloSeat: opts.forcedSoloSeat ?? null,
    soloPlayed: opts.soloPlayed ?? [],
    seats,
    vorhand,
    phase: 'vorbehalt',
    hands,
    gameType,
    order: buildOrder(gameType, rs),
    reSeats: [],
    vorbehalte: [],
    ansagen: [],
    armut: null,
    hochzeitBride: null,
    hochzeitResolved: false,
    stilleHochzeit: false,
    turn: vorhand,
    currentTrick: [],
    tricks: [],
    cardsPlayed: Object.fromEntries(seats.map((s) => [s, 0])),
    announcements: { ...NO_ANNOUNCEMENTS },
    pendingPflichtansage: null,
    pflichtansageKette: false,
    pflichtansageRefTrick: null,
    pflichtansageWarteschlange: [],
    result: null,
    triggersBock: false,
    schweinchen,
  };
}

// --- Zulaessige Vorbehalte --------------------------------------------------

export function allowedVorbehalte(
  state: RoundState,
  seat: number,
): VorbehaltKind[] {
  const { rs } = state;
  // Wird ein Sitz vorgefuehrt, bleibt ihm nur das Solo.
  if (state.forcedSoloSeat !== null) {
    return state.forcedSoloSeat === seat ? ['solo'] : [];
  }
  const hand = state.hands[seat];
  const out: VorbehaltKind[] = [];

  if (rs.solos.length > 0) out.push('solo');
  if (schmeissOption(hand, rs).allowed) out.push('schmeiss');
  if (rs.armut && canAnnounceArmut(hand, buildOrder({ kind: 'normal' }, rs))) {
    out.push('armut');
  }
  if (rs.hochzeit && hand.filter(isClubQueen).length === 2) out.push('hochzeit');

  return out;
}

// --- Reducer ----------------------------------------------------------------

export function apply(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case 'vorbehalt':
      return applyVorbehalt(state, action);
    case 'armutAccept':
    case 'armutDecline':
      return applyArmutResponse(state, action);
    case 'armutHandover':
      return applyArmutHandover(state, action);
    case 'armutReturn':
      return applyArmutReturn(state, action);
    case 'playCard':
      return applyPlayCard(state, action);
    case 'announce':
      return applyAnnounce(state, action);
    case 'confirmPflichtansage':
      return applyPflichtansage(state, action);
    default:
      // Ohne diesen Zweig gab die Funktion bei einer erfundenen Aktion
      // stillschweigend undefined zurueck; der Fehler tauchte erst eine
      // Ebene hoeher als TypeError auf, weit weg von der Ursache.
      fail('Unbekannte Aktion');
  }
}

/** Sitz, der als Naechstes eine Vorbehaltsantwort geben muss. */
export function vorbehaltTurn(state: RoundState): number | null {
  if (state.phase !== 'vorbehalt') return null;
  const asked = new Set(state.vorbehalte.map((v) => v.seat));

  // Wird vorgefuehrt, steht die Spielart bereits fest: Der Vorgefuehrte MUSS
  // ein Solo ansagen, und allen anderen bietet allowedVorbehalte nichts an -
  // kein Solo, kein Schmeissen, keine Armut, keine Hochzeit. Sie trotzdem der
  // Reihe nach zu fragen ist eine Frage ohne Antwortmoeglichkeit: Sie koennten
  // nur passen, und das aendert nichts. Also wird nur der Vorgefuehrte gefragt.
  if (state.forcedSoloSeat !== null) {
    return asked.has(state.forcedSoloSeat) ? null : state.forcedSoloSeat;
  }

  for (const seat of seatOrderFrom(state.seats, state.vorhand)) {
    if (!asked.has(seat)) return seat;
  }
  return null;
}

function applyVorbehalt(
  state: RoundState,
  a: Extract<RoundAction, { type: 'vorbehalt' }>,
): RoundState {
  if (state.phase !== 'vorbehalt') fail('Keine Vorbehaltsabfrage aktiv');
  if (vorbehaltTurn(state) !== a.seat) fail('Sitz ist nicht an der Reihe');

  if (state.forcedSoloSeat === a.seat && a.kind !== 'solo') {
    fail('Vorgefuehrter Spieler muss ein Solo ansagen');
  }
  if (a.kind !== null) {
    if (!allowedVorbehalte(state, a.seat).includes(a.kind)) {
      fail(`Vorbehalt ${a.kind} ist fuer diesen Sitz nicht zulaessig`);
    }
    if (a.kind === 'solo') {
      if (!a.solo) fail('Solo ohne Solovariante');
      if (!state.rs.solos.includes(a.solo)) fail('Solovariante nicht aktiviert');
    }
  }

  const vorbehalte = [...state.vorbehalte, { seat: a.seat, kind: a.kind, solo: a.solo }];
  const next = { ...state, vorbehalte };

  return vorbehaltTurn(next) === null ? resolveVorbehaltPhase(next) : next;
}

function resolveVorbehaltPhase(state: RoundState): RoundState {
  const claims = state.vorbehalte
    .filter((v): v is VorbehaltEntry & { kind: VorbehaltKind } => v.kind !== null)
    .map((v) => ({ seat: v.seat, kind: v.kind }));

  const winner = resolveVorbehalte(claims, state.seats, state.vorhand);

  if (!winner) return startNormalGame(state);

  switch (winner.kind) {
    case 'schmeiss':
      return {
        ...state,
        phase: 'redeal',
        triggersBock: state.rs.schmeissConsequence === 'redealAndBock',
      };

    case 'solo': {
      const entry = state.vorbehalte.find((v) => v.seat === winner.seat)!;
      const gameType: GameType = { kind: 'solo', solo: entry.solo! };
      const order = buildOrder(gameType, state.rs, schweinCtx(state, winner.seat, gameType));
      return mitRundenbeginnPflichten({
        ...state,
        phase: 'playing',
        gameType,
        order,
        reSeats: [winner.seat],
        turn: soloLead(state, winner.seat),
      });
    }

    case 'armut':
      return {
        ...state,
        phase: 'armutExchange',
        armut: {
          seat: winner.seat,
          declined: [],
          partnerSeat: null,
          given: null,
          handoverDone: false,
          returnedTrumps: null,
        },
      };

    case 'hochzeit': {
      const gameType: GameType = { kind: 'hochzeit' };
      // Schweinchen wirken auf die ganze Runde, nicht nur bei der Braut. Den
      // TATSAECHLICHEN Halter suchen (wie in startNormalGame) — sonst bleibt
      // das Karo-Ass eines Nicht-Braut-Halters ein niedriger Trumpf, obwohl
      // „Schweine" angezeigt wird: die Faeuste stechen dann nicht, die Anzeige
      // verspricht eine Wirkung, die es nicht gibt. Die Hochzeit nutzt die
      // normale Trumpfordnung, deshalb ist state.schweinchen (bei Rundenbeginn
      // im Normalspiel erkannt) hier gueltig.
      const holder = state.seats.find((s) => state.schweinchen[s]);
      const ctx = holder !== undefined ? schweinCtx(state, holder, gameType) : {};
      return mitRundenbeginnPflichten({
        ...state,
        phase: 'playing',
        gameType,
        order: buildOrder(gameType, state.rs, ctx),
        reSeats: [winner.seat],
        hochzeitBride: winner.seat,
        hochzeitResolved: false,
        turn: state.vorhand,
      });
    }
  }
}

/**
 * Pflichten, die schon vor dem ersten Stich feststehen: Armut und Schweine.
 *
 * Beide haengen am TATSAECHLICH GESPIELTEN Spieltyp, nicht an einer Ansage.
 * Sagt einer Hochzeit und einer Armut an, wird Armut gespielt — der
 * Hochzeit-Ansager spielt seine Hochzeit gar nicht und bekommt deshalb keine
 * Pflicht. Genau dieser Fehler ist damit ausgeschlossen: Hier steht nur, was
 * die Runde geworden ist.
 *
 * Die Hochzeit fehlt in dieser Liste mit Absicht — sie loest erst am
 * Klaerungsstich aus, weil vorher die Parteien nicht feststehen.
 */
function mitRundenbeginnPflichten(state: RoundState): RoundState {
  if (!state.rs.pflichtansage) return state;

  let next = state;
  if (state.rs.pflichtansageSchweine) {
    for (const seat of state.seats) {
      if (state.schweinchen[seat]) next = pflichtEinreihen(next, seat, 'schweine');
    }
  }
  if (state.rs.pflichtansageArmut && state.armut) {
    next = pflichtEinreihen(next, state.armut.seat, 'armut');
  }
  return next;
}

/**
 * Haengt eine Pflicht an. Ist noch keine offen, wird sie sofort sichtbar,
 * sonst wartet sie hinter der laufenden.
 *
 * Kein `canDecline`: Diese Pflichten haengen nicht an einer Augenzahl, sondern
 * an einer Tatsache auf der Hand. Es gibt keine moralische Zwischenstufe, an
 * der man abwaegen koennte.
 */
function pflichtEinreihen(
  state: RoundState,
  seat: number,
  reason: PflichtansageReason,
): RoundState {
  if (nextOpenLevel(state.announcements, partyOf(state, seat)) === null) return state;

  const entry: PendingPflichtansage = {
    seat,
    trickPoints: 0,
    canDecline: false,
    reason,
  };
  return state.pendingPflichtansage === null
    ? { ...state, pendingPflichtansage: entry }
    : {
        ...state,
        pflichtansageWarteschlange: [...state.pflichtansageWarteschlange, entry],
      };
}

function schweinCtx(state: RoundState, seat: number, gameType: GameType) {
  const status = detectSchweinchen(state.hands[seat], state.rs, gameType);
  return {
    schweinchenActive: status.schweinchen,
    superSchweinActive: status.superschwein,
  };
}

/**
 * Wer spielt bei einem Solo aus?
 *
 * Das ERSTE Solo eines Spielers ist sein Pflichtsolo und hat immer Aufspiel.
 * Jedes weitere ist ein Lustsolo und kommt nur raus, wenn der Regelsatz das
 * vorsieht.
 */
function soloLead(state: RoundState, soloSeat: number): number {
  const isPflichtsolo =
    state.rs.pflichtsolo && !state.soloPlayed.includes(soloSeat);
  if (isPflichtsolo) return soloSeat;
  return state.rs.soloLeadsOut ? soloSeat : state.vorhand;
}

function startNormalGame(state: RoundState): RoundState {
  const reSeats = state.seats.filter(
    (s) => state.hands[s].some(isClubQueen),
  );
  // Haelt ein Spieler beide Kreuz-Damen und sagt nichts an, ist das eine
  // stille Hochzeit: er spielt allein und wird wie ein Solo gewertet.
  const stille = reSeats.length === 1;

  // Schweinchen des Spielers, der sie haelt, wirken auf die ganze Runde.
  const holder = state.seats.find((s) => state.schweinchen[s]);
  const ctx = holder !== undefined
    ? schweinCtx(state, holder, state.gameType)
    : {};

  return mitRundenbeginnPflichten({
    ...state,
    phase: 'playing',
    reSeats,
    stilleHochzeit: stille,
    order: buildOrder(state.gameType, state.rs, ctx),
    turn: state.vorhand,
  });
}

// --- Armut ------------------------------------------------------------------

export function armutTurn(state: RoundState): number | null {
  if (state.phase !== 'armutExchange' || !state.armut) return null;
  if (state.armut.partnerSeat !== null) return null;
  const declined = new Set(state.armut.declined);
  for (const seat of seatOrderFrom(state.seats, state.vorhand)) {
    if (seat === state.armut.seat) continue;
    if (!declined.has(seat)) return seat;
  }
  return null;
}

function applyArmutResponse(
  state: RoundState,
  a: Extract<RoundAction, { type: 'armutAccept' | 'armutDecline' }>,
): RoundState {
  if (!state.armut) fail('Keine Armut aktiv');
  if (armutTurn(state) !== a.seat) fail('Sitz ist nicht an der Reihe');

  if (a.type === 'armutAccept') {
    return { ...state, armut: { ...state.armut, partnerSeat: a.seat } };
  }

  const declined = [...state.armut.declined, a.seat];
  const next = { ...state, armut: { ...state.armut, declined } };
  // Niemand hat angenommen: es wird neu gegeben.
  return armutTurn(next) === null ? { ...next, phase: 'redeal' } : next;
}

/**
 * Abgabe durch den Ansager.
 *
 * Bei vorhandenen Truempfen muessen ALLE Truempfe abgegeben werden, es gibt
 * dort also keine Wahl. Nur ohne Trumpf waehlt der Ansager drei Karten frei.
 */
function applyArmutHandover(
  state: RoundState,
  a: Extract<RoundAction, { type: 'armutHandover' }>,
): RoundState {
  const armut = state.armut;
  if (!armut || armut.partnerSeat === null) fail('Keine angenommene Armut');
  if (armut.given !== null) fail('Abgabe bereits erfolgt');
  if (a.seat !== armut.seat) fail('Nur der Ansager gibt ab');

  const poorHand = state.hands[armut.seat];
  const size = handoverSize(poorHand, state.order);
  if (a.cards.length !== size) fail(`Es muessen genau ${size} Karten abgegeben werden`);

  // Jede Karte hoechstens einmal. Die Laengenpruefung zaehlt Eintraege, das
  // Entnehmen arbeitet ueber IDs - mit [7,7,7] verlor der Ansager EINE Karte,
  // der Partner bekam DREI Kopien, und die Augenrechnung der Runde war
  // manipuliert.
  if (new Set(a.cards).size !== a.cards.length) fail('Jede Karte nur einmal');

  const given = a.cards.map((id) => {
    const card = poorHand.find((c) => c.id === id);
    if (!card) fail('Karte nicht auf der Hand des Ansagers');
    return card;
  });

  const trumps = poorHand.filter((c) => isTrump(c, state.order));
  if (trumps.length > 0) {
    const givenIds = new Set(given.map((c) => c.id));
    if (!trumps.every((c) => givenIds.has(c.id))) {
      fail('Es muessen alle Truempfe abgegeben werden');
    }
  }

  const giveIds = new Set(given.map((c) => c.id));
  const hands = {
    ...state.hands,
    [armut.seat]: poorHand.filter((c) => !giveIds.has(c.id)),
    [armut.partnerSeat]: [...state.hands[armut.partnerSeat], ...given],
  };

  return { ...state, hands, armut: { ...armut, given } };
}

/** Rueckgabe durch den Annehmer: beliebige Karten, gleiche Anzahl. */
function applyArmutReturn(
  state: RoundState,
  a: Extract<RoundAction, { type: 'armutReturn' }>,
): RoundState {
  const armut = state.armut;
  if (!armut || armut.partnerSeat === null) fail('Keine angenommene Armut');
  if (armut.given === null) fail('Abgabe steht noch aus');
  if (armut.handoverDone) fail('Rueckgabe bereits erfolgt');
  if (a.seat !== armut.partnerSeat) fail('Nur der Annehmer gibt zurueck');

  const size = armut.given.length;
  if (a.cards.length !== size) fail(`Es muessen genau ${size} Karten zurueckgegeben werden`);

  // Jede Karte hoechstens einmal. Die Laengenpruefung zaehlt Eintraege, das
  // Entnehmen arbeitet ueber IDs - mit [7,7,7] verlor der Ansager EINE Karte,
  // der Partner bekam DREI Kopien, und die Augenrechnung der Runde war
  // manipuliert.
  if (new Set(a.cards).size !== a.cards.length) fail('Jede Karte nur einmal');

  const partnerHand = state.hands[armut.partnerSeat];
  const back = a.cards.map((id) => {
    const card = partnerHand.find((c) => c.id === id);
    if (!card) fail('Karte nicht auf der Hand des Annehmers');
    return card;
  });

  const backIds = new Set(back.map((c) => c.id));
  const hands = {
    ...state.hands,
    [armut.partnerSeat]: partnerHand.filter((c) => !backIds.has(c.id)),
    [armut.seat]: [...state.hands[armut.seat], ...back],
  };

  return mitRundenbeginnPflichten({
    ...state,
    phase: 'playing',
    hands,
    reSeats: [armut.seat, armut.partnerSeat],
    turn: state.vorhand,
    armut: {
      ...armut,
      handoverDone: true,
      returnedTrumps: back.filter((c) => isTrump(c, state.order)).length,
    },
  });
}

// --- Spielphase -------------------------------------------------------------

function applyPlayCard(
  state: RoundState,
  a: Extract<RoundAction, { type: 'playCard' }>,
): RoundState {
  if (state.phase !== 'playing') fail('Es wird gerade nicht gespielt');
  if (state.pendingPflichtansage) fail('Pflichtansage steht noch aus');
  if (state.turn !== a.seat) fail('Sitz ist nicht an der Reihe');

  const hand = state.hands[a.seat];
  const card = hand.find((c) => c.id === a.cardId);
  if (!card) fail('Karte nicht auf der Hand');

  const leadCard = state.currentTrick[0]?.card ?? null;
  const legal = legalCards(hand, state.order, leadCard);
  if (!legal.some((c) => c.id === card.id)) fail('Bedienzwang verletzt');

  const hands = { ...state.hands, [a.seat]: hand.filter((c) => c.id !== card.id) };
  const currentTrick = [...state.currentTrick, { card, seat: a.seat }];
  const cardsPlayed = { ...state.cardsPlayed, [a.seat]: state.cardsPlayed[a.seat] + 1 };

  if (currentTrick.length < 4) {
    return {
      ...state,
      hands,
      currentTrick,
      cardsPlayed,
      turn: nextSeat(state, a.seat),
    };
  }

  const res = resolveTrick(currentTrick, state.order, {
    secondDulleBeatsFirst: state.rs.secondDulleBeatsFirst,
  });
  const trick: TrickRecord = { played: currentTrick, winnerSeat: res.winnerSeat };
  const tricks = [...state.tricks, trick];

  let next: RoundState = {
    ...state,
    hands,
    cardsPlayed,
    currentTrick: [],
    tricks,
    turn: res.winnerSeat,
  };

  /*
   * Ob die Hochzeit GERADE JETZT geklaert wurde, laesst sich nur am Uebergang
   * ablesen. `hochzeitResolved` allein taugt nicht: Das Flag bleibt bis zum
   * Rundenende wahr, und genau daran hing der Fehler, dass die Pflichtansage
   * bei jedem weiteren fetten Stich erneut ausloeste.
   */
  const warGeklaert = next.hochzeitResolved;
  next = maybeResolveHochzeit(next);
  const jetztGeklaert = !warGeklaert && next.hochzeitResolved;
  next = maybeCheckPflichtansage(next, trick, tricks.length, jetztGeklaert);

  const done = state.seats.every((s) => next.hands[s].length === 0);
  return done ? finish(next) : next;
}

function maybeResolveHochzeit(state: RoundState): RoundState {
  if (state.gameType.kind !== 'hochzeit') return state;
  if (state.hochzeitResolved) return state;
  if (state.hochzeitBride === null) return state;

  const limit = state.rs.hochzeitClarifyTricks;
  const out = resolveHochzeit(state.tricks, state.hochzeitBride, state.rs);

  if (out.partnerSeat !== null) {
    return {
      ...state,
      hochzeitResolved: true,
      reSeats: [state.hochzeitBride, out.partnerSeat],
    };
  }
  // Frist abgelaufen, ungeklaert: die Braut spielt allein.
  if (state.tricks.length >= limit) {
    return { ...state, hochzeitResolved: true, reSeats: [state.hochzeitBride] };
  }
  return state;
}

function maybeCheckPflichtansage(
  state: RoundState,
  trick: TrickRecord,
  trickNumber: number,
  hochzeitJetztGeklaert: boolean,
): RoundState {
  if (!state.rs.pflichtansage) return state;

  /*
   * Bezugsstich ist der erste Stich — bei einer Hochzeit dagegen der
   * Klaerungsstich. Der Grund liegt nicht in der Augenzahl, sondern in den
   * Parteien: Bis zur Klaerung ist nicht bekannt, wen eine Pflicht ueberhaupt
   * trifft. Weil die Klaerung bis zum dritten Stich dauern kann, ist die Nummer
   * nicht vorhersagbar, und der Stich DANACH haengt an ihr statt an einer
   * festen Zwei.
   *
   * Geprueft wird ausschliesslich der Bezugsstich und der eine danach — und der
   * nur, wenn im Bezugsstich wirklich angesagt wurde. Vorher stand hier
   * `hochzeitResolved`, das bis zum Rundenende wahr bleibt; jeder weitere fette
   * Stich loeste deshalb erneut aus.
   */
  const istHochzeit = state.gameType.kind === 'hochzeit';
  const istBezug = istHochzeit ? hochzeitJetztGeklaert : trickNumber === 1;
  const istFolgestich =
    state.rs.pflichtansageFolge &&
    state.pflichtansageKette &&
    state.pflichtansageRefTrick !== null &&
    trickNumber === state.pflichtansageRefTrick + 1;
  if (!istBezug && !istFolgestich) return state;

  // Der Bezugsstich wird auch dann vermerkt, wenn er zu mager fuer eine Pflicht
  // ist: Ohne ihn waere spaeter nicht zu sagen, welcher Stich der naechste war.
  const merk: RoundState = istBezug
    ? { ...state, pflichtansageRefTrick: trickNumber }
    : state;

  const check = checkPflichtansage(merk.rs, trick);
  if (check.kind === 'none' || check.seat === null) return merk;

  // Steht die Partei schon auf schwarz, ist nichts mehr zu fordern.
  const party = partyOf(merk, check.seat);
  if (nextOpenLevel(merk.announcements, party) === null) return merk;

  return {
    ...merk,
    pendingPflichtansage: {
      seat: check.seat,
      trickPoints: check.trickPoints,
      canDecline: check.canDecline,
      reason: istHochzeit && istBezug ? 'hochzeit' : 'trick',
    },
  };
}

function partyOf(state: RoundState, seat: number): Party {
  return state.reSeats.includes(seat) ? 're' : 'kontra';
}

function applyAnnounce(
  state: RoundState,
  a: Extract<RoundAction, { type: 'announce' }>,
): RoundState {
  if (state.phase !== 'playing') fail('Ansagen nur waehrend des Spiels');
  if (!state.rs.announcements) fail('Ansagen sind deaktiviert');
  if (a.level > 0 && !state.rs.absagen) fail('Absagen sind deaktiviert');
  if (!mayAnnounce(a.level, state.cardsPlayed[a.seat])) fail('Ansagefrist abgelaufen');

  const party = partyOf(state, a.seat);
  return setAnnouncement(state, a.seat, party, a.level);
}

function setAnnouncement(
  state: RoundState,
  seat: number,
  party: Party,
  level: AbsageLevel,
): RoundState {
  const ann = { ...state.announcements };

  /*
   * Die Staffel wird von unten geklettert: Erst Re beziehungsweise Kontra,
   * dann Keine 90 und so weiter.
   *
   * Nach dem offiziellen Regelwerk schliesst eine hoehere Ansage die
   * niedrigeren ein - "Keine 90" ohne vorheriges Re waere dort erlaubt und
   * zaehlte als beides. Hier gilt es bewusst nicht: Wer "Keine 90" sagen
   * will, muss vorher Re gesagt haben. Das haelt die Ansagen fuer alle am
   * Tisch nachvollziehbar und macht die Fristen zu echten Entscheidungen.
   */
  /*
   * Re gehoert der Partei, nicht dem Sitz: Steht es, kann der Partner es nicht
   * noch einmal sagen. Vorher ging das — zwei Spieler sagten Re, die Anzeige
   * zeigte es zweimal, und der Spielwert verdoppelte sich trotzdem nur einmal.
   * Wer nachlegen will, nimmt die naechste Stufe.
   */
  if (party === 're') {
    if (level === 0 && ann.re) fail('Re steht schon');
    if (level > 0 && !ann.re) fail('Erst Re, dann eine Absage');
    ann.re = true;
    if (level > 0) {
      if (level > ann.reAbsage + 1) fail('Absagestufe muss aufeinander aufbauen');
      ann.reAbsage = level;
    }
  } else {
    if (level === 0 && ann.kontra) fail('Kontra steht schon');
    if (level > 0 && !ann.kontra) fail('Erst Kontra, dann eine Absage');
    ann.kontra = true;
    if (level > 0) {
      if (level > ann.kontraAbsage + 1) fail('Absagestufe muss aufeinander aufbauen');
      ann.kontraAbsage = level;
    }
  }

  return {
    ...state,
    announcements: ann,
    ansagen: [...state.ansagen, { seat, level }],
  };
}

function applyPflichtansage(
  state: RoundState,
  a: Extract<RoundAction, { type: 'confirmPflichtansage' }>,
): RoundState {
  const pending = state.pendingPflichtansage;
  if (!pending) fail('Keine Pflichtansage offen');
  if (pending.seat !== a.seat) fail('Falscher Sitz');
  if (!a.accept && !pending.canDecline) fail('Diese Ansage ist verpflichtend');

  /*
   * Verlaengert wird die Kette nur von einer ZUGESTIMMTEN Pflicht am
   * Bezugsstich — also aus dem Stich selbst oder aus der Hochzeit, die den
   * Bezugsstich ja verschiebt. Armut und Schweine schlagen vor dem ersten Stich
   * zu und verschieben nichts: Sie heben die Stufe, aber der Bezugsstich bleibt
   * der erste. Wer eine moralische Pflicht ablehnt, hat nichts angesagt — dann
   * gibt es auch keinen Grund, den Stich danach noch zu pruefen.
   */
  const amBezugsstich =
    pending.reason === 'trick' || pending.reason === 'hochzeit';
  const kette = state.pflichtansageKette || (a.accept && amBezugsstich);

  // Die naechste wartende Pflicht rueckt nach und wird damit sichtbar.
  const [naechste, ...rest] = state.pflichtansageWarteschlange;
  const cleared: RoundState = {
    ...state,
    pendingPflichtansage: naechste ?? null,
    pflichtansageWarteschlange: rest,
    pflichtansageKette: kette,
  };
  if (!a.accept) return cleared;

  /*
   * Die Pflicht ist die naechste OFFENE Stufe der Partei, nicht stur Re.
   *
   * Vorher stand hier eine feste 0. Hatte die Partei schon Re gesagt, lief die
   * Pflichtansage damit in "Re steht schon" — die Ansage wurde nicht
   * hochgehandelt, sondern verfiel. Steht die Partei schon auf schwarz, gibt es
   * nichts mehr zu fordern und die Pflicht verfaellt still.
   */
  const party = partyOf(state, a.seat);
  const level = nextOpenLevel(state.announcements, party);
  if (level === null) return cleared;
  return setAnnouncement(cleared, a.seat, party, level);
}

function finish(state: RoundState): RoundState {
  // Stille Hochzeit und ungeklaerte Hochzeit werden wie ein Solo gewertet.
  const aloneSeat =
    state.reSeats.length === 1 ? state.reSeats[0] : null;
  const scoringType: GameType =
    state.gameType.kind === 'solo'
      ? state.gameType
      : aloneSeat !== null
        ? { kind: 'solo', solo: 'suitD' } // Wertungsform, nicht Trumpfordnung
        : state.gameType;

  const result = scoreRound({
    rs: state.rs,
    gameType: scoringType,
    order: state.order,
    reSeats: state.reSeats,
    tricks: state.tricks,
    announcements: state.announcements,
    multiplier: state.multiplier,
  });

  // Eine auf dem letzten Stich sitzengebliebene Pflichtansage ist
  // gegenstandslos: Ansagen sind nach der letzten Karte ohnehin unmoeglich,
  // und die Wertung steht fest. Bliebe sie stehen, hielte sie die
  // Rundenpause auf - currentActor zeigte auf einen Sitz, der nichts mehr
  // tun kann.
  return {
    ...state,
    phase: 'finished',
    pendingPflichtansage: null,
    pflichtansageWarteschlange: [],
    result,
  };
}

// --- Sichtbarkeitsfilter ----------------------------------------------------

/**
 * Reduzierte Sicht fuer einen Sitz. Fremde Handkarten duerfen NIE an den
 * Client gehen, auch nicht versteckt im JSON.
 */
export interface PlayerView {
  readonly seat: number;
  readonly phase: RoundPhase;
  readonly hand: readonly Card[];
  readonly legal: readonly Card[];
  /** Kartenanzahl der Mitspieler, ohne deren Karten. */
  readonly handCounts: Readonly<Record<number, number>>;
  readonly currentTrick: readonly PlayedCard[];
  /** Der letzte abgeschlossene Stich ist immer einsehbar. */
  readonly lastTrick: TrickRecord | null;
  /**
   * Alle abgeschlossenen Stiche der Runde — oeffentliche Information: jede
   * Karte lag beim Legen offen. Der Client zeigt nur den letzten; der
   * kartenzaehlende Genie-Bot braucht die ganze Reihe, um zu wissen, was noch
   * im Spiel ist. Kein Geheimnis wird preisgegeben, nur Gedaechtnis erlaubt.
   */
  readonly alleStiche: readonly TrickRecord[];
  readonly turn: number;
  readonly gameType: GameType;
  readonly order: CardOrder;
  readonly announcements: Announcements;
  /**
   * Wer was gesagt hat — beides oeffentlich, beides am Tisch zu hoeren.
   *
   * `vorbehalte` fuehrt auch das "gesund" (kind null). Ohne diese beiden
   * Listen kann die Oberflaeche eine Ansage niemandem zuordnen: Die
   * Announcements-Struktur haelt nur fest, OB Re gefallen ist.
   */
  readonly vorbehalte: readonly SichtbarerVorbehalt[];
  readonly ansagen: readonly AnsageEntry[];
  /** Eigene Partei. Bei ungeklaerter Hochzeit null. */
  readonly myParty: Party | null;
  /** Oeffentlich bekannte Parteizugehoerigkeit anderer Sitze. */
  readonly knownParties: Readonly<Record<number, Party>>;
  /** Erspielte Augen je Sitz. Leer, wenn die Regel countPoints aus ist. */
  readonly standings: Readonly<Record<number, number>>;
  /**
   * Gewonnene Stiche je Sitz. Anders als die Augen immer gefuellt: Wer wie
   * viele Stiche vor sich liegen hat, sieht am echten Tisch auch jeder.
   */
  readonly trickCounts: Readonly<Record<number, number>>;
  readonly pendingPflichtansage: PendingPflichtansage | null;
  /**
   * Sitze, die die Schweine halten — dauerhaft, nicht als kurze Meldung.
   *
   * Gefuellt nur, wenn der Schweine-Ausloeser aktiv ist. Sonst waere es
   * Geheimwissen: Wer beide Karo-Asse haelt, sagt es ohne diese Regel niemandem.
   * Mit ihr muss er ansagen, der Tisch weiss es also ohnehin — und dann gehoert
   * es an den Sitz und nicht in eine Blase, die nach drei Sekunden weg ist.
   */
  readonly schweineSeats: readonly number[];
  readonly result: RoundResult | null;

  /** Ist dieser Sitz gerade dran? */
  readonly isMyTurn: boolean;
  /** Eigene zulaessige Vorbehalte, leer ausserhalb der Abfrage. */
  readonly allowedVorbehalte: readonly VorbehaltKind[];
  /** Wird dieser Sitz vorgefuehrt und muss ein Solo ansagen? */
  readonly forcedSolo: boolean;
  readonly soloOptions: readonly SoloKind[];
  /**
   * Kartenordnung je waehlbarem Solo — fuer die Vorschau in der
   * Vorbehaltsabfrage.
   *
   * Wer ein Solo antippt, soll seine Hand sofort nach DESSEN Trumpfordnung
   * sortiert sehen, bevor er bestaetigt. Ohne diese Vorschau muss man sich die
   * Umsortierung im Kopf vorstellen, und genau das ist bei Damen- oder
   * Bubensolo die eigentliche Entscheidung.
   *
   * Der Server liefert die Ordnung, nicht der Client: Welche Karte Trumpf ist,
   * entscheidet allein das Spielmodul (`DESIGN.md`, Grundsatz 6). Ein Client,
   * der Solo-Trumpfordnungen selbst nachbaut, waere die zweite Wahrheit.
   *
   * Nur in der Vorbehaltsabfrage gefuellt und nur fuer den Sitz, der dran ist.
   */
  readonly soloVorschau: Readonly<Record<string, CardOrder>>;
  /**
   * Sitze, die ihr Pflichtsolo noch offen haben. Leer, wenn die Regel aus ist.
   *
   * Ohne diese Angabe ist am Tisch nicht zu sehen, wen die Vorfuehrung noch
   * treffen kann — und wer selbst noch dran ist. Die Zahl steht in der Partie,
   * nicht in der Runde; sichtbar war sie bisher nirgends.
   */
  readonly pflichtsoloOffen: readonly number[];
  /**
   * Gerade legale Ansagestufen der eigenen Partei (Re/Kontra = 0, danach die
   * Absagenkette). Leer, wenn Ansagen aus sind, die Frist abgelaufen ist oder
   * die Partei die Stufe schon gesagt hat.
   *
   * Wie `allowedVorbehalte`: Die Legalitaet rechnet der Server in `viewFor`,
   * nicht der Client oder der Bot — beide bilden keine Regel nach (DESIGN.md,
   * Grundsatz 6). Ein Experte-Bot ohne diese Angabe muesste die Ansagefrist
   * selbst nachbauen und wuerfe bei einem Fehler den ganzen Tisch.
   */
  readonly announceOptions: readonly AbsageLevel[];
  /**
   * Ob die Hausregel „zweite Dulle sticht erste" aktiv ist. Der Bot braucht
   * das, um eine gelegte Dulle nicht faelschlich fuer unschlagbar zu halten und
   * um eine gegnerische Dulle mit der eigenen zweiten stechen zu koennen — die
   * Stichauswertung haengt sonst von der Reihenfolge ab, nicht nur vom Rang.
   */
  readonly secondDulleBeatsFirst: boolean;
  /** Eigene Rolle im Armut-Ablauf und was gerade von mir erwartet wird. */
  readonly armut: {
    readonly role: 'poor' | 'candidate' | 'partner' | null;
    readonly awaiting: 'decide' | 'handover' | 'return' | null;
    readonly handoverSize: number;
  };
}

export function viewFor(state: RoundState, seat: number): PlayerView {
  const hand = state.hands[seat] ?? [];
  const leadCard = state.currentTrick[0]?.card ?? null;

  // Zaehlhilfe nur, wenn die Tischregel sie erlaubt. Es ist kein Geheimnis -
  // alle Stiche liegen offen -, aber ohne die Regel soll auch niemand die
  // Rechenarbeit abgenommen bekommen.
  const standings: Record<number, number> = {};
  if (state.rs.countPoints) {
    for (const s of state.seats) standings[s] = 0;
    for (const t of state.tricks) {
      standings[t.winnerSeat] += sumValues(t.played.map((p) => p.card));
    }
  }

  // Stichzahl je Sitz ist immer oeffentlich: Der Stapel liegt am echten
  // Tisch fuer alle sichtbar neben dem Gewinner.
  const trickCounts: Record<number, number> = Object.fromEntries(
    state.seats.map((s) => [s, 0]),
  );
  for (const t of state.tricks) trickCounts[t.winnerSeat] += 1;

  // Oeffentlich ist die Partei nur, wo sie ohnehin sichtbar ist: Solist,
  // geklaerte Hochzeit, Armut-Paar und jeder, der angesagt hat.
  const knownParties: Record<number, Party> = {};
  const reveal = (s: number) => {
    knownParties[s] = state.reSeats.includes(s) ? 're' : 'kontra';
  };
  if (state.gameType.kind === 'solo') state.seats.forEach(reveal);
  if (state.gameType.kind === 'hochzeit' && state.hochzeitResolved) {
    state.seats.forEach(reveal);
  }
  if (state.armut?.handoverDone) {
    reveal(state.armut.seat);
    if (state.armut.partnerSeat !== null) reveal(state.armut.partnerSeat);
  }
  /*
   * Eine gespielte Kreuz-Dame deckt die Partei auf — und zwar dauerhaft.
   *
   * Im Normalspiel ist Re, wer eine Kreuz-Dame haelt. Liegt eine auf dem
   * Tisch, hat es jeder gesehen, und niemand am echten Tisch vergisst das
   * wieder. Vorher stand das nirgends: Die Oberflaeche zeigte die Partei
   * nicht an, und ein Bot konnte sie hoechstens aus dem letzten Stich
   * ablesen und im uebernaechsten wieder vergessen.
   *
   * Das ist keine zusaetzliche Auskunft, sondern eine, die bisher gefehlt
   * hat: gespielte Karten sind oeffentlich.
   */
  if (state.gameType.kind === 'normal') {
    const gelegt = [...state.tricks.flatMap((t) => t.played), ...state.currentTrick];
    for (const p of gelegt) {
      if (isClubQueen(p.card)) reveal(p.seat);
    }
  }
  // Wer "Re" sagt, sagt damit auch, dass er Re ist. Das gilt in jeder
  // Spielart und ist der offenkundigste Fall von oeffentlicher Partei.
  for (const a of state.ansagen) reveal(a.seat);
  if (state.phase === 'finished') state.seats.forEach(reveal);

  const myParty: Party | null =
    state.reSeats.length === 0 ? null : partyOf(state, seat);

  const actor = currentActor(state);
  const isMyTurn = actor === seat;

  // Legale Ansagen der eigenen Partei — dieselbe Frist wie in legalActions des
  // Adapters (mayAnnounce bemisst sie an den eigenen gespielten Karten, nicht
  // am Zugrecht). Hier gerechnet, damit der Bot sie nur ablesen muss.
  const announceOptions: AbsageLevel[] = [];
  if (state.phase === 'playing' && myParty && state.rs.announcements) {
    const own = state.cardsPlayed[seat] ?? 0;
    const made = myParty === 're' ? state.announcements.re : state.announcements.kontra;
    const absage =
      myParty === 're' ? state.announcements.reAbsage : state.announcements.kontraAbsage;
    if (!made && mayAnnounce(0, own)) announceOptions.push(0);
    const next = (absage + 1) as AbsageLevel;
    if (made && state.rs.absagen && next <= 4 && mayAnnounce(next, own)) {
      announceOptions.push(next);
    }
  }

  const a = state.armut;
  let role: 'poor' | 'candidate' | 'partner' | null = null;
  let awaiting: 'decide' | 'handover' | 'return' | null = null;
  let handoverSize = 0;
  if (a) {
    if (a.seat === seat) role = 'poor';
    else if (a.partnerSeat === seat) role = 'partner';
    else if (a.partnerSeat === null) role = 'candidate';

    if (isMyTurn && state.phase === 'armutExchange') {
      if (a.partnerSeat === null) awaiting = 'decide';
      else if (a.given === null) awaiting = 'handover';
      else awaiting = 'return';
    }
    handoverSize =
      a.given !== null
        ? a.given.length
        : role === 'poor'
          ? handoverSizeFor(state, seat)
          : 0;
  }

  return {
    seat,
    phase: state.phase,
    hand,
    legal:
      state.phase === 'playing' && state.turn === seat && !state.pendingPflichtansage
        ? legalCards(hand, state.order, leadCard)
        : [],
    handCounts: Object.fromEntries(
      state.seats.map((s) => [s, state.hands[s].length]),
    ),
    currentTrick: state.currentTrick,
    lastTrick: state.tricks[state.tricks.length - 1] ?? null,
    alleStiche: state.tricks,
    turn: state.turn,
    gameType: state.gameType,
    order: state.order,
    announcements: state.announcements,
    // Waehrend der Vorbehaltsabfrage bleibt die ART fremder Vorbehalte
    // verdeckt und die Schweine ungenannt: Wer ein Solo erwaegt, soll nicht
    // sehen, wer Hochzeit/Armut/Solo hat oder die Karo-Asse haelt. Der eigene
    // Sitz sieht seine eigene Wahl. Sobald alle erklaert haben (Phase nicht
    // mehr 'vorbehalt'), liegt alles offen wie zuvor.
    vorbehalte:
      state.phase === 'vorbehalt'
        ? state.vorbehalte.map((v) =>
            v.seat === seat || v.kind === null
              ? v
              : { seat: v.seat, kind: 'verdeckt' as const },
          )
        : state.vorbehalte,
    ansagen: state.ansagen,
    myParty,
    knownParties,
    standings,
    trickCounts,
    pendingPflichtansage: state.pendingPflichtansage,
    schweineSeats:
      state.rs.pflichtansageSchweine && state.phase !== 'vorbehalt'
        ? state.seats.filter((s) => state.schweinchen[s])
        : [],
    result: state.result,
    isMyTurn,
    allowedVorbehalte:
      state.phase === 'vorbehalt' && isMyTurn ? allowedVorbehalte(state, seat) : [],
    forcedSolo: state.forcedSoloSeat === seat,
    soloOptions: state.rs.solos,
    soloVorschau: soloVorschauFuer(state, seat, isMyTurn),
    pflichtsoloOffen: state.rs.pflichtsolo
      ? state.seats.filter((s) => !state.soloPlayed.includes(s))
      : [],
    announceOptions,
    secondDulleBeatsFirst: state.rs.secondDulleBeatsFirst,
    armut: { role, awaiting, handoverSize },
  };
}

/**
 * Kartenordnung je waehlbarem Solo, fuer die Vorschau vor dem Bestaetigen.
 *
 * Gerechnet wird sie nur in der Vorbehaltsabfrage und nur fuer den Sitz, der
 * dran ist: Sie kostet eine Ordnung je Solovariante, und ausserhalb der Abfrage
 * kann sie niemand brauchen.
 *
 * Die Schweinchen des eigenen Blattes gehen mit ein — sie haengen am Spieltyp,
 * und eine Vorschau, die sie weglaesst, zeigte im Damensolo einen Karo-Ass-Platz
 * an, den es dort nicht gibt.
 */
function soloVorschauFuer(
  state: RoundState,
  seat: number,
  isMyTurn: boolean,
): Record<string, CardOrder> {
  if (state.phase !== 'vorbehalt' || !isMyTurn) return {};

  const out: Record<string, CardOrder> = {};
  for (const solo of state.rs.solos) {
    const gameType: GameType = { kind: 'solo', solo };
    out[solo] = buildOrder(gameType, state.rs, schweinCtx(state, seat, gameType));
  }
  return out;
}

function handoverSizeFor(state: RoundState, seat: number): number {
  return handoverSize(state.hands[seat], state.order);
}

/** Hilfsfunktion fuer Tests und Bots: aktuell zulaessige Aktionen. */
export function currentActor(state: RoundState): number | null {
  if (state.pendingPflichtansage) return state.pendingPflichtansage.seat;
  switch (state.phase) {
    case 'vorbehalt':
      return vorbehaltTurn(state);
    case 'armutExchange': {
      const a = state.armut;
      if (!a) return null;
      if (a.partnerSeat === null) return armutTurn(state);
      return a.given === null ? a.seat : a.partnerSeat;
    }
    case 'playing':
      return state.turn;
    default:
      return null;
  }
}

export { servingSuit };
