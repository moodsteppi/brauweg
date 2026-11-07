/**
 * Flying Bro: eine Partie — ein Level, gerechnet mit rapier.
 *
 * Hier steht, was die Spezifikation (docs/SPEZIFIKATION-FLYINGBRO.md) an
 * Physik verlangt: Bauwerk aus der Leveldatei, Schuss, die drei Fähigkeiten,
 * Schaden aus Kontaktimpulsen, Trefferpunkte mit Deckel je Ziel, umfallende
 * Giraffen und die Ruhe, nach der der nächste Bro kommt. Die Zahlen kommen
 * ausnahmslos aus `@brauweg/flyingbro-kern` — der Server rechnet mit
 * denselben Grenzen (Höchstpunkte), und eine zweite Zahl hier wäre eine
 * zweite Wahrheit, die ehrliche Läufe ablehnen lässt.
 *
 * Kein DOM, keine Uhr: Wer `schritt()` ruft, bestimmt die Zeit. Damit läuft
 * dieselbe Klasse im Bildschirm (60 Schritte je Sekunde) und im Test (die
 * Ruheprobe aller Level, partie.test.ts). Pausiert ist das Spiel, indem
 * niemand `schritt()` ruft — ein Bro im Flug bleibt dann in der Luft stehen.
 */

import type * as RapierTypen from '@dimforge/rapier2d-compat';
import {
  BRO_WERTE,
  type Bro,
  FAEHIGKEITEN,
  GIRAFFEN_WERTE,
  type Giraffe,
  type Level,
  SPIELABLAUF,
  STOFF_WERTE,
  SCHADEN,
  type Stoff,
  type Teil,
  broMasse,
  giraffeUmgefallen,
  GIRAFFE_UMGEFALLEN,
  kontaktSchaden,
  schadensFaktor,
  trefferPunkte,
} from '@brauweg/flyingbro-kern';

import { SCHRITT_S, SCHWERKRAFT, type Vek } from './zielen';

type Rapier = typeof RapierTypen;
type Koerper = RapierTypen.RigidBody;
type Huelle = RapierTypen.Collider;

let geladen: Promise<Rapier> | null = null;

/**
 * rapier einmal laden und initialisieren. Dynamisch importiert, damit die
 * 1,25 MB (gzip) nur lädt, wer Flying Bro öffnet (Spezifikation, Empfehlung).
 */
export function ladeRapier(): Promise<Rapier> {
  geladen ??= import('@dimforge/rapier2d-compat')
    .then(async (m) => {
      const r = ((m as unknown as { default?: Rapier }).default ?? m) as Rapier;
      await r.init();
      return r;
    })
    .catch((e: unknown) => {
      // Ein gescheitertes Promise darf nicht zwischengespeichert bleiben,
      // sonst scheitert auch "Nochmal laden" sofort wieder (z. B. nach einer
      // CSP-Sperre fuer WebAssembly oder einem Netzabbruch).
      geladen = null;
      throw e;
    });
  return geladen;
}

export type Phase = 'zielen' | 'flug' | 'gewonnen' | 'verloren';

type Ziel =
  | { art: 'teil'; i: number }
  | { art: 'giraffe'; i: number }
  | { art: 'bro' }
  | { art: 'boden' };

export interface TeilZustand {
  def: Teil;
  koerper: Koerper | null;
  haltbarkeit: number;
  max: number;
  treffer: number;
}

export interface GiraffeZustand {
  def: Giraffe;
  koerper: Koerper | null;
  haltbarkeit: number;
  treffer: number;
  /** Wie lange sie schon über der Neigungsgrenze liegt (s). */
  liegtSeit: number;
  hoechstesY: number;
  umgefallen: boolean;
  /** Nach dem Umfallen: Zierde ohne Kollision, die beleidigt aus dem Bild trottet. */
  abgang: { x: number; y: number; winkel: number; t: number } | null;
}

export type BroForm = 'kreis' | 'rutsch' | 'gleit' | 'eis';

