import { TANKS_ITEMS, type ArtiPrivat, type PanzerDesign, type TanksItem, type TanksOptionen } from '@brauweg/broremote-kern';
import { aufstellen, hoeheBei, inselAusSeed, type Gelaende } from './gelaende';
import { einschlagAnwenden, flugBerechnen, type Einschlag, type Flugbahn } from './flug';
import { mischen, REGELN, STROM, VORRAT_START, WAFFEN_ANZAHL, zufallsstrom, type Waffe } from './regeln';

const R = REGELN;
const TICKS = (s: number): number => Math.round(s / R.schritt);

export type TanksSpieler = { id: string; name: string; farbe: string; team?: 0 | 1; design?: PanzerDesign };
export type TanksEingabe =
  | { art: 'steuerung'; x: number; y: number; tasten: readonly string[] }
  | { art: 'zielen'; winkel: number; staerke: number; waffe: number }
  | { art: 'feuer'; zug: number; winkel: number; staerke: number; waffe: number }
  | { art: 'tanksitem'; item: TanksItem; zug: number; ziel?: number }
  | { art: 'reset' };
export type TanksPhase = 'countdown' | 'zielen' | 'flug' | 'nachlauf' | 'ende';
export type TanksGrund = '' | 'letzter' | 'gleichstand' | 'grenze';

export type Wertung = { id: string; lp: number; schaden: number };
/** Rangfolge: erst wer vorn steht (Sieger), dann Lebenspunkte, dann verursachter Schaden. Gleiches teilt sich einen Platz. */
export function rangfolge<T extends Wertung>(bros: readonly T[], vorn: readonly string[] = []): (T & { platz: number })[] {
  // Wer vorn steht (Sieger, auch bei Gleichstand), teilt sich Platz 1 unabhängig von den Zahlen.
  const wert = (b: Wertung): number[] => (vorn.includes(b.id) ? [1, 0, 0] : [0, b.lp, b.schaden]);
  const gleich = (a: Wertung, b: Wertung): number => { const x = wert(a), y = wert(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]; return 0; };
  return [...bros].sort(gleich).map(b => ({ ...b, platz: 1 + bros.filter(o => gleich(b, o) > 0).length }));
}

/** Schaden eines Einschlags: linear fallend, der eigene Bro nimmt die Hälfte. Nur lebende Bros. */
export function schadenBei(e: Einschlag, bros: readonly { id: string; x: number; y: number; raus: boolean }[], schuetze?: string): { id: string; schaden: number; selbst: boolean }[] {
  const aus: { id: string; schaden: number; selbst: boolean }[] = [];
  if (e.schaden <= 0 || e.sr <= 0) return aus;
  for (const b of bros) {
    if (b.raus) continue;
    const d = Math.hypot(b.x - e.sx, b.y + R.broHoehe - e.sy);
    if (d >= e.sr) continue;
    const selbst = b.id === schuetze;
    const s = Math.round(e.schaden * (1 - d / e.sr) * (selbst ? R.eigenerSchaden : 1));
    if (s > 0) aus.push({ id: b.id, schaden: s, selbst });
  }
  return aus;
}

type Bro = TanksSpieler & {
  x: number; y: number; lp: number; tank: number; winkel: number; staerke: number; waffe: Waffe; munition: number[];
  items: number[]; itemGenutzt: boolean; schild: boolean; schuesse: number; treffer: number;
  schaden: number; raus: boolean; aufgegeben: boolean; fahrt: number; fahrtAlter: number;
};
export type BroSicht = Omit<Bro, 'fahrt' | 'fahrtAlter'> & { platz: number };
export type Treffer = { id: string; schaden: number; selbst: boolean };
export type SchussSicht = { schuetze: string; waffe: Waffe; flug: Flugbahn; treffer: Treffer[]; fall: Treffer[]; ausgeschieden: string[] };
export type TanksSicht = {
  optionen: TanksOptionen; phase: TanksPhase; /** Restzeit der Phase in s. */ rest: number; seed: number;
  /** Zählt bei jeder Veränderung des Geländes hoch: Die Bühne zeichnet die Insel nur dann neu. */
  gelaendeStand: number; gelaende: Gelaende; meer: number; wind: number; runde: number; zug: number; amZug: string;
  reihe: string[]; bros: BroSicht[]; schuss?: SchussSicht; gewinner: string[]; grund: TanksGrund;
};
export type TanksPrivat = ArtiPrivat;

