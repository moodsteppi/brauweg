import { randomBytes } from 'node:crypto';
import type { Server, IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, WebSocket } from 'ws';
import { aktionLesen, type Spieler, type TanksOptionen } from '@brauweg/broremote-kern';
import { TanksPartie } from '@brauweg/broremote-kern/tanks/partie';
import type { TanksStand } from '@brauweg/broremote-kern/tanks/online';

type Sitz = { spieler: Spieler; token: string; ws?: WebSocket; fehltSeit?: number };
type Raum = { code: string; host: string; sitze: Sitz[]; optionen: TanksOptionen; spiel?: TanksPartie; partie: number; seit: number; leerSeit: number };
const farben = ['#70dfc4', '#ffc961', '#ad9eff', '#ff8ca5'];
/** Online-Partien leben auf dem Server; kein Handy muss als Gastgeber die Physik weiterrechnen. */
export class TanksGateway {
  private wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  private raeume = new Map<string, Raum>();
  private leitungen = new Set<WebSocket>();
  private takt: ReturnType<typeof setInterval>;
  private letzteZeit = Date.now();
  private puffer = 0;
  private versand = 0;
  constructor(private server: Server, private origins: readonly string[] = []) {
    server.on('upgrade', this.upgrade);
    this.takt = setInterval(() => this.schritt(), 50);
    this.takt.unref();
  }
  private upgrade = (req: IncomingMessage, socket: Duplex, head: Buffer): void => {
    if (req.url?.split('?')[0] !== '/ws/tanks') return;
    if (this.origins.length && !this.origins.includes(req.headers.origin ?? '')) { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (this.leitungen.size >= 400) { socket.destroy(); return; }
    this.wss.handleUpgrade(req, socket, head, ws => this.verbinden(ws));
  };
  private senden(ws: WebSocket, n: unknown): void {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 262144) { ws.close(1013); return; }
    ws.send(JSON.stringify(n));
  }
  private verteilen(r: Raum): void {
    const s = r.spiel?.sicht();
    const sicht = s ? (({ schuss: _schuss, gelaende, ...rest }) => ({ ...rest, gelaende: Array.from(gelaende) }))(s) : undefined;
    for (const sitz of r.sitze) if (sitz.ws) {
      const n: TanksStand = { art: 'stand', code: r.code, ich: sitz.spieler.id, host: r.host,
        spieler: r.sitze.map(s => ({ ...s.spieler, verbunden: !!s.ws })), optionen: r.optionen,
        partie: r.partie, sicht, privat: r.spiel?.privatFuer(sitz.spieler.id) ?? undefined };
      this.senden(sitz.ws, n);
    }
  }
  private schritt(): void {
    const jetzt = Date.now();
    this.puffer += Math.min(250, jetzt - this.letzteZeit); this.letzteZeit = jetzt;
    const schritte = Math.floor(this.puffer / (1000 / 60)); this.puffer -= schritte * (1000 / 60);
    for (const [code, r] of this.raeume) {
      if (r.sitze.some(s => s.ws)) r.leerSeit = jetzt;
      if (jetzt - r.seit > 2 * 3600000 || jetzt - r.leerSeit > 120000) {
        for (const s of r.sitze) s.ws?.close(1000, 'Lobby beendet');
        this.raeume.delete(code); continue;
      }
      for (const s of [...r.sitze]) if (!s.ws && s.fehltSeit && jetzt - s.fehltSeit > 60000) {
        if (r.spiel) r.spiel.aufgeben(s.spieler.id);
        else this.entfernen(r, s);
      }
      if (r.spiel) for (let i = 0; i < schritte; i++) r.spiel.schritt();
      if (this.versand % 4 === 0) this.verteilen(r);
    }
    this.versand++;
  }
  private entfernen(r: Raum, s: Sitz): void {
    r.sitze = r.sitze.filter(x => x !== s);
    if (r.host === s.spieler.id) r.host = r.sitze.find(x => x.ws)?.spieler.id ?? r.sitze[0]?.spieler.id ?? '';
  }
  private verbinden(ws: WebSocket): void {
    this.leitungen.add(ws);
    let raum: Raum | undefined, sitz: Sitz | undefined, zuletzt = Date.now(), fenster = Date.now(), anzahl = 0;
    const frist = setInterval(() => { if (Date.now() - zuletzt > 15000) ws.terminate(); }, 5000);
    ws.on('error', () => ws.terminate());
    ws.on('message', (raw, binary) => {
      zuletzt = Date.now();
      if (zuletzt - fenster > 1000) { fenster = zuletzt; anzahl = 0; }
      if (binary || ++anzahl > 40) { ws.close(1008); return; }
      try {
        const n = JSON.parse(raw.toString());
        if (!n || typeof n !== 'object') throw Error('Ungültige Nachricht.');
        if (n.art === 'ping') { this.senden(ws, { art: 'pong', zeit: typeof n.zeit === 'number' ? n.zeit : 0 }); return; }
        if (!raum || !sitz) {
          if (n.art === 'weiter') {
            const r = this.raeume.get(String(n.code));
            const s = typeof n.token === 'string' && r?.sitze.find(s => s.token === n.token);
            if (!r || !s) { this.senden(ws, { art: 'fehler', fatal: true, text: 'Diese Lobby ist abgelaufen. Öffne eine neue Runde.' }); return; }
            s.ws?.close(1000, 'Auf anderem Gerät fortgesetzt'); raum = r; sitz = s;
          } else {
            if (!['oeffnen', 'beitreten'].includes(n.art)) throw Error('Bitte öffne eine Lobby oder tritt bei.');
            if (typeof n.name !== 'string' || !n.name.trim() || n.name.trim().length > 24) throw Error('Bitte gib einen Namen mit höchstens 24 Zeichen ein.');
            let r: Raum | undefined;
            if (n.art === 'beitreten') {
              r = this.raeume.get(String(n.code).trim().toUpperCase());
              if (!r || r.spiel) throw Error('Diese Lobby ist nicht offen.');
              if (r.sitze.length >= 4) throw Error('Die Lobby ist voll.');
            } else {
              if (this.raeume.size >= 100) throw Error('Gerade sind alle Lobbys belegt.');
              let code: string; do { code = randomBytes(4).toString('hex').toUpperCase(); } while (this.raeume.has(code));
              r = { code, host: '', sitze: [], optionen: { modus: 'einzel', serie: 1, karte: 0 }, partie: 0, seit: zuletzt, leerSeit: zuletzt };
              this.raeume.set(code, r);
            }
            sitz = { token: randomBytes(24).toString('hex'), spieler: { id: randomBytes(8).toString('hex'), name: n.name.trim().replace(/[\x00-\x1f]/g, ''), farbe: farben[r.sitze.length], bereit: false, verbunden: true } };
            r.sitze.push(sitz); if (!r.host) r.host = sitz.spieler.id; raum = r;
          }
          sitz.ws = ws; sitz.fehltSeit = undefined;
          this.senden(ws, { art: 'zugang', code: raum.code, token: sitz.token }); this.verteilen(raum); return;
        }
        // Ein ersetztes Socket darf auch vor seinem close-Ereignis keine Eingaben mehr senden.
        if (sitz.ws !== ws) return;
        if (n.art === 'verlassen') {
          raum.spiel?.aufgeben(sitz.spieler.id); sitz.ws = undefined;
          if (!raum.spiel) this.entfernen(raum, sitz); else sitz.fehltSeit = zuletzt;
          if (raum.host === sitz.spieler.id) raum.host = raum.sitze.find(s => s.ws)?.spieler.id ?? '';
          this.verteilen(raum); ws.close(); return;
        }
        if (n.art === 'bereit' && !raum.spiel && typeof n.wert === 'boolean') sitz.spieler.bereit = n.wert;
        if (n.art === 'karte' && raum.host === sitz.spieler.id && !raum.spiel && Number.isInteger(n.karte) && n.karte >= 0 && n.karte < 5) {
          raum.optionen.karte = n.karte; raum.sitze.forEach(s => { s.spieler.bereit = false; });
        }
        if (n.art === 'start') {
          if (raum.host !== sitz.spieler.id) throw Error('Nur der Ersteller startet die Runde.');
          if (raum.spiel || raum.sitze.length < 2 || !raum.sitze.every(s => s.ws && s.spieler.bereit)) throw Error('Mindestens zwei verbundene Spieler müssen bereit sein.');
          raum.partie++; raum.spiel = new TanksPartie(raum.sitze.map(s => s.spieler), randomBytes(4).readUInt32LE(), raum.optionen);
        }
        if (n.art === 'lobby' && raum.host === sitz.spieler.id && raum.spiel?.sicht().phase === 'ende') {
          raum.spiel = undefined; raum.sitze = raum.sitze.filter(s => s.ws); raum.sitze.forEach(s => { s.spieler.bereit = false; });
        }
        if (n.art === 'eingabe' && n.partie === raum.partie && raum.spiel) {
          const a = aktionLesen(n.aktion, 'zielen');
          if (a && (a.art === 'reset' || n.zug === raum.spiel.sicht().zug) && ['steuerung', 'zielen', 'feuer', 'tanksitem', 'reset'].includes(a.art)) raum.spiel.eingabe(sitz.spieler.id, a as Parameters<TanksPartie['eingabe']>[1]);
        }
        // Steuerung erzeugt keine Broadcast-Flut; Zustände kommen mit festem Takt.
        if (n.art !== 'eingabe') this.verteilen(raum);
      } catch (e) { this.senden(ws, { art: 'fehler', text: e instanceof Error ? e.message : 'Ungültige Nachricht.' }); }
    });
    ws.on('close', () => {
      clearInterval(frist); this.leitungen.delete(ws);
      if (raum && sitz?.ws === ws) {
        sitz.ws = undefined; sitz.fehltSeit = Date.now(); sitz.spieler.bereit = false;
        raum.spiel?.eingabe(sitz.spieler.id, { art: 'reset' });
        if (raum.host === sitz.spieler.id) raum.host = raum.sitze.find(s => s.ws)?.spieler.id ?? raum.host;
        this.verteilen(raum);
      }
    });
  }
  async close(): Promise<void> {
    clearInterval(this.takt); this.server.off('upgrade', this.upgrade);
    for (const ws of this.leitungen) ws.terminate();
    await new Promise<void>(resolve => this.wss.close(() => resolve()));
  }
}
