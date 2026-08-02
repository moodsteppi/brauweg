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

/**
 * Rangfolge der Karten in der aktuellen Spielart, wie sie die Engine liefert:
 * Truempfe stark nach schwach, dann je Fehlfarbe stark nach schwach. Die Werte
 * sind Kartenschluessel wie "DA" oder "HT".
 *
 * Der Client wertet damit KEINE Regeln aus — er ordnet die Hand nur sichtbar.
 * Weil sich `order` bei einem Solo aendert, sortiert sich die Hand von selbst
 * um, ohne dass der Client wuesste, was ein Solo ist.
 */
export interface CardOrder {
  trumps: string[];
  fehl: Record<string, string[]>;
}

export interface RoundView {
  seat: number;
  phase: string;
  hand: Card[];
  legal: Card[];
  /** Kartenstaerke der aktuellen Spielart. Kommt mit der Sicht vom Server. */
  order?: CardOrder;
  gameType?: { kind: string; solo?: string };
  handCounts: Record<number, number>;
  currentTrick: PlayedCard[];
  /** Feldnamen wie in der Engine: `played` und `winnerSeat`. */
  lastTrick: { winnerSeat: number; played: PlayedCard[] } | null;
  turn: number;
  announcements: { re: boolean; kontra: boolean; reAbsage: number; kontraAbsage: number };
  myParty: string | null;
  /** Bekannte Parteien anderer Sitze (Solo, aufgedeckte Hochzeit, Ansagen). */
  knownParties?: Record<number, string>;
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
