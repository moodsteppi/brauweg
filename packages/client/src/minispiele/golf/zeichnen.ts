/**
 * Der Zeichner: aus einem Partiezustand wird ein Bild.
 *
 * Ohne React, ohne Netz, ohne Regeln — er liest den Zustand und malt. Genau
 * deshalb kann ihn auch das Banner der Spielauswahl benutzen, das dieselbe
 * Physik mit Bots laufen lässt.
 *
 * **Zwei Ebenen, und das ist der ganze Leistungstrick.** Alles, was sich in
 * einem Loch nie ändert — Rasen, Mähstreifen, Rauschen, Wände, die Grundform
 * der Zonen, der Trichter des Lochs —, wird EINMAL je Bahn in eine
 * Nebenleinwand in Weltauflösung gemalt und je Bild nur verschoben und
 * skaliert. Übrig bleiben für die 60 Bilder je Sekunde: acht Bälle, ein paar
 * Animationen und der Zielpfeil. Ohne diese Trennung malt man auf einem
 * Handy 200 Wandsegmente sechzigmal je Sekunde neu, und das ist genau die
 * Sorte Arbeit, die man später nicht mehr findet, weil sie überall gleich
 * verteilt ist.
 *
 * **Keine Allokationen im Zeichenpfad.** Ballbilder, Muster und Farbverläufe
 * entstehen einmal und liegen danach herum; die Partikelliste wird
 * wiederverwendet statt neu aufgebaut. `save`/`restore` steht nur dort, wo
 * wirklich geclippt wird.
 *
 * **Determinismus geht diese Datei nichts an.** Hier darf `Math.sin`,
 * `Math.random` und alles andere stehen, was in `physik.ts` verboten ist:
 * Kein Pixel dieser Datei fließt je in einen Spielzustand zurück.
 */

import { dunkler, farbeVon, heller } from './farben';
import type { Blick } from './kamera';
import type {
  Karte,
  Wand,
  Zone,
  ZoneBeschleuniger,
  ZoneBumper,
  ZoneDrehkreuz,
  ZonePortal,
  ZoneSprungfeld,
  ZoneStrudel,
} from './karte';
import { RAND_DICKE, istKreis, istRechteck } from './karte';
import {
  BALL_R,
  IMMUN_TAKTE,
  LOCH_R,
  MAX_ZUG,
  type Effektereignis,
  type Partiezustand,
} from './physik';

/* --------------------------------------------------------------------------
 * Farbstimmungen
 * ----------------------------------------------------------------------- */

interface Stimmung {
  grund: string;
  streifenHell: string;
  streifenDunkel: string;
  rahmen: string;
  rahmenHell: string;
  rahmenDunkel: string;
  wand: string;
  wandOben: string;
  loch: string;
}

const STIMMUNGEN: Record<string, Stimmung> = {
  wiese: {
    grund: '#3f8f4a',
    streifenHell: '#4aa356',
    streifenDunkel: '#387f42',
    rahmen: '#7a5230',
    rahmenHell: '#9a6a3f',
    rahmenDunkel: '#553a20',
    wand: '#e8e3d6',
    wandOben: '#fbf8ef',
    loch: '#12331a',
  },
  wueste: {
    grund: '#8d8f42',
    streifenHell: '#9ba14d',
    streifenDunkel: '#7d803a',
    rahmen: '#8a6134',
    rahmenHell: '#a97a44',
    rahmenDunkel: '#5f4123',
    wand: '#efe0bd',
    wandOben: '#fff5dc',
    loch: '#33280f',
  },
  eis: {
    grund: '#4b8b86',
    streifenHell: '#579c96',
    streifenDunkel: '#417b77',
    rahmen: '#4d6b7d',
    rahmenHell: '#67889c',
    rahmenDunkel: '#354b58',
    wand: '#dff0f5',
    wandOben: '#f4fdff',
    loch: '#0f2c31',
  },
  nacht: {
    grund: '#24543c',
    streifenHell: '#2c6146',
    streifenDunkel: '#1e4a34',
    rahmen: '#3a3550',
    rahmenHell: '#4f4a6b',
    rahmenDunkel: '#26223a',
    wand: '#b9b6cf',
    wandOben: '#d5d2e8',
    loch: '#080f0c',
  },
};

function stimmungVon(karte: Karte): Stimmung {
  return STIMMUNGEN[karte.dekor ?? 'wiese'] ?? STIMMUNGEN.wiese;
}

/* --------------------------------------------------------------------------
 * Aufträge
 * ----------------------------------------------------------------------- */

/** Was der Zielpfeil zeigen soll. */
export interface Zielbild {
  /** Ballmitte in Weltkoordinaten. */
  x: number;
  y: number;
  /** Einheitsvektor der Schussrichtung. */
  rx: number;
  ry: number;
  /** Kraft in (0, 1]. */
  kraft: number;
  /** Vorschau als x,y-Paare; leer heißt: keine zeichnen. */
  bahn: readonly number[];
}

export interface Bildauftrag {
  karte: Karte;
  /** Der Zustand des laufenden Takts — LEBEND, wird nur gelesen. */
  zustand: Partiezustand;
  /** Der Zustand des Vortakts, für die Zwischenbilder. */
  vorher: Partiezustand;
  /** Wie weit der laufende Takt schon vorbei ist, 0..1. */
  anteil: number;
  blick: Blick;
  /** Sitz des Zuschauers; -1 = niemand (Banner, Zuschauer). */
  eigenerSitz: number;
  ziel: Zielbild | null;
  /** Wanduhr in Millisekunden — treibt die Deko-Animationen. */
  uhrMs: number;
  /** Übersichtsmodus: die Bälle werden etwas größer gemalt, damit man sie sieht. */
  uebersicht: boolean;
}

/* --------------------------------------------------------------------------
 * Partikel
 * ----------------------------------------------------------------------- */

interface Partikel {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Restliche Lebensdauer in Millisekunden. */
  rest: number;
  ganz: number;
  groesse: number;
  farbe: string;
  /** Ring statt Punkt (Wasserwelle, Bumper-Blitz). */
  ring: boolean;
}