const ganzIn = (n: unknown, min: number, max: number): n is number => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;

/** Eine autoritative Partie auf dem Gastgeber. Läuft ohne Uhr: schritt() = genau 1/60 s Spielzeit. */
export class TanksPartie {
  private readonly g: Gelaende;
  private readonly bros: Bro[];
  private readonly reihe: string[];
  private readonly windZufall: () => number;
  private meer: number = R.meerStart;
  private idx = 0;
  private zugNr = 1;
  private runde = 1;
  private wind = 0;
  private phase: TanksPhase = 'countdown';
  private ticks = TICKS(R.countdown);
  private flug?: Flugbahn;
  private schuss?: SchussSicht;
  private gewinner: string[] = [];
  private grund: TanksGrund = '';
  private stand = 0;
  private dauerTicks = 0;
  /** Wer beim letzten Prüfen noch im Spiel war: bei gleichzeitigem Ausscheiden aller sind das die Gleichen. */
  private lebendStand: string[];

  constructor(private readonly spieler: readonly TanksSpieler[], readonly seed: number, readonly optionen: TanksOptionen = { modus: 'einzel', serie: 1 }, zugStart = 1) {
    if (spieler.length < R.spielerMin || spieler.length > R.spielerMax || new Set(spieler.map(s => s.id)).size !== spieler.length) {
      throw new Error('Zwei bis vier verschiedene Spieler sind erforderlich.');
    }
    if (optionen.modus === 'team' && (spieler.length !== 4 || spieler.filter(b => b.team === 0).length !== 2 || spieler.filter(b => b.team === 1).length !== 2)) throw new Error('Teamkampf benötigt zweimal zwei Bros.');
    this.zugNr = zugStart;
    this.g = inselAusSeed(seed, optionen.karte);
    const xs = aufstellen(this.g, spieler.length, seed);
    // Platz und erster Schütze mischt der Seed, nicht die Sitzreihenfolge.
    const z = zufallsstrom((seed ^ STROM.reihe) >>> 0);
    const plaetze = mischen(xs, z);
    // Teams starten auf gegenüberliegenden Seiten, die eigene Reihenfolge bleibt zufällig.
    const teamPlaetze = [xs.slice(0, 2), xs.slice(2)].map(a => mischen(a, z));
    this.bros = spieler.map((s, i) => { const x = optionen.modus === 'team' ? teamPlaetze[s.team!].shift()! : plaetze[i]; return {
      ...s, x, y: hoeheBei(this.g, x), lp: R.lebenspunkte, tank: R.tank, winkel: x < R.breite / 2 ? 60 : 120, staerke: 50, waffe: 0, munition: [...VORRAT_START],
      schaden: 0, items: [1, 1, 1, 1], itemGenutzt: false, schild: false, schuesse: 0, treffer: 0, raus: false, aufgegeben: false, fahrt: 0, fahrtAlter: 0,
    }; });
    const teamReihe = mischen([0,1], z);
    this.reihe = optionen.modus === 'team' ? [0, 1].flatMap(i => teamReihe.map(t => this.bros.filter(b => b.team === t)[i].id)) : mischen(spieler.map(s => s.id), z);
    this.windZufall = zufallsstrom((seed ^ STROM.wind) >>> 0);
    this.lebendStand = this.reihe.slice();
    this.windZiehen();
  }

  private bro(id: string): Bro | undefined { return this.bros.find(b => b.id === id); }
  private get amZug(): Bro { return this.bro(this.reihe[this.idx])!; }
  private windZiehen(): void { this.wind = Math.round(this.windZufall() * 2 * R.windMax - R.windMax); }
  private lebende(): Bro[] { return this.bros.filter(b => !b.raus); }

