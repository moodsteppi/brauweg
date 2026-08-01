/**
 * WebSocket-Protokoll.
 *
 * JEDE Nachricht traegt Spielkennung und Protokollversion. Das steht hier und
 * nicht in einer spaeteren Aufraeumrunde, weil es sich nachtraeglich nicht mehr
 * einfuehren laesst: Die Webversion ist nach dem Deploy sofort aktuell, ein
 * App-Store-Update dauert Tage und wird erst nach Wochen installiert. An einem
 * Tisch sitzen dann ein Client von heute und einer von vor drei Wochen.
 *
 * Regeln:
 *   1. Nur additive Aenderungen. Neue Felder ja, umbenannte oder entfernte nein.
 *   2. Der Server unterstuetzt mindestens die letzten zwei Versionen je Modul.
 *   3. Die Mindestversion wird beim TISCHBEITRITT erzwungen, nie mitten in der
 *      Partie.
 *   4. Die Regelsatz-Version wird mitgeschickt. Kennt ein Client eine Option
 *      nicht, lehnt er den Tisch ab, statt ihn falsch darzustellen.
 *   5. Jeder Zustand traegt eine Revisionsnummer. Der Client verwirft
 *      veraltete Nachrichten.
 */

import type { GameId } from '@brauweg/game-api';

/** Version des Rahmenprotokolls, unabhaengig von der eines Spielmoduls. */
export const ENVELOPE_VERSION = 1;

/** Wie viele Versionen zurueck ein Modul noch bedient wird. */
export const SUPPORTED_MODULE_VERSIONS = 2;

// ---------------------------------------------------------------------------
// Client -> Server
// ---------------------------------------------------------------------------

export type ClientMessage =
  | {
      readonly v: number;
      readonly game: GameId;
      readonly type: 'join';
      readonly tableId: string;
      /** Protokollversion des Spielmoduls, die dieser Client beherrscht. */
      readonly moduleVersion: number;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      readonly type: 'action';
      readonly tableId: string;
      readonly action: unknown;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      readonly type: 'leave';
      readonly tableId: string;
    };

// ---------------------------------------------------------------------------
// Server -> Client
// ---------------------------------------------------------------------------

export interface ViewMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'view';
  readonly tableId: string;
  readonly revision: number;
  /** Sitz des Empfaengers, null bei Zuschauern. */
  readonly seat: number | null;
  readonly view: unknown;
  readonly legalActions: readonly unknown[];
  readonly currentActor: number | null;
  /** Zeitpunkt in Millisekunden seit Epoche, null wenn kein Timer laeuft. */
  readonly turnDeadline: number | null;
  readonly botSeats: readonly number[];
  readonly leftSeats: readonly number[];
  readonly finished: boolean;
  /** Feste Version des Regelsatzes, gegen den gespielt wird. */
  readonly ruleSetVersion: number;
}

export interface PartyMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'party';
  readonly tableId: string;
  readonly standings: readonly unknown[];
  readonly seats: readonly {
    readonly seat: number;
    readonly displayName: string | null;
    readonly isBot: boolean;
  }[];
}

export interface ErrorMessage {
  readonly v: number;
  readonly type: 'error';
  readonly code: string;
  readonly messageKey: string;
}

export type ServerMessage = ViewMessage | PartyMessage | ErrorMessage;

export function errorMessage(code: string, messageKey?: string): ErrorMessage {
  return {
    v: ENVELOPE_VERSION,
    type: 'error',
    code,
    messageKey: messageKey ?? `error.${code}`,
  };
}

/**
 * Ist dieser Client alt genug abgewiesen zu werden?
 *
 * Geprueft wird nur beim Beitritt. Wer schon sitzt, wird nie mitten in der
 * Partie hinausgeworfen, auch wenn der Server inzwischen weitergezogen ist.
 */
export function moduleVersionAccepted(
  clientVersion: number,
  serverVersion: number,
): boolean {
  if (clientVersion > serverVersion) return false;
  return clientVersion > serverVersion - SUPPORTED_MODULE_VERSIONS;
}