/** Mehr als das wird nicht gezeichnet — gegen Lawinen bei Dauerkontakt. */
const PARTIKEL_MAX = 220;

/* --------------------------------------------------------------------------
 * Der Zeichner
 * ----------------------------------------------------------------------- */

export class Zeichner {
  private readonly leinwand: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D | null;

  /** Die einmal gemalte Bahn. */
  private statisch: HTMLCanvasElement | null = null;
  private statischKarte: Karte | null = null;
  /** Weltmaße der statischen Ebene (mit Rahmen). */
  private statischLinks = 0;
  private statischOben = 0;
  private statischBreite = 0;
  private statischHoehe = 0;

  /** Ballbilder je Sitz, einmal gemalt. */
  private readonly ballBilder: (HTMLCanvasElement | null)[] = [];
  /** Rauschkachel für den Rasen. */
  private rauschen: HTMLCanvasElement | null = null;

  private readonly partikel: Partikel[] = [];
  private letzteUhr = 0;

  /* Bildmaße und Abbildung Welt → Bildschirm, je Bild gesetzt. */
  private breitePx = 1;
  private hoehePx = 1;
  private dpr = 1;
  private skala = 1;
  private mx = 0;
  private my = 0;

  constructor(leinwand: HTMLCanvasElement) {
    this.leinwand = leinwand;
    this.ctx = leinwand.getContext('2d');
  }

  /** Ohne 2D-Kontext (jsdom, sehr alte Browser) wird gar nicht gemalt. */
  get bereit(): boolean {
    return this.ctx !== null;
  }

  /** Höhe zu Breite des Blickfelds — die Kamera braucht es zum Klemmen. */
  get seitenverhaeltnis(): number {
    return this.hoehePx > 0 && this.breitePx > 0 ? this.hoehePx / this.breitePx : 1.6;
  }

  /** Bildschirmpunkt (CSS-Pixel relativ zur Leinwand) → Weltkoordinaten. */
  zuWelt(px: number, py: number): { x: number; y: number } {
    return {
      x: (px - this.breitePx / 2) / this.skala + this.mx,
      y: (py - this.hoehePx / 2) / this.skala + this.my,
    };
  }

  /** Weltkoordinaten → Bildschirmpunkt (CSS-Pixel relativ zur Leinwand). */
  zuBild(x: number, y: number): { px: number; py: number } {
    return {
      px: (x - this.mx) * this.skala + this.breitePx / 2,
      py: (y - this.my) * this.skala + this.hoehePx / 2,
    };
  }

  /**
   * Die Leinwand an ihre Anzeigegröße anpassen.
   *
   * Nur wenn sich etwas geändert hat: Ein Schreiben auf `canvas.width` leert
   * die Leinwand und wirft alle Zustände weg, auch wenn derselbe Wert
   * daraufsteht.
   */
  messe(): void {
    const el = this.leinwand;
    const dpr = typeof window !== 'undefined' ? Math.min(2.5, window.devicePixelRatio || 1) : 1;
    const breite = el.clientWidth || el.width || 1;
    const hoehe = el.clientHeight || el.height || 1;
    this.breitePx = breite;
    this.hoehePx = hoehe;
    this.dpr = dpr;
    const w = Math.max(1, Math.round(breite * dpr));
    const h = Math.max(1, Math.round(hoehe * dpr));
    if (el.width !== w) el.width = w;
    if (el.height !== h) el.height = h;
  }

  /**
   * Deko-Ereignisse eines Takts aufnehmen (Funken, Spritzer, Konfetti).
   *
   * Sie sind bewusst KEIN Spielzustand: Ein Rückspulen kann sie doppelt
   * erzeugen, und das ist auch die einzige Folge — ein paar Funken zu viel.
   */
  nimmEffekte(ereignisse: readonly Effektereignis[]): void {
    for (let i = 0; i < ereignisse.length; i += 1) {
      const e = ereignisse[i];
      if (e.art === 'wandtreffer') {
        const n = e.staerke > 12 ? 7 : 4;
        for (let k = 0; k < n; k += 1) this.funke(e.x, e.y, '#fff6d0', 260, 3.2);
      } else if (e.art === 'balltreffer') {
        for (let k = 0; k < 5; k += 1) this.funke(e.x, e.y, farbeVon(e.sitz), 300, 3.6);
      } else if (e.art === 'bumper') {
        this.ringstoss(e.x, e.y, '#ffd166', 340);
        for (let k = 0; k < 8; k += 1) this.funke(e.x, e.y, '#ffe08a', 340, 5);
      } else if (e.art === 'wasser') {
        this.ringstoss(e.x, e.y, '#bfe6ff', 500);
        for (let k = 0; k < 8; k += 1) this.funke(e.x, e.y, '#cfeaff', 420, 3);
      } else if (e.art === 'eingelocht') {
        // Konfetti in der Spielerfarbe — der einzige Effekt, der lange steht.
        for (let k = 0; k < 22; k += 1) this.funke(e.x, e.y, farbeVon(e.sitz), 900, 6);
        this.ringstoss(e.x, e.y, farbeVon(e.sitz), 700);
      } else if (e.art === 'portal') {
        this.ringstoss(e.x, e.y, '#c9a7ff', 400);
        this.ringstoss(e.zielX, e.zielY, '#c9a7ff', 400);
      } else if (e.art === 'sprung') {
        for (let k = 0; k < 6; k += 1) this.funke(e.x, e.y, '#ffffff', 300, 4);
      }
    }
  }

  /** Die Bahn wechseln — baut die statische Ebene neu auf. */
  setzeKarte(karte: Karte): void {
    if (this.statischKarte === karte) return;
    this.statischKarte = karte;
    this.baueStatisch(karte);
    this.partikel.length = 0;
  }

  /* ------------------------------------------------------------------ */