  eingabe(id: string, a: TanksEingabe): void {
    const b = this.bro(id);
    if (!b || this.phase === 'ende') return;
    if (a.art === 'reset') { b.fahrt = 0; return; }
    // Nur der Bro am Zug, nur beim Zielen. Alles andere wird still verworfen.
    if (this.phase !== 'zielen' || b !== this.amZug || b.raus) return;
    if (a.art === 'tanksitem') { this.itemNutzen(b, a); return; }
    if (a.art === 'steuerung') {
      if (typeof a.x !== 'number' || !Number.isFinite(a.x)) return;
      b.fahrt = Math.sign(Math.max(-1, Math.min(1, a.x))); b.fahrtAlter = 0; return;
    }
    if (!ganzIn(a.winkel, 0, 180) || !ganzIn(a.staerke, 0, 100) || !ganzIn(a.waffe, 0, WAFFEN_ANZAHL - 1)) return;
    if (a.art === 'zielen') {
      b.winkel = a.winkel; b.staerke = a.staerke;
      if (b.munition[a.waffe] !== 0) b.waffe = a.waffe as Waffe;
      return;
    }
    if (a.art === 'feuer') this.feuern(b, a);
  }

  private itemNutzen(b: Bro, a: Extract<TanksEingabe, { art: 'tanksitem' }>): void {
    const i = TANKS_ITEMS.indexOf(a.item);
    if (a.zug !== this.zugNr || i < 0 || b.items[i] <= 0 || b.itemGenutzt) return;
    if (a.item === 'reparatur') { if (b.lp >= R.lebenspunkte) return; b.lp = Math.min(R.lebenspunkte, b.lp + 30); }
    if (a.item === 'schild') { if (b.schild) return; b.schild = true; }
    if (a.item === 'treibstoff') { if (b.tank >= R.tank) return; b.tank = R.tank; }
    if (a.item === 'teleport') {
      if (!ganzIn(a.ziel, 0, 63) || !teleportZiele(b, this.bros, this.g, this.meer).includes(a.ziel)) return;
      b.x = a.ziel; b.y = hoeheBei(this.g, b.x); b.fahrt = 0;
    }
    b.items[i]--; b.itemGenutzt = true;
  }

  private feuern(b: Bro, a: Extract<TanksEingabe, { art: 'feuer' }>): void {
    // Die Zugnummer macht den Schuss einmalig: Ein doppelter oder verspäteter Druck findet keinen Zug mehr.
    if (a.zug !== this.zugNr || b.munition[a.waffe] === 0) return;
    b.winkel = a.winkel; b.staerke = a.staerke; b.waffe = a.waffe as Waffe; b.fahrt = 0;
    b.schuesse++;
    if (b.munition[a.waffe] > 0) b.munition[a.waffe]--;
    const ziele = this.lebende().map(o => ({ x: o.x, y: o.y, schuetze: o === b }));
    this.flug = flugBerechnen({ x: b.x, y: b.y }, b.winkel, b.staerke, this.wind, b.waffe, this.g, ziele);
    this.schuss = undefined;
    this.phase = 'flug';
    this.ticks = Math.max(30, TICKS(Math.min(R.flugAnzeige, this.flug.dauer)));
  }

  neutralisieren(): void { for (const b of this.bros) b.fahrt = 0; }

  aufgeben(id: string): void {
    const b = this.bro(id);
    if (!b || b.raus || this.phase === 'ende') return;
    b.aufgegeben = true; b.raus = true; b.lp = 0; b.fahrt = 0;
    if (this.endePruefen()) return;
    if (this.phase === 'zielen' && b === this.amZug) { this.phase = 'nachlauf'; this.ticks = TICKS(R.nachlauf); }
  }

