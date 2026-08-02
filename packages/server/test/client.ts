/**
 * Testclient.
 *
 * Bildet nach, was der Web-Client tut, und haelt sich an dieselbe Regel: Er
 * baut seine Zuege ausschliesslich aus legalActions und der gefilterten Sicht.
 * Regelwissen hat er nicht — genau deshalb taugt er als Beweis, dass die
 * Schnittstelle ausreicht.
 */

import { WebSocket } from 'ws';

import {
  ENVELOPE_VERSION,
  type ServerMessage,
  type ViewMessage,
} from '../src/realtime/protocol.js';

interface Card {
  readonly id: number;
}

interface RoundView {
  readonly hand: readonly Card[];
  readonly armut: {
    readonly awaiting: 'decide' | 'handover' | 'return' | null;
    readonly handoverSize: number;
  };
}

interface DokoView {
  readonly round: RoundView | null;
}

export class TestClient {
  private socket!: WebSocket;
  private readonly seen: ServerMessage[] = [];
  lastView: ViewMessage | null = null;
  lastTable: Extract<ServerMessage, { type: 'table' }> | null = null;
  errors: string[] = [];
  /** Auf true setzen, damit der Client nicht mehr selbst zieht. */
  passive = false;
  private actedAt = -1;

  private constructor(
    readonly name: string,
    private readonly url: string,
    private readonly cookie: string,
  ) {}

  static async connect(url: string, cookie: string, name = 'client'): Promise<TestClient> {
    const client = new TestClient(name, url, cookie);
    await client.open();
    return client;
  }

  private open(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url, { headers: { cookie: this.cookie } });
      this.socket.on('open', () => resolve());
      this.socket.on('error', reject);
      this.socket.on('message', (raw) => this.receive(JSON.parse(raw.toString())));
    });
  }

  private receive(message: ServerMessage): void {
    this.seen.push(message);
    if (message.type === 'error') {
      this.errors.push(message.code);
      return;
    }
    if (message.type === 'table') {
      this.lastTable = message;
      return;
    }
    if (message.type !== 'view') return;

    // Revisionsnummer: veraltete Nachrichten werden verworfen.
    if (this.lastView && message.revision < this.lastView.revision) return;
    this.lastView = message;

    if (!this.passive) this.autoPlay(message);
  }

  private autoPlay(view: ViewMessage): void {
    if (view.finished || view.seat === null) return;

    // Nur handeln, wenn dieser Sitz wirklich dran ist. Ansagen waeren auch
    // ausserhalb des Zugrechts erlaubt, aber ein Automat, der jede angebotene
    // Ansage macht, sagt sich durch alle Stufen und laesst die Partie nicht
    // vorankommen. Ansagen deckt der Adaptertest ab.
    if (view.currentActor !== view.seat) return;

    // Je Zustand hoechstens eine Aktion. Ohne das wuerde derselbe Zug auf jede
    // eingehende Sicht erneut gesendet und ab dem zweiten Mal abgelehnt.
    if (this.actedAt === view.revision) return;
    this.actedAt = view.revision;

    const armut = (view.view as DokoView).round?.armut;
    const hand = (view.view as DokoView).round?.hand ?? [];

    // Kartenmengen sind nicht aufzaehlbar und kommen deshalb nicht aus
    // legalActions. Der Client stellt sie aus der Sicht zusammen; ob sie
    // zulaessig sind, entscheidet der Server.
    if (armut?.awaiting === 'return' && armut.handoverSize > 0) {
      this.send({
        type: 'armutReturn',
        seat: view.seat,
        cards: hand.slice(0, armut.handoverSize).map((card) => card.id),
      });
      return;
    }
    if (armut?.awaiting === 'handover' && view.legalActions.length === 0) {
      this.send({
        type: 'armutHandover',
        seat: view.seat,
        cards: hand.slice(0, armut.handoverSize).map((card) => card.id),
      });
      return;
    }

    // Ansagen sind freiwillig und werden hier uebergangen.
    const usable = view.legalActions.filter(
      (candidate) => (candidate as { type: string }).type !== 'announce',
    );
    if (usable.length === 0) return;

    const action =
      usable.find((candidate) => (candidate as { type: string }).type === 'playCard') ??
      usable[0];

    this.send(action);
  }

  private send(action: unknown): void {
    if (!this.lastView) return;
    this.socket.send(
      JSON.stringify({
        v: ENVELOPE_VERSION,
        game: this.lastView.game,
        type: 'action',
        tableId: this.lastView.tableId,
        action,
      }),
    );
  }

  join(tableId: string, moduleVersion = 1, game = 'doppelkopf'): void {
    this.socket.send(
      JSON.stringify({ v: ENVELOPE_VERSION, game, type: 'join', tableId, moduleVersion }),
    );
  }

  raw(message: unknown): void {
    this.socket.send(JSON.stringify(message));
  }

  messages<T extends ServerMessage['type']>(type: T): Extract<ServerMessage, { type: T }>[] {
    return this.seen.filter((m) => m.type === type) as Extract<ServerMessage, { type: T }>[];
  }

  /** Wartet, bis die Bedingung erfuellt ist, oder scheitert nach timeoutMs. */
  async waitFor(
    predicate: () => unknown,
    what: string,
    timeoutMs = 20_000,
  ): Promise<void> {
    const until = Date.now() + timeoutMs;
    while (!predicate()) {
      if (Date.now() > until) {
        throw new Error(
          `Zeit abgelaufen beim Warten auf ${what} ` +
            `(letzte Revision ${this.lastView?.revision ?? '-'}, Fehler: ${this.errors.join(',') || 'keine'})`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  close(): void {
    this.socket.close();
  }
}
