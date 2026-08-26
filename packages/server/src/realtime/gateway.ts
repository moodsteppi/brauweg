/**
 * WebSocket-Vermittlung.
 *
 * Verbindungen werden Tischen zugeordnet, Zustandsaenderungen als gefilterte
 * Sicht je Sitz verteilt. Der Client haelt keinen eigenen Verlauf: Beim
 * Wiederverbinden schickt der Server die vollstaendige aktuelle Sicht plus
 * Partiestand.
 */

import { eq, inArray, sql } from 'drizzle-orm';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { z } from 'zod';

import type { BotLevel } from '@brauweg/game-api';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { AppError, forbidden } from '../errors.js';
import { type SessionInfo, sessionFromToken } from '../auth/service.js';
import { PartyRuntime } from '../runtime/party.js';
import {
  isReadyToStart,
  setSeatBot,
  setTableBotLevel,
  tableBotLevel,
  tableWithSeats,
} from '../tables/service.js';
import { requireModule } from '../games/registry.js';
import { requireClubMember } from '../clubs/service.js';
import {
  ENVELOPE_VERSION,
  type ClientMessage,
  type EmoteMessage,
  type ReaktionMessage,
  type ServerMessage,
  type TaktMessage,
  errorMessage,
  moduleVersionAccepted,
} from './protocol.js';
import { EMOTE_PAUSE_MS, besitztEmote, istEmote } from '../emotes.js';

/**
 * Ab welcher gemeldeten Modulversion ein Client Reaktionen vertraegt.
 *
 * Wer weniger meldet, bekommt sie nicht — siehe die Begruendung in
 * `reaktion()`. Die Zahl gehoert zum Spiel, das den Kanal benutzt
 * (Mememory, protocolVersion 2), gilt aber fuer jedes weitere gleich.
 */
const REAKTION_AB_MODULVERSION = 2;

/**
 * Ab welcher Version ein Client ein MOTIV als Reaktion versteht.
 *
 * Seit dem 26. August kann statt eines Emojis ein gesammeltes Meme fliegen.
 * Ein Client der Version 2 kennt die Nachricht, nicht aber das Feld `motiv`
 * — er zeigte das Emoji Nummer 0 und damit etwas anderes, als der Absender
 * geschickt hat. Lieber nichts als das Falsche.
 */
const MOTIV_AB_MODULVERSION = 3;

interface Connection {
  readonly socket: WebSocket;
  readonly accountId: string;
  tableId: string | null;
  /** Beginn des laufenden Ratenfensters. */
  fensterStart: number;
  imFenster: number;
  /** Wann diese Verbindung zuletzt einen Zuruf abgesetzt hat. */
  letzterEmote: number;
  /** Wann diese Verbindung zuletzt einen Takt-Herzschlag abgesetzt hat. */
  letzterTakt: number;
  /** Wann diese Verbindung zuletzt eine Reaktion abgesetzt hat. */
  letzteReaktion: number;
  /**
   * Wie weit diese Verbindung mit dem anwachsenden Teil der Sicht beliefert
   * ist (GameModule.viewCursor). Nur Feldherr hat so einen Teil; bei allen
   * anderen bleibt der Wert 0 und aendert nichts.
   *
   * Steht auf null, solange nichts gesendet wurde — dann geht die volle
   * Sicht raus. Auf null zurueckgesetzt wird er bei jedem Tischwechsel:
   * Die Marke gehoert zu EINER Partie, und ein alter Stand an einem neuen
   * Tisch waere genau das Loch, das die Marke verhindern soll.
   */
  sichtStand: number | null;
  /**
   * Protokollversion, die diese Verbindung beim `join` gemeldet hat.
   *
   * Sie entscheidet, ob die Sicht als Ausschnitt rausgehen darf. Ein Client
   * mit aelterer Version liest die Zugliste als vollstaendig — bekaeme er
   * einen Ausschnitt, rechnete er ab dem ersten Zug eine andere Partie.
   * Genau das passiert bei jedem Deploy: Der Server startet neu, alle
   * offenen Geraete verbinden sich neu, und die haben noch das alte
   * Programm im Speicher.
   */
  moduleVersion: number;
  /**
   * Warteschlange dieser Verbindung: Nachrichten werden der Reihe nach
   * abgearbeitet, nicht nebeneinander.
   *
   * Ohne sie ueberholt ein synchron weitergereichter Herzschlag den Zug
   * desselben Absenders, der noch auf die Datenbank wartet — und die
   * Gegenseite bekommt die Erlaubnis, ueber den Takt dieses Zuges hinaus zu
   * rechnen. Siehe die Kette in `accept`.
   */
  kette: Promise<void>;
}

/** Hoechstens so viele offene Verbindungen je Konto. */
const VERBINDUNGEN_JE_KONTO = 8;
const NACHRICHTEN_FENSTER_MS = 10_000;
const NACHRICHTEN_JE_FENSTER = 120;

/**
 * Form jeder eingehenden Nachricht.
 *
 * Vorher wurde nur die Versionsnummer geprueft und alles andere
 * durchgereicht - eine erfundene tableId landete so als Datenbankfehler im
 * Log, ein erfundener Sitz als Regelverstoss tief in der Engine.
 */
