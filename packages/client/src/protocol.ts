/**
 * Gegenstueck zum Serverprotokoll.
 *
 * Bewusst als eigene Datei und nicht aus dem Serverpaket importiert: Der
 * Client soll genau die Felder kennen, die er benutzt, und beim Deploy nicht
 * zufaellig mit einer neueren Serverfassung mitwandern. Die Version steht
 * deshalb hier ausgeschrieben.
 */

export const ENVELOPE_VERSION = 1;

/**
 * Protokollversion je Spielmodul, die dieser Client beherrscht. Steigt sie
 * serverseitig um mehr als eine Stufe, weist der Server den Beitritt ab — beim
 * Beitritt, nie mitten in der Partie.
 *
 * Jedes Modul hat seine eigene Version: Ein Zauberer-Update darf einen
 * Doppelkopf-Tisch nicht aussperren.
 */
export const DOPPELKOPF_MODULE_VERSION = 1;
export const WIZARD_MODULE_VERSION = 1;
/**
 * 2 seit dem 9. August 2026: Dieser Client versteht die Zugliste als
 * Ausschnitt ab `abIndex`. Wer die 1 meldet, bekommt vom Server weiter die
 * ganze Liste. Das ist der Grund, warum ein Geraet, das ueber einen Deploy
 * hinweg offen bleibt, nicht auseinanderlaeuft — der Server richtet sich
 * nach dem, was der Client gemeldet hat, nicht nach dem, was er selbst kann.
 */
export const FELDHERR_MODULE_VERSION = 2;

const MODULE_VERSIONS: Record<string, number> = {
  doppelkopf: DOPPELKOPF_MODULE_VERSION,
  wizard: WIZARD_MODULE_VERSION,
  feldherr: FELDHERR_MODULE_VERSION,
};

/** Version fuer den Beitritt. Unbekannte Spiele bekommen die 1. */
export function moduleVersionFor(gameId: string): number {
  return MODULE_VERSIONS[gameId] ?? 1;
}

export interface Card {
  id: number;
  suit: string;
  rank: string;
}

export interface PlayedCard {
  seat: number;
  card: Card;
}

export interface RoundSpecialPoint {
  kind: 'fuchs' | 'karlchen' | 'doppelkopf' | 'charlie' | 'herzdurchlauf';
  party: 're' | 'kontra';
  trickIndex: number;
}

/** Abrechnung einer Doppelkopf-Runde (kommt aus der Engine, wird nur gezeigt). */
export interface RoundResult {
  rePoints: number;
  kontraPoints: number;
  winner: 're' | 'kontra' | null;
  value: number;
  specials: RoundSpecialPoint[];
  scores: Record<number, number>;
  isSolo: boolean;
  soloSeat: number | null;
  /**
   * Der Sieg ist wegen zu niedriger Ansage gedreht worden (Hausregel Feigling).
   * `winner` ist dann NICHT die Partei mit den meisten Augen — ohne diesen
   * Hinweis sieht die Abrechnung wie ein Rechenfehler aus.
   */
  feigling?: boolean;
}

