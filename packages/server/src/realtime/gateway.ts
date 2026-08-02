/**
 * WebSocket-Vermittlung.
 *
 * Verbindungen werden Tischen zugeordnet, Zustandsaenderungen als gefilterte
 * Sicht je Sitz verteilt. Der Client haelt keinen eigenen Verlauf: Beim
 * Wiederverbinden schickt der Server die vollstaendige aktuelle Sicht plus
 * Partiestand.
 */

import { eq, inArray } from 'drizzle-orm';
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';

import type { Db } from '../db/types.js';
import * as s from '../db/schema.js';
import { AppError } from '../errors.js';
import { sessionFromToken } from '../auth/service.js';
import { PartyRuntime } from '../runtime/party.js';
import { isReadyToStart, tableWithSeats } from '../tables/service.js';
import { requireModule } from '../games/registry.js';
import {
  ENVELOPE_VERSION,
  type ClientMessage,
  type ServerMessage,
  errorMessage,
  moduleVersionAccepted,
} from './protocol.js';

interface Connection {
  readonly socket: WebSocket;
  readonly accountId: string;
  tableId: string | null;
}

/** Liest das Sitzungs-Cookie aus dem Handshake. */
function cookieValue(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export class Gateway {
  private readonly wss: WebSocketServer;
  private readonly connections = new Set<Connection>();
  private readonly byTable = new Map<string, Set<Connection>>();

  constructor(
    server: Server,
    private readonly db: Db,
    private readonly runtime: PartyRuntime,
    private readonly cookieName = 'brauweg_session',
  ) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (socket, request) => {
      void this.accept(socket, request.headers.cookie);
    });
    this.runtime.onUpdate((tableId) => {
      void this.broadcast(tableId);
    });
  }

  async close(): Promise<void> {
    for (const connection of this.connections) connection.socket.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }

  private async accept(socket: WebSocket, cookieHeader?: string): Promise<void> {
    const token = cookieValue(cookieHeader, this.cookieName);
    const session = await sessionFromToken(this.db, token);
    if (!session) {
      send(socket, errorMessage('unauthorized'));
      socket.close();
      return;
    }

    const connection: Connection = {
      socket,
      accountId: session.accountId,
      tableId: null,
    };
    this.connections.add(connection);

    socket.on('message', (raw) => {
      void this.handle(connection, raw.toString());
    });
    socket.on('close', () => this.drop(connection));
  }

  private drop(connection: Connection): void {
    if (connection.tableId) {
      this.byTable.get(connection.tableId)?.delete(connection);
      // Verbindungsverlust pausiert nichts, der Zugtimer laeuft weiter.
      this.runtime.setPresence(connection.tableId, connection.accountId, false);
    }
    this.connections.delete(connection);
  }

  private async handle(connection: Connection, raw: string): Promise<void> {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      send(connection.socket, errorMessage('malformedMessage'));
      return;
    }

    if (message.v !== ENVELOPE_VERSION) {
      send(connection.socket, errorMessage('protocolVersionUnsupported'));
      return;
    }

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
    const { table } = await tableWithSeats(this.db, message.tableId);

    // Mindestversion wird beim Beitritt erzwungen, nicht mitten in der Partie.
    const expected = requireModule(table.gameId).protocolVersion;
    if (!moduleVersionAccepted(message.moduleVersion, expected)) {
      send(connection.socket, errorMessage('clientTooOld'));
      connection.socket.close();
      return;
    }

    // Erst in den Raum, dann alles Weitere. Ein Tisch, der noch auf Mitspieler
    // wartet, ist kein Fehler: Der Beitretende gehoert dazu und muss
    // mitbekommen, wenn sich die Plaetze fuellen.
    connection.tableId = message.tableId;
    let room = this.byTable.get(message.tableId);
    if (!room) {
      room = new Set();
      this.byTable.set(message.tableId, room);
    }
    room.add(connection);

    this.runtime.setPresence(message.tableId, connection.accountId, true);
    await this.ensureStarted(message.tableId);
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
    this.byTable.get(connection.tableId)?.delete(connection);
    this.runtime.setPresence(connection.tableId, connection.accountId, false);
    connection.tableId = null;
  }

  private async broadcast(tableId: string): Promise<void> {
    const room = this.byTable.get(tableId);
    if (!room || room.size === 0) return;
    // Ein Beitritt ueber HTTP kann den Tisch vollgemacht haben.
    await this.ensureStarted(tableId);
    await this.sendState(tableId, [...room]);
  }

  /** Jede Verbindung bekommt ihre eigene, gefilterte Sicht. */
  private async sendState(
    tableId: string,
    targets: readonly Connection[],
  ): Promise<void> {
    const [table] = await this.db
      .select()
      .from(s.gameTable)
      .where(eq(s.gameTable.id, tableId));
    if (!table) return;

    const seatRows = await this.db
      .select({
        seatIndex: s.tableSeat.seatIndex,
        isBot: s.tableSeat.isBot,
        accountId: s.tableSeat.accountId,
      })
      .from(s.tableSeat)
      .where(eq(s.tableSeat.tableId, tableId));

    const party = this.runtime.get(tableId);

    const accountIds = seatRows.map((row) => row.accountId).filter(Boolean) as string[];
    const names =
      accountIds.length > 0
        ? await this.db
            .select({ id: s.account.id, displayName: s.account.displayName })
            .from(s.account)
            .where(inArray(s.account.id, accountIds))
        : [];
    const nameOf = new Map(names.map((row) => [row.id, row.displayName]));

    const seats = seatRows
      .slice()
      .sort((a, b) => a.seatIndex - b.seatIndex)
      .map((row) => ({
        seat: row.seatIndex,
        displayName: row.accountId ? (nameOf.get(row.accountId) ?? null) : null,
        isBot: row.isBot || (party?.botControlled.has(row.seatIndex) ?? false),
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
    };
    for (const connection of targets) send(connection.socket, tableMessage);

    // Laeuft noch keine Partie, ist der Wartebereich alles, was es zu sagen gibt.
    if (!party) return;

    const partyMessage: ServerMessage = {
      v: ENVELOPE_VERSION,
      game: party.gameId,
      type: 'party',
      tableId,
      standings: this.runtime.standings(party),
      seats,
    };

    for (const connection of targets) {
      const state = this.runtime.viewFor(party, connection.accountId);
      send(connection.socket, {
        v: ENVELOPE_VERSION,
        game: party.gameId,
        type: 'view',
        tableId,
        ruleSetVersion: table.ruleSetVersion,
        ...state,
      });
      send(connection.socket, partyMessage);
    }
  }
}

function send(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}