  schritt(): void {
    if (this.phase === 'ende') return;
    this.dauerTicks++;
    if (this.phase === 'zielen') {
      this.fahren();
      // Fahren kann den Zug beenden (Meer); dann gilt der neue Zeitgeber, nicht ein weiterer Tick.
      if (this.phase !== 'zielen') return;
    }
    if (--this.ticks > 0) return;
    if (this.phase === 'countdown') this.zugStarten();
    else if (this.phase === 'zielen') {
      // Zeit abgelaufen: Der Zug verfällt, es wird nichts verbraucht.
      this.amZug.fahrt = 0; this.schuss = undefined; this.flug = undefined;
      this.phase = 'nachlauf'; this.ticks = TICKS(R.nachlauf);
    } else if (this.phase === 'flug') this.aufloesen();
    else this.weiter();
  }

  private zugStarten(): void {
    // Wer im Countdown aufgegeben hat, darf nicht dran sein: sonst warten alle die vollen 20 s auf einen Toten.
    if (this.amZug.raus) { this.weiter(); return; }
    this.phase = 'zielen'; this.ticks = TICKS(R.zielzeit);
    this.amZug.tank = R.tank; this.amZug.fahrt = 0; this.amZug.itemGenutzt = false;
  }

  private fahren(): void {
    const b = this.amZug;
    if (!b.fahrt) return;
    if (++b.fahrtAlter > TICKS(R.eingabeVerfall)) { b.fahrt = 0; return; }
    if (b.tank <= 0) return;
    const dx = b.fahrt * R.fahrtempo * R.schritt, nx = b.x + dx;
    if (nx < 0 || nx > R.breite) { b.fahrt = 0; return; }
    if (this.lebende().some(o=>o!==b&&Math.abs(o.x-nx)<2.2&&Math.abs(o.x-nx)<Math.abs(o.x-b.x))) { b.fahrt=0; return; }
    const h = hoeheBei(this.g, nx);
    if ((h - b.y) / Math.abs(dx) > R.steigungMax) return; // zu steil zum Hinauffahren
    b.tank = Math.max(0, b.tank - R.tankProSekunde * R.schritt);
    b.x = nx; b.y = h;
    if (h <= this.meer) {
      // Ertrunken: Der Zug endet sofort, statt bis zum Ablauf der Zielzeit auf einen Toten zu warten.
      b.lp = 0; b.raus = true; b.fahrt = 0;
      if (this.endePruefen()) return;
      this.phase = 'nachlauf'; this.ticks = TICKS(R.nachlauf);
    }
  }

  /** Bros sacken nach, nehmen Fallschaden oder ertrinken. Rückgabe: Fallschaden je Bro und Ausgeschiedene. */
  private nachrutschen(fall: Treffer[], raus: string[]): void {
    for (const b of this.lebende()) {
      const h = hoeheBei(this.g, b.x);
      const tiefe = b.y - h;
      b.y = h;
      if (h <= this.meer || b.x < 0 || b.x > R.breite) { b.lp = 0; b.raus = true; raus.push(b.id); continue; }
      if (tiefe > R.fallFrei) {
        const s = Math.min(b.lp, Math.round((tiefe - R.fallFrei) * R.fallProMeter));
        b.lp -= s; fall.push({ id: b.id, schaden: s, selbst: false });
        if (b.lp <= 0) { b.lp = 0; b.raus = true; raus.push(b.id); }
      }
    }
  }

