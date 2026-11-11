/** Gemeinsame Raumautorität: im Relay und im gebündelten iOS-Gastgeber identisch. */
export const VERSION = 1;
export const EINLADUNG_MS = 10 * 60_000;
// Eine kurze Netzumschaltung darf die gesamte Runde nicht verlieren.
export const GASTGEBER_PAUSE_MS = 90_000;
export const EINGABE_PAUSE_MS = 600;
export const MAX_NACHRICHT = 8192;
export type BotStufe = 'leicht' | 'mittel' | 'schwer';
export type TanksModus = 'einzel' | 'team';
export type TanksOptionen = { modus: TanksModus; serie: 1 | 3; karte?: number };
export type TanksItem = 'reparatur' | 'schild' | 'teleport' | 'treibstoff';
export const TANKS_ITEMS: readonly TanksItem[] = ['reparatur', 'schild', 'teleport', 'treibstoff'];
export type PanzerDesign = 'klassisch' | 'kupfer' | 'polar' | 'royal';
export type Spiel = 'building' | 'brotanks';
export type Layout = 'bauen' | 'auswahl' | 'zielen';
export type Taste = 'drehen' | 'fallen' | 'bestaetigen';
export type BauZauber = 'anker' | 'plattform' | 'stein' | 'schwere' | 'eis';
export type BauItem = { art: BauZauber; nummer: number };
export type BauPlatzierung = { x: number; y: number; gueltig: boolean; rest: number };
const BAUZAUBER: readonly string[] = ['anker', 'plattform', 'stein', 'schwere', 'eis'];
export type Aktion =
  | { art: 'steuerung'; x: number; y: number; tasten: Taste[] }
  | { art: 'wahl'; wert: number }
  | { art: 'zahl'; wert: number }
  | { art: 'zauber'; zauber: BauZauber; item: number; ziel?: string }
  | { art: 'plattform'; item: number; schritt: 'platzieren' | 'zurueck' }
  | { art: 'zielen'; winkel: number; staerke: number; waffe: number }
  | { art: 'feuer'; zug: number; winkel: number; staerke: number; waffe: number }
  | { art: 'tanksitem'; item: TanksItem; zug: number; ziel?: number }
  | { art: 'reset' };
export type BauPrivat = { form: number; hoehe: number; restzeit: number; phase: 'countdown' | 'spiel' | 'pause' | 'ende'; countdown: number; platz: number; fertig: boolean; gewonnen: boolean; verbraucht: number; spielerzahl?: number; ziele?: string[]; zielCountdown?: number; item?: BauItem; itemIn?: number; itemBereit?: boolean; platzierung?: BauPlatzierung; eisWartet?: boolean; steinWartet?: boolean; anker?: number; schwereWartet?: boolean; gebaut?: number; verloren?: number; aufgegeben?: boolean; dauer?: number };
/** BroTanks: was ein einzelnes Handy über seine Partie erfährt (docs/BROREMOTE-ARTILLERIE.md, Abschnitt 6). */
export type ArtiPrivat = {
  items?: number[]; itemGenutzt?: boolean; schild?: boolean; teleportZiele?: number[];
  spielerzahl?: number; dauer?: number; aufgegeben?: boolean; schaden?: number; schuesse?: number; treffer?: number; team?: 0 | 1;
  serie?: { runde: number; maximal: 1 | 3; siege: number; fertig: boolean; gewonnen: boolean };
  phase: 'countdown' | 'zielen' | 'flug' | 'nachlauf' | 'pause' | 'ende';
  amZug: boolean; zug: number; rest: number; inZuegen: number;
  winkel: number; staerke: number; waffe: number; munition: number[];
  lp: number; tank: number; wind: number; runde: number; platz: number; raus: boolean; gewonnen: boolean;
};
const ARTIPHASEN: readonly string[] = ['countdown', 'zielen', 'flug', 'nachlauf', 'pause', 'ende'];
export type Privat = { leben?: number; punkte?: number; hinweis?: string; inventar?: string[]; amZug?: boolean; bau?: BauPrivat; arti?: ArtiPrivat };
export type Spieler = { bot?: BotStufe; team?: 0 | 1; design?: PanzerDesign; id: string; name: string; farbe: string; verbunden: boolean; bereit: boolean };
export type RaumSicht = {
  raum: string; phase: 'lobby' | 'test' | 'spiel'; abschnitt: number; layout: Layout;
  /** Der Kern setzt beides immer; optional im Typ, damit ältere Aufrufer und Tests unverändert übersetzen. */
  tanks?: TanksOptionen; spiel?: Spiel; baumodus?: 'rennen' | 'standfest'; partie?: { id: string; seed: number; spiel?: Spiel; modus: 'rennen' | 'standfest'; tanks?: TanksOptionen };
  gesperrt: boolean; gastgeberDa: boolean; spieler: Spieler[]; einladungBis: number;
};
export type Nachricht = Record<string, unknown>;
export type ServerNachricht =
  | { art: 'willkommen'; rolle: 'gastgeber' | 'spieler'; schluessel: string; spieler?: string; einladung?: string; raum: string }
  | { art: 'raum'; sicht: RaumSicht }
  | { art: 'eingabe'; spieler: string; aktion: Aktion; folge: number; abschnitt: number }
  | { art: 'privat'; daten: Privat; abschnitt: number }
  | { art: 'einladung'; einladung: string; bis: number }
  | { art: 'fehler'; text: string }
  | { art: 'beendet'; text: string }
  | { art: 'pong'; zeit: number; kennung?: string };