  zeichne(a: Bildauftrag): void {
    const ctx = this.ctx;
    if (ctx === null) return;
    this.messe();
    this.setzeKarte(a.karte);

    const dt = this.letzteUhr === 0 ? 16 : Math.min(80, a.uhrMs - this.letzteUhr);
    this.letzteUhr = a.uhrMs;
    this.bewegePartikel(dt);

    this.skala = this.breitePx / Math.max(0.001, a.blick.breite);
    this.mx = a.blick.mx;
    this.my = a.blick.my;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Der Grund hinter der Bahn: dunkel, damit der Rahmen eine Kante hat.
    ctx.fillStyle = '#141c17';
    ctx.fillRect(0, 0, this.breitePx, this.hoehePx);

    ctx.translate(this.breitePx / 2, this.hoehePx / 2);
    ctx.scale(this.skala, this.skala);
    ctx.translate(-this.mx, -this.my);

    if (this.statisch !== null) {
      ctx.drawImage(
        this.statisch,
        this.statischLinks,
        this.statischOben,
        this.statischBreite,
        this.statischHoehe,
      );
    }

    this.zeichneBewegteZonen(ctx, a);
    this.zeichneBaelle(ctx, a);
    this.zeichnePartikel(ctx);
    this.zeichneFahne(ctx, a);
    if (a.ziel !== null && !a.uebersicht) this.zeichneZiel(ctx, a.ziel);

    // Zurück in den Bildschirmraum: Alles Weitere (Beschriftung) darf nicht
    // mitskalieren, sonst ist die Prozentzahl bei Übersicht briefmarkengroß.
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (a.ziel !== null && !a.uebersicht) this.zeichneKraftzahl(ctx, a.ziel);
  }

  /* ------------------------------------------------------------------ */
  /* Statische Ebene                                                     */
  /* ------------------------------------------------------------------ */

  private baueStatisch(karte: Karte): void {
    if (typeof document === 'undefined') return;
    const d = RAND_DICKE;
    const weltBreite = karte.breite + 2 * d;
    const weltHoehe = karte.hoehe + 2 * d;
    /*
     * Auflösung der Nebenleinwand: so fein wie möglich, aber nie über 2048 px
     * Kante. Auf einer 40 × 64 großen Bahn sind das 31 px je Einheit — mehr
     * als jedes Handy je zeigt, und ein 4096er Puffer kostet auf schwachen
     * Geräten den Grafikspeicher.
     */
    const pxProE = Math.max(6, Math.min(64, 2048 / Math.max(weltBreite, weltHoehe)));
    const w = Math.max(1, Math.round(weltBreite * pxProE));
    const h = Math.max(1, Math.round(weltHoehe * pxProE));

    const flaeche = document.createElement('canvas');
    flaeche.width = w;
    flaeche.height = h;
    const c = flaeche.getContext('2d');
    if (c === null) return;

    const s = stimmungVon(karte);
    c.setTransform(pxProE, 0, 0, pxProE, d * pxProE, d * pxProE);

    this.malRahmen(c, karte, s, d);
    this.malRasen(c, karte, s);
    // Rauschen in GERÄTEPIXELN, nicht in Welteinheiten: Ein mitskaliertes
    // Rauschen wird auf einer großen Bahn zu grobem Grieß.
    this.malRauschen(c, karte, pxProE, d);
    for (const zone of karte.zonen) this.malZoneStatisch(c, zone, s);
    this.malLoch(c, karte, s);
    for (const wand of karte.waende) this.malWand(c, wand, s);

    this.statisch = flaeche;
    this.statischLinks = -d;
    this.statischOben = -d;
    this.statischBreite = weltBreite;
    this.statischHoehe = weltHoehe;
  }

  private malRahmen(c: CanvasRenderingContext2D, karte: Karte, s: Stimmung, d: number): void {
    c.fillStyle = s.rahmen;
    c.fillRect(-d, -d, karte.breite + 2 * d, karte.hoehe + 2 * d);
    // Holzmaserung: ein paar unregelmäßige Striche, damit die Leiste nicht
    // wie ein Farbbalken aussieht.
    c.strokeStyle = s.rahmenDunkel;
    c.lineWidth = 0.05;
    c.globalAlpha = 0.5;
    for (let i = 0; i < 40; i += 1) {
      const y = -d + ((i * 3.7) % (karte.hoehe + 2 * d));
      c.beginPath();
      c.moveTo(-d, y);
      c.lineTo(-d + d * 0.9, y + 0.25);
      c.moveTo(karte.breite + d * 0.1, y + 0.4);
      c.lineTo(karte.breite + d, y + 0.1);
      c.stroke();
    }
    c.globalAlpha = 1;
    // Obere Kante hell, untere dunkel — die Leiste bekommt Höhe.
    c.fillStyle = s.rahmenHell;
    c.fillRect(-d, -d, karte.breite + 2 * d, 0.16);
    c.fillStyle = s.rahmenDunkel;
    c.fillRect(-d, karte.hoehe + d - 0.16, karte.breite + 2 * d, 0.16);
  }

  private malRasen(c: CanvasRenderingContext2D, karte: Karte, s: Stimmung): void {
    c.fillStyle = s.grund;
    c.fillRect(0, 0, karte.breite, karte.hoehe);
    /*
     * Mähstreifen. Breite und Richtung hängen an der Kennung der Bahn: So
     * sieht jede Bahn anders aus, ohne dass jemand es je eintragen muss —
     * und dieselbe Bahn sieht auf jedem Gerät gleich aus.
     */
    let hash = 2166136261;
    for (let i = 0; i < karte.id.length; i += 1) {
      hash = (hash ^ karte.id.charCodeAt(i)) * 16777619;
      hash >>>= 0;
    }
    const quer = (hash & 1) === 0;
    const bahnbreite = 1.6 + ((hash >>> 1) % 5) * 0.35;
    const laenge = quer ? karte.hoehe : karte.breite;
    for (let i = 0, n = 0; i < laenge; i += bahnbreite, n += 1) {
      if (n % 2 === 0) continue;
      c.fillStyle = s.streifenHell;
      if (quer) c.fillRect(0, i, karte.breite, Math.min(bahnbreite, karte.hoehe - i));
      else c.fillRect(i, 0, Math.min(bahnbreite, karte.breite - i), karte.hoehe);
    }
    // Weicher Schatten an der Innenkante des Rahmens: Der Rasen liegt tiefer.
    const rand = c.createLinearGradient(0, 0, 0, 1.1);
    rand.addColorStop(0, 'rgba(0, 0, 0, 0.32)');
    rand.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = rand;
    c.fillRect(0, 0, karte.breite, 1.1);
    c.save();
    c.translate(0, karte.hoehe);
    c.scale(1, -1);
    c.fillStyle = rand;
    c.fillRect(0, 0, karte.breite, 1.1);
    c.restore();
    const seite = c.createLinearGradient(0, 0, 0.9, 0);
    seite.addColorStop(0, 'rgba(0, 0, 0, 0.26)');
    seite.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = seite;
    c.fillRect(0, 0, 0.9, karte.hoehe);
    c.save();
    c.translate(karte.breite, 0);
    c.scale(-1, 1);
    c.fillStyle = seite;
    c.fillRect(0, 0, 0.9, karte.hoehe);
    c.restore();
  }

