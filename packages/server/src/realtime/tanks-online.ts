import { randomBytes } from 'node:crypto';
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { TanksOnlineRaum } from '@brauweg/broremote-kern/tanks/online';
import type { TanksEingabe } from '@brauweg/broremote-kern/tanks/partie';

type Raum = {
  kern: TanksOnlineRaum;
  tokens: Map<string, string>;
  leitungen: Map<string, WebSocket>;
  leerSeit: number;
};
const kennung = () => randomBytes(4).toString('hex').toUpperCase();
const ganz = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
function aktion(n: Record<string, unknown>): TanksEingabe | null {
  if (n.art === 'reset') return { art: 'reset' };
  if (n.art === 'steuerung' && ganz(n.x, -1, 1))
    return { art: 'steuerung', x: n.x, y: 0, tasten: [] };
  if (
    (n.art === 'zielen' || n.art === 'feuer') &&
    ganz(n.winkel, 0, 180) &&
    ganz(n.staerke, 0, 100) &&
    ganz(n.waffe, 0, 2) &&
    ganz(n.zug, 1, 10000)
  )
    return n.art === 'feuer'
      ? {
          art: 'feuer',
          zug: n.zug,
          winkel: n.winkel,
          staerke: n.staerke,
          waffe: n.waffe,
        }
      : { art: 'zielen', winkel: n.winkel, staerke: n.staerke, waffe: n.waffe };
  if (
    n.art === 'tanksitem' &&
    (n.item === 'reparatur' || n.item === 'schild') &&
    ganz(n.zug, 1, 10000)
  )
    return { art: 'tanksitem', item: n.item, zug: n.zug };
  return null;
}
export class TanksOnlineGateway {
  private readonly wss = new WebSocketServer({
    noServer: true,
    maxPayload: 2048,
    perMessageDeflate: false,
  });
  private readonly raeume = new Map<string, Raum>();
  private readonly leitungen = new Set<WebSocket>();
  private readonly jeIp = new Map<string, number>();
  private readonly takt: ReturnType<typeof setInterval>;
  private zaehler = 0;
  constructor(
    private readonly server: Server,
    private readonly origins: readonly string[] = [],
  ) {
    server.on('upgrade', this.upgrade);
    this.takt = setInterval(() => {
      const jetzt = Date.now();
      for (const [code, r] of this.raeume) {
        if (r.leitungen.size) r.leerSeit = jetzt;
        if (jetzt - r.leerSeit > 120_000 || jetzt - r.kern.seit > 3_600_000) {
          this.raeume.delete(code);
          for (const ws of r.leitungen.values()) {
            this.senden(ws, {
              art: 'fehler',
              text: 'Die Arena wurde geschlossen.',
              fatal: true,
            });
            ws.close();
          }
          continue;
        }
        r.kern.schritt(jetzt);
        for (const [token, id] of r.tokens)
          if (!r.kern.spieler.some((p) => p.id === id)) r.tokens.delete(token);
        if (this.zaehler % 5 === 0) this.verteilen(r);
      }
      this.zaehler++;
    }, 50);
    this.takt.unref();
  }
  private upgrade = (
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    if (req.url?.split('?')[0] !== '/ws/tanks-online') return;
    if (
      this.origins.length &&
      !this.origins.includes(req.headers.origin ?? '')
    ) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
      return;
    }
    const ip = req.socket.remoteAddress ?? '';
    if (this.leitungen.size >= 240 || (this.jeIp.get(ip) ?? 0) >= 20) {
      socket.end('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      return;
    }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.verbinden(ws, ip));
  };
  private senden(ws: WebSocket, n: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 256 * 1024) {
      ws.close(1013);
      return;
    }
    ws.send(JSON.stringify(n));
  }
  private verteilen(r: Raum): void {
    for (const [id, ws] of r.leitungen)
      this.senden(ws, r.kern.sicht(id, Date.now()));
  }
  private verbinden(ws: WebSocket, ip: string): void {
    this.leitungen.add(ws);
    this.jeIp.set(ip, (this.jeIp.get(ip) ?? 0) + 1);
    let raum: Raum | undefined,
      id = '',
      token = '',
      zuletzt = Date.now(),
      fenster = Date.now(),
      anzahl = 0;
    const wacht = setInterval(() => {
      if (Date.now() - zuletzt > 15_000) ws.close(1008);
    }, 5000);
    ws.on('error', () => ws.terminate());
    ws.on('message', (raw, binaer) => {
      if (binaer) {
        ws.close(1008);
        return;
      }
      zuletzt = Date.now();
      if (zuletzt - fenster > 1000) {
        fenster = zuletzt;
        anzahl = 0;
      }
      if (++anzahl > 50) {
        ws.close(1008);
        return;
      }
      try {
        const n = JSON.parse(raw.toString());
        if (!n || typeof n !== 'object' || Array.isArray(n))
          throw Error('Ungültige Nachricht.');
        if (n.art === 'ping') {
          if (typeof n.zeit === 'number')
            this.senden(ws, { art: 'pong', zeit: n.zeit });
          return;
        }
        if (!raum) {
          if (n.version !== 1)
            throw Error('Bitte öffne BroTanks Online erneut.');
          let r: Raum | undefined;
          if (n.art === 'weiter') {
            r = this.raeume.get(String(n.code));
            token = String(n.token);
            id = r?.tokens.get(token) ?? '';
            if (!r || !id || !r.kern.spieler.some((p) => p.id === id))
              throw Error('Diese Partie ist nicht mehr verfügbar.');
            r.leitungen.get(id)?.close();
          } else {
            if (!['online', 'privat', 'beitreten'].includes(n.art))
              throw Error('Bitte wähle einen Spieleinstieg.');
            if (n.art === 'beitreten') {
              r = this.raeume.get(String(n.code).toUpperCase());
              if (!r || r.kern.offen)
                throw Error('Diese Freundeslobby wurde nicht gefunden.');
            } else if (n.art === 'online')
              r = [...this.raeume.values()].find(
                (r) =>
                  r.kern.offen &&
                  !r.kern.partie &&
                  r.kern.spieler.length < 4 &&
                  r.leitungen.size > 0,
              );
            if (!r) {
              if (this.raeume.size >= 60)
                throw Error(
                  'Alle Arenen sind gerade belegt. Versuche es gleich noch einmal.',
                );
              let code: string;
              do {
                code = kennung();
              } while (this.raeume.has(code));
              r = {
                kern: new TanksOnlineRaum(
                  code,
                  randomBytes(4).readUInt32LE(),
                  n.art === 'online',
                  Date.now(),
                ),
                tokens: new Map(),
                leitungen: new Map(),
                leerSeit: Date.now(),
              };
              this.raeume.set(code, r);
            }
            id = randomBytes(12).toString('hex');
            token = randomBytes(24).toString('hex');
            if (
              !r.kern.hinzufuegen(
                id,
                typeof n.name === 'string' ? n.name : 'Bro',
                n.ohneBots === true,
              )
            )
              throw Error(
                'Diese Lobby ist voll oder die Partie läuft bereits.',
              );
            r.tokens.set(token, id);
          }
          raum = r;
          r.leitungen.set(id, ws);
          r.kern.verbindung(id, true, Date.now());
          this.senden(ws, { art: 'zugang', code: r.kern.code, token });
          this.verteilen(r);
          return;
        }
        // Eine ersetzte Leitung darf weder den Sitz steuern noch abmelden.
        if (raum.leitungen.get(id) !== ws) return;
        if (n.art === 'verlassen') {
          raum.kern.entfernen(id);
          raum.tokens.delete(token);
          raum.leitungen.delete(id);
          this.verteilen(raum);
          ws.close();
          return;
        }
        if (n.art === 'bots' && typeof n.ohneBots === 'boolean') {
          raum.kern.botWahl(id, n.ohneBots);
          this.verteilen(raum);
          return;
        }
        if (n.art === 'start') {
          if (!raum.kern.starten(id))
            this.senden(ws, {
              art: 'fehler',
              text: 'Zum Start müssen mindestens zwei Spieler verbunden sein oder Bots erlaubt werden.',
            });
          this.verteilen(raum);
          return;
        }
        const a = aktion(n);
        if (a) raum.kern.eingabe(id, n.zug, a);
      } catch (e) {
        this.senden(ws, {
          art: 'fehler',
          text: e instanceof Error ? e.message : 'Bitte versuche es erneut.',
          fatal: !raum,
        });
        if (!raum) ws.close(1008);
      }
    });
    ws.on('close', () => {
      clearInterval(wacht);
      this.leitungen.delete(ws);
      const n = (this.jeIp.get(ip) ?? 1) - 1;
      if (n) this.jeIp.set(ip, n);
      else this.jeIp.delete(ip);
      if (raum?.leitungen.get(id) === ws) {
        raum.leitungen.delete(id);
        raum.kern.verbindung(id, false, Date.now());
        this.verteilen(raum);
      }
    });
  }
  async close(): Promise<void> {
    clearInterval(this.takt);
    this.server.off('upgrade', this.upgrade);
    for (const ws of this.leitungen) ws.terminate();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}