export function objekt(wert: unknown): wert is Nachricht {
  return wert !== null && typeof wert === 'object' && !Array.isArray(wert);
}
export function lesen(text: string): Nachricht | null {
  if (text.length > MAX_NACHRICHT) return null;
  try { const n: unknown = JSON.parse(text); return objekt(n) && n.v === VERSION && typeof n.art === 'string' ? n : null; }
  catch { return null; }
}
export function geheimnis(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[a-f0-9]{32}$/.test(wert);
}
export function raumkennung(wert: unknown): wert is string {
  return typeof wert === 'string' && /^[A-Z0-9]{8}$/.test(wert);
}
function zahl(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}
function ganz(n: unknown, min: number, max: number): n is number {
  return zahl(n, min, max) && Number.isSafeInteger(n);
}
function name(wert: unknown): string | null {
  if (typeof wert !== 'string') return null;
  const kurz = wert.trim().replace(/[\u0000-\u001f\u007f]/g, '');
  return kurz.length > 0 && kurz.length <= 24 ? kurz : null;
}
export function aktionLesen(a: unknown, layout: Layout): Aktion | null {
  if (!objekt(a)) return null;
  if (layout === 'bauen' && a.art === 'zauber' && typeof a.zauber === 'string' && BAUZAUBER.includes(a.zauber) && ganz(a.item, 1, 1000) && (a.ziel === undefined || (typeof a.ziel === 'string' && a.ziel.length <= 24))) return { art: 'zauber', zauber: a.zauber as BauZauber, item: a.item, ...(typeof a.ziel === 'string' ? { ziel: a.ziel } : {}) };
  if (layout === 'bauen' && a.art === 'plattform' && ganz(a.item, 1, 1000) && (a.schritt === 'platzieren' || a.schritt === 'zurueck')) return { art: 'plattform', item: a.item, schritt: a.schritt };
  if (layout === 'zielen' && a.art === 'zielen' && ganz(a.winkel, 0, 180) && ganz(a.staerke, 0, 100) && ganz(a.waffe, 0, 10)) return { art: 'zielen', winkel: a.winkel, staerke: a.staerke, waffe: a.waffe };
  if (layout === 'zielen' && a.art === 'feuer' && ganz(a.zug, 1, 10000) && ganz(a.winkel, 0, 180) && ganz(a.staerke, 0, 100) && ganz(a.waffe, 0, 10)) return { art: 'feuer', zug: a.zug, winkel: a.winkel, staerke: a.staerke, waffe: a.waffe };
  if (layout === 'zielen' && a.art === 'tanksitem' && TANKS_ITEMS.includes(a.item as TanksItem) && ganz(a.zug, 1, 10000) && (a.item === 'teleport' ? ganz(a.ziel, 0, 63) : a.ziel === undefined)) return { art: 'tanksitem', item: a.item as TanksItem, zug: a.zug, ...(typeof a.ziel === 'number' ? { ziel: a.ziel } : {}) };
  if (a.art === 'reset') return { art: 'reset' };
  if (a.art === 'steuerung' && zahl(a.x, -1, 1) && zahl(a.y, -1, 1) && Array.isArray(a.tasten) && a.tasten.length <= 3) {
    // Beim Zielen gibt es nur Fahren: keine Tasten, keine Senkrechte.
    if (layout === 'zielen' && (a.y !== 0 || a.tasten.length)) return null;
    const erlaubt = layout === 'bauen' ? ['drehen', 'fallen'] : layout === 'zielen' ? [] : ['bestaetigen'];
    if (!a.tasten.every(t => typeof t === 'string' && erlaubt.includes(t)) || new Set(a.tasten).size !== a.tasten.length) return null;
    return { art: 'steuerung', x: a.x, y: a.y, tasten: a.tasten as Taste[] };
  }
  if (layout === 'auswahl' && a.art === 'wahl' && ganz(a.wert, 0, 3)) return { art: 'wahl', wert: a.wert };
  if (layout === 'auswahl' && a.art === 'zahl' && ganz(a.wert, 0, 999)) return { art: 'zahl', wert: a.wert };
  return null;
}
function privatLesen(d: unknown): Privat | null {
  if (!objekt(d)) return null;
  if (d.leben !== undefined && !ganz(d.leben, 0, 999)) return null;
  if (d.punkte !== undefined && !ganz(d.punkte, 0, 1e9)) return null;
  if (d.amZug !== undefined && typeof d.amZug !== 'boolean') return null;
  if (d.hinweis !== undefined && (typeof d.hinweis !== 'string' || d.hinweis.length > 160)) return null;
  if (d.inventar !== undefined && (!Array.isArray(d.inventar) || d.inventar.length > 12 || !d.inventar.every(i => typeof i === 'string' && i.length <= 40))) return null;
  if (d.bau !== undefined) {
    const b = d.bau;
    if (!objekt(b)) return null;
    if (b.spielerzahl !== undefined && !ganz(b.spielerzahl, 1, 4)) return null;
    if (b.ziele !== undefined && (!Array.isArray(b.ziele) || b.ziele.length > 3 || !b.ziele.every(z => typeof z === 'string' && z.length <= 24))) return null;
    for (const k of ['itemBereit', 'eisWartet', 'steinWartet', 'schwereWartet', 'aufgegeben']) if (b[k] !== undefined && typeof b[k] !== 'boolean') return null;
    if (b.item !== undefined && (!objekt(b.item) || typeof b.item.art !== 'string' || !BAUZAUBER.includes(b.item.art) || !ganz(b.item.nummer, 1, 1000))) return null;
    if (b.platzierung !== undefined) {
      const p = b.platzierung;
      if (!objekt(p) || !zahl(p.x, -6, 6) || !zahl(p.y, .4, 20) || !ganz(p.rest, 0, 8) || typeof p.gueltig !== 'boolean' || !objekt(b.item) || b.item.art !== 'plattform') return null;
    }
    // Höhenrennen liefert weiter Teile. Drei Minuten mit Nachschubpause
    // bleiben unter 300; die alte 30er-Grenze verschluckte ganze Statuspakete.
    for (const [k, max] of [['itemIn', 28], ['zielCountdown', 3], ['anker', 4], ['gebaut', 300], ['verloren', 300], ['dauer', 181]] as const) if (b[k] !== undefined && !zahl(b[k], 0, max)) return null;
    if ( !ganz(b.form, 0, 6) || !zahl(b.hoehe, 0, 200) || !ganz(b.restzeit, 0, 180) || !ganz(b.countdown, 0, 3) || !ganz(b.platz, 1, 4) || !ganz(b.verbraucht, 0, 300)
      || typeof b.phase !== 'string' || !['countdown', 'spiel', 'pause', 'ende'].includes(b.phase) || typeof b.fertig !== 'boolean' || typeof b.gewonnen !== 'boolean') return null;
  }
  if (d.arti !== undefined) {
    const t = d.arti;
    if (!objekt(t)) return null;
    if (typeof t.phase !== 'string' || !ARTIPHASEN.includes(t.phase) || typeof t.amZug !== 'boolean' || typeof t.raus !== 'boolean' || typeof t.gewonnen !== 'boolean') return null;
    if (!ganz(t.zug, 1, 10000) || !ganz(t.rest, 0, 20) || !ganz(t.inZuegen, 0, 3) || !ganz(t.winkel, 0, 180) || !ganz(t.staerke, 0, 100) || !ganz(t.waffe, 0, 10)
      || !ganz(t.lp, 0, 100) || !ganz(t.tank, 0, 100) || !ganz(t.wind, -10, 10) || !ganz(t.runde, 1, 12) || !ganz(t.platz, 1, 4)) return null;
    if (t.items !== undefined && (!Array.isArray(t.items) || t.items.length !== 4 || !t.items.every(m => ganz(m, 0, 2)))) return null;
    for (const f of ['itemGenutzt', 'schild', 'aufgegeben']) if (t[f] !== undefined && typeof t[f] !== 'boolean') return null;
    if (t.spielerzahl !== undefined && !ganz(t.spielerzahl, 2, 4)) return null;
    for (const f of ['schaden', 'schuesse', 'treffer']) if (t[f] !== undefined && !ganz(t[f], 0, 10000)) return null;
    if (t.dauer !== undefined && !ganz(t.dauer,0,1800)) return null;
    if (t.team !== undefined && !ganz(t.team, 0, 1)) return null;
    if (t.teleportZiele !== undefined && (!Array.isArray(t.teleportZiele) || t.teleportZiele.length > 64 || !t.teleportZiele.every(x => ganz(x, 0, 63)))) return null;
    if (t.serie !== undefined && (!objekt(t.serie) || !ganz(t.serie.runde, 1, 3) || ![1, 3].includes(t.serie.maximal as number) || !ganz(t.serie.siege, 0, 2) || typeof t.serie.fertig !== 'boolean' || typeof t.serie.gewonnen !== 'boolean')) return null;
    if (!Array.isArray(t.munition) || ![8, 11].includes(t.munition.length) || !t.munition.every(m => ganz(m, -1, 3)) || (t.waffe as number) >= t.munition.length) return null;
  }
  const { leben, punkte, amZug, hinweis, inventar } = d;
  const arti = d.arti as ArtiPrivat | undefined;
  // Nur bekannte Felder weitergeben: keine versteckten großen Nutzlasten im Spielstatus.
  const bau = d.bau as BauPrivat | undefined;
  return { leben, punkte, amZug, hinweis, inventar, ...(arti ? { arti: { ...Object.fromEntries(Object.entries({ spielerzahl:arti.spielerzahl, dauer:arti.dauer, aufgegeben:arti.aufgegeben, items: arti.items?.slice(), itemGenutzt: arti.itemGenutzt, schild: arti.schild, teleportZiele: arti.teleportZiele?.slice(), schaden: arti.schaden, schuesse: arti.schuesse, treffer: arti.treffer, team: arti.team, serie: arti.serie ? { runde: arti.serie.runde, maximal: arti.serie.maximal, siege: arti.serie.siege, fertig: arti.serie.fertig, gewonnen: arti.serie.gewonnen } : undefined }).filter(([,v])=>v!==undefined)), phase: arti.phase, amZug: arti.amZug, zug: arti.zug, rest: arti.rest, inZuegen: arti.inZuegen, winkel: arti.winkel, staerke: arti.staerke, waffe: arti.waffe, munition: [...arti.munition], lp: arti.lp, tank: arti.tank, wind: arti.wind, runde: arti.runde, platz: arti.platz, raus: arti.raus, gewonnen: arti.gewonnen } } : {}), ...(bau ? { bau: { form: bau.form, hoehe: bau.hoehe, restzeit: bau.restzeit, phase: bau.phase, countdown: bau.countdown, platz: bau.platz, fertig: bau.fertig, gewonnen: bau.gewonnen, verbraucht: bau.verbraucht, spielerzahl: bau.spielerzahl, ziele: bau.ziele, zielCountdown: bau.zielCountdown, item: bau.item ? { art: bau.item.art, nummer: bau.item.nummer } : undefined, itemIn: bau.itemIn, itemBereit: bau.itemBereit, platzierung: bau.platzierung ? { x: bau.platzierung.x, y: bau.platzierung.y, rest: bau.platzierung.rest, gueltig: bau.platzierung.gueltig } : undefined, eisWartet: bau.eisWartet, steinWartet: bau.steinWartet, anker: bau.anker, schwereWartet: bau.schwereWartet, gebaut: bau.gebaut, verloren: bau.verloren, aufgegeben: bau.aufgegeben, dauer: bau.dauer } } : {}) } as Privat;
}