export interface FliegenderBro {
  art: Bro;
  koerper: Koerper;
  huelle: Huelle;
  form: BroForm;
  faehigkeit: 'bereit' | 'aktiv' | 'vorbei';
  /** Wurde die Fähigkeit wirklich ausgelöst? Nur dann gilt der Stoff-Faktor (auch nach ihrem Ende). */
  ausgeloest: boolean;
  /** Schon irgendwo angestoßen? Danach geht die Fähigkeit nicht mehr (außer Malve, solange sie nicht liegt). */
  kontakt: boolean;
  seitAusloesung: number;
  /** Bauchrutscher: Der erste Bodenkontakt ist schon verarbeitet. */
  gelandet: boolean;
  /** Tempo vor dem letzten Schritt — beim Aufsetzen behält Pelle 90 % davon. */
  tempoVorher: Vek;
  spur: Vek[];
}

export interface Splitter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  dw: number;
  t: number;
  stoff: Stoff;
  groesse: number;
}

export interface Einblendung {
  text: string;
  x: number;
  y: number;
  t: number;
}

const BODEN_TIEFE = 2;
/** So lange bleibt ein Splitter oder eine Punktzahl sichtbar (s). */
const SPLITTER_S = 1.2;
const EINBLENDUNG_S = 1.1;
/** So lange trottet eine umgefallene Giraffe, bis sie aus dem Bild ist (s). */
export const ABGANG_S = 3.2;
/** Ab hier liegt Malve — danach geht auch ihr Gleitflug nicht mehr (m/s). */
const LIEGT_UNTER = 1;

function schluessel(a: number, b: number): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

