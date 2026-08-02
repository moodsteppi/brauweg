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
 * Protokollversion des Doppelkopf-Moduls, die dieser Client beherrscht. Steigt
 * sie serverseitig um mehr als eine Stufe, weist der Server den Beitritt ab —
 * beim Beitritt, nie mitten in der Partie.
 */
export const DOPPELKOPF_MODULE_VERSION = 1;

export interface Card {
  id: number;
  suit: string;
  rank: string;
}

export interface PlayedCard {
  seat: number;
  card: Card;
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
  order: { trumps: string[] };
  standings: Record<number, number>;
  pendingPflichtansage: { seat: number; trickPoints: number; canDecline: boolean } | null;
  result: unknown;
  isMyTurn: boolean;
  armut: { role: string | null; awaiting: string | null; handoverSize: number };
}

export interface GameView {
  round: RoundView | null;
  roundIndex: number;
  totalRounds: number;
  scores: Record<number, number>;
  nextMultiplier: number;
  finished: boolean;
  spectator: boolean;
}

export interface Action {
  type: string;
  seat: number;
  [key: string]: unknown;
}

export interface ViewMessage {
  v: number;
  game: string;
  type: 'view';
  tableId: string;
  revision: number;
  seat: number | null;
  view: GameView;
  legalActions: Action[];
  currentActor: number | null;
  turnDeadline: number | null;
  botSeats: number[];
  leftSeats: number[];
  finished: boolean;
  ruleSetVersion: number;
}

export interface TableMessage {
  v: number;
  game: string;
  type: 'table';
  tableId: string;
  status: 'waiting' | 'running' | 'finished' | 'abandoned';
  seats: { seat: number; displayName: string | null; isBot: boolean }[];
  missing: number;
  rounds: number;
}

export interface PartyMessage {
  v: number;
  game: string;
  type: 'party';
  tableId: string;
  standings: { seat: number; points: number; place: number; left: boolean }[];
  seats: { seat: number; displayName: string | null; isBot: boolean }[];
}

export interface ErrorMessage {
  v: number;
  type: 'error';
  code: string;
  messageKey: string;
}

export type ServerMessage = ViewMessage | PartyMessage | TableMessage | ErrorMessage;