type Sitz = Spieler & { schluessel: string; verbindung?: string; folge: number; letzteEingabe: number; aktiv: boolean; privat?: Privat };
type Leitung = { spieler?: Sitz; gastgeber: boolean; gesehen: number; fenster: number; anzahl: number };
const FARBEN = ['#70dfc4', '#ffc961', '#ad9eff', '#ff8ca5'];
export interface RaumOptionen {
  raum: string;
  jetzt: () => number;
  zufall: () => string;
  senden: (verbindung: string, nachricht: ServerNachricht) => void;
  trennen: (verbindung: string) => void;
}

export class BroRaum {
  readonly id: string;
  readonly hostSchluessel: string;
  private einladung: string;
  private einladungBis: number;
  private host?: string;
  private hostVermisst: number | null = null;
  private readonly sitze: Sitz[] = [];
  private readonly leitungen = new Map<string, Leitung>();
  private phase: RaumSicht['phase'] = 'lobby';
  private layout: Layout = 'bauen';
  private abschnitt = 0;
  private baumodus: 'rennen' | 'standfest' = 'rennen';
  private spiel: Spiel = 'building';
  private tanks: TanksOptionen = { modus: 'einzel', serie: 1 };
  private partie?: RaumSicht['partie'];
  private gesperrt = false;
  beendet = false;
  constructor(private readonly o: RaumOptionen) {
    this.id = o.raum;
    this.hostSchluessel = o.zufall();
    this.einladung = o.zufall();
    this.einladungBis = o.jetzt() + EINLADUNG_MS;
    this.hostVermisst = o.jetzt();
  }
  sicht(): RaumSicht {
    return {
      raum: this.id, phase: this.phase, layout: this.layout, abschnitt: this.abschnitt,
      spiel: this.spiel, baumodus: this.baumodus, partie: this.partie, tanks: { ...this.tanks },
      gesperrt: this.gesperrt, gastgeberDa: !!this.host, einladungBis: this.einladungBis,
      spieler: this.sitze.map(({ id, name, farbe, verbunden, bereit, bot, team, design }) => ({ id, name, farbe, verbunden, bereit, ...(bot ? { bot } : {}), ...(team !== undefined ? { team } : {}), ...(design ? { design } : {}) })),
    };
  }
  private fehler(v: string, text: string): void { this.o.senden(v, { art: 'fehler', text }); }
  private verteilen(): void {
    const n: ServerNachricht = { art: 'raum', sicht: this.sicht() };
    for (const v of this.leitungen.keys()) this.o.senden(v, n);
  }
  anmelden(v: string, n: Nachricht): boolean {
    if (this.beendet || this.leitungen.has(v) || n.v !== VERSION) return false;
    const jetzt = this.o.jetzt();
    if (n.art === 'gastgeber' && n.schluessel === this.hostSchluessel) {
      if (this.host) { const alt = this.host; this.leitungen.delete(alt); this.o.trennen(alt); }
      this.host = v;
      this.hostVermisst = null;
      this.leitungen.set(v, { gastgeber: true, gesehen: jetzt, fenster: jetzt, anzahl: 0 });
      this.o.senden(v, { art: 'willkommen', rolle: 'gastgeber', schluessel: this.hostSchluessel, einladung: this.einladung, raum: this.id });
      // Nach Host-Wechsel dürfen keine alten gedrückten Tasten weiterlaufen.
      this.neuerAbschnitt();
      this.verteilen();
      return true;
    }
    let sitz: Sitz | undefined;
    if (n.art === 'fortsetzen' && geheimnis(n.schluessel)) sitz = this.sitze.find(s => !s.bot && s.schluessel === n.schluessel);
    else if (n.art === 'beitreten' && n.einladung === this.einladung && jetzt < this.einladungBis && !this.gesperrt && this.phase === 'lobby' && this.host) {
      const anzeige = name(n.name);
      if (!anzeige || this.sitze.length >= 4) { this.fehler(v, anzeige ? 'Die Lobby ist voll.' : 'Bitte wähle einen Namen mit 1 bis 24 Zeichen.'); return false; }
      const farbe = FARBEN.find(f => !this.sitze.some(s => s.farbe === f))!;
      sitz = { team: this.sitze.filter(s => s.team === 0).length <= this.sitze.filter(s => s.team === 1).length ? 0 : 1, id: this.o.zufall().slice(0, 12), name: anzeige, farbe, verbunden: false, bereit: false, schluessel: this.o.zufall(), folge: -1, letzteEingabe: 0, aktiv: false };
      this.sitze.push(sitz);
    }
    if (!sitz) { this.fehler(v, 'Einladung ungültig, abgelaufen oder Lobby geschlossen. Bitte lass dir einen neuen QR-Code zeigen.'); return false; }
    if (sitz.verbindung) { const alt = sitz.verbindung; this.leitungen.delete(alt); this.o.trennen(alt); }
    this.reset(sitz);
    sitz.verbindung = v;
    sitz.verbunden = true;
    sitz.bereit = false;
    sitz.folge = -1;
    this.leitungen.set(v, { gastgeber: false, spieler: sitz, gesehen: jetzt, fenster: jetzt, anzahl: 0 });
    this.o.senden(v, { art: 'willkommen', rolle: 'spieler', schluessel: sitz.schluessel, spieler: sitz.id, raum: this.id });
    this.verteilen();
    if (sitz.privat) this.o.senden(v, { art: 'privat', daten: sitz.privat, abschnitt: this.abschnitt });
    return true;
  }
  empfangen(v: string, n: Nachricht): void {
    const l = this.leitungen.get(v), jetzt = this.o.jetzt();
    if (!l || this.beendet || n.v !== VERSION) return;
    if (jetzt - l.fenster >= 1000) { l.fenster = jetzt; l.anzahl = 0; }
    if (++l.anzahl > 80) { this.abmelden(v); this.o.trennen(v); return; }
    l.gesehen = jetzt;
    if (n.art === 'ping') {
      // Korrelierte Pongs verhindern falsche Millisekundenwerte, wenn Debug-
      // Messung und Verbindung gleichzeitig pingen. Alte Clients bleiben gültig.
      const kennung = typeof n.kennung === 'string' && /^[a-zA-Z0-9-]{1,48}$/.test(n.kennung) ? n.kennung : undefined;
      this.o.senden(v, { art: 'pong', zeit: jetzt, ...(kennung ? { kennung } : {}) }); return;
    }
    if (n.art === 'verlassen') {
      if (l.gastgeber) this.schliessen('Der Gastgeber hat die Lobby beendet.');
      else { const s = l.spieler!; this.abmelden(v); this.sitze.splice(this.sitze.indexOf(s), 1); this.o.trennen(v); this.verteilen(); }
      return;
    }
    if (l.gastgeber) {
      if (n.art === 'sperren' && typeof n.gesperrt === 'boolean') this.gesperrt = n.gesperrt;
      else if (n.art === 'einladen') {
        this.einladung = this.o.zufall(); this.einladungBis = jetzt + EINLADUNG_MS;
        this.o.senden(v, { art: 'einladung', einladung: this.einladung, bis: this.einladungBis });
      } else if (n.art === 'entfernen' && typeof n.spieler === 'string') {
        const s = this.sitze.find(s => s.id === n.spieler);
        if (!s || this.phase !== 'lobby') return;
        this.reset(s);
        if (s.verbindung) { const alt = s.verbindung; this.o.senden(alt, { art: 'beendet', text: 'Du wurdest aus der Lobby entfernt.' }); this.leitungen.delete(alt); this.o.trennen(alt); }
        this.sitze.splice(this.sitze.indexOf(s), 1);
        // Ein entfernter Gast kann mit einem alten QR nicht sofort zurückkommen.
        this.einladung = this.o.zufall(); this.einladungBis = jetzt + EINLADUNG_MS;
        this.o.senden(v, { art: 'einladung', einladung: this.einladung, bis: this.einladungBis });
      } else if (n.art === 'tanksoptionen' && this.phase === 'lobby' && this.spiel === 'brotanks') {
        if ((n.modus !== 'einzel' && n.modus !== 'team') || (n.serie !== 1 && n.serie !== 3) || (n.karte !== undefined && !ganz(n.karte, -1, 4))) { this.fehler(v, 'Ungültige Partieeinstellungen.'); return; }
        this.tanks = { modus: n.modus, serie: n.serie, ...(typeof n.karte === 'number' && n.karte >= 0 ? { karte: n.karte } : {}) };
        for (const s of this.sitze) s.bereit = !!s.bot;
      } else if (n.art === 'bot' && this.phase === 'lobby' && this.spiel === 'brotanks') {
        if (!['leicht', 'mittel', 'schwer'].includes(n.stufe as string)) return;
        const stufe = n.stufe as BotStufe;
        if (typeof n.spieler === 'string') {
          const s = this.sitze.find(s => s.id === n.spieler && s.bot); if (!s) return; s.bot = stufe;
        } else {
          if (this.sitze.length >= 4) { this.fehler(v, 'Alle vier Plätze sind belegt.'); return; }
          const farbe = FARBEN.find(f => !this.sitze.some(s => s.farbe === f))!;
          const i = FARBEN.indexOf(farbe);
          this.sitze.push({ id: this.o.zufall().slice(0, 12), name: ['Bot Bruno', 'Bot Frida', 'Bot Oskar', 'Bot Lotti'][i], farbe, bot: stufe, team: this.sitze.filter(s => s.team === 0).length <= this.sitze.filter(s => s.team === 1).length ? 0 : 1, verbunden: true, bereit: true, schluessel: '', folge: -1, letzteEingabe: 0, aktiv: false });
        }
      } else if (n.art === 'tanksteam' && this.phase === 'lobby' && this.spiel === 'brotanks' && ganz(n.team, 0, 1)) {
        const s = this.sitze.find(s => s.id === n.spieler); if (!s) return; s.team = n.team as 0 | 1;
        for (const s of this.sitze) s.bereit = !!s.bot;
      } else if (n.art === 'baumodus' && this.phase === 'lobby' && (n.modus === 'rennen' || n.modus === 'standfest')) {
        this.baumodus = n.modus;
        for (const s of this.sitze) s.bereit = false;
      } else if (n.art === 'spielwahl' && this.phase === 'lobby' && (n.spiel === 'building' || n.spiel === 'brotanks')) {
        // Wie der Moduswechsel: Wer schon „bereit“ war, hat ein anderes Spiel bestätigt.
        this.spiel = n.spiel;
        if (this.spiel !== 'brotanks') for (let i = this.sitze.length - 1; i >= 0; i--) if (this.sitze[i].bot) this.sitze.splice(i, 1);
        for (const s of this.sitze) s.bereit = !!s.bot;
      } else if ((n.art === 'starten' || n.art === 'spielen') && this.phase === 'lobby') {
        if (!this.sitze.length || this.sitze.some(s => !s.bereit || !s.verbunden)) { this.fehler(v, 'Alle verbundenen Spieler müssen bereit sein.'); return; }
        const tanks = n.art === 'spielen' && this.spiel === 'brotanks';
        if (tanks && this.sitze.length < 2) { this.fehler(v, 'Für BroTanks braucht ihr mindestens zwei Spieler oder Bots.'); return; }
        if (tanks && n.karte !== undefined && !ganz(n.karte, 0, 4)) { this.fehler(v, 'Unbekanntes Schlachtfeld.'); return; }
        if (tanks && this.tanks.modus === 'team' && (this.sitze.length !== 4 || this.sitze.filter(s => s.team === 0).length !== 2 || this.sitze.filter(s => s.team === 1).length !== 2)) { this.fehler(v, 'Für 2 gegen 2 braucht jedes Team genau zwei Spieler oder Bots.'); return; }
        this.phase = n.art === 'spielen' ? 'spiel' : 'test'; this.layout = tanks ? 'zielen' : 'bauen'; this.gesperrt = true;
        this.partie = n.art === 'spielen' ? { id: this.o.zufall(), seed: parseInt(this.o.zufall().slice(0, 8), 16) >>> 0, spiel: this.spiel, modus: this.baumodus, ...(tanks ? { tanks: { ...this.tanks, karte: typeof n.karte === 'number' ? n.karte : this.tanks.karte ?? (parseInt(this.o.zufall().slice(0, 8), 16) >>> 0) % 5 } } : {}) } : undefined;
        if (tanks && this.partie && typeof n.karte === 'number' && n.karte < 3) {
          // Die gewählte Welt steckt im gespeicherten Seed und überlebt einen Reconnect.
          this.partie.seed = Math.min(4294967292, this.partie.seed - this.partie.seed % 3) + n.karte;
        }
        this.neuerAbschnitt();
      } else if (n.art === 'lobby') {
        this.phase = 'lobby'; this.partie = undefined; this.gesperrt = false; this.neuerAbschnitt();
        for (const s of this.sitze) s.bereit = !!s.bot;
      } else if (n.art === 'layout' && this.phase === 'test' && (n.layout === 'bauen' || n.layout === 'auswahl')) {
        this.layout = n.layout; this.neuerAbschnitt();
      } else if (n.art === 'privat' && ganz(n.abschnitt, 0, 1e9) && n.abschnitt === this.abschnitt) {
        const s = this.sitze.find(s => s.id === n.spieler), daten = privatLesen(n.daten);
        if (!s || !daten) { this.fehler(v, 'Ungültige persönliche Nachricht.'); return; }
        s.privat = daten;
        if (s.verbindung) this.o.senden(s.verbindung, { art: 'privat', daten, abschnitt: this.abschnitt });
        return;
      } else { this.fehler(v, 'Dieser Gastgeberbefehl ist nicht verfügbar.'); return; }
      this.verteilen();
    } else {
      const s = l.spieler!;
      if (n.art === 'panzerdesign' && this.phase === 'lobby' && ['klassisch', 'kupfer', 'polar', 'royal'].includes(n.design as string)) { s.design = n.design as PanzerDesign; this.verteilen(); }
      else if (n.art === 'bereit' && this.phase === 'lobby' && typeof n.bereit === 'boolean') { s.bereit = n.bereit; this.verteilen(); }
      else if (n.art === 'eingabe' && (this.phase === 'test' || this.phase === 'spiel') && this.host && n.abschnitt === this.abschnitt && ganz(n.folge, 0, Number.MAX_SAFE_INTEGER) && n.folge > s.folge) {
        const aktion = aktionLesen(n.aktion, this.layout);
        if (!aktion) { this.fehler(v, 'Diese Eingabe passt nicht zum Controller.'); return; }
        s.folge = n.folge; s.letzteEingabe = jetzt;
        s.aktiv = aktion.art === 'steuerung' && (aktion.x !== 0 || aktion.y !== 0 || aktion.tasten.length > 0);
        this.o.senden(this.host, { art: 'eingabe', spieler: s.id, aktion, folge: s.folge, abschnitt: this.abschnitt });
      }
    }
  }
  private neuerAbschnitt(): void {
    this.abschnitt++;
    for (const s of this.sitze) { s.privat = undefined; this.reset(s); }
  }
  private reset(s: Sitz): void {
    s.aktiv = false;
    if (this.host) this.o.senden(this.host, { art: 'eingabe', spieler: s.id, aktion: { art: 'reset' }, folge: s.folge, abschnitt: this.abschnitt });
  }
  abmelden(v: string): void {
    const l = this.leitungen.get(v);
    if (!l) return;
    this.leitungen.delete(v);
    if (l.gastgeber) { this.host = undefined; this.hostVermisst = this.o.jetzt(); for (const s of this.sitze) s.aktiv = false; }
    else if (l.spieler?.verbindung === v) {
      const s = l.spieler; this.reset(s); s.verbindung = undefined; s.verbunden = false; s.bereit = false;
    }
    this.verteilen();
  }
  tick(): void {
    if (this.beendet) return;
    const jetzt = this.o.jetzt();
    for (const [v, l] of this.leitungen) if (jetzt - l.gesehen > 15_000) { this.abmelden(v); this.o.trennen(v); }
    for (const s of this.sitze) if (s.aktiv && jetzt - s.letzteEingabe > EINGABE_PAUSE_MS) this.reset(s);
    if (this.hostVermisst !== null && jetzt - this.hostVermisst > GASTGEBER_PAUSE_MS) this.schliessen('Der Gastgeber ist nicht mehr erreichbar. Bitte öffne eine neue Lobby.');
  }
  schliessen(text: string): void {
    this.beendet = true;
    for (const v of this.leitungen.keys()) { this.o.senden(v, { art: 'beendet', text }); this.o.trennen(v); }
    this.leitungen.clear();
  }
}