const clientMessageSchema = z.discriminatedUnion('type', [
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('join'),
    tableId: z.string().uuid(),
    moduleVersion: z.number().int().min(0).max(1000),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('action'),
    tableId: z.string().uuid(),
    action: z.unknown(),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('leave'),
    tableId: z.string().uuid().optional(),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.enum(['addBot', 'removeBot']),
    tableId: z.string().uuid(),
    seat: z.number().int().min(0).max(7),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('setBotLevel'),
    tableId: z.string().uuid(),
    level: z.enum(['anfaenger', 'standard', 'experte', 'genie']),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('emote'),
    tableId: z.string().uuid(),
    // Die Laenge deckelt hier nur grob; welche Kennungen es gibt, entscheidet
    // istEmote — eine erfundene faellt still durch.
    emote: z.string().min(1).max(40),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('reaktion'),
    tableId: z.string().uuid(),
    /*
     * Platz im Zeichenvorrat des Clients, keine Zeichenkette. Der Server
     * weiss nicht, welches Emoji das ist, und soll es nicht wissen: Eine
     * Zahl kann kein Schimpfwort sein. Die Obergrenze ist grosszuegig, damit
     * ein spaeterer, groesserer Vorrat keine Serveraenderung braucht.
     */
    zeichen: z.number().int().min(0).max(63),
    /*
     * Statt eines Emojis kann ein gesammeltes Motiv fliegen. Das ist die
     * einzige Stelle, an der bei einer Reaktion eine Zeichenkette ueber die
     * Leitung geht — und sie ist trotzdem kein Freitext: Geprueft wird die
     * Form, und das Bild dahinter liefert der Server nur aus, wenn es
     * freigegeben ist (siehe memes.ts, `bildVon` filtert auf 'frei'). Ein
     * wartender oder erfundener Vorschlag erreicht die Gegenseite also nicht
     * als Bild, sondern gar nicht.
     */
    motiv: z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/).optional(),
  }),
  z.object({
    v: z.literal(ENVELOPE_VERSION),
    game: z.string().max(40).optional(),
    type: z.literal('takt'),
    tableId: z.string().uuid(),
    takt: z.number().int().min(0).max(10_000_000),
    grenzTakt: z.number().int().min(0).max(10_000_000),
    // Pruefsumme ist eine Basis-36-Zahl; 16 Zeichen sind mehr als genug.
    pruef: z.string().max(16),
    /**
     * Wie viele Zuege der Absender aus der Serverliste schon bekommen hat.
     *
     * Damit weiss die Gegenseite, ob IHR letzter Zug drueben angekommen ist —
     * die Frage, an der der Gleichschritt haengt (siehe `bestaetigt` im Kern).
     * Optional, weil aeltere Clients das Feld nicht senden; dann faellt der
     * Empfaenger auf die alte Regel zurueck.
     */
    zuege: z.number().int().min(0).max(10_000_000).optional(),
  }),
]);

/** Liest das Sitzungs-Cookie aus dem Handshake. */
function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

/**
 * Marke, hinter der die App ihr Sitzungstoken als Unterprotokoll mitschickt.
 *
 * Die iOS-Huelle laedt den Client aus dem App-Paket und ist damit eine
 * fremde Herkunft; WebKit gibt ihr das Sitzungs-Cookie nicht mit (siehe
 * `APP_ORIGIN` in `http/app.ts`). Eigene Kopfzeilen kann ein WebSocket im
 * Browser nicht setzen — die Liste der Unterprotokolle ist das Einzige, was
 * beim Handshake mitgeht. Bewusst nicht in der Adresse: Adressen landen in
 * Zugriffsprotokollen und Fehlerberichten, Kopfzeilen nicht.
 *
 * Das Token ist Base64url (`auth/secrets.ts: newToken`) und damit ohne
 * Umweg ein gueltiger Protokollname.
 */
export const TOKEN_PROTOKOLL = 'brauweg-token';

/** Token aus `Sec-WebSocket-Protocol`, oder undefined. */
function protokollToken(header: string | string[] | undefined): string | undefined {
  const zeile = Array.isArray(header) ? header.join(',') : header;
  if (!zeile) return undefined;
  const teile = zeile.split(',').map((teil) => teil.trim());
  if (teile[0] !== TOKEN_PROTOKOLL) return undefined;
  return teile[1] || undefined;
}

export interface GatewayOptions {
  readonly cookieName?: string;
  /**
   * Erlaubte Herkuenfte des Handshakes: die eigene Adresse und die der
   * iOS-Huelle. Das Sitzungs-Cookie ist `sameSite: lax`, deshalb schicken
   * heutige Browser es bei fremder Herkunft ohnehin nicht mit - diese
   * Pruefung ist die zweite Schicht. Leer heisst: keine Pruefung (Tests).
   */
  readonly allowedOrigins?: readonly string[];
  /**
   * Sitzungspruefung. Injizierbar, damit sich im Test deterministisch
   * nachstellen laesst, dass sie dauert - genau dann entstand die Luecke, in
   * der eingehende Nachrichten verloren gingen.
   */
  readonly lookupSession?: (token: string | undefined) => Promise<SessionInfo | null>;
}

export class Gateway {
  private readonly wss: WebSocketServer;
  private readonly connections = new Set<Connection>();
  private readonly byTable = new Map<string, Set<Connection>>();
  private readonly cookieName: string;
  private readonly lookupSession: (token: string | undefined) => Promise<SessionInfo | null>;