  private malRauschen(
    c: CanvasRenderingContext2D,
    karte: Karte,
    pxProE: number,
    d: number,
  ): void {
    const kachel = this.holeRauschen();
    if (kachel === null) return;
    const muster = c.createPattern(kachel, 'repeat');
    if (muster === null) return;
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 0.13;
    c.fillStyle = muster;
    c.fillRect(d * pxProE, d * pxProE, karte.breite * pxProE, karte.hoehe * pxProE);
    c.restore();
  }

  private holeRauschen(): HTMLCanvasElement | null {
    if (this.rauschen !== null) return this.rauschen;
    if (typeof document === 'undefined') return null;
    const k = document.createElement('canvas');
    k.width = 64;
    k.height = 64;
    const c = k.getContext('2d');
    if (c === null) return null;
    const bild = c.createImageData(64, 64);
    for (let i = 0; i < bild.data.length; i += 4) {
      const v = Math.random() < 0.5 ? 0 : 255;
      bild.data[i] = v;
      bild.data[i + 1] = v;
      bild.data[i + 2] = v;
      bild.data[i + 3] = Math.floor(Math.random() * 90);
    }
    c.putImageData(bild, 0, 0);
    this.rauschen = k;
    return k;
  }

  /** Der Trichter: dunkel in der Mitte, ein heller Ring als Kante. */
  private malLoch(c: CanvasRenderingContext2D, karte: Karte, s: Stimmung): void {
    const [lx, ly] = karte.loch;
    const verlauf = c.createRadialGradient(lx, ly, 0, lx, ly, LOCH_R * 1.25);
    verlauf.addColorStop(0, '#000000');
    verlauf.addColorStop(0.72, s.loch);
    verlauf.addColorStop(1, 'rgba(0, 0, 0, 0)');
    c.fillStyle = verlauf;
    c.beginPath();
    c.arc(lx, ly, LOCH_R * 1.25, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    c.lineWidth = 0.06;
    c.beginPath();
    c.arc(lx, ly, LOCH_R, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
  }

  private malWand(c: CanvasRenderingContext2D, wand: Wand, s: Stimmung): void {
    // Erst der Schlagschatten, versetzt — eine echte Schattenwurf-Angabe des
    // Kontexts wird von der Transformation nicht mitskaliert und sähe auf
    // einer großen Bahn anders aus als auf einer kleinen.
    c.fillStyle = 'rgba(0, 0, 0, 0.35)';
    this.wandPfad(c, wand, 0.14, 0.2);
    c.fill();
    c.fillStyle = s.wand;
    this.wandPfad(c, wand, 0, 0);
    c.fill();
    // Oberkante heller: Die Bande bekommt eine Höhe.
    if (istRechteck(wand)) {
      c.fillStyle = s.wandOben;
      c.fillRect(wand.x, wand.y, wand.w, Math.min(0.16, wand.h * 0.4));
      c.fillStyle = 'rgba(0, 0, 0, 0.18)';
      c.fillRect(wand.x, wand.y + wand.h - Math.min(0.12, wand.h * 0.3), wand.w, Math.min(0.12, wand.h * 0.3));
    } else {
      c.strokeStyle = s.wandOben;
      c.lineWidth = 0.1;
      c.beginPath();
      c.moveTo(wand.ax, wand.ay);
      c.lineTo(wand.bx, wand.by);
      c.stroke();
    }
  }

  private wandPfad(c: CanvasRenderingContext2D, wand: Wand, vx: number, vy: number): void {
    c.beginPath();
    if (istRechteck(wand)) {
      c.rect(wand.x + vx, wand.y + vy, wand.w, wand.h);
      return;
    }
    const dx = wand.bx - wand.ax;
    const dy = wand.by - wand.ay;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = (-dy / len) * (wand.dicke / 2);
    const ny = (dx / len) * (wand.dicke / 2);
    c.moveTo(wand.ax + nx + vx, wand.ay + ny + vy);
    c.lineTo(wand.bx + nx + vx, wand.by + ny + vy);
    c.lineTo(wand.bx - nx + vx, wand.by - ny + vy);
    c.lineTo(wand.ax - nx + vx, wand.ay - ny + vy);
    c.closePath();
  }

  /** Der ruhende Teil einer Zone. Was sich dreht oder läuft, kommt je Bild. */
  private malZoneStatisch(c: CanvasRenderingContext2D, zone: Zone, s: Stimmung): void {
    if (zone.art === 'sand') {
      this.flaechePfad(c, zone);
      c.fillStyle = '#e3cf9a';
      c.fill();
      c.save();
      c.clip();
      /*
       * Körnung: Die Punkte werden über die MASSE der Zone gestreut und nicht
       * über eine feste Fläche — eine kleine Kuhle bekäme sonst nur ein paar
       * Körner am Rand und sähe aus wie ein beiger Fleck. Der Zufall ist ein
       * simpler Linearkongruenz-Schritt; er muss nichts können außer
       * ungleichmäßig aussehen.
       */
      const bx = this.zonenLinks(zone);
      const by = this.zonenOben(zone);
      const bw = this.zonenBreite(zone);
      const bh = this.zonenHoehe(zone);
      const koerner = Math.min(1400, Math.round(bw * bh * 26));
      let r = 0x9e3779b9;
      for (let i = 0; i < koerner; i += 1) {
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        const px = ((r >>> 8) % 1024) / 1024;
        r = (r * 1103515245 + 12345) & 0x7fffffff;
        const py = ((r >>> 8) % 1024) / 1024;
        c.fillStyle = i % 3 === 0 ? 'rgba(255, 246, 220, 0.75)' : 'rgba(148, 116, 58, 0.45)';
        c.fillRect(bx + px * bw, by + py * bh, 0.07, 0.07);
      }
      // Ein weicher Schatten am oberen Rand: Die Kuhle liegt tiefer als der Rasen.
      const tiefe = c.createLinearGradient(0, by, 0, by + Math.min(0.9, bh));
      tiefe.addColorStop(0, 'rgba(90, 68, 30, 0.4)');
      tiefe.addColorStop(1, 'rgba(90, 68, 30, 0)');
      c.fillStyle = tiefe;
      c.fillRect(bx, by, bw, Math.min(0.9, bh));
      c.restore();
      return;
    }
    if (zone.art === 'eis') {
      this.flaechePfad(c, zone);
      c.fillStyle = 'rgba(196, 234, 246, 0.86)';
      c.fill();
      c.save();
      c.clip();
      // Glanzstreifen quer über die Fläche — sie sagen "glatt", ohne dass
      // dafür ein Wort nötig wäre.
      c.strokeStyle = 'rgba(255, 255, 255, 0.72)';
      c.lineWidth = 0.16;
      const ex = this.zonenLinks(zone);
      const ey = this.zonenOben(zone);
      const eh = this.zonenHoehe(zone);
      const ew = this.zonenBreite(zone);
      for (let x0 = ex - eh; x0 < ex + ew; x0 += 1.1) {
        c.beginPath();
        c.moveTo(x0, ey);
        c.lineTo(x0 + eh * 0.7, ey + eh);
        c.stroke();
      }
      c.restore();
      return;
    }
    if (zone.art === 'wasser') {
      this.flaechePfad(c, zone);
      c.fillStyle = '#1f5c94';
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = 'rgba(10, 40, 70, 0.55)';
      c.fillRect(this.zonenLinks(zone) - 1, this.zonenOben(zone) - 1, 60, 0.4);
      c.restore();
      c.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      c.lineWidth = 0.1;
      this.flaechePfad(c, zone);
      c.stroke();
      return;
    }
    if (zone.art === 'beschleuniger') {
      const z = zone as ZoneBeschleuniger;
      c.fillStyle = 'rgba(18, 74, 34, 0.85)';
      c.fillRect(z.x, z.y, z.w, z.h);
      c.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      c.lineWidth = 0.07;
      c.strokeRect(z.x, z.y, z.w, z.h);
      return;
    }
    if (zone.art === 'sprungfeld') {
      const z = zone as ZoneSprungfeld;
      c.fillStyle = '#5c4a38';
      c.fillRect(z.x, z.y, z.w, z.h);
      c.strokeStyle = '#d9b36a';
      for (let i = 1; i <= 3; i += 1) {
        const f = i * 0.12;
        c.lineWidth = 0.08;
        c.strokeRect(z.x + z.w * f, z.y + z.h * f, z.w * (1 - 2 * f), z.h * (1 - 2 * f));
      }
      return;
    }
    if (zone.art === 'bumper') {
      const z = zone as ZoneBumper;
      c.fillStyle = 'rgba(0, 0, 0, 0.3)';
      c.beginPath();
      c.arc(z.x + 0.1, z.y + 0.16, z.r, 0, Math.PI * 2);
      c.fill();
      const v = c.createRadialGradient(z.x - z.r * 0.3, z.y - z.r * 0.35, z.r * 0.1, z.x, z.y, z.r);
      v.addColorStop(0, '#ffe9a8');
      v.addColorStop(0.55, '#f0a63c');
      v.addColorStop(1, '#b8631d');
      c.fillStyle = v;
      c.beginPath();
      c.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      c.lineWidth = 0.07;
      c.beginPath();
      c.arc(z.x, z.y, z.r * 0.6, Math.PI * 1.1, Math.PI * 1.75);
      c.stroke();
      return;
    }
    if (zone.art === 'strudel') {
      const z = zone as ZoneStrudel;
      const v = c.createRadialGradient(z.x, z.y, 0, z.x, z.y, z.r);
      v.addColorStop(0, 'rgba(12, 22, 40, 0.85)');
      v.addColorStop(1, 'rgba(40, 70, 110, 0)');
      c.fillStyle = v;
      c.beginPath();
      c.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      c.fill();
      return;
    }
    if (zone.art === 'portal') {
      const z = zone as ZonePortal;
      c.fillStyle = 'rgba(10, 6, 22, 0.8)';
      c.beginPath();
      c.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      c.fill();
      return;
    }
    if (zone.art === 'drehkreuz') {
      const z = zone as ZoneDrehkreuz;
      // Nur die Achse — der Balken hängt am Takt und ist deshalb beweglich.
      c.fillStyle = s.wandOben;
      c.beginPath();
      c.arc(z.x, z.y, 0.28, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      c.lineWidth = 0.06;
      c.stroke();
    }
  }

  private flaechePfad(c: CanvasRenderingContext2D, zone: Zone): void {
    c.beginPath();
    if (zone.art === 'sand' || zone.art === 'eis' || zone.art === 'wasser') {
      if (istKreis(zone)) c.arc(zone.x, zone.y, zone.r, 0, Math.PI * 2);
      else c.rect(zone.x, zone.y, zone.w, zone.h);
    }
  }

  private zonenLinks(zone: Zone): number {
    if (zone.art === 'sand' || zone.art === 'eis' || zone.art === 'wasser') {
      return istKreis(zone) ? zone.x - zone.r : zone.x;
    }
    return 0;
  }

  private zonenOben(zone: Zone): number {
    if (zone.art === 'sand' || zone.art === 'eis' || zone.art === 'wasser') {
      return istKreis(zone) ? zone.y - zone.r : zone.y;
    }
    return 0;
  }

  private zonenBreite(zone: Zone): number {
    if (zone.art === 'sand' || zone.art === 'eis' || zone.art === 'wasser') {
      return istKreis(zone) ? zone.r * 2 : zone.w;
    }
    return 0;
  }

  private zonenHoehe(zone: Zone): number {
    if (zone.art === 'sand' || zone.art === 'eis' || zone.art === 'wasser') {
      return istKreis(zone) ? zone.r * 2 : zone.h;
    }
    return 0;
  }

  /* ------------------------------------------------------------------ */
  /* Bewegte Ebene                                                       */
  /* ------------------------------------------------------------------ */

  private zeichneBewegteZonen(ctx: CanvasRenderingContext2D, a: Bildauftrag): void {
    const t = a.uhrMs / 1000;
    const taktGenau = a.zustand.takt - 1 + a.anteil;
    for (const zone of a.karte.zonen) {
      if (zone.art === 'wasser') {
        // Wellenringe: drei Ringe, versetzt, die von innen nach außen laufen.
        ctx.save();
        this.flaechePfad(ctx, zone);
        ctx.clip();
        ctx.strokeStyle = 'rgba(190, 228, 255, 0.4)';
        ctx.lineWidth = 0.08;
        const cx = istKreis(zone) ? zone.x : zone.x + zone.w / 2;
        const cy = istKreis(zone) ? zone.y : zone.y + zone.h / 2;
        const gross = istKreis(zone) ? zone.r : Math.max(zone.w, zone.h) / 2;
        for (let i = 0; i < 3; i += 1) {
          const p = ((t * 0.4 + i / 3) % 1) * gross * 1.4;
          ctx.globalAlpha = 0.5 * (1 - p / (gross * 1.4));
          ctx.beginPath();
          ctx.arc(cx, cy, 0.2 + p, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      } else if (zone.art === 'beschleuniger') {
        const z = zone as ZoneBeschleuniger;
        ctx.save();
        ctx.beginPath();
        ctx.rect(z.x, z.y, z.w, z.h);
        ctx.clip();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.lineWidth = 0.14;
        ctx.lineCap = 'round';
        const laenge = Math.abs(z.rx) > Math.abs(z.ry) ? z.w : z.h;
        const schritt = 1.1;
        const versatz = (t * 2.2) % schritt;
        const px = -z.ry;
        const py = z.rx;
        for (let s = -schritt; s < laenge + schritt; s += schritt) {
          const d = s + versatz;
          const bx = z.x + z.w / 2 + z.rx * (d - laenge / 2);
          const by = z.y + z.h / 2 + z.ry * (d - laenge / 2);
          ctx.beginPath();
          ctx.moveTo(bx - z.rx * 0.3 + px * 0.42, by - z.ry * 0.3 + py * 0.42);
          ctx.lineTo(bx + z.rx * 0.32, by + z.ry * 0.32);
          ctx.lineTo(bx - z.rx * 0.3 - px * 0.42, by - z.ry * 0.3 - py * 0.42);
          ctx.stroke();
        }
        ctx.restore();
      } else if (zone.art === 'portal') {
        const z = zone as ZonePortal;
        // Zwei gegenläufige Ringe in der Farbe des Paars.
        const farbe = z.paar % 2 === 0 ? '#b98cff' : '#5ce1e6';
        ctx.strokeStyle = farbe;
        ctx.lineWidth = 0.12;
        for (let i = 0; i < 2; i += 1) {
          const dreh = t * (i === 0 ? 1.6 : -1.1);
          const r = z.r * (i === 0 ? 0.92 : 0.62);
          ctx.globalAlpha = 0.85;
          for (let k = 0; k < 5; k += 1) {
            const a0 = dreh + (k * Math.PI * 2) / 5;
            ctx.beginPath();
            ctx.arc(z.x, z.y, r, a0, a0 + 0.7);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      } else if (zone.art === 'strudel') {
        const z = zone as ZoneStrudel;
        ctx.strokeStyle = 'rgba(160, 205, 255, 0.6)';
        ctx.lineWidth = 0.1;
        const dreh = t * 2.4;
        for (let arm = 0; arm < 3; arm += 1) {
          ctx.beginPath();
          for (let i = 0; i <= 24; i += 1) {
            const f = i / 24;
            const w = dreh + (arm * Math.PI * 2) / 3 + f * 4.6;
            const r = z.r * f;
            const px = z.x + Math.cos(w) * r;
            const py = z.y + Math.sin(w) * r;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();
        }
      } else if (zone.art === 'drehkreuz') {
        const z = zone as ZoneDrehkreuz;
        // Der Winkel kommt aus dem TAKT und nicht aus der Wanduhr: Der Balken
        // ist echte Physik, kein Zierrat — ein Bild, das ihn woanders zeigt,
        // als er steht, lässt jeden Abpraller falsch aussehen.
        const grad = (taktGenau * z.gradJeTakt + z.phase) % 360;
        const w = (grad * Math.PI) / 180;
        const hx = (Math.cos(w) * z.laenge) / 2;
        const hy = (Math.sin(w) * z.laenge) / 2;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.lineWidth = 0.44;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(z.x - hx + 0.12, z.y - hy + 0.18);
        ctx.lineTo(z.x + hx + 0.12, z.y + hy + 0.18);
        ctx.stroke();
        ctx.strokeStyle = '#f0ece0';
        ctx.lineWidth = 0.36;
        ctx.beginPath();
        ctx.moveTo(z.x - hx, z.y - hy);
        ctx.lineTo(z.x + hx, z.y + hy);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 0.1;
        ctx.beginPath();
        ctx.moveTo(z.x - hx, z.y - hy);
        ctx.lineTo(z.x + hx, z.y + hy);
        ctx.stroke();
      }
    }
  }

  private zeichneBaelle(ctx: CanvasRenderingContext2D, a: Bildauftrag): void {
    const z = a.zustand;
    const v = a.vorher;
    /*
     * Zwischenbilder nur, wenn beide Zustände dasselbe Loch mit derselben
     * Ballzahl zeigen. Sonst würde beim Lochwechsel jeder Ball quer über die
     * Bahn schleifen — und beim Portal ebenso, dagegen hilft weiter unten die
     * Sprungprüfung.
     */
    const misch =
      v !== z &&
      v.aktuell.loch === z.aktuell.loch &&
      v.baelle.length === z.baelle.length &&
      a.anteil > 0 &&
      a.anteil < 1.2;
    const eigenGross = a.uebersicht ? 1.6 : 1;

    for (let s = 0; s < z.baelle.length; s += 1) {
      const b = z.baelle[s];
      if (!b.dabei || b.eingelocht) continue;
      let x = b.x;
      let y = b.y;
      if (misch) {
        const alt = v.baelle[s];
        const dx = b.x - alt.x;
        const dy = b.y - alt.y;
        // Ein Sprung über zwei Einheiten in einem Takt ist ein Portal, kein
        // Rollen — dazwischen darf nichts gemalt werden.
        if (dx * dx + dy * dy < 4) {
          x = alt.x + dx * a.anteil;
          y = alt.y + dy * a.anteil;
        }
      }
      const flug = b.flugTakte > 0;
      const r = BALL_R * eigenGross * (flug ? 1.45 : 1);
      const schattenAb = flug ? 0.55 : 0.16;

      ctx.fillStyle = flug ? 'rgba(0, 0, 0, 0.28)' : 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.ellipse(x + schattenAb * 0.4, y + schattenAb, r * 0.95, r * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      const immun = !b.geschlagen && z.takt - z.aktuell.startTakt < IMMUN_TAKTE;
      if (immun) {
        // Sichtbare Schonzeit: Der Ring pulsiert und läuft mit ihr aus.
        const rest = 1 - (z.takt - z.aktuell.startTakt) / IMMUN_TAKTE;
        ctx.globalAlpha = 0.35 + 0.35 * Math.sin(a.uhrMs / 130);
        ctx.strokeStyle = farbeVon(s);
        ctx.lineWidth = 0.09;
        ctx.beginPath();
        ctx.arc(x, y, r * (1.6 + 0.5 * rest), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 0.82;
      }

      const bild = this.ballbild(s);
      if (bild !== null) ctx.drawImage(bild, x - r, y - r, r * 2, r * 2);
      ctx.globalAlpha = 1;

      if (s === a.eigenerSitz) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.075;
        ctx.beginPath();
        ctx.arc(x, y, r + 0.09, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  /** Der Ball eines Sitzes, einmal in eine kleine Leinwand gemalt. */
  private ballbild(sitz: number): HTMLCanvasElement | null {
    const fertig = this.ballBilder[sitz];
    if (fertig !== undefined) return fertig;
    if (typeof document === 'undefined') {
      this.ballBilder[sitz] = null;
      return null;
    }
    const groesse = 96;
    const k = document.createElement('canvas');
    k.width = groesse;
    k.height = groesse;
    const c = k.getContext('2d');
    if (c === null) {
      this.ballBilder[sitz] = null;
      return null;
    }
    const farbe = farbeVon(sitz);
    const m = groesse / 2;
    const v = c.createRadialGradient(m - m * 0.35, m - m * 0.4, m * 0.05, m, m, m * 0.98);
    v.addColorStop(0, heller(farbe, 0.75));
    v.addColorStop(0.45, farbe);
    v.addColorStop(1, dunkler(farbe, 0.45));
    c.fillStyle = v;
    c.beginPath();
    c.arc(m, m, m * 0.97, 0, Math.PI * 2);
    c.fill();
    // Dimples: der Golfball ist an ihnen zu erkennen, sonst wäre es eine Murmel.
    c.fillStyle = 'rgba(0, 0, 0, 0.11)';
    for (let ring = 1; ring <= 2; ring += 1) {
      const n = ring * 7;
      for (let i = 0; i < n; i += 1) {
        const w = (i / n) * Math.PI * 2 + ring;
        const r = m * (0.28 * ring);
        c.beginPath();
        c.arc(m + Math.cos(w) * r, m + Math.sin(w) * r, m * 0.07, 0, Math.PI * 2);
        c.fill();
      }
    }
    // Glanzpunkt.
    c.fillStyle = 'rgba(255, 255, 255, 0.55)';
    c.beginPath();
    c.ellipse(m - m * 0.32, m - m * 0.38, m * 0.2, m * 0.13, -0.7, 0, Math.PI * 2);
    c.fill();
    this.ballBilder[sitz] = k;
    return k;
  }

  /** Fahnenmast und Tuch — bewusst ÜBER den Bällen, damit man das Loch findet. */
  private zeichneFahne(ctx: CanvasRenderingContext2D, a: Bildauftrag): void {
    const [lx, ly] = a.karte.loch;
    const hoehe = 2.5;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx + 0.9, ly + 0.35);
    ctx.stroke();
    ctx.strokeStyle = '#e9e6dd';
    ctx.lineWidth = 0.09;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.lineTo(lx, ly - hoehe);
    ctx.stroke();
    const wehen = Math.sin(a.uhrMs / 260) * 0.22;
    ctx.fillStyle = '#e63946';
    ctx.beginPath();
    ctx.moveTo(lx, ly - hoehe);
    ctx.quadraticCurveTo(lx + 0.65, ly - hoehe + 0.12 + wehen, lx + 1.25, ly - hoehe + 0.42);
    ctx.quadraticCurveTo(lx + 0.6, ly - hoehe + 0.62 - wehen, lx, ly - hoehe + 0.92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
    ctx.beginPath();
    ctx.moveTo(lx, ly - hoehe + 0.6);
    ctx.quadraticCurveTo(lx + 0.5, ly - hoehe + 0.68 - wehen, lx, ly - hoehe + 0.92);
    ctx.closePath();
    ctx.fill();
  }

  /* ------------------------------------------------------------------ */
  /* Zielpfeil                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Der Pfeil: Farbe nach Kraft, drei Abschnitte mit zwei Lücken.
   *
   * Die Lücken sitzen FEST bei einem Drittel und zwei Dritteln der
   * Maximallänge, nicht bei einem Drittel der aktuellen Länge. Nur so sind
   * sie Marken: Der Pfeil wächst durch sie hindurch, und man sieht auf einen
   * Blick, im wievielten Drittel der Kraft man gerade ist — ohne die
   * Prozentzahl zu lesen.
   */
  private zeichneZiel(ctx: CanvasRenderingContext2D, ziel: Zielbild): void {
    const laenge = ziel.kraft * MAX_ZUG;
    const farbe = kraftfarbe(ziel.kraft);

    // Gepunktete Vorschau zuerst, damit der Pfeil darüber liegt.
    if (ziel.bahn.length >= 4) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
      ctx.lineWidth = 0.09;
      ctx.setLineDash([0.22, 0.26]);
      ctx.beginPath();
      ctx.moveTo(ziel.bahn[0], ziel.bahn[1]);
      for (let i = 2; i < ziel.bahn.length; i += 2) ctx.lineTo(ziel.bahn[i], ziel.bahn[i + 1]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const drittel = MAX_ZUG / 3;
    const luecke = 0.3;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = farbe;
    ctx.lineWidth = 0.26;
    for (let i = 0; i < 3; i += 1) {
      const von = i === 0 ? BALL_R * 1.2 : i * drittel + luecke / 2;
      const bis = Math.min(laenge, (i + 1) * drittel - (i === 2 ? 0 : luecke / 2));
      if (bis <= von) continue;
      ctx.beginPath();
      ctx.moveTo(ziel.x + ziel.rx * von, ziel.y + ziel.ry * von);
      ctx.lineTo(ziel.x + ziel.rx * bis, ziel.y + ziel.ry * bis);
      ctx.stroke();
    }

    // Spitze am Ende — sie sagt, wohin, und macht die Länge ablesbar.
    const sx = ziel.x + ziel.rx * laenge;
    const sy = ziel.y + ziel.ry * laenge;
    const px = -ziel.ry;
    const py = ziel.rx;
    ctx.fillStyle = farbe;
    ctx.beginPath();
    ctx.moveTo(sx + ziel.rx * 0.5, sy + ziel.ry * 0.5);
    ctx.lineTo(sx + px * 0.32, sy + py * 0.32);
    ctx.lineTo(sx - px * 0.32, sy - py * 0.32);
    ctx.closePath();
    ctx.fill();

    // Die beiden Marken auch dann sichtbar, wenn der Pfeil sie noch nicht
    // erreicht hat: Sonst weiß man erst hinterher, wo die Stufen liegen.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.06;
    for (let i = 1; i <= 2; i += 1) {
      const d = i * drittel;
      if (d < laenge) continue;
      const bx = ziel.x + ziel.rx * d;
      const by = ziel.y + ziel.ry * d;
      ctx.beginPath();
      ctx.moveTo(bx + px * 0.2, by + py * 0.2);
      ctx.lineTo(bx - px * 0.2, by - py * 0.2);
      ctx.stroke();
    }
  }

  /** Die Prozentzahl am Pfeil — im Bildschirmraum, damit sie lesbar bleibt. */
  private zeichneKraftzahl(ctx: CanvasRenderingContext2D, ziel: Zielbild): void {
    const laenge = ziel.kraft * MAX_ZUG;
    const p = this.zuBild(ziel.x + ziel.rx * (laenge + 0.75), ziel.y + ziel.ry * (laenge + 0.75));
    const text = `${Math.round(ziel.kraft * 100)} %`;
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.strokeText(text, p.px, p.py);
    ctx.fillStyle = kraftfarbe(ziel.kraft);
    ctx.fillText(text, p.px, p.py);
  }

  /* ------------------------------------------------------------------ */
  /* Partikel                                                            */
  /* ------------------------------------------------------------------ */

  private funke(x: number, y: number, farbe: string, dauer: number, tempo: number): void {
    if (this.partikel.length >= PARTIKEL_MAX) return;
    const w = Math.random() * Math.PI * 2;
    const v = tempo * (0.4 + Math.random() * 0.8);
    this.partikel.push({
      x,
      y,
      vx: Math.cos(w) * v,
      vy: Math.sin(w) * v,
      rest: dauer,
      ganz: dauer,
      groesse: 0.06 + Math.random() * 0.08,
      farbe,
      ring: false,
    });
  }

  private ringstoss(x: number, y: number, farbe: string, dauer: number): void {
    if (this.partikel.length >= PARTIKEL_MAX) return;
    this.partikel.push({
      x,
      y,
      vx: 0,
      vy: 0,
      rest: dauer,
      ganz: dauer,
      groesse: 1.5,
      farbe,
      ring: true,
    });
  }

  private bewegePartikel(dtMs: number): void {
    const dt = dtMs / 1000;
    let schreib = 0;
    for (let i = 0; i < this.partikel.length; i += 1) {
      const p = this.partikel[i];
      p.rest -= dtMs;
      if (p.rest <= 0) continue;
      if (!p.ring) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
      }
      // In dieselbe Liste zurückschreiben statt zu filtern: Ein `filter` je
      // Bild legt sechzigmal je Sekunde ein neues Array an.
      this.partikel[schreib] = p;
      schreib += 1;
    }
    this.partikel.length = schreib;
  }

  private zeichnePartikel(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.partikel.length; i += 1) {
      const p = this.partikel[i];
      const f = p.rest / p.ganz;
      ctx.globalAlpha = f;
      if (p.ring) {
        ctx.strokeStyle = p.farbe;
        ctx.lineWidth = 0.09;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.groesse * (1 - f) + 0.15, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = p.farbe;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.groesse * f + 0.02, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Grün → Gelb → Orange → Rot.
 *
 * Als Stufen und nicht als Verlauf: Der Pfeil ist ein Anzeigeinstrument, und
 * ein stufenloser Verlauf sagt bei 40 % dasselbe wie bei 45 %. Die drei
 * Abschnitte des Schafts teilen sich dieselben Grenzen.
 */
export function kraftfarbe(kraft: number): string {
  if (kraft < 0.34) return '#3ddc84';
  if (kraft < 0.67) return '#ffd23f';
  if (kraft < 0.9) return '#ff9124';
  return '#ff4d4d';
}