export type Einladung = { transport: 'relay' | 'lan'; adresse: string; raum: string; schluessel: string; bis: number };
/** Nur private IPv4-Adressen: Ein gescannter Code darf die native Brücke nicht als beliebigen Proxy benutzen. */
export function lokaleAdresse(adresse: string): boolean {
  try {
    const u = new URL(adresse), p = u.hostname.split('.').map(Number);
    return u.protocol === 'ws:' && !u.username && !u.password && u.pathname === '/broremote' && !u.search && !u.hash && /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && p.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
      (p[0] === 10 || (p[0] === 192 && p[1] === 168) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 169 && p[1] === 254)) && Number(u.port) > 0;
  } catch { return false; }
}
export function einladungsLink(e: Einladung): string {
  const basis = e.transport === 'lan' ? 'https://staging.brauweg-spielen.de' : e.adresse.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/ws\/broremote$/, '');
  const p = new URLSearchParams({ t: e.transport, r: e.raum, k: e.schluessel, b: String(e.bis) });
  if (e.transport === 'lan') p.set('a', e.adresse);
  return `${basis}/broremote#${p}`;
}
export function einladungLesen(text: string, jetzt = Date.now()): Einladung | null {
  try {
    if (text.length > 500) return null;
    const u = new URL(text.trim()), p = new URLSearchParams(u.hash.slice(1));
    if (u.pathname !== '/broremote' || u.username || u.password || u.search) return null;
    const transport = p.get('t'), raum = p.get('r'), schluessel = p.get('k'), bis = Number(p.get('b'));
    if (!raumkennung(raum) || !geheimnis(schluessel) || !Number.isSafeInteger(bis) || bis <= jetzt || bis > jetzt + EINLADUNG_MS + 60_000) return null;
    if (transport === 'lan' && lokaleAdresse(p.get('a') ?? '')) return { transport, raum, schluessel, bis, adresse: p.get('a')! };
    const lokal = u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    const vertraut = u.protocol === 'https:' && ['www.brauweg-spielen.de', 'staging.brauweg-spielen.de'].includes(u.hostname) && !u.port;
    if (transport !== 'relay' || (!lokal && !vertraut)) return null;
    return { transport, raum, schluessel, bis, adresse: `${u.origin.replace(/^http/, 'ws')}/ws/broremote` };
  } catch { return null; }
}

/** Kleine, kontogebundene Wertung; keine kompetitive Rangliste für hostberechnete Runden. */
export type TanksErgebnis = {
  modus: TanksModus; spielerzahl: number; bots: number; stufe: BotStufe;
  gewonnen: boolean; aufgegeben: boolean; platz: number; schaden: number; schuesse: number; treffer: number; dauer: number;
};
export type TanksStatistik = { partien: number; siege: number; schaden: number; schuesse: number; treffer: number };
export type TanksVerlauf = { konto: string; statistik: TanksStatistik; designs: PanzerDesign[]; restMuenzen: number };
export function panzerFreigaben(s: TanksStatistik): PanzerDesign[] {
  return ['klassisch', ...(s.partien >= 1 ? ['kupfer'] : []), ...(s.siege >= 3 ? ['polar'] : []), ...(s.siege >= 10 ? ['royal'] : [])] as PanzerDesign[];
}
