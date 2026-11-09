import { randomBytes, randomUUID } from 'node:crypto';
import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { BroRaum, lesen, MAX_NACHRICHT, raumkennung, type ServerNachricht } from '@brauweg/broremote-kern';

/** Kein Spielzustand im Relay. Nur Raumrechte, Sitzvergabe und adressierte Nachrichten. */
export class BroRemoteGateway {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: MAX_NACHRICHT, perMessageDeflate: false });
  private readonly raeume = new Map<string, { raum: BroRaum; seit: number }>();
  private readonly leitungen = new Map<string, WebSocket>();
  private readonly jeAdresse = new Map<string, number>();
  private readonly eroeffnungen = new Map<string, { seit: number; anzahl: number }>();
  private readonly takt: ReturnType<typeof setInterval>;
  private readonly upgrade: (r: IncomingMessage, s: Duplex, h: Buffer) => void;

  constructor(private readonly server: Server, erlaubteHerkunft: readonly string[] = []) {
    this.upgrade = (anfrage, socket, kopf) => {
      if (anfrage.url?.split('?')[0] !== '/ws/broremote') return;
      const herkunft = anfrage.headers.origin;
      if (erlaubteHerkunft.length && (!herkunft || !erlaubteHerkunft.includes(herkunft))) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return;
      }
      const ip = anfrage.socket.remoteAddress ?? 'unbekannt';
      if (this.leitungen.size >= 1000 || (this.jeAdresse.get(ip) ?? 0) >= 80) {
        socket.end('HTTP/1.1 429 Too Many Requests\r\nConnection: close\r\n\r\n'); return;
      }
      this.wss.handleUpgrade(anfrage, socket, kopf, ws => this.annehmen(ws, ip));
    };
    server.on('upgrade', this.upgrade);
    this.takt = setInterval(() => {
      const jetzt = Date.now();
      for (const [id, r] of this.raeume) {
        r.raum.tick();
        if (jetzt - r.seit > 12 * 60 * 60_000) r.raum.schliessen('Diese Lobby ist nach zwölf Stunden beendet. Öffne eine neue Lobby.');
        if (r.raum.beendet) this.raeume.delete(id);
      }
      for (const [ip, f] of this.eroeffnungen) if (jetzt - f.seit > 60_000) this.eroeffnungen.delete(ip);
    }, 200);
    this.takt.unref();
  }

  private senden = (id: string, n: ServerNachricht): void => {
    const ws = this.leitungen.get(id);
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    // Keine alten Steuerbefehle nachliefern, wenn die Leitung bereits überfüllt ist.
    if (ws.bufferedAmount > 64 * 1024) { ws.close(1013, 'Verbindung zu langsam'); return; }
    ws.send(JSON.stringify({ v: 1, ...n }));
  };

  private annehmen(ws: WebSocket, ip: string): void {
    const id = randomUUID();
    let raum: BroRaum | undefined;
    this.leitungen.set(id, ws);
    this.jeAdresse.set(ip, (this.jeAdresse.get(ip) ?? 0) + 1);
    const frist = setTimeout(() => ws.close(1008, 'Anmeldung fehlt'), 8000);
    ws.on('error', () => ws.terminate());
    ws.on('message', (daten, binaer) => {
      const n = !binaer && lesen(daten.toString());
      if (!n) { ws.close(1008, 'Ungültige Nachricht'); return; }
      if (raum) { raum.empfangen(id, n); return; }
      if (n.art === 'oeffnen') {
        const jetzt = Date.now();
        const f = this.eroeffnungen.get(ip) ?? { seit: jetzt, anzahl: 0 };
        if (jetzt - f.seit > 60_000) { f.seit = jetzt; f.anzahl = 0; }
        this.eroeffnungen.set(ip, f);
        if (++f.anzahl > 30 || this.raeume.size >= 200) {
          this.senden(id, { art: 'beendet', text: 'Gerade sind zu viele Lobbys offen. Bitte versuche es später erneut.' }); ws.close(); return;
        }
        let kennung: string;
        do { kennung = randomBytes(4).toString('hex').toUpperCase(); } while (this.raeume.has(kennung));
        raum = new BroRaum({ raum: kennung, jetzt: Date.now, zufall: () => randomBytes(16).toString('hex'), senden: this.senden, trennen: v => this.leitungen.get(v)?.close() });
        this.raeume.set(kennung, { raum, seit: jetzt });
        raum.anmelden(id, { v: 1, art: 'gastgeber', schluessel: raum.hostSchluessel });
      } else {
        const gefunden = raumkennung(n.raum) ? this.raeume.get(n.raum)?.raum : undefined;
        if (!gefunden || !gefunden.anmelden(id, n)) {
          this.senden(id, { art: 'beendet', text: 'Kein Zugang zu dieser Lobby. Bitte scanne einen aktuellen QR-Code.' }); ws.close(); return;
        }
        raum = gefunden;
      }
      clearTimeout(frist);
    });
    ws.on('close', () => {
      clearTimeout(frist);
      this.leitungen.delete(id);
      const rest = (this.jeAdresse.get(ip) ?? 1) - 1;
      if (rest > 0) this.jeAdresse.set(ip, rest); else this.jeAdresse.delete(ip);
      raum?.abmelden(id);
    });
  }

  async close(): Promise<void> {
    clearInterval(this.takt);
    this.server.off('upgrade', this.upgrade);
    for (const { raum } of this.raeume.values()) raum.schliessen('Der Server wird neu gestartet. Bitte öffne danach eine neue Lobby.');
    for (const ws of this.leitungen.values()) ws.terminate();
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
  }
}