/** Fester Zufall für die Splitter — kein `Math.random`, damit Tests gleich laufen. */
function lcg(saat: number): () => number {
  let s = saat >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Partie {
  readonly level: Level;
  readonly reihe: Bro[];
  phase: Phase = 'zielen';
  punkte = 0;
  verschossen = 0;
  /** Index des nächsten Bros in `reihe`, der in die Schleuder kommt. */
  naechster = 0;
  bro: FliegenderBro | null = null;
  readonly teile: TeilZustand[] = [];
  readonly giraffen: GiraffeZustand[] = [];
  readonly splitter: Splitter[] = [];
  readonly einblendungen: Einblendung[] = [];
  /** Zeit seit dem letzten Schuss (s) — nach `ruheMaxS` kommt der nächste Bro, auch wenn noch etwas wackelt. */
  seitSchuss = 0;
  /** Die übrigen Bros sind am Ende gutgeschrieben (nur einmal). */
  private abgerechnet = false;
  /** Ist der Gleitflug-Finger noch unten? */
  private gehalten = false;

  private readonly r: Rapier;
  private readonly welt: RapierTypen.World;
  private readonly ereignisse: RapierTypen.EventQueue;
  private readonly ziele = new Map<number, Ziel>();
  /** Kontakte, die gerade anliegen; der Wert zählt, wie viele Schritte der Kontakt noch als „neu" gilt. */
  private readonly kontakte = new Map<string, number>();
  /** Schritt, in dem sich ein Paar zuletzt getrennt hat. */
  private readonly getrennt = new Map<string, number>();
  private schrittNr = 0;
  /** Impuls je Paar im vorigen Schritt — die Last, die dort ohnehin ruht. */
  private ruhelast = new Map<string, number>();
  private readonly zufall = lcg(4711);

  constructor(r: Rapier, level: Level, opt: { ersatzPelle?: boolean } = {}) {
    this.r = r;
    this.level = level;
    this.reihe = [...level.bros, ...(opt.ersatzPelle ? (['pelle'] as Bro[]) : [])];
    this.welt = new r.World({ x: 0, y: SCHWERKRAFT });
    this.welt.timestep = SCHRITT_S;
    this.ereignisse = new r.EventQueue(true);

    // Boden: weit über das Level hinaus, damit nichts über die Kante fällt
    // und ewig weiterfällt (dann schliefe nie etwas ein).
    const boden = this.welt.createRigidBody(r.RigidBodyDesc.fixed().setTranslation(level.breite / 2, level.boden - BODEN_TIEFE / 2));
    const bh = this.welt.createCollider(r.ColliderDesc.cuboid(level.breite / 2 + 40, BODEN_TIEFE / 2).setFriction(0.8), boden);
    this.ziele.set(bh.handle, { art: 'boden' });

    level.teile.forEach((t, i) => this.baueTeil(t, i));
    level.giraffen.forEach((g, i) => this.baueGiraffe(g, i));
  }

  // -------------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------------

  private aktiv(): RapierTypen.ActiveEvents {
    return this.r.ActiveEvents.COLLISION_EVENTS | this.r.ActiveEvents.CONTACT_FORCE_EVENTS;
  }

  /** Unter dieser Kraft je Schritt gibt es ohnehin keinen Schaden — so kommen nur Ereignisse, die zählen. */
  private schwelle(): number {
    return SCHADEN.impulsSchwelle / SCHRITT_S;
  }

  private baueTeil(t: Teil, i: number): void {
    const r = this.r;
    const w = STOFF_WERTE[t.stoff];
    const winkel = ((t.winkel ?? 0) * Math.PI) / 180;
    const koerper = this.welt.createRigidBody(r.RigidBodyDesc.dynamic().setTranslation(t.x, t.y).setRotation(winkel));
    let desc: RapierTypen.ColliderDesc;
    if (t.form === 'kreis') desc = r.ColliderDesc.ball(t.r);
    else if (t.form === 'quader') desc = r.ColliderDesc.cuboid(t.b / 2, t.h / 2);
    else {
      // Dreieck: (x, y) ist die Mitte des umgebenden Kastens, Spitze oben (level.ts).
      const d = r.ColliderDesc.convexHull(new Float32Array([-t.b / 2, -t.h / 2, t.b / 2, -t.h / 2, 0, t.h / 2]));
      desc = d ?? r.ColliderDesc.cuboid(t.b / 2, t.h / 2);
    }
    const h = this.welt.createCollider(
      desc
        .setDensity(w.dichte)
        .setFriction(w.reibung)
        .setRestitution(w.abprall)
        .setActiveEvents(this.aktiv())
        .setContactForceEventThreshold(this.schwelle()),
      koerper,
    );
    this.ziele.set(h.handle, { art: 'teil', i });
    this.teile.push({ def: t, koerper, haltbarkeit: w.haltbarkeit, max: w.haltbarkeit, treffer: 0 });
  }

  /** Halsbreite als Anteil der Rumpfbreite — schmal, damit sie kopflastig ist. */
  static readonly HALS_ANTEIL = 0.28;

  private baueGiraffe(g: Giraffe, i: number): void {
    const r = this.r;
    const w = GIRAFFEN_WERTE[g.groesse];
    // Der Körper sitzt am Fußpunkt; Rumpf und Hals hängen als zwei Formen daran.
    const koerper = this.welt.createRigidBody(r.RigidBodyDesc.dynamic().setTranslation(g.x, g.y));
    // Rumpf: Kasten mit runden Ecken statt der Kapsel aus der Spezifikation.
    // Eine liegende Kapsel steht nur auf ihrem geraden Mittelstück (beim Kalb
    // 15 cm), der seitlich versetzte Hals zog sie damit schon im Stand um —
    // die Ruheprobe meldete 44 von 45 Leveln, bevor ein Bro flog.
    const ecke = Math.min(0.08, w.rumpfHoehe / 4);
    const rumpf = r.ColliderDesc.roundCuboid(w.rumpfBreite / 2 - ecke, w.rumpfHoehe / 2 - ecke, ecke).setTranslation(0, w.rumpfHoehe / 2);
    // Hals mit Kopf: schmaler Quader über dem Rumpf, zur Blickseite versetzt,
    // aber innerhalb der Rumpfbreite (die Levelprüfung hält nur dort Abstand).
    const halsB = w.rumpfBreite * Partie.HALS_ANTEIL;
    const halsH = w.hoehe - w.rumpfHoehe;
    const seite = g.blick === 'links' ? -1 : 1;
    const hals = r.ColliderDesc.cuboid(halsB / 2, halsH / 2).setTranslation(seite * (w.rumpfBreite / 2 - halsB / 2), w.rumpfHoehe + halsH / 2);
    for (const d of [rumpf, hals]) {
      const h = this.welt.createCollider(
        d
          .setDensity(w.dichte)
          .setFriction(0.6)
          .setRestitution(0.05)
          .setActiveEvents(this.aktiv())
          .setContactForceEventThreshold(this.schwelle()),
        koerper,
      );
      this.ziele.set(h.handle, { art: 'giraffe', i });
    }
    this.giraffen.push({
      def: g,
      koerper,
      haltbarkeit: w.haltbarkeit,
      treffer: 0,
      liegtSeit: 0,
      hoechstesY: g.y,
      umgefallen: false,
      abgang: null,
    });
  }

  // -------------------------------------------------------------------------
  // Bros
  // -------------------------------------------------------------------------

  /** Der Bro, der gerade in der Schleuder sitzt (oder `null`, wenn keiner mehr da ist). */
  imBand(): Bro | null {
    return this.phase === 'zielen' ? (this.reihe[this.naechster] ?? null) : null;
  }

  /** Die Bros, die noch warten (ohne den in der Schleuder). */
  wartend(): Bro[] {
    return this.reihe.slice(this.naechster + (this.phase === 'zielen' ? 1 : 0));
  }

  abschussPunkt(): Vek {
    return { x: this.level.schleuder.x, y: this.level.schleuder.y };
  }

  /** Abschuss mit fertiger Geschwindigkeit (zielen.ts rechnet sie aus dem Zug). */
  schiessen(v: Vek): boolean {
    const art = this.imBand();
    if (!art) return false;
    const r = this.r;
    const w = BRO_WERTE[art];
    const p = this.abschussPunkt();
    const koerper = this.welt.createRigidBody(
      r.RigidBodyDesc.dynamic()
        .setTranslation(p.x, p.y)
        .setLinvel(v.x, v.y)
        .setCcdEnabled(true)
        .setLinearDamping(SPIELABLAUF.broLinearDaempfung)
        .setAngularDamping(SPIELABLAUF.broRollDaempfung),
    );
    const huelle = this.welt.createCollider(this.broHuelle(r.ColliderDesc.ball(w.radius), w.dichte, 0.5, 0.3), koerper);
    this.ziele.set(huelle.handle, { art: 'bro' });
    this.bro = {
      art,
      koerper,
      huelle,
      form: 'kreis',
      faehigkeit: 'bereit',
      ausgeloest: false,
      kontakt: false,
      seitAusloesung: 0,
      gelandet: false,
      tempoVorher: { ...v },
      spur: [],
    };
    this.naechster += 1;
    this.verschossen += 1;
    this.seitSchuss = 0;
    this.phase = 'flug';
    return true;
  }

  private broHuelle(d: RapierTypen.ColliderDesc, dichte: number, reibung: number, abprall: number): RapierTypen.ColliderDesc {
    return d
      .setDensity(dichte)
      .setFriction(reibung)
      .setRestitution(abprall)
      .setActiveEvents(this.aktiv())
      .setContactForceEventThreshold(this.schwelle());
  }

  /** Neue Form für den fliegenden Bro, bei gleicher Lage und gleichem Tempo. */
  private tauscheHuelle(d: RapierTypen.ColliderDesc): void {
    const b = this.bro;
    if (!b) return;
    this.ziele.delete(b.huelle.handle);
    this.welt.removeCollider(b.huelle, true);
    b.huelle = this.welt.createCollider(d, b.koerper);
    this.ziele.set(b.huelle.handle, { art: 'bro' });
  }

  /** Darf die Fähigkeit jetzt noch ausgelöst werden? */
  faehigkeitMoeglich(): boolean {
    const b = this.bro;
    if (!b || this.phase !== 'flug' || b.faehigkeit !== 'bereit') return false;
    if (!b.kontakt) return true;
    // Malve: auch nach einem Streifkontakt, solange sie nicht liegt.
    if (!FAEHIGKEITEN.gleitflug.nachStreifkontakt || b.art !== 'malve') return false;
    const v = b.koerper.linvel();
    return Math.hypot(v.x, v.y) > LIEGT_UNTER;
  }

  /** Tipp im Flug (Finger runter). Gibt zurück, ob etwas ausgelöst wurde. */
  tippen(): boolean {
    if (!this.faehigkeitMoeglich()) return false;
    const b = this.bro!;
    const r = this.r;
    b.faehigkeit = 'aktiv';
    b.ausgeloest = true;
    b.seitAusloesung = 0;
    if (b.art === 'pelle') {
      // Bauchrutscher: flach als Kapsel, gleiche Masse, kaum Reibung.
      const f = FAEHIGKEITEN.bauchrutscher;
      const r0 = f.hoehe / 2;
      const flaeche = (f.breite - f.hoehe) * f.hoehe + Math.PI * r0 * r0;
      this.tauscheHuelle(this.broHuelle(r.ColliderDesc.roundCuboid(f.breite / 2 - r0, 0.001, r0 - 0.001), broMasse('pelle') / flaeche, f.reibung, 0));
      b.koerper.setRotation(0, true);
      b.koerper.setAngvel(0, true);
      b.koerper.lockRotations(true, true);
      b.form = 'rutsch';
    } else if (b.art === 'malve') {
      // Gleitflug: so lange der Finger unten bleibt, höchstens 2,5 s.
      const f = FAEHIGKEITEN.gleitflug;
      this.gehalten = true;
      b.koerper.setGravityScale(f.schwerkraftFaktor, true);
      b.koerper.setLinearDamping(f.luftwiderstand);
      b.form = 'gleit';
    } else {
      // Eisblock: Würfel, dreifache Masse, kein Abprall.
      const f = FAEHIGKEITEN.eisblock;
      const masse = broMasse('tjark') * f.masseFaktor;
      this.tauscheHuelle(this.broHuelle(r.ColliderDesc.cuboid(f.kante / 2, f.kante / 2), masse / (f.kante * f.kante), 0.6, f.abprall));
      b.form = 'eis';
    }
    return true;
  }

  /** Finger hoch: beendet einen Gleitflug. */
  loslassen(): void {
    this.gehalten = false;
    if (this.bro?.form === 'gleit') this.gleitEnde();
  }

  private gleitEnde(): void {
    const b = this.bro;
    if (!b || b.form !== 'gleit') return;
    b.koerper.setGravityScale(1, true);
    b.koerper.setLinearDamping(SPIELABLAUF.broLinearDaempfung);
    b.form = 'kreis';
    b.faehigkeit = 'vorbei';
  }

  // -------------------------------------------------------------------------
  // Rechnen
  // -------------------------------------------------------------------------

  /** Ein fester Schritt von 1/60 s. */
  schritt(): void {
    if (this.phase === 'gewonnen' || this.phase === 'verloren') {
      this.zierdeSchritt();
      return;
    }
    const dt = SCHRITT_S;
    const b = this.bro;
    if (b) {
      b.tempoVorher = { ...b.koerper.linvel() };
      this.faehigkeitSchritt(b, dt);
    }

    this.schrittNr += 1;
    this.welt.step(this.ereignisse);
    this.kontakteAuswerten();

    if (this.phase === 'flug') this.seitSchuss += dt;
    if (b && this.bro === b) {
      const p = b.koerper.translation();
      if (b.spur.length === 0 || Math.hypot(p.x - b.spur[b.spur.length - 1]!.x, p.y - b.spur[b.spur.length - 1]!.y) > 0.35) {
        if (!b.kontakt) b.spur.push({ x: p.x, y: p.y });
      }
      // Aus dem Level geflogen: weg damit, sonst schläft er nie ein.
      if (p.x > this.level.breite + 6 || p.x < -6 || p.y < this.level.boden - 3) this.entferneBro();
    }

    this.giraffenPruefen(dt);
    this.zierdeSchritt();
    this.ruhePruefen();
  }

  private faehigkeitSchritt(b: FliegenderBro, dt: number): void {
    if (b.faehigkeit !== 'aktiv') return;
    b.seitAusloesung += dt;
    if (b.form === 'gleit') {
      if (!this.gehalten || b.seitAusloesung >= FAEHIGKEITEN.gleitflug.dauerMaxS) this.gleitEnde();
    } else if (b.form === 'rutsch' && b.gelandet && b.seitAusloesung >= FAEHIGKEITEN.bauchrutscher.rutschenMaxS) {
      // Ausgerutscht: Reibung zurück, damit er liegen bleibt und einschläft.
      b.huelle.setFriction(0.8);
      b.koerper.lockRotations(false, true);
      b.faehigkeit = 'vorbei';
    }
  }

  private kontakteAuswerten(): void {
    this.ereignisse.drainCollisionEvents((h1, h2, angefangen) => {
      const k = schluessel(h1, h2);
      if (angefangen) {
        // Zwei Schritte lang gilt der Kontakt als neu: Die Kraft kommt bei
        // rapier im selben, manchmal erst im nächsten Schritt an. Hat sich
        // das Paar aber eben erst getrennt, ist es Flattern eines ruhenden
        // Stapels und kein Treffer — die Ruheprobe zählte sonst in w3-09
        // und w3-15 je 10 Punkte, ohne dass etwas getroffen war.
        const zuletzt = this.getrennt.get(k);
        if (zuletzt === undefined || this.schrittNr - zuletzt > 15) this.kontakte.set(k, 2);
        this.beruehrt(h1, h2);
      } else {
        this.kontakte.delete(k);
        this.getrennt.set(k, this.schrittNr);
      }
    });
    // Schaden macht nur der STOSS, nicht die Last. Eine Steinplatte unter
    // einem ganzen Turm (w3-15) trägt im Ruhen schon 2,8 Impuls je Schritt —
    // über der Schwelle des Kerns —, und zerrieb sich ohne Schuss in einer
    // Viertelsekunde; der Turm sackte durch. Gezählt wird darum, was ein Paar
    // über seinen Impuls im vorigen Schritt hinaus bekommt. Ein Aufprall
    // springt, eine Last bleibt gleich.
    const jetzt = new Map<string, number>();
    const zaehlt = this.verschossen > 0;
    this.ereignisse.drainContactForceEvents((e) => {
      const h1 = e.collider1();
      const h2 = e.collider2();
      const k = schluessel(h1, h2);
      const roh = e.totalForceMagnitude() * SCHRITT_S;
      jetzt.set(k, roh);
      const impuls = roh - (this.ruhelast.get(k) ?? 0);
      const neu = (this.kontakte.get(k) ?? 0) > 0;
      if (neu) this.kontakte.set(k, 0);
      // Vor dem ersten Schuss setzt sich das Bauwerk nur — das ist kein Treffer.
      if (!zaehlt || impuls <= 0) return;
      const a = this.ziele.get(h1);
      const b = this.ziele.get(h2);
      if (!a || !b) return;
      this.schaden(a, b, impuls, neu);
      this.schaden(b, a, impuls, neu);
    });
    this.ruhelast = jetzt;
    for (const [k, n] of this.kontakte) if (n > 0) this.kontakte.set(k, n - 1);
  }

  /** Der Bro hat etwas berührt: Fähigkeit verfällt, Pelle setzt zum Rutschen auf. */
  private beruehrt(h1: number, h2: number): void {
    const b = this.bro;
    if (!b) return;
    const a = this.ziele.get(h1);
    const c = this.ziele.get(h2);
    const istBro = a?.art === 'bro' || c?.art === 'bro';
    if (!istBro) return;
    const anderes = a?.art === 'bro' ? c : a;
    b.kontakt = true;
    if (b.form === 'rutsch' && !b.gelandet && anderes?.art === 'boden') {
      // Bauchrutscher: 90 % des Tempos bleiben, flach nach vorn statt Abprall.
      b.gelandet = true;
      b.seitAusloesung = 0;
      const tempo = Math.hypot(b.tempoVorher.x, b.tempoVorher.y) * FAEHIGKEITEN.bauchrutscher.tempoBehalten;
      b.koerper.setLinvel({ x: Math.sign(b.tempoVorher.x || 1) * tempo, y: 0 }, true);
    }
    if (b.faehigkeit === 'bereit' && b.art !== 'malve') b.faehigkeit = 'vorbei';
  }

  private schaden(ziel: Ziel, anderes: Ziel, impuls: number, neu: boolean): void {
    if (ziel.art !== 'teil' && ziel.art !== 'giraffe') return;
    const b = this.bro;
    const vomBro = anderes.art === 'bro' && b !== null;
    if (ziel.art === 'teil') {
      const t = this.teile[ziel.i]!;
      if (!t.koerper) return;
      const faktor = vomBro ? schadensFaktor(b!.art, t.def.stoff, b!.ausgeloest) : 1;
      const s = kontaktSchaden(impuls, faktor);
      if (s <= 0) return;
      if (neu) this.treffer(t, s);
      t.haltbarkeit -= s;
      if (t.haltbarkeit <= 0) this.brich(ziel.i);
    } else {
      const g = this.giraffen[ziel.i]!;
      if (!g.koerper || g.umgefallen) return;
      const s = kontaktSchaden(impuls, 1);
      if (s <= 0) return;
      if (neu) this.treffer(g, s);
      g.haltbarkeit -= s;
    }
  }

  private treffer(z: { treffer: number }, schaden: number): void {
    const punkte = trefferPunkte(schaden, z.treffer);
    if (punkte <= 0) return;
    z.treffer += 1;
    this.punkte += punkte;
  }

  private brich(i: number): void {
    const t = this.teile[i]!;
    const k = t.koerper;
    if (!k) return;
    const p = k.translation();
    const v = k.linvel();
    for (let n = k.numColliders() - 1; n >= 0; n--) this.ziele.delete(k.collider(n).handle);
    this.welt.removeRigidBody(k);
    t.koerper = null;
    t.haltbarkeit = 0;
    const punkte = STOFF_WERTE[t.def.stoff].bruchpunkte;
    this.punkte += punkte;
    this.einblendungen.push({ text: `+${punkte}`, x: p.x, y: p.y, t: 0 });
    // 4–6 Splitter ohne Kollision — nur Zierde (Spezifikation, Bauteile).
    const anzahl = 4 + Math.floor(this.zufall() * 3);
    const groesse = t.def.form === 'kreis' ? t.def.r : Math.min(t.def.b, t.def.h);
    for (let n = 0; n < anzahl; n++) {
      this.splitter.push({
        x: p.x + (this.zufall() - 0.5) * 0.4,
        y: p.y + (this.zufall() - 0.5) * 0.4,
        vx: v.x * 0.3 + (this.zufall() - 0.5) * 5,
        vy: v.y * 0.3 + this.zufall() * 4,
        w: this.zufall() * Math.PI,
        dw: (this.zufall() - 0.5) * 12,
        t: 0,
        stoff: t.def.stoff,
        groesse: Math.max(0.08, groesse * (0.35 + this.zufall() * 0.4)),
      });
    }
  }

  private giraffenPruefen(dt: number): void {
    const grenze = (GIRAFFE_UMGEFALLEN.neigungGrad * Math.PI) / 180;
    for (const g of this.giraffen) {
      const k = g.koerper;
      if (!k || g.umgefallen) continue;
      const p = k.translation();
      g.hoechstesY = Math.max(g.hoechstesY, p.y);
      const w = Math.atan2(Math.sin(k.rotation()), Math.cos(k.rotation()));
      g.liegtSeit = Math.abs(w) > grenze ? g.liegtSeit + dt : 0;
      if (giraffeUmgefallen({ haltbarkeit: g.haltbarkeit, liegtSeitS: g.liegtSeit, y: p.y, hoechstesY: g.hoechstesY })) {
        this.umfallen(g);
      }
    }
  }

  private umfallen(g: GiraffeZustand): void {
    const k = g.koerper!;
    const p = k.translation();
    for (let n = k.numColliders() - 1; n >= 0; n--) this.ziele.delete(k.collider(n).handle);
    g.abgang = { x: p.x, y: Math.max(this.level.boden, p.y), winkel: k.rotation(), t: 0 };
    this.welt.removeRigidBody(k);
    g.koerper = null;
    g.umgefallen = true;
    const punkte = GIRAFFEN_WERTE[g.def.groesse].punkte;
    this.punkte += punkte;
    this.einblendungen.push({ text: `+${punkte}`, x: p.x, y: p.y + GIRAFFEN_WERTE[g.def.groesse].hoehe, t: 0 });
  }

  /** Splitter, Punktzahlen und abgehende Giraffen — Zierde, auch nach dem Levelende. */
  private zierdeSchritt(): void {
    const dt = SCHRITT_S;
    for (let i = this.splitter.length - 1; i >= 0; i--) {
      const s = this.splitter[i]!;
      s.t += dt;
      s.vy += SCHWERKRAFT * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.w += s.dw * dt;
      if (s.y < this.level.boden + 0.05) {
        s.y = this.level.boden + 0.05;
        s.vy *= -0.3;
        s.vx *= 0.6;
      }
      if (s.t > SPLITTER_S) this.splitter.splice(i, 1);
    }
    for (let i = this.einblendungen.length - 1; i >= 0; i--) {
      const e = this.einblendungen[i]!;
      e.t += dt;
      e.y += 0.8 * dt;
      if (e.t > EINBLENDUNG_S) this.einblendungen.splice(i, 1);
    }
    for (const g of this.giraffen) if (g.abgang && g.abgang.t < ABGANG_S) g.abgang.t += dt;
  }

  private entferneBro(): void {
    const b = this.bro;
    if (!b) return;
    this.ziele.delete(b.huelle.handle);
    this.welt.removeRigidBody(b.koerper);
    this.bro = null;
    this.gehalten = false;
  }

  /** Schläft alles, was sich bewegen kann? */
  alleSchlafen(): boolean {
    if (this.bro && !this.bro.koerper.isSleeping()) return false;
    for (const t of this.teile) if (t.koerper && !t.koerper.isSleeping()) return false;
    for (const g of this.giraffen) if (g.koerper && !g.koerper.isSleeping()) return false;
    return true;
  }

  alleGiraffenUm(): boolean {
    return this.giraffen.every((g) => g.umgefallen);
  }

  private ruhePruefen(): void {
    if (this.phase === 'zielen') {
      // Eine Giraffe kann auch nach der Frist noch nachkippen — dann ist das
      // Level geschafft, sobald alles ruht, ohne dass noch einer fliegen muss.
      if (this.alleGiraffenUm() && this.alleSchlafen()) this.beende(true);
      return;
    }
    if (this.phase !== 'flug') return;
    if (!this.alleSchlafen() && this.seitSchuss < SPIELABLAUF.ruheMaxS) return;
    this.entferneBro();
    for (const g of this.giraffen) if (g.koerper) g.hoechstesY = g.koerper.translation().y;
    if (this.alleGiraffenUm()) this.beende(true);
    else if (this.naechster < this.reihe.length) this.phase = 'zielen';
    else this.beende(false);
  }

  private beende(geschafft: boolean): void {
    if (this.abgerechnet) return;
    this.abgerechnet = true;
    if (geschafft) {
      const uebrig = this.reihe.length - this.naechster;
      this.punkte += uebrig * SPIELABLAUF.bonusJeUebrigemBro;
      this.phase = 'gewonnen';
    } else this.phase = 'verloren';
  }

  /** Nicht verschossene Bros (für die Anzeige der Wertung). */
  uebrigeBros(): number {
    return this.reihe.length - this.naechster;
  }

  /** Lage eines Körpers für die Zeichnung. */
  static lage(k: Koerper): { x: number; y: number; w: number } {
    const p = k.translation();
    return { x: p.x, y: p.y, w: k.rotation() };
  }

  freigeben(): void {
    this.welt.free();
    this.ereignisse.free();
  }
}