  constructor(
    server: Server,
    private readonly db: Db,
    private readonly runtime: PartyRuntime,
    options: GatewayOptions = {},
  ) {
    this.cookieName = options.cookieName ?? 'brauweg_session';
    this.lookupSession =
      options.lookupSession ?? ((token) => sessionFromToken(this.db, token));
    // maxPayload: ohne Grenze nimmt ws bis 100 MiB je Nachricht an - ein
    // Dutzend davon beendet den Prozess. Der groesste echte Zug bleibt weit
    // unter einem Kilobyte.
    this.wss = new WebSocketServer({
      server,
      path: '/ws',
      maxPayload: 64 * 1024,
      /**
       * Bietet ein Client Unterprotokolle an, MUSS der Server eines davon
       * bestaetigen - sonst bricht der Browser die Verbindung ab. Bestaetigt
       * wird nur die Marke, nie das Token dahinter: Es hat im
       * Antwortkopf nichts verloren.
       */
      handleProtocols: (protocols) =>
        protocols.has(TOKEN_PROTOKOLL) ? TOKEN_PROTOKOLL : false,
    });
    const erlaubt = options.allowedOrigins ?? [];
    this.wss.on('connection', (socket, request) => {
      const herkunft = request.headers.origin;
      if (erlaubt.length > 0 && herkunft && !erlaubt.includes(herkunft)) {
        socket.close();
        return;
      }
      // Cookie zuerst: Der Browser ist der Normalfall, die App der Sonderweg.
      const token =
        cookieValue(request.headers.cookie, this.cookieName) ??
        protokollToken(request.headers['sec-websocket-protocol']);
      this.accept(socket, token);
    });
    this.runtime.onUpdate((tableId, nurSicht) => {
      void this.broadcast(tableId, nurSicht);
    });
  }