export interface RoundView {
  seat: number;
  phase: string;
  hand: Card[];
  legal: Card[];
  handCounts: Record<number, number>;
  currentTrick: PlayedCard[];
  /** Feldnamen wie in der Engine: `played` und `winnerSeat`. */
  lastTrick: { winnerSeat: number; played: PlayedCard[] } | null;
  turn: number;
  announcements: { re: boolean; kontra: boolean; reAbsage: number; kontraAbsage: number };
  /**
   * Wer was gesagt hat. Beides öffentlich und am Tisch zu hören — die
   * `announcements` oben halten nur fest, OB Re gefallen ist, nicht von wem.
   * `vorbehalte` führt auch das „gesund" mit `kind: null`.
   */
  vorbehalte: { seat: number; kind: string | null; solo?: string }[];
  ansagen: { seat: number; level: number }[];
  myParty: string | null;
  /** Öffentlich bekannte Parteizugehörigkeit, im Solo verrät sie den Solisten. */
  knownParties: Record<number, string>;
  /** Was gespielt wird: Normalspiel, Hochzeit, Armut oder ein Solo. */
  gameType: { kind: string; solo?: string };
  /**
   * Rangfolge der Karten. `trumps` enthält die Trumpfkarten als `Farbe+Wert`.
   * Der Client rechnet daraus nichts aus, er liest nur ab, was Trumpf ist —
   * welche Karte Trumpf ist, entscheidet allein das Spielmodul.
   */
  order: { trumps: string[]; fehl?: Record<string, string[]> };
  standings: Record<number, number>;
  /** Gewonnene Stiche je Sitz, immer gefuellt. */
  trickCounts?: Record<number, number>;
  /**
   * `reason` benennt den Anlass: `trick`, `hochzeit`, `armut` oder `schweine`.
   * Ohne ihn stand im Blatt immer "Der erste Stich hatte N Augen" — bei einer
   * Hochzeit ist es der Klaerungsstich, und bei Schweinen oder Armut gibt es
   * ueberhaupt keinen Stich.
   */
  pendingPflichtansage: {
    seat: number;
    trickPoints: number;
    canDecline: boolean;
    reason?: string;
  } | null;
  /**
   * Sitze, die die Schweine halten. Nur gefuellt, wenn der Schweine-Ausloeser
   * aktiv ist — sonst waere es Geheimwissen, das der Server nicht herausgibt.
   */
  schweineSeats?: number[];
  /**
   * Kartenordnung je waehlbarem Solo, nur in der Vorbehaltsabfrage.
   *
   * Damit sortiert der Client die Hand vorab um, wenn ein Solo angetippt aber
   * noch nicht bestaetigt ist. Die Ordnung kommt vom Server — welche Karte
   * Trumpf ist, rechnet der Client nie selbst aus.
   */
  soloVorschau?: Record<string, { trumps: string[]; fehl?: Record<string, string[]> }>;
  /** Sitze mit noch offenem Pflichtsolo. Leer, wenn die Regel aus ist. */
  pflichtsoloOffen?: number[];
  result: RoundResult | null;
  isMyTurn: boolean;
  armut: { role: string | null; awaiting: string | null; handoverSize: number };
}

/** Was jede Partiesicht hat, egal welches Spiel. */
export interface BaseGameView {
  roundIndex: number;
  totalRounds: number;
  scores: Record<number, number>;
  finished: boolean;
  spectator: boolean;
}

export interface GameView extends BaseGameView {
  round: RoundView | null;
  nextMultiplier: number;
}

// ---------------------------------------------------------------------------
// Zauberer
// ---------------------------------------------------------------------------

export interface WizardRoundView {
  seat: number | null;
  /** 'trump' | 'bidding' | 'playing' | 'finished' */
  phase: string;
  roundNumber: number;
  handSize: number;
  seats: number[];
  dealer: number;
  hand: Card[];
  legal: Card[];
  legalBids: number[];
  /** Blinde erste Runde: fremde Karten sichtbar, die eigene nicht. */
  blind: boolean;
  blindHands: Record<number, Card[]> | null;
  handCounts: Record<number, number>;
  /** Solange verdeckt angesagt wird, steht hier höchstens die eigene Ansage. */
  bids: Record<number, number>;
  bidsRevealed: boolean;
  /** Summe aller Ansagen — null, solange verdeckt. */
  bidTotal: number | null;
  tricks: Record<number, number>;
  currentTrick: PlayedCard[];
  lastTrick: { winnerSeat: number; played: PlayedCard[] } | null;
  turn: number;
  isMyTurn: boolean;
  /** Aufgedeckte Karte des Rests. Null heißt: kein Trumpf. */
  upcard: Card | null;
  trump: string | null;
  /** Sitz, der gerade die Trumpffarbe nennen muss. */
  awaitingTrump: number | null;
  order: { trumps: string[]; fehl?: Record<string, string[]> };
  result: {
    bids: Record<number, number>;
    tricks: Record<number, number>;
    scores: Record<number, number>;
  } | null;
}

/** Eine abgerechnete Runde, wie sie in der Punktetafel steht. */
export interface WizardRoundSummary {
  roundIndex: number;
  roundNumber: number;
  dealer: number;
  upcard: Card | null;
  trump: string | null;
  bids: Record<number, number>;
  tricks: Record<number, number>;
  scores: Record<number, number>;
  totals: Record<number, number>;
}

export interface WizardGameView extends BaseGameView {
  round: WizardRoundView | null;
  history: WizardRoundSummary[];
}

// ---------------------------------------------------------------------------
// Cambio
// ---------------------------------------------------------------------------