  private aufloesen(): void {
    const b = this.amZug, flug = this.flug!;
    const treffer: Treffer[] = [], fall: Treffer[] = [], raus: string[] = [];
    let getroffen = false;
    for (const e of flug.einschlaege) {
      // Schaden nach den Stellungen VOR dem Einschlag, dann erst das Gelände verändern.
      for (const s of schadenBei(e, this.bros, b.id)) {
        const o = this.bro(s.id)!;
        if (o !== b && this.optionen.modus === 'team' && o.team === b.team) continue;
        if (o.schild) { o.schild = false; continue; }
        const echt = Math.min(o.lp, s.schaden);
        if (!s.selbst && echt > 0) getroffen = true;
        o.lp -= echt; if (!s.selbst) b.schaden += echt;
        treffer.push({ ...s, schaden: echt });
        if (o.lp <= 0) { o.lp = 0; o.raus = true; raus.push(o.id); }
      }
      einschlagAnwenden(this.g, e); this.stand++;
      if (e.stoss > 0) {
        for (const o of this.lebende()) {
          const d = Math.hypot(o.x - e.sx, o.y + R.broHoehe - e.sy);
          if (d < e.sr) o.x = Math.max(-1, Math.min(R.breite + 1, o.x + (o.x >= e.sx ? 1 : -1) * e.stoss * (1 - d / e.sr)));
        }
      }
      this.nachrutschen(fall, raus);
    }
    if (getroffen) b.treffer++;
    this.schuss = { schuetze: b.id, waffe: b.waffe, flug, treffer, fall, ausgeschieden: raus };
    this.phase = 'nachlauf'; this.ticks = TICKS(R.nachlauf);
    this.endePruefen();
  }

  /** Beendet die Partie, wenn höchstens einer übrig ist. Gleichzeitiges Ausscheiden der Letzten ist ein Gleichstand. */
  private endePruefen(): boolean {
    const da = this.lebende();
    if (this.optionen.modus === 'team' && da.length && new Set(da.map(b => b.team)).size === 1) {
      this.gewinner = this.bros.filter(b => b.team === da[0].team && !b.aufgegeben).map(b => b.id); this.grund = 'letzter'; this.phase = 'ende'; this.ticks = 0; return true;
    }
    if (da.length > 1) { this.lebendStand = da.map(b => b.id); return false; }
    this.gewinner = da.length === 1 ? [da[0].id] : this.lebendStand.filter(id => !this.bro(id)!.aufgegeben);
    this.grund = da.length === 1 ? 'letzter' : 'gleichstand';
    this.phase = 'ende'; this.ticks = 0; return true;
  }

  /** Nach dem Nachlauf: nächster lebender Bro; neue Runde, Flut und Rundengrenze. */
  private weiter(): void {
    if (this.endePruefen()) return;
    let i = this.idx, neueRunde = false;
    do { i++; if (i >= this.reihe.length) { i = 0; neueRunde = true; } } while (this.bro(this.reihe[i])!.raus);
    this.idx = i;
    if (neueRunde) {
      this.runde++;
      if (this.runde > R.rundenMax) { this.runde = R.rundenMax; this.grenze(); return; }
      if (this.runde >= R.flutAb) {
        this.meer += R.flutProRunde;
        this.nachrutschen([], []);
        this.stand++;
        if (this.endePruefen()) return;
      }
    }
    this.zugNr++; this.windZiehen(); this.schuss = undefined; this.flug = undefined;
    this.phase = 'zielen'; this.ticks = TICKS(R.zielzeit);
    this.amZug.tank = R.tank; this.amZug.fahrt = 0; this.amZug.itemGenutzt = false;
  }

  /** Nach zwölf Runden: Lebenspunkte, dann verursachter Schaden. Ein Gleichstand bleibt einer. */
  private grenze(): void {
    if (this.optionen.modus === 'team') {
      const teams = [0, 1].map(t => ({ id: String(t), lp: this.bros.filter(b => b.team === t).reduce((n,b) => n+b.lp, 0), schaden: this.bros.filter(b => b.team === t).reduce((n,b) => n+b.schaden, 0) }));
      const sieger = rangfolge(teams).filter(t => t.platz === 1).map(t => Number(t.id));
      this.gewinner = this.bros.filter(b => sieger.includes(b.team!) && !b.aufgegeben).map(b => b.id);
    } else { const r = rangfolge(this.lebende()); this.gewinner = r.filter(b => b.platz === 1).map(b => b.id); }
    this.grund = 'grenze'; this.phase = 'ende'; this.ticks = 0;
  }