  async close(): Promise<void> {
    for (const connection of this.connections) connection.socket.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  /**
   * Nimmt eine Verbindung an.
   *
   * Der Zuhörer für eingehende Nachrichten wird SOFORT angehängt, nicht erst
   * nach dem Sitzungs-Nachschlag. Jeder vernuenftige Client schickt sein
   * `join` unmittelbar beim Oeffnen der Verbindung; der Nachschlag geht aber
   * in die Datenbank und dauert. Was in dieser Luecke ankam, fiel auf den
   * Boden - ohne Antwort, ohne Fehler. Der Client wartete danach endlos auf
   * eine Sicht, die nie kam, und ob es klappte, entschied die Tagesform der
   * Datenbank.
   *
   * Nachrichten aus der Luecke werden gepuffert und in Reihenfolge
   * nachgeholt, sobald die Sitzung steht.
   */
  private accept(socket: WebSocket, sessionToken?: string): void {
    const queued: string[] = [];
    let connection: Connection | null = null;
    let rejected = false;

    socket.on('message', (raw) => {
      if (rejected) return;
      const text = raw.toString();
      if (!connection) {
        queued.push(text);
        return;
      }
      /**
       * Der Reihe nach, je Verbindung.
       *
       * Vorher stand hier ein blosses `void this.handle(...)`, und damit
       * liefen die Nachrichten EINES Clients nebeneinander. Das ist bei
       * Kartenspielen folgenlos und bei Feldherr der Fehler: Der
       * `takt`-Zweig ist synchron und geht sofort raus, der `action`-Zweig
       * wartet auf die Datenbank. Ein Herzschlag, der NACH einem Zug
       * abgeschickt wurde, kam beim Gegner damit VOR ihm an — der Gegner
       * bekam die Erlaubnis, ueber den Takt des Zuges hinaus zu rechnen,
       * und der Zug traf danach in seiner Vergangenheit ein. Am 10.8.2026
       * im Mitschnitt einer echten Partie nachgewiesen (400 ms Fenster,
       * docs/FELDHERR-DIAGNOSE.md).
       *
       * Die Kette kostet nichts, was nicht ohnehin zu bezahlen waere:
       * Pulse, die hinter einem langsamen Zug warten, beschreiben einen
       * Stand, den die Gegenseite ohne den Zug gar nicht rechnen darf.
       */
      connection.kette = connection.kette
        .then(() => this.handle(connection as Connection, text))
        .catch(() => {
          /* handle() faengt selbst; hier nur die Kette am Leben halten. */
        });
    });

    socket.on('close', () => {
      if (connection) this.drop(connection);
    });

    void (async () => {
      const session = await this.lookupSession(sessionToken);
      if (!session) {
        rejected = true;
        queued.length = 0;
        send(socket, errorMessage('unauthorized'));
        socket.close();
        return;
      }

      // Ein Konto, ein paar Geraete - mehr braucht niemand. Ohne Grenze
      // konnte ein einziges Konto tausende Verbindungen offenhalten und
      // damit Speicher und Datenbankpool belegen.
      let offen = 0;
      for (const vorhanden of this.connections) {
        if (vorhanden.accountId === session.accountId) offen += 1;
      }
      if (offen >= VERBINDUNGEN_JE_KONTO) {
        rejected = true;
        queued.length = 0;
        send(socket, errorMessage('tooManyConnections'));
        socket.close();
        return;
      }

      const accepted: Connection = {
        socket,
        accountId: session.accountId,
        tableId: null,
        fensterStart: Date.now(),
        imFenster: 0,
        letzterEmote: 0,
        letzteReaktion: 0,
        letzterTakt: 0,
        sichtStand: null,
        /* Bis zum `join` gilt die vorsichtigste Annahme: alles vollstaendig. */
        moduleVersion: 1,
        kette: Promise.resolve(),
      };
      this.connections.add(accepted);
      connection = accepted;

      for (const text of queued) await this.handle(accepted, text);
      queued.length = 0;
    })();
  }

  private drop(connection: Connection): void {
    if (connection.tableId) {
      const tableId = connection.tableId;
      const room = this.byTable.get(tableId);
      room?.delete(connection);
      if (room && room.size === 0) {
        this.byTable.delete(tableId);
        this.tischDaten.delete(tableId);
        this.zuletztGesendet.delete(tableId);
      }
      // Verbindungsverlust pausiert nichts, der Zugtimer laeuft weiter.
      this.runtime.setPresence(tableId, connection.accountId, false);
    }
    this.connections.delete(connection);
  }

  private async handle(connection: Connection, raw: string): Promise<void> {
    let roh: unknown;
    try {
      roh = JSON.parse(raw);
    } catch {
      send(connection.socket, errorMessage('malformedMessage'));
      return;
    }

    // Nachrichtenrate je Verbindung. Ohne sie kann eine einzige Verbindung
    // mit join-Nachrichten den Datenbankpool auslasten. Takt-Herzschlaege
    // zaehlen nicht mit: Sie kommen planmaessig zehnmal je Sekunde, beruehren
    // weder Datenbank noch Partie und haben in this.takt ihre eigene Bremse —
    // im Fenster erschoepften sie das Budget und die Verbindung fiele mitten
    // in der Partie.
    const zaehlt = (roh as { type?: unknown } | null)?.type !== 'takt';
    if (zaehlt) {
      const jetzt = Date.now();
      if (jetzt - connection.fensterStart > NACHRICHTEN_FENSTER_MS) {
        connection.fensterStart = jetzt;
        connection.imFenster = 0;
      }
      connection.imFenster += 1;
      if (connection.imFenster > NACHRICHTEN_JE_FENSTER) {
        send(connection.socket, errorMessage('tooManyMessages'));
        connection.socket.close();
        return;
      }
    }

    // Erst pruefen, dann anfassen: Frueher ging jedes Feld ungeprueft in die
    // Tischverwaltung, und eine erfundene tableId landete als Datenbankfehler
    // im Log statt als saubere Ablehnung.
    const geprueft = clientMessageSchema.safeParse(roh);
    if (!geprueft.success) {
      const v = (roh as { v?: unknown } | null)?.v;
      send(
        connection.socket,
        errorMessage(
          v !== undefined && v !== ENVELOPE_VERSION
            ? 'protocolVersionUnsupported'
            : 'malformedMessage',
        ),
      );
      return;
    }
    const message: ClientMessage = geprueft.data as ClientMessage;

    try {
      switch (message.type) {
        case 'join':
          await this.join(connection, message);
          break;
        case 'action':
          await this.runtime.act(message.tableId, connection.accountId, message.action);
          break;
        case 'leave':
          this.leave(connection);
          break;
        case 'emote':
          await this.emote(connection, message);
          break;
        case 'takt':
          this.takt(connection, message);
          break;
        case 'reaktion':
          this.reaktion(connection, message);
          break;
        case 'addBot':
          await this.setBot(connection, message.tableId, message.seat, true);
          break;
        case 'removeBot':
          await this.setBot(connection, message.tableId, message.seat, false);
          break;
        case 'setBotLevel':
          await this.setBotLevel(connection, message.tableId, message.level);
          break;
        default:
          send(connection.socket, errorMessage('unknownMessageType'));
      }
    } catch (err) {
      if (err instanceof AppError) {
        send(connection.socket, errorMessage(err.code, err.messageKey));
      } else {
        // Regelverstoesse wirft das Spielmodul als gewoehnlichen Fehler. Der
        // Client bekommt keinen Text, sondern einen Schluessel.
        send(connection.socket, errorMessage('actionRejected'));
      }
    }
  }

  private async join(
    connection: Connection,
    message: Extract<ClientMessage, { type: 'join' }>,
  ): Promise<void> {
    const { table, seats } = await tableWithSeats(this.db, message.tableId);

    // Mindestversion wird beim Beitritt erzwungen, nicht mitten in der Partie.
    const expected = requireModule(table.gameId).protocolVersion;
    if (!moduleVersionAccepted(message.moduleVersion, expected)) {
      send(connection.socket, errorMessage('clientTooOld'));
      connection.socket.close();
      return;
    }

    /**
     * Wer darf zusehen?
     *
     * Vorher niemand geprueft: Mit einer fremden Tisch-Kennung bekam jeder
     * Angemeldete dauerhaft Sitzbelegung, Spielstand und Stiche eines
     * privaten Clantisches - und sein Beitritt startete den Tisch sogar,
     * bevor die Eingeladenen da waren. Handkarten waren nie betroffen, die
     * Zuschauersicht entfernt sie.
     */
    const sitzt = seats.some((seat) => seat.accountId === connection.accountId);
    if (!sitzt) {
      if (table.visibility === 'club_only') {
        if (!table.clubId) throw forbidden('notSeated');
        await requireClubMember(this.db, table.clubId, connection.accountId);
      } else if (table.visibility === 'on_request') {
        throw forbidden('notSeated');
      }
    }

    // Alten Raum verlassen. Ohne das blieb die Verbindung nach einem
    // Tischwechsel im vorherigen Raum eingetragen, bekam dessen Rundrufe
    // weiter und hinterliess bei jedem Wechsel einen Eintrag mehr.
    if (connection.tableId && connection.tableId !== message.tableId) {
      const alt = this.byTable.get(connection.tableId);
      alt?.delete(connection);
      if (alt && alt.size === 0) this.byTable.delete(connection.tableId);
      this.runtime.setPresence(connection.tableId, connection.accountId, false);
    }

    // Erst in den Raum, dann alles Weitere. Ein Tisch, der noch auf Mitspieler
    // wartet, ist kein Fehler: Der Beitretende gehoert dazu und muss
    // mitbekommen, wenn sich die Plaetze fuellen.
    connection.tableId = message.tableId;
    /**
     * Jedes `join` ist ein Abgleich — auch das nach einem Wiederverbinden
     * oder nach der Rueckkehr in den Tab. Die Marke faellt deshalb hier auf
     * null, und die volle Sicht geht raus. Genau das macht den Ausschnitt
     * im Rundruf ungefaehrlich: Wer etwas verpasst haben koennte, hat
     * vorher ein `join` geschickt.
     */
    connection.sichtStand = null;
    /* Was dieser Client versteht, sagt er hier — und nur hier. */
    connection.moduleVersion = message.moduleVersion;
    let room = this.byTable.get(message.tableId);
    if (!room) {
      room = new Set();
      this.byTable.set(message.tableId, room);
    }
    room.add(connection);

    this.runtime.setPresence(message.tableId, connection.accountId, true);
    // Nur wer selbst sitzt, darf einen Tisch anlaufen lassen.
    if (sitzt) await this.ensureStarted(message.tableId);
    // Wer gerade beitritt, hat womoeglich selbst einen Platz besetzt (der
    // Beitritt laeuft ueber HTTP) — der zwischengespeicherte Stand kennt ihn
    // dann noch nicht.
    this.tischDaten.delete(message.tableId);
    await this.sendState(message.tableId, [connection]);
  }

  /**
   * Startet die Partie, sobald der Tisch bereit ist, oder holt eine laufende
   * nach einem Neustart zurueck. Ist der Tisch noch nicht voll, passiert
   * nichts — dann bleibt es beim Wartebereich.
   */
  private async ensureStarted(tableId: string): Promise<void> {
    if (this.runtime.get(tableId)) return;

    const { table, seats } = await tableWithSeats(this.db, tableId);
    if (table.status === 'running') {
      await this.runtime.resume(tableId);
      return;
    }
    if (table.status !== 'waiting') return;
    if (!isReadyToStart(table, seats)) return;

    await this.runtime.start(tableId);
  }

  private leave(connection: Connection): void {
    if (!connection.tableId) return;
    const tableId = connection.tableId;
    const room = this.byTable.get(tableId);
    room?.delete(connection);
    // Mit dem letzten Zuhoerer verschwindet auch, was fuer ihn aufgehoben
    // wurde. Sonst haelt jeder je besuchte Tisch fuer immer eine Zeile.
    if (room && room.size === 0) {
      this.byTable.delete(tableId);
      this.tischDaten.delete(tableId);
      this.zuletztGesendet.delete(tableId);
    }
    this.runtime.setPresence(tableId, connection.accountId, false);
    connection.tableId = null;
    connection.sichtStand = null;
  }

  /**
   * Zuruf an den Tisch.
   *
   * Weitergereicht wird nur, was aus der festen Liste kommt, von einem Sitz
   * kommt und nicht zu schnell kommt. Alle drei Faelle enden still: Ein
   * Zuruf, der nicht durchgeht, ist kein Fehler, den der Absender ausbaden
   * muesste — und eine Fehlermeldung waere genau die Aufmerksamkeit, auf die
   * es der Dauerklicker abgesehen hat.
   *
   * Zuschauer duerfen nicht rufen. Am echten Tisch redet mit, wer mitspielt.
   */
  private async emote(
    connection: Connection,
    message: Extract<ClientMessage, { type: 'emote' }>,
  ): Promise<void> {
    if (connection.tableId !== message.tableId) return;
    if (!istEmote(message.emote)) return;

    const jetzt = Date.now();
    if (jetzt - connection.letzterEmote < EMOTE_PAUSE_MS) return;

    const party = this.runtime.get(message.tableId);
    if (!party) return;
    const seat = this.runtime.seatOf(party, connection.accountId);
    if (seat === null) return;

    // Gekauft sein muss er auch. Sonst waere ein Aufruf mit fremder Kennung
    // der Weg, einen Zuruf zu benutzen, ohne ihn zu haben.
    if (!(await besitztEmote(this.db, connection.accountId, message.emote))) return;

    connection.letzterEmote = jetzt;

    const nachricht: EmoteMessage = {
      v: ENVELOPE_VERSION,
      game: party.gameId,
      type: 'emote',
      tableId: message.tableId,
      seat,
      emote: message.emote,
    };
    for (const ziel of this.byTable.get(message.tableId) ?? []) {
      send(ziel.socket, nachricht);
    }
  }

  /**
   * Takt-Herzschlag eines Echtzeitspiels, weitergereicht wie ein Zuruf.
   *
   * Der Server versteht ihn nicht und soll es nicht: Er stempelt den Sitz
   * und verteilt. Kein Partiestand, kein Schnappschuss, kein Sicht-Rundruf —
   * genau deshalb ist er keine Aktion (siehe protocol.ts). Was nicht
   * durchgeht, endet still: Ein Puls ist in 200 ms ohnehin wieder da.
   *
   * Nur wer selbst sitzt, darf pulsen — der Sitz im Umschlag ist die
   * Wahrheit fuer die Gegenseite, und ein Zuschauer haette hier nichts zu
   * melden.
   */
  private takt(
    connection: Connection,
    message: Extract<ClientMessage, { type: 'takt' }>,
  ): void {
    if (connection.tableId !== message.tableId) return;

    // Bremse gegen Dauerfeuer: Der Kern pulst alle 100 ms; was deutlich
    // schneller kommt, ist kein Herzschlag.
    const jetzt = Date.now();
    if (jetzt - connection.letzterTakt < 60) return;
    connection.letzterTakt = jetzt;

    const party = this.runtime.get(message.tableId);
    if (!party) return;
    const seat = this.runtime.seatOf(party, connection.accountId);
    if (seat === null) return;

    const nachricht: TaktMessage = {
      v: ENVELOPE_VERSION,
      game: party.gameId,
      type: 'takt',
      tableId: message.tableId,
      seat,
      takt: message.takt,
      grenzTakt: message.grenzTakt,
      pruef: message.pruef,
      /* Unveraendert durchreichen. Fehlt es (aelterer Client), fehlt es auch
       * drueben — und der Empfaenger nimmt die alte Regel. */
      ...(message.zuege === undefined ? {} : { zuege: message.zuege }),
    };
    for (const ziel of this.byTable.get(message.tableId) ?? []) {
      // Der Absender kennt seinen eigenen Takt — zurueckspiegeln waere Laerm.
      if (ziel !== connection) send(ziel.socket, nachricht);
    }
  }

  /**
   * Reaktion: ein Emoji ueber den Tisch, weitergereicht wie ein Herzschlag.
   *
   * Bewusst NICHT ueber den Zuruf-Weg gebaut, obwohl es aehnlich aussieht.
   * Drei Unterschiede, jeder davon ein eigener Grund:
   *
   *   1. **Takt.** Ein Zuruf darf alle zwei Sekunden kommen (EMOTE_PAUSE_MS),
   *      eine Reaktion viermal je Sekunde. Sie ist ein Zwischenruf, kein
   *      Statement.
   *   2. **Kein Besitz.** Zurufe muessen gekauft sein. Reaktionen gehoeren
   *      zum Spiel und kosten nichts — eine Abfrage in der Datenbank je Tipp
   *      waere bei diesem Takt ohnehin nicht vertretbar.
   *   3. **Nur eine Zahl.** Der Server kennt den Zeichenvorrat nicht. Damit
   *      gibt es hier nichts zu pruefen ausser dem Zahlenbereich, und nichts,
   *      was sich als Freitext missbrauchen liesse.
   *
   * Was nicht durchgeht, endet still — wie beim Herzschlag. Eine
   * Fehlermeldung waere genau die Aufmerksamkeit, auf die es ein
   * Dauerklicker abgesehen hat.
   */
  private reaktion(
    connection: Connection,
    message: Extract<ClientMessage, { type: 'reaktion' }>,
  ): void {
    if (connection.tableId !== message.tableId) return;

    // Viermal je Sekunde. Die Bremse steht hier UND im Client: Was ohnehin
    // verworfen wuerde, muss die Leitung nicht belasten — aber der Client
    // ist nicht die Stelle, an der eine Grenze durchgesetzt wird.
    const jetzt = Date.now();
    if (jetzt - connection.letzteReaktion < 250) return;

    const party = this.runtime.get(message.tableId);
    if (!party) return;
    // Zuschauer reagieren nicht. Am echten Tisch ruft mit, wer mitspielt.
    const seat = this.runtime.seatOf(party, connection.accountId);
    if (seat === null) return;

    connection.letzteReaktion = jetzt;

    const nachricht: ReaktionMessage = {
      v: ENVELOPE_VERSION,
      game: party.gameId,
      type: 'reaktion',
      tableId: message.tableId,
      seat,
      zeichen: message.zeichen,
      ...(message.motiv ? { motiv: message.motiv } : {}),
    };
    for (const ziel of this.byTable.get(message.tableId) ?? []) {
      /*
       * Nur an Clients, die den Nachrichtentyp kennen.
       *
       * Ein aelterer Client faellt bei einer unbekannten Nachricht in seinen
       * Sicht-Zweig und setzt sie als Sicht — das Brett waere danach leer.
       * Die gemeldete Modulversion ist die einzige verlaessliche Auskunft
       * darueber, was drueben laeuft; nach einem Deploy verbinden alte
       * Geraete mit dem alten Buendel im Speicher neu. Dieselbe Lehre wie
       * bei der Feldherr-Sicht am 9. August.
       *
       * Der Absender bekommt nichts zurueck: Er hat sein eigenes Emoji schon
       * fliegen sehen, bevor die Nachricht draussen war.
       */
      if (ziel === connection) continue;
      if (ziel.moduleVersion < REAKTION_AB_MODULVERSION) continue;
      // Ein Motiv braucht einen Client, der das Feld kennt. Sonst zeigte er
      // das Emoji Nummer 0 — etwas anderes, als geschickt wurde.
      if (message.motiv && ziel.moduleVersion < MOTIV_AB_MODULVERSION) continue;
      send(ziel.socket, nachricht);
    }
  }

  /**
   * Bot auf einen freien Platz setzen oder wieder entfernen. Danach der
   * uebliche Rundruf: Fuellt der Bot den letzten Platz, startet die Partie in
   * ensureStarted von selbst; sonst sehen alle den aktualisierten Wartebereich.
   */
  private async setBot(
    connection: Connection,
    tableId: string,
    seat: number,
    wantBot: boolean,
  ): Promise<void> {
    await setSeatBot(this.db, tableId, seat, wantBot, connection.accountId);
    await this.broadcast(tableId);
  }

  /**
   * Bot-Spielstaerke des Tisches setzen. Gilt fuer alle Bots des Tisches; der
   * anschliessende Rundruf traegt die neue Stufe an alle im Wartebereich.
   */
  private async setBotLevel(
    connection: Connection,
    tableId: string,
    level: BotLevel,
  ): Promise<void> {
    await setTableBotLevel(this.db, tableId, level, connection.accountId);
    await this.broadcast(tableId);
  }

  private async broadcast(tableId: string, nurSicht = false): Promise<void> {
    const room = this.byTable.get(tableId);
    if (!room || room.size === 0) {
      this.tischDaten.delete(tableId);
      this.zuletztGesendet.delete(tableId);
      return;
    }
    if (!nurSicht) {
      // Alles ausser einer reinen Spielstands-Aenderung kann Tisch und Sitze
      // beruehrt haben: Der zwischengespeicherte Stand ist damit hinfaellig.
      this.tischDaten.delete(tableId);
      // Ein Beitritt ueber HTTP kann den Tisch vollgemacht haben.
      await this.ensureStarted(tableId);
    }
    await this.sendState(tableId, [...room], { nurSicht, anRaum: true });
  }

  /**
   * Tischzeile, Sitze und Anzeigenamen — die drei Abfragen, die jeder
   * Rundruf brauchte.
   *
   * Sie aendern sich nur, wenn jemand kommt, geht, zum Bot wird oder die
   * Partie beginnt bzw. endet — nie durch einen Spielzug. Bei einem
   * Kartenspiel faellt das nicht auf; Feldherr ruft mehrmals je Sekunde
   * ueber Minuten hinweg, und drei Datenbankfragen je Zug landen als
   * Wartezeit zwischen Tipp und sichtbarem Zug. Jeder Anlass, der nicht
   * "nur die Sicht" ist, wirft den Eintrag weg (siehe broadcast).
   */
  private readonly tischDaten = new Map<string, TischDaten>();
  /**
   * Zuletzt an den Raum geschickte Tisch- und Partienachricht, als Text.
   * Waehrend einer Partie sind beide von Zug zu Zug meist Wort fuer Wort
   * dieselben — sie erneut zu schicken kostet Bytes auf der Leitung und
   * beim Empfaenger ein Neuzeichnen fuer nichts.
   */
  private readonly zuletztGesendet = new Map<string, { tisch: string; partie: string }>();

  private async ladeTischDaten(tableId: string): Promise<TischDaten | null> {
    const zwischen = this.tischDaten.get(tableId);
    if (zwischen) return zwischen;

    const [table] = await this.db
      .select()
      .from(s.gameTable)
      .where(eq(s.gameTable.id, tableId));
    if (!table) return null;

    const seatRows = await this.db
      .select({
        seatIndex: s.tableSeat.seatIndex,
        isBot: s.tableSeat.isBot,
        accountId: s.tableSeat.accountId,
      })
      .from(s.tableSeat)
      .where(eq(s.tableSeat.tableId, tableId));

    const accountIds = seatRows.map((row) => row.accountId).filter(Boolean) as string[];
    const names =
      accountIds.length > 0
        ? await this.db
            .select({
              id: s.account.id,
              displayName: s.account.displayName,
              hasAvatar: sql<boolean>`${s.account.avatar} is not null`,
            })
            .from(s.account)
            .where(inArray(s.account.id, accountIds))
        : [];
    const nameOf = new Map(names.map((row) => [row.id, row.displayName]));
    const avatarOf = new Map(names.map((row) => [row.id, row.hasAvatar]));

    const daten: TischDaten = {
      table,
      seatRows: seatRows.slice().sort((a, b) => a.seatIndex - b.seatIndex),
      nameOf,
      avatarOf,
    };
    this.tischDaten.set(tableId, daten);
    return daten;
  }

  /** Jede Verbindung bekommt ihre eigene, gefilterte Sicht. */
  private async sendState(
    tableId: string,
    targets: readonly Connection[],
    /**
     * `anRaum` heisst: Dieser Versand geht an ALLE am Tisch. Nur dann darf
     * er festhalten, was zuletzt geschickt wurde — die Antwort auf ein
     * einzelnes `join` sagt nichts darueber aus, was die anderen kennen,
     * und duerfte ihnen sonst eine Nachricht wegkuerzen, die sie nie
     * bekommen haben.
     */
    { nurSicht, anRaum }: { nurSicht: boolean; anRaum: boolean } = {
      nurSicht: false,
      anRaum: false,
    },
  ): Promise<void> {
    const daten = await this.ladeTischDaten(tableId);
    if (!daten) return;
    const { table, seatRows, nameOf, avatarOf } = daten;

    const party = this.runtime.get(tableId);

    const seats = seatRows.map((row) => ({
      seat: row.seatIndex,
      displayName: row.accountId ? (nameOf.get(row.accountId) ?? null) : null,
      accountId: row.accountId,
      isBot: row.isBot || (party?.botControlled.has(row.seatIndex) ?? false),
      // Nur eine kurze URL ueber die Leitung; die Bytes holt der Browser
      // einmal und behaelt sie im Cache.
      avatarUrl:
        row.accountId && avatarOf.get(row.accountId)
          ? `/api/avatars/${row.accountId}`
          : null,
    }));

    // Der Tisch selbst geht immer raus: Wer wartet, soll sehen, wer schon da
    // ist und wie viele noch fehlen.
    const tableMessage: ServerMessage = {
      v: ENVELOPE_VERSION,
      game: table.gameId,
      type: 'table',
      tableId,
      status: table.status,
      seats,
      missing: Math.max(0, table.seats - seatRows.filter((row) => row.accountId).length),
      rounds: table.maxRounds,
      visibility: table.visibility,
      paused: table.pausedAt !== null || (party?.paused ?? false),
      botLevel: tableBotLevel(table.filters),
    };

    /**
     * Beim Rundruf nach einem Zug wird nur geschickt, was sich auch geaendert
     * hat.
     *
     * Wortgleiche Nachrichten kosten nicht nur Bytes: Der Client setzt
     * daraufhin seinen Zustand neu und zeichnet den Tisch mit. Waehrend einer
     * Feldherr-Partie sind Tisch- und Partienachricht von Zug zu Zug fast
     * immer identisch — nur ihre Sicht unterscheidet sich. Wer neu dazukommt,
     * bekommt beide trotzdem: Dieser Weg gilt allein fuer den Rundruf an den
     * ganzen Raum (`nurSicht`), nie fuer die Antwort auf ein `join`.
     */
    const alt = this.zuletztGesendet.get(tableId);
    const tischText = JSON.stringify(tableMessage);
    const tischGleich = nurSicht && alt?.tisch === tischText;
    if (!tischGleich) for (const connection of targets) send(connection.socket, tableMessage);

    // Laeuft noch keine Partie, ist der Wartebereich alles, was es zu sagen gibt.
    if (!party) {
      if (anRaum) this.zuletztGesendet.set(tableId, { tisch: tischText, partie: '' });
      return;
    }

    const partyMessage: ServerMessage = {
      v: ENVELOPE_VERSION,
      game: party.gameId,
      type: 'party',
      tableId,
      standings: this.runtime.standings(party),
      seats,
      trophies: party.awards,
    };
    const partieText = JSON.stringify(partyMessage);
    const partieGleich = nurSicht && alt?.partie === partieText;
    if (anRaum) this.zuletztGesendet.set(tableId, { tisch: tischText, partie: partieText });

    /**
     * Stand des anwachsenden Sichtteils VOR dem Versand einlesen: Jede
     * Verbindung bekommt alles ab ihrer eigenen Marke und traegt danach den
     * neuen Stand ein. Bei allen Spielen ausser Feldherr ist er 0, `seit`
     * bleibt 0, und es aendert sich nichts.
     */
    const stand = this.runtime.viewCursor(party);
    /**
     * Den Ausschnitt bekommt nur, wer die aktuelle Protokollversion des
     * Moduls gemeldet hat. Alle anderen — insbesondere jedes Geraet, das
     * einen Deploy im Speicher ueberlebt hat — bekommen weiter die volle
     * Sicht. Lieber ein paar Kilobyte zu viel an ein altes Programm als ein
     * Ausschnitt, den es als ganze Liste liest.
     */
    const aktuelleVersion = requireModule(party.gameId).protocolVersion;
    for (const connection of targets) {
      const zuwachsFaehig = connection.moduleVersion >= aktuelleVersion;
      const seit = zuwachsFaehig ? (connection.sichtStand ?? 0) : 0;
      const state = this.runtime.viewFor(party, connection.accountId, seit);
      connection.sichtStand = stand;
      send(connection.socket, {
        v: ENVELOPE_VERSION,
        game: party.gameId,
        type: 'view',
        tableId,
        ruleSetVersion: table.ruleSetVersion,
        ...state,
      });
      if (!partieGleich) send(connection.socket, partyMessage);
    }
  }
}

/** Was ein Rundruf ueber Tisch und Sitze wissen muss. Siehe `tischDaten`. */
interface TischDaten {
  readonly table: typeof s.gameTable.$inferSelect;
  readonly seatRows: readonly {
    seatIndex: number;
    isBot: boolean;
    accountId: string | null;
  }[];
  readonly nameOf: ReadonlyMap<string, string>;
  readonly avatarOf: ReadonlyMap<string, boolean>;
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}
