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

import type { BotLevel, GameId } from '@brauweg/game-api';

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
    }
  | {
      readonly v: number;
      readonly game: GameId;
      /**
       * Zuruf an den Tisch. Aus einer festen Liste, nie Freitext — siehe
       * src/emotes.ts.
       */
      readonly type: 'emote';
      readonly tableId: string;
      readonly emote: string;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      /** Freien Platz mit einem Bot belegen oder den Bot wieder entfernen. */
      readonly type: 'addBot' | 'removeBot';
      readonly tableId: string;
      readonly seat: number;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      /** Spielstaerke der Bots dieses Tisches setzen (gilt fuer alle Bots). */
      readonly type: 'setBotLevel';
      readonly tableId: string;
      readonly level: BotLevel;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      /**
       * Sofort starten: Der Tisch schrumpft auf die besetzten Plaetze
       * (mindestens zwei) und die Partie geht los — ohne Bot-Auffuellen.
       */
      readonly type: 'startNow';
      readonly tableId: string;
      /**
       * Rundenzahl, falls sie erst beim Start feststeht (Golf waehlt die
       * Loecher in der Lobby). Fehlt sie, gilt die des Tisches.
       */
      readonly rounds?: number;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      /**
       * Takt-Herzschlag eines Echtzeitspiels (Feldherr). Bewusst KEINE
       * Aktion: Er aendert keinen Partiestand, wird nicht gespeichert und
       * loest keinen Sicht-Rundruf aus — er wird nur an die anderen am Tisch
       * weitergereicht, wie ein Zuruf. Liefe er durch das Spielmodul, schriebe
       * jeder Feldherr-Tisch fuenfmal je Sekunde einen Schnappschuss in die
       * Datenbank und funkte jedes Mal die volle Zugliste an alle.
       */
      readonly type: 'takt';
      readonly tableId: string;
      /** Takt, bis zu dem dieses Geraet gerechnet hat. */
      readonly takt: number;
      /** 40er-Taktgrenze, zu der die Pruefsumme gehoert. */
      readonly grenzTakt: number;
      /** Zustandsprobe an dieser Grenze, fuer den Abgleich beider Laeufe. */
      readonly pruef: string;
      /**
       * Quittung: so viele Zuege hat dieses Geraet aus der Serverliste. Der
       * Server reicht sie unveraendert weiter; die Gegenseite loest daran
       * ihren Melde-Deckel. Optional, weil aeltere Clients sie nicht senden.
       */
      readonly zuege?: number;
    }
  | {
      readonly v: number;
      readonly game: GameId;
      /**
       * Reaktion: ein Emoji ueber den Tisch. Wie der Takt bewusst KEINE
       * Aktion — kein Partiestand, kein Schnappschuss, kein Sicht-Rundruf.
       * Sie traegt nur eine Nummer aus dem Zeichenvorrat des Clients; welches
       * Zeichen das ist, erfaehrt der Server nie und braucht es nicht.
       */
      readonly type: 'reaktion';
      readonly tableId: string;
      readonly zeichen: number;
      /** Statt des Emojis ein gesammeltes Motiv. Siehe ReaktionMessage. */
      readonly motiv?: string;
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
  /**
   * Frist einer laufenden Schaupause, oder null. Getrennt vom Zugtimer, weil
   * sie fuer ALLE gilt und nicht fuer einen Sitz: die Rundenabrechnung, und
   * beim Doppelkopf die gleichzeitige Vorbehaltsabfrage.
   */
  readonly interludeDeadline: number | null;
  /**
   * Frist der laufenden Phase, oder null. Gilt wie die Schaupause fuer ALLE
   * Sitze — anders als sie aber, waehrend noch gehandelt werden darf: Bei
   * Tafelrunde ruesten alle gleichzeitig, und die Zugzeit taugt dort als
   * Restzeit nicht (siehe phaseMs in game-api).
   */
  readonly phaseDeadline: number | null;
  readonly botSeats: readonly number[];
  readonly leftSeats: readonly number[];
  readonly finished: boolean;
  /** Feste Version des Regelsatzes, gegen den gespielt wird. */
  readonly ruleSetVersion: number;
}

/**
 * Zustand eines Tisches, an dem noch keine Partie laeuft.
 *
 * Ohne diese Nachricht sah ein Tisch mit freien Plaetzen aus wie ein Fehler:
 * Der Server lehnte den Beitritt ab, der Client wartete endlos auf eine Sicht,
 * die nie kam. Ein Tisch, der auf Mitspieler wartet, ist aber kein Fehlerfall,
 * sondern der Normalzustand jeder Lobby.
 */
export interface SeatInfo {
  readonly seat: number;
  readonly displayName: string | null;
  /**
   * Konto-Kennung des Sitzenden, damit der Client Namen zum Profil verlinken
   * kann. Kein Geheimnis: Dieselbe Kennung steht in der Profil-Adresse.
   */
  readonly accountId: string | null;
  readonly isBot: boolean;
  /** Profilbild-URL oder null. Nur eine kurze URL, nie die Bytes. */
  readonly avatarUrl: string | null;
}