/**
 * Ein Platz in einer Hand, so wie ihn dieser Betrachter sieht.
 *
 * `card: null` heißt verdeckt — für ihn. Der Client blendet nichts selbst
 * aus: Was hier steht, hat der Server bereits gefiltert.
 */
export interface CambioSlot {
  index: number;
  card: Card | null;
}

/** Ein Platz als Ziel einer Aktion. */
export interface CambioTarget {
  seat: number;
  index: number;
}

export interface CambioRoundView {
  seat: number | null;
  /** 'turn' | 'decide' | 'action' | 'finished' */
  phase: string;
  seats: number[];
  dealer: number;
  /** Der Regelsatz — der Tisch zeigt an, welche Aktionskarten gelten. */
  rs: Record<string, unknown>;
  /** Alle Hände, je Karte nur sichtbar, wenn dieser Sitz sie kennt. */
  hands: Record<number, CambioSlot[]>;
  stockCount: number;
  topDiscard: Card;
  /** Gezogene Karte — nur für den, der sie gerade hält. */
  drawn: Card | null;
  /** 'peekOwn' | 'peekOther' | 'blindSwap' | 'lookAndSwap' */
  pendingAction: string | null;
  /** Bei der Dame: der bereits angesehene Platz. */
  lookedAt: CambioTarget | null;
  turn: number;
  isMyTurn: boolean;
  legal: Action[];
  caller: number | null;
  afterCall: number[];
  result: {
    raw: Record<number, number>;
    scores: Record<number, number>;
    caller: number | null;
    callSucceeded: boolean | null;
    hands: Record<number, Card[]>;
  } | null;
}

/** Eine abgerechnete Runde, wie sie in der Punktetafel steht. */
export interface CambioRoundSummary {
  roundIndex: number;
  dealer: number;
  caller: number | null;
  callSucceeded: boolean | null;
  raw: Record<number, number>;
  scores: Record<number, number>;
  totals: Record<number, number>;
}

export interface CambioGameView extends BaseGameView {
  round: CambioRoundView | null;
  history: CambioRoundSummary[];
}

// ---------------------------------------------------------------------------
// Skat
// ---------------------------------------------------------------------------

/** Abrechnung einer Skat-Gabe (kommt aus der Engine, wird nur gezeigt). */
export interface SkatResult {
  gameType: { kind: string; trump?: string };
  declarer: number | null;
  reizWert: number;
  spielwert: number;
  gewonnen: boolean;
  ueberreizt: boolean;
  schneider: boolean;
  schwarz: boolean;
  declarerAugen: number;
  punkte: Record<number, number>;
  durchmarsch: number | null;
  /** Ramsch: Sitze ohne einen einzigen Stich. */
  jungfrauen: number[];
  /** Angesagte Patrouillen, die in den Spielwert eingingen. */
  patrouillen: number;
}

/** Eine Zeile des Reizrechners. Alles darin hat der Server gerechnet. */
export interface SkatReizZeile {
  /** 'C' | 'S' | 'H' | 'D' | 'grand' | 'saechsisch' | 'null' */
  spiel: string;
  grundwert: number;
  spitzen: number;
  mit: boolean;
  maxWert: number;
}

export interface SkatRoundView {
  seat: number;
  /** 'reizen' | 'schieben' | 'skat' | 'druecken' | 'ansage' | 'stich' | 'vorbei' */
  phase: string;
  dealer: number;
  hand: Card[];
  legal: Card[];
  handCounts: Record<number, number>;
  trick: PlayedCard[];
  lastTrick: { winner: number; played: PlayedCard[] } | null;
  turn: number | null;
  gameType: { kind: string; trump?: string } | null;
  /** Trumpfkarten als `Farbe+Wert`, absteigend. Der Client rechnet nichts aus. */
  trumpfKeys: string[];
  reiz: {
    wert: number;
    gebot: number | null;
    amZug: number | null;
    rolle: string | null;
    /** Werte, die jetzt gesagt werden dürfen — die Leiter des Rechners. */
    stufen: number[];
  };
  /** Was die eigene Hand je Spielart hergibt. Nur während des Reizens gefüllt. */
  reizHilfe: SkatReizZeile[];
  declarer: number | null;
  reizWert: number;
  handSpiel: boolean;
  ouvert: boolean;
  schneiderAngesagt: boolean;
  schwarzAngesagt: boolean;
  kontra: boolean;
  re: boolean;
  hirsch: boolean;
  /** Angesagte Patrouillen des Alleinspielers ('schwarz' | 'rot'). */
  patrouillen: string[];
  /** Patrouillen, die man selbst gerade ansagen könnte (nur in der Ansage). */
  meinePatrouillen: string[];
  /** Schieberamsch: wer schiebt, ob er aufnahm, wie oft schon verdoppelt wurde. */
  schiebenSitz: number | null;
  schiebenAufgenommen: boolean;
  ramschFaktor: number;
  trickCounts: Record<number, number>;
  augen: Record<number, number>;
  /** Offene Hand des Alleinspielers bei Ouvert, sonst null. */
  ouvertHand: Card[] | null;
  result: SkatResult | null;
  isMyTurn: boolean;
  neuGeben: boolean;
  ramschAn: boolean;
  /** Tischvarianten, aus denen der Client seine Ansage-Kacheln baut. */
  saechsischAn: boolean;
  patrouillenAn: boolean;
  /** Nicht-Karten-Aktionen dieses Sitzes als Typen ('reizWeiter', 'kontra', …). */
  aktionen: string[];
}