  private platzVon(id: string): number {
    return rangfolge(this.bros, this.gewinner).find(b => b.id === id)!.platz;
  }

  sicht(): TanksSicht {
    const rang = rangfolge(this.bros, this.gewinner);
    return {
      optionen: { ...this.optionen }, phase: this.phase, rest: this.ticks * R.schritt, seed: this.seed, gelaendeStand: this.stand, gelaende: this.g, meer: this.meer,
      wind: this.wind, runde: this.runde, zug: this.zugNr, amZug: this.reihe[this.idx], reihe: [...this.reihe],
      bros: this.bros.map(({ fahrt: _f, fahrtAlter: _a, ...b }) => ({ ...b, items: [...b.items], munition: [...b.munition], platz: rang.find(r => r.id === b.id)!.platz })),
      schuss: this.schuss, gewinner: [...this.gewinner], grund: this.grund,
    };
  }

  /** Was ein einzelnes Handy erfährt. Nichts davon verrät etwas über andere. */
  privatFuer(id: string): TanksPrivat | undefined {
    const b = this.bro(id);
    if (!b) return undefined;
    const am = this.phase === 'zielen' && b === this.amZug && !b.raus;
    let inZuegen = 0;
    if (!b.raus && !am) {
      // Schritte in der Zugfolge bis zu diesem Bro, nur lebende gezählt; er selbst nach seinem Schuss: ein voller Umlauf.
      const n = this.reihe.length;
      for (let k = 1; k <= n; k++) {
        const o = this.bro(this.reihe[(this.idx + k) % n])!;
        if (o.raus) continue;
        inZuegen++;
        if (o === b) break;
      }
    }
    return {
      spielerzahl:this.bros.length, dauer:Math.floor(this.dauerTicks*R.schritt), aufgegeben:b.aufgegeben, items: [...b.items], itemGenutzt: b.itemGenutzt, schild: b.schild, teleportZiele: teleportZiele(b, this.bros, this.g, this.meer),
      schaden: b.schaden, schuesse: b.schuesse, treffer: b.treffer, ...(this.optionen.modus === 'team' ? { team: b.team } : {}),
      phase: this.phase, amZug: am, zug: this.zugNr, rest: Math.min(R.zielzeit, Math.ceil(this.ticks * R.schritt)), inZuegen: Math.min(3, inZuegen),
      winkel: b.winkel, staerke: b.staerke, waffe: b.waffe, munition: [...b.munition], lp: b.lp, tank: Math.round(b.tank), wind: this.wind,
      runde: this.runde, platz: this.platzVon(id), raus: b.raus, gewonnen: this.grund !== 'gleichstand' && (this.optionen.modus === 'team' ? new Set(this.bros.filter(b=>this.gewinner.includes(b.id)).map(b=>b.team)).size===1 : this.gewinner.length===1) && this.gewinner.includes(id),
    };
  }

  /** Revanche: neue Partie mit denselben Bros und neuem Seed. Nur nach dem Ende; Aufgegebene sind wieder dabei. */
  revanche(neuerSeed: number): TanksPartie {
    if (this.phase !== 'ende') throw new Error('Eine Revanche gibt es erst nach dem Ende der Partie.');
    return new TanksPartie(this.spieler, neuerSeed, this.optionen);
  }
}

/** Sichere Landepunkte in Reichweite; keine Überlappung und kein Teleport ins Wasser. */
export function teleportZiele(b: { x: number; id: string }, bros: readonly { id: string; x: number; raus: boolean }[], g: Gelaende, meer: number): number[] {
  const ziele: number[] = [];
  for (let x = 4; x < 60; x++) {
    if (Math.abs(x - b.x) < 3 || Math.abs(x - b.x) > 14 || hoeheBei(g, x) <= meer + 1 || Math.abs(hoeheBei(g, x - 1) - hoeheBei(g, x + 1)) > 2) continue;
    if (bros.some(o => !o.raus && o.id !== b.id && Math.abs(o.x - x) < 3)) continue;
    ziele.push(x);
  }
  return ziele;
}
