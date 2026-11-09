import { BroRaum, lesen, type Nachricht, type ServerNachricht } from '@brauweg/broremote-kern';

type NativEreignis = { art: string; id?: string; text?: string; adressen?: string[]; host?: boolean };
type NativFenster = Window & { BroRemoteNativ?: (daten: Record<string, unknown>) => void };
export const hatLan = (): boolean => typeof (window as NativFenster).BroRemoteNativ === 'function';
export function nativ(daten: Record<string, unknown>): void { (window as NativFenster).BroRemoteNativ?.(daten); }
export function nativLauschen(fn: (e: NativEreignis) => void): () => void {
  const listener = (e: Event): void => fn((e as CustomEvent<NativEreignis>).detail);
  window.addEventListener('brauweg:broremote', listener);
  return () => window.removeEventListener('brauweg:broremote', listener);
}
export function zufall(): string {
  return [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
}

export interface Kanal { senden(n: Nachricht): boolean; schliessen(): void }
export interface Ereignisse {
  offen(): void;
  nachricht(n: ServerNachricht): void;
  zu(): void;
  fehler(text: string): void;
}

/** Gemeinsamer Vertrag: weder die Controller noch das spätere Spiel kennen WebSocket oder Swift. */
export function netzKanal(adresse: string, lokal: boolean, e: Ereignisse): Kanal {
  let aktiv = false, beendet = false;
  if (lokal) {
    const id = zufall();
    const abmelden = nativLauschen(n => {
      if (n.id !== id || beendet) return;
      if (n.art === 'offen') { aktiv = true; e.offen(); }
      if (n.art === 'text' && n.text) {
        const m = lesen(n.text); if (m) e.nachricht(m as unknown as ServerNachricht);
      }
      if (n.art === 'wartet') e.fehler(n.text ?? 'Warte auf das lokale Netzwerk.');
      if (n.art === 'zu') { aktiv = false; abmelden(); e.zu(); }
    });
    nativ({ art: 'verbinden', adresse, id });
    return {
      senden(n) { if (!aktiv || beendet) return false; nativ({ art: 'senden', id, text: JSON.stringify({ ...n, v: 1 }) }); return true; },
      schliessen() { beendet = true; abmelden(); nativ({ art: 'trennen', id }); },
    };
  }
  const ws = new WebSocket(adresse);
  ws.onopen = () => { aktiv = true; if (!beendet) e.offen(); };
  ws.onmessage = m => {
    if (beendet || typeof m.data !== 'string') return;
    const n = lesen(m.data); if (n) e.nachricht(n as unknown as ServerNachricht);
  };
  ws.onerror = () => e.fehler('Die Verbindung ist unterbrochen. Wir versuchen es erneut.');
  ws.onclose = () => { aktiv = false; if (!beendet) e.zu(); };
  return {
    senden(n) {
      if (!aktiv || beendet || ws.readyState !== WebSocket.OPEN) return false;
      if (ws.bufferedAmount > 16_384) { ws.close(); return false; }
      ws.send(JSON.stringify({ ...n, v: 1 })); return true;
    },
    schliessen() { beendet = true; ws.close(); },
  };
}

export type Zugang = {
  transport: 'relay' | 'lan'; adresse: string; rolle: 'gastgeber' | 'spieler';
  raum?: string; schluessel?: string; einladung?: string; name?: string;
};
export type Status = 'verbinden' | 'verbunden' | 'wiederverbinden' | 'beendet';
export interface SitzungsEreignisse {
  nachricht(n: ServerNachricht): void;
  status(s: Status): void;
  fehler(t: string): void;
  merken(z: Zugang): void;
}
export class Verbindung implements Kanal {
  private kanal?: Kanal;
  private beendet = false;
  private authentifiziert = false;
  private lauf = 0;
  private letzteNachricht = Date.now();
  private ausfallSeit = Date.now();
  private versuch = 0;
  private wieder?: ReturnType<typeof setTimeout>;
  private readonly takt: ReturnType<typeof setInterval>;
  constructor(private zugang: Zugang, private e: SitzungsEreignisse,
    private oeffner = netzKanal) {
    this.takt = setInterval(() => {
      if (this.beendet) return;
      if (this.authentifiziert) this.kanal?.senden({ art: 'ping' });
      if (Date.now() - this.letzteNachricht > 12_000 && !this.wieder) this.abbruch();
    }, 3000);
    this.starten();
  }
  private starten(): void {
    if (this.beendet) return;
    const lauf = ++this.lauf;
    this.letzteNachricht = Date.now();
    this.e.status(this.versuch ? 'wiederverbinden' : 'verbinden');
    this.kanal = this.oeffner(this.zugang.adresse, this.zugang.transport === 'lan', {
      offen: () => {
        if (lauf !== this.lauf || this.beendet) return;
        const z = this.zugang;
        this.kanal?.senden(z.schluessel
          ? { art: z.rolle === 'gastgeber' ? 'gastgeber' : 'fortsetzen', raum: z.raum, schluessel: z.schluessel }
          : z.rolle === 'gastgeber' ? { art: 'oeffnen' } : { art: 'beitreten', raum: z.raum, einladung: z.einladung, name: z.name });
      },
      nachricht: n => {
        if (lauf !== this.lauf || this.beendet) return;
        this.letzteNachricht = Date.now();
        if (n.art === 'willkommen') {
          this.authentifiziert = true; this.versuch = 0; this.ausfallSeit = 0;
          this.zugang = { ...this.zugang, rolle: n.rolle, raum: n.raum, schluessel: n.schluessel, einladung: undefined };
          this.e.merken(this.zugang); this.e.status('verbunden');
        }
        if (n.art === 'beendet') { this.schliessen(); this.e.status('beendet'); }
        this.e.nachricht(n);
      },
      zu: () => { if (lauf === this.lauf) this.abbruch(); },
      fehler: t => { if (!this.beendet && lauf === this.lauf) this.e.fehler(t); },
    });
  }
  private abbruch(): void {
    if (this.beendet || this.wieder) return;
    this.lauf++; this.kanal?.schliessen(); this.authentifiziert = false;
    this.e.status('wiederverbinden');
    if (!this.ausfallSeit) this.ausfallSeit = Date.now();
    if (Date.now() - this.ausfallSeit > 45_000) {
      this.schliessen(); this.e.status('beendet');
      this.e.fehler('Die Lobby ist nicht mehr erreichbar. Prüfe dein Netzwerk und verbinde dich erneut.'); return;
    }
    this.versuch++;
    this.wieder = setTimeout(() => { this.wieder = undefined; this.starten(); }, Math.min(3000, 500 * this.versuch));
  }
  senden(n: Nachricht): boolean { return this.authentifiziert && !this.beendet && (this.kanal?.senden(n) ?? false); }
  schliessen(): void {
    this.beendet = true; this.lauf++;
    clearInterval(this.takt); clearTimeout(this.wieder); this.kanal?.schliessen();
  }
}

/** Die lokale Autorität läuft auf dem Gastgeber, auch ohne erreichbaren API-Server. */
export function lanGastgeber(e: SitzungsEreignisse, bereit: (adressen: string[]) => void): Kanal {
  let raum: BroRaum | undefined, beendet = false;
  const angemeldet = new Set<string>(), fristen = new Map<string, ReturnType<typeof setTimeout>>();
  const trennen = (id: string): void => { angemeldet.delete(id); nativ({ art: 'trennen', id }); };
  const abmelden = nativLauschen(n => {
    if (beendet) return;
    if (n.art === 'bereit' && n.adressen?.length) {
      bereit(n.adressen);
      raum = new BroRaum({ raum: zufall().slice(0, 8).toUpperCase(), jetzt: Date.now, zufall,
        senden(id, m) { if (id === 'host') e.nachricht(m); else nativ({ art: 'senden', id, text: JSON.stringify({ ...m, v: 1 }) }); }, trennen });
      e.status('verbunden');
      raum.anmelden('host', { v: 1, art: 'gastgeber', schluessel: raum.hostSchluessel });
    } else if (n.art === 'offen' && n.id) {
      const id = n.id;
      fristen.set(id, setTimeout(() => { fristen.delete(id); if (!angemeldet.has(id)) trennen(id); }, 8000));
    } else if (n.art === 'text' && n.id && n.text && raum) {
      const m = lesen(n.text);
      if (!m) { trennen(n.id); return; }
      if (angemeldet.has(n.id)) raum.empfangen(n.id, m);
      else {
        // Das LAN-Protokoll kennt keinen entfernten Gastgeberzugang: Der Host ist dieses Gerät.
        if (m.raum !== raum.id || (m.art !== 'beitreten' && m.art !== 'fortsetzen') || !raum.anmelden(n.id, m)) { trennen(n.id); return; }
        angemeldet.add(n.id); clearTimeout(fristen.get(n.id)); fristen.delete(n.id);
      }
    } else if (n.art === 'zu' && n.id) {
      clearTimeout(fristen.get(n.id)); fristen.delete(n.id); angemeldet.delete(n.id); raum?.abmelden(n.id);
    } else if (n.art === 'fehler') {
      e.fehler(n.text ?? 'Lokale Lobby nicht verfügbar.'); e.status('beendet');
      beenden();
    }
    else if (n.art === 'hintergrund' && n.host) {
      raum?.schliessen('Die Gastgeber-App wurde in den Hintergrund gelegt. Bitte öffne eine neue Lobby.');
      e.status('beendet'); e.fehler('Die lokale Lobby wurde beendet. Lass die Gastgeber-App während des Spielens geöffnet.');
      beenden();
    }
  });
  const takt = setInterval(() => { raum?.empfangen('host', { v: 1, art: 'ping' }); raum?.tick(); }, 200);
  const beenden = (): void => {
    beendet = true; clearInterval(takt); abmelden();
    for (const t of fristen.values()) clearTimeout(t);
    raum?.schliessen('Die lokale Lobby wurde beendet.'); nativ({ art: 'stop' });
  };
  e.status('verbinden'); nativ({ art: 'host' });
  return {
    senden(n) { if (!raum || beendet || raum.beendet) return false; raum.empfangen('host', { ...n, v: 1 }); return true; },
    schliessen: beenden,
  };
}