export interface SkatGameView extends BaseGameView {
  round: SkatRoundView | null;
  /** Bock-Faktor der laufenden Gabe. */
  bock: number;
}

export interface Action {
  type: string;
  seat: number;
  [key: string]: unknown;
}

/**
 * Der Typparameter ist die Sicht des jeweiligen Spiels. Vorgabe ist die des
 * Doppelkopfs, damit bestehender Code unveraendert bleibt; der Zauberer-Tisch
 * setzt `ViewMessage<WizardGameView>` ein.
 */
export interface ViewMessage<V = GameView> {
  v: number;
  game: string;
  type: 'view';
  tableId: string;
  revision: number;
  seat: number | null;
  view: V;
  legalActions: Action[];
  currentActor: number | null;
  turnDeadline: number | null;
  botSeats: number[];
  leftSeats: number[];
  finished: boolean;
  ruleSetVersion: number;
}

export interface SeatInfo {
  seat: number;
  displayName: string | null;
  /** Kennung für den Sprung zum Profil. Null bei freien Plätzen und Bots. */
  accountId: string | null;
  isBot: boolean;
  /** Profilbild-URL oder null. */
  avatarUrl: string | null;
}

export interface TableMessage {
  v: number;
  game: string;
  type: 'table';
  tableId: string;
  status: 'waiting' | 'running' | 'finished' | 'abandoned';
  seats: SeatInfo[];
  missing: number;
  rounds: number;
  visibility: 'public' | 'on_request' | 'club_only';
  /** Clantisch bewusst angehalten. */
  paused: boolean;
}

export interface PartyMessage {
  v: number;
  game: string;
  type: 'party';
  tableId: string;
  standings: { seat: number; points: number; place: number; left: boolean }[];
  seats: SeatInfo[];
  /** Gebuchte Trophäen je Sitz, gefüllt erst nach Partie-Ende. */
  trophies?: { seat: number; delta: number; reason: string }[];
}

export interface ErrorMessage {
  v: number;
  type: 'error';
  code: string;
  messageKey: string;
}

/**
 * Ein Zuruf vom Tisch. Traegt keine Revision — ein Zuruf ist ein Moment,
 * kein Zustand, und wer ihn verpasst, hat nichts zu holen.
 */
export interface EmoteMessage {
  v: number;
  game: string;
  type: 'emote';
  tableId: string;
  seat: number;
  emote: string;
}

/**
 * Takt-Herzschlag eines Echtzeitspiels (Feldherr), weitergereicht wie ein
 * Zuruf: keine Revision, kein Zustand. Wer einen verpasst, bekommt in 200 ms
 * den naechsten.
 */
export interface TaktMessage {
  v: number;
  game: string;
  type: 'takt';
  tableId: string;
  /** Sitz des Absenders, vom Server gestempelt. */
  seat: number;
  /** Takt, bis zu dem das andere Geraet gerechnet hat. */
  takt: number;
  /** 40er-Taktgrenze, zu der die Pruefsumme gehoert. */
  grenzTakt: number;
  pruef: string;
}

export type ServerMessage<V = GameView> =
  | ViewMessage<V>
  | PartyMessage
  | TableMessage
  | EmoteMessage
  | TaktMessage
  | ErrorMessage;