export interface TableMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'table';
  readonly tableId: string;
  readonly status: 'waiting' | 'running' | 'finished' | 'abandoned';
  readonly seats: readonly SeatInfo[];
  /** Wie viele Menschen noch fehlen, bis automatisch gestartet wird. */
  readonly missing: number;
  readonly rounds: number;
  readonly visibility: 'public' | 'on_request' | 'club_only';
  /** Vereinstisch bewusst angehalten — Zugtimer und Verfall stehen still. */
  readonly paused: boolean;
  /**
   * Eingestellte Bot-Spielstaerke des Tisches. Der Client zeigt sie im
   * Wartebereich und laesst sie dort aendern (derzeit nur beim Doppelkopf
   * ausgewertet).
   */
  readonly botLevel: BotLevel;
}

export interface PartyMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'party';
  readonly tableId: string;
  readonly standings: readonly unknown[];
  readonly seats: readonly SeatInfo[];
  /**
   * Gebuchte Trophaeen je Sitz, gefuellt erst nach Partie-Ende. Leer bei
   * Tischen, die nicht fuer die Rangliste zaehlen. Additive Erweiterung.
   */
  readonly trophies: readonly { seat: number; delta: number; reason: string }[];
}

export interface ErrorMessage {
  readonly v: number;
  readonly type: 'error';
  readonly code: string;
  readonly messageKey: string;
}

/**
 * Ein Zuruf, weitergereicht an alle am Tisch.
 *
 * Traegt bewusst keine Revision: Emotes sind kein Zustand, sondern ein
 * Moment. Ein Client, der sie verpasst, hat nichts zu holen — deshalb wird
 * hier auch nichts nachgeliefert.
 */
export interface EmoteMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'emote';
  readonly tableId: string;
  /** Wer gerufen hat. */
  readonly seat: number;
  readonly emote: string;
}

/**
 * Weitergereichter Takt-Herzschlag. Wie der Zuruf ohne Revision: Er ist ein
 * Moment, kein Zustand. Wer ihn verpasst, bekommt in 200 ms den naechsten.
 */
/**
 * Eine Reaktion: ein Emoji, das ueber den Tisch fliegt.
 *
 * Genau wie ein Zuruf ein Moment und kein Zustand — nicht gespeichert, in
 * keiner Sicht, ueberlebt kein Neuladen. Der Unterschied zum Zuruf ist die
 * Frequenz: Ein Zuruf darf alle zwei Sekunden kommen, eine Reaktion viermal
 * je Sekunde. Deshalb traegt sie auch keinen Text und keine Kennung, sondern
 * nur eine **Nummer** aus einem festen Vorrat, den der Client kennt. Der
 * Server prueft die Zahl und stempelt den Sitz; was fuer ein Zeichen das ist,
 * erfaehrt er nie. Aus einer Zahl laesst sich niemand beleidigen — derselbe
 * Grund, aus dem es Zurufe gibt und keinen Tischchat.
 */
export interface ReaktionMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'reaktion';
  readonly tableId: string;
  /** Sitz des Absenders — vom Server gestempelt, nie vom Client behauptet. */
  readonly seat: number;
  /** Platz im Vorrat des Clients. */
  readonly zeichen: number;
  /**
   * Statt eines Emojis ein gesammeltes Motiv (Mememory, seit dem 26. August).
   *
   * Die einzige Zeichenkette, die bei einer Reaktion fliegt — und trotzdem
   * kein Freitext: Geprueft wird die Form, und das Bild dahinter liefert der
   * Server nur aus, wenn es freigegeben ist. Ein wartender oder erfundener
   * Vorschlag erreicht die Gegenseite gar nicht als Bild.
   *
   * **Eigener Takt.** Eine Reaktion mit Motiv darf einmal je Sekunde kommen,
   * eine ohne viermal (gateway.ts). Ein Bild quer ueber das Brett ist etwas
   * anderes als ein Zeichen am Rand — und der Gegner will sich in derselben
   * Zeit Karten merken.
   */
  readonly motiv?: string;
}

export interface TaktMessage {
  readonly v: number;
  readonly game: GameId;
  readonly type: 'takt';
  readonly tableId: string;
  /** Sitz des Absenders — vom Server gestempelt, nie vom Client behauptet. */
  readonly seat: number;
  readonly takt: number;
  readonly grenzTakt: number;
  readonly pruef: string;
  /**
   * Zahl der Zuege, die der Absender aus der Serverliste schon erhalten hat.
   *
   * Sie beantwortet der Gegenseite die einzige Frage, auf die es ankommt:
   * Ist MEIN letzter Zug bei dir angekommen? Der Absender darf seinen
   * Melde-Deckel erst danach loesen — sein eigenes Server-Echo sagt darueber
   * nichts (Befund vom 10.8.2026, docs/FELDHERR-DIAGNOSE.md).
   *
   * Optional: Aeltere Clients senden das Feld nicht. Wer es nie sieht,
   * faellt auf die alte Regel zurueck, statt fuer immer zu deckeln.
   */
  readonly zuege?: number;
}

export type ServerMessage =
  | ViewMessage
  | PartyMessage
  | TableMessage
  | EmoteMessage
  | TaktMessage
  | ReaktionMessage
  | ErrorMessage;

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
