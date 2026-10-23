/**
 * Die Spielwelt der Kartenmanufaktur als Pixi-Szene (PixiJS v8).
 *
 * Nur Bild: Die Szene liest in jedem Bild den Stand aus der Steuerung und
 * stellt ihn dar. Getippt wird auf DOM-Knoepfe, die genau darueber liegen
 * (Ueberlagerung.tsx, beide aus layout.ts) — das haelt Schrift scharf,
 * VoiceOver bedienbar und die Tippflaechen bei mindestens 44 pt.
 *
 * **Die Bilder luegen nie.** Jede Bewegung haengt am Stand (abbild.ts): Der
 * Arbeiter legt den Stapel ab, wenn der Warenwert in der Kiste landet, die
 * Tabletts tragen nur Karten, wenn wirklich etwas hinauffaehrt, der Wagen
 * faehrt erst beladen, und das Tempo der Ablaeufe kommt aus der Zykluszeit.
 *
 * Seit dem 23.10.2026 aus den gelieferten Einzelteilen (outputs/rig/):
 * Pinguine als Rig (figur.ts, rig.ts), Pressen mit Hebel, Rad und Zeiger
 * (maschine.ts), Wagen mit Tueren und drehenden Raedern, Packtisch mit drei
 * Kartonstapeln, Paternoster aus Kopf, Rad, Mittelkachel und Fuss, Kiste in
 * zwei Ebenen, Bodenbalken, gesperrte Etage, Effekte als Bilder.
 *
 * Die Leinwand ist so gross wie der sichtbare Ausschnitt und klebt oben im
 * Rollbereich (`position: sticky`); gerollt wird, indem die Welt verschoben
 * wird. Was nicht im Ausschnitt liegt, wird nicht gezeichnet, und im
 * Hintergrund steht der Takt still — beim Zurueckkommen rechnet die Steuerung
 * ueber die Uhr nach, nicht die Szene.
 */

import { Application, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';

import {
  FAEHIGKEIT_MS,
  type ManufakturStand,
  type Presse,
  MAX_PRESSEN,
  VERSAND_ABFAHRT,
  arbeiter,
  tempo,
  versandKapazitaet,
  versandZyklus,
} from '@brauweg/manufaktur-kern';

import type { Getragen } from '../../api';
import { stapelBild } from '../bilder';
import { ton } from '../toene';
import {
  ablaufTempo,
  arbeiterAblauf,
  arbeiterOrt,
  kistenStapel,
  packtischKartons,
  LAUFEN_TEMPO_MAX,
  paternosterOrt,
  phasenTempo,
  pressenPhase,
  pressenPhaseMs,
  schlagZwischen,
  traegtStapel,
  wagenOrt,
} from './abbild';
import { CLIPS } from './clips';
import { type Figur, RigFigur } from './figur';
import { BREITE, ETAGE_HOEHE, HALLE_HOEHE, KULISSE, SCHACHT, etage, gesamtHoehe, haltY, halle } from './layout';
import { PresseBild, maschinenDateien } from './maschine';
import { type Ausstattung, ausstattungAus, berufsAusstattung, rigDatei, rigDateien } from './rig';
import { schachtRoehre } from './zeichnen';

export interface Quelle {
  stand: () => ManufakturStand | null;
  jetzt: () => number;
  /** Was der eigene Pinguin traegt — der Direktor auf dem Podest. */
  getragen?: () => Getragen | undefined;
}

/** Wie gerollt ist (Bildschirmpunkte), wie hoch der Ausschnitt und wie hoch die ganze Leinwand ist. */
export interface Ausschnitt {
  oben: number;
  hoehe: number;
  breite: number;
  /** Hoehe der Leinwand = Hoehe der ganzen Welt in Bildschirmpunkten. */
  leinwand: number;
}

/**
 * Aufloesung der Leinwand: hoechstens doppelt (dreifach sieht man am iPhone
 * nicht und kostet Speicher), und bei einer hohen Welt so weit herunter, dass
 * die Leinwand unter rund acht Millionen Bildpunkten bleibt.
 */
function aufloesung(breite: number, hoehe: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return Math.max(1, Math.min(dpr, Math.sqrt(8_000_000 / Math.max(1, breite * hoehe))));
}

/** Was die Szene dem DOM meldet — Muenzflug und Zahlen-Popup laufen dort. */
export type SzenenEreignis = { art: 'verkauf'; betrag: number; x: number; y: number };

const R = rigDatei;
const DATEIEN = [
  R('kulisse-halle-oben.png'),
  '/manufaktur/wand-keller.webp',
  R('laufband-leer.png'),
  R('laufband-kopf.png'),
  R('laufband-antriebsrad.png'),
  R('laufband-fuss.png'),
  R('laufband-ladung.png'),
  R('lager-tisch.png'),
  R('lager-kisten-1.png'),
  R('lager-kisten-2.png'),
  R('lager-kisten-3.png'),
  R('versand-korpus-offen.png'),
  R('versand-korpus-zu.png'),
  R('versand-rad.png'),
  R('ablage-kiste.png'),
  R('ablage-kiste-vorn.png'),
  R('etage-boden.png'),
  R('etage-gesperrt.png'),
  R('fx-dampf-1.png'),
  R('fx-dampf-2.png'),
  R('fx-dampf-3.png'),
  R('fx-staub.png'),
  R('fx-funke.png'),
  R('fx-glanz.png'),
  R('fx-karte.png'),
  R('req-paket.png'),
  ...Array.from({ length: MAX_PRESSEN }, (_, i) => stapelBild(i)),
  ...rigDateien(),
  ...maschinenDateien(),
];

/** Paternoster-Mittelkachel: 256 × 512 mit vier Tabletts im Abstand 128. Im Schacht 68 breit. */
const BAND = { breite: 68, px: 256, kachelPx: 512, tablettAbstandPx: 128, tablettPx: 64, ladungPx: 87 };
/**
 * Massstab der Mittelkachel. Tabletts und Schienen belegen nur das mittlere
 * Viertel der 256 px — auf Schachtbreite gestreckt waeren sie winzig. Also
 * groesser zeichnen und die leeren Raender an der Schachtbreite abschneiden.
 */
const BAND_M = 0.5;
/** Der Kopf ist breiter als die Tabletts (Radgehaeuse); im vollen Massstab ragte er aus dem Bild. */
const KOPF_M = 0.42;
/**
 * Scheitel bis Fuss. Kleiner als die 54 der Einzelbilder: Dort lag Luft um
 * den Pinguin, beim Rig misst die Hoehe nur die Figur selbst.
 */
const ARBEITER_HOEHE = 40;
/** Laenger als ein Bild darf ein Schritt nicht sein — sonst springen Ablaeufe nach einer Pause. */
const MAX_DT = 100;

/** Wagen (versand.json): 640 × 384, Raeder bei y 317/321, Radradius rund 60 px. */
const WAGEN = { px: 640, unten: 380, ladepunkt: [82, 279] as const, auspuff: [91, 321] as const, radRadius: 60 };
/** Packtisch (lager.json): 512 × 512, Beine bis Zeile 500. */
const TISCH = { px: 512, unten: 500, abstell: [167, 242] as const, packer: [487, 474] as const };

/**
 * Bilder als <img> laden und daraus Texturen machen — nicht ueber Pixis
 * `Assets`. In der App liefert ein eigenes URL-Schema die Dateien (apps/ios,
 * PaketSchema), und `Assets.load` kam dort nie zurueck, auch ohne Worker:
 * Die Buehne blieb schwarz, ohne Fehler. Ein <img> laedt dort wie ueberall.
 */
async function ladeTexturen(dateien: readonly string[]): Promise<Record<string, Texture>> {
  const eindeutig = [...new Set(dateien)];
  const paare = await Promise.all(
    eindeutig.map(async (url) => {
      const bild = new Image();
      // `onload` statt `decode()`: decode() kam in einem verdeckten Fenster
      // nie zurueck (Browser schieben das Dekodieren dann auf), und die
      // Buehne blieb leer, bis man wegsah und wiederkam.
      await new Promise<void>((fertig, fehler) => {
        bild.onload = () => fertig();
        bild.onerror = () => fehler(new Error(`Bild fehlt: ${url}`));
        bild.src = url;
      });
      return [url, Texture.from(bild)] as const;
    }),
  );
  return Object.fromEntries(paare);
}

/** Kurzlebige Teilchen aus den gelieferten Effektbildern (Paket 6, je 128 × 128). */
interface Teilchen {
  g: Sprite;
  vx: number;
  vy: number;
  dreh: number;
  leben: number;
  dauer: number;
  von: number;
  bis: number;
}

class Teilchenwolke {
  readonly wurzel = new Container();
  private readonly liste: Teilchen[] = [];

  constructor(private readonly t: Record<string, Texture>) {}

  private neu(datei: string, x: number, y: number, groesse: number): Sprite {
    const s = new Sprite(this.t[R(datei)]);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.scale.set(groesse / 128);
    return s;
  }

  dampf(x: number, y: number): void {
    for (let i = 0; i < 2; i += 1) {
      const g = this.neu(`fx-dampf-${1 + Math.floor(Math.random() * 3)}.png`, x + (Math.random() - 0.5) * 6, y, 14);
      this.dazu({ g, vx: (Math.random() - 0.5) * 10, vy: -22 - Math.random() * 10, dreh: 0, leben: 0, dauer: 1000, von: 14, bis: 28 });
    }
  }

  staub(x: number, y: number): void {
    for (let i = 0; i < 4; i += 1) {
      const g = this.neu('fx-staub.png', x, y - Math.random() * 6, 12);
      this.dazu({ g, vx: -30 - Math.random() * 40, vy: -6 - Math.random() * 10, dreh: 0, leben: 0, dauer: 650, von: 12, bis: 26 });
    }
  }

  funken(x: number, y: number): void {
    for (let i = 0; i < 5; i += 1) {
      const w = (i / 5) * Math.PI * 2;
      const g = this.neu('fx-funke.png', x, y, 10);
      this.dazu({ g, vx: Math.cos(w) * 50, vy: Math.sin(w) * 50 - 20, dreh: 4, leben: 0, dauer: 600, von: 12, bis: 4 });
    }
  }

  glanz(x: number, y: number): void {
    const g = this.neu('fx-glanz.png', x, y, 18);
    this.dazu({ g, vx: 0, vy: -8, dreh: 2, leben: 0, dauer: 500, von: 10, bis: 34 });
  }

  /** Eine Karte fliegt von (x, y) nach (zielX, zielY). */
  karte(x: number, y: number, zielX: number, zielY: number): void {
    const dauer = 280;
    const g = this.neu('fx-karte.png', x, y, 14);
    this.dazu({ g, vx: ((zielX - x) / dauer) * 1000, vy: ((zielY - y) / dauer) * 1000 - 40, dreh: 6, leben: 0, dauer, von: 14, bis: 12 });
  }

  private dazu(t: Teilchen): void {
    this.liste.push(t);
    this.wurzel.addChild(t.g);
  }

  aktualisiere(dt: number): void {
    for (let i = this.liste.length - 1; i >= 0; i -= 1) {
      const t = this.liste[i]!;
      t.leben += dt;
      const s = dt / 1000;
      t.g.x += t.vx * s;
      t.g.y += t.vy * s;
      t.g.rotation += t.dreh * s;
      const f = Math.min(1, t.leben / t.dauer);
      t.g.alpha = 1 - f * f;
      t.g.scale.set((t.von + (t.bis - t.von) * f) / 128);
      if (t.leben >= t.dauer) {
        t.g.destroy();
        this.liste.splice(i, 1);
      }
    }
  }
}

/** Eine Etage: Bodenbalken, Kiste mit Stapeln, Presse, Arbeiter, Meister — oder die gesperrte Wand. */
class EtageBild {
  readonly wurzel = new Container();
  private readonly gebaut = new Container();
  private readonly gesperrt = new Container();
  private readonly stapel: Sprite[] = [];
  private readonly presse: PresseBild;
  private readonly arbeiter: Figur[] = [];
  private readonly meister: Figur;
  /** Merkzettel vom letzten Bild — daraus entstehen Schlaege, Jubel und Einlauf. */
  private letzteStufe = 0;
  private letzteAnzahl = 0;
  private letzterAnteil: number[] = [];
  private letztePhase: string[] = [];
  private einlauf: number[] = [];
  private jubelBis = 0;
  private pfeifenSeit = 0;

  constructor(
    private readonly index: number,
    private readonly t: Record<string, Texture>,
    private readonly wolke: Teilchenwolke,
  ) {
    const e = etage(index);

    // Bodenbalken: 512 × 64, der Balken selbst 45 px hoch und mittig.
    const m = 14 / 45;
    const balken = new TilingSprite({ texture: t[R('etage-boden.png')]!, width: BREITE, height: 64 * m });
    balken.tileScale.set(m);
    balken.position.set(0, e.boden - 9.5 * m);
    this.wurzel.addChild(this.gebaut, this.gesperrt, balken);

    // Ablagekiste: hintere Ebene, dann die Stapel, zuletzt die Vorderwand (etagen.json).
    const km = e.kiste.b / 256;
    const kisteX = e.kiste.x + e.kiste.b / 2;
    const hinten = new Sprite(t[R('ablage-kiste.png')]);
    hinten.anchor.set(128 / 256, 240 / 256);
    hinten.scale.set(km);
    hinten.position.set(kisteX, e.boden);
    this.gebaut.addChild(hinten);
    const ablageY = e.boden + (180 - 240) * km;
    for (let i = 0; i < 6; i += 1) {
      const s = new Sprite(t[stapelBild(index)]);
      s.anchor.set(0.5, 234 / 256);
      s.scale.set(18 / 256);
      // Zwei Reihen zu drei; die obere ragt ueber die Vorderwand — so sieht man, wie voll sie ist.
      s.position.set(kisteX - 14 + (i % 3) * 14, ablageY + 6 - Math.floor(i / 3) * 9);
      this.stapel.push(s);
      this.gebaut.addChild(s);
    }
    const vorn = new Sprite(t[R('ablage-kiste-vorn.png')]);
    vorn.anchor.set(128 / 256, 240 / 256);
    vorn.scale.set(km);
    vorn.position.set(kisteX, e.boden);
    this.gebaut.addChild(vorn);

    this.presse = new PresseBild(t, e.presse.b / 512);
    this.presse.wurzel.position.set(e.presse.x + e.presse.b / 2, e.boden);
    this.gebaut.addChild(this.presse.wurzel);

    for (let i = 0; i < 5; i += 1) {
      const a = new RigFigur(t, ARBEITER_HOEHE, berufsAusstattung('drucker'), 18);
      this.arbeiter.push(a);
      this.letzterAnteil.push(0);
      this.letztePhase.push('');
      this.einlauf.push(0);
      this.gebaut.addChild(a.wurzel);
    }
    // Wie im Vorbild steht der Meister vorn an der Kiste, vor den Arbeitern —
    // sonst verschwindet er hinter der Kolonne, und nur sein ⚡ bleibt sichtbar.
    this.meister = new RigFigur(t, ARBEITER_HOEHE, berufsAusstattung('meister'));
    this.meister.wurzel.position.set(e.meisterFigur.x + e.meisterFigur.b / 2, e.boden);
    this.gebaut.addChild(this.meister.wurzel);

    // Gesperrte Etage: vernagelte Bretter mit Messingschloss (1024 × 320).
    const breite = BREITE - SCHACHT.x - SCHACHT.b - 8;
    const wand = new Sprite(t[R('etage-gesperrt.png')]);
    wand.width = breite;
    wand.height = (breite * 320) / 1024;
    wand.position.set(SCHACHT.x + SCHACHT.b + 4, e.boden - wand.height - 1);
    this.gesperrt.addChild(wand);
  }

  zeige(stand: ManufakturStand, jetzt: number, rest: number, dt: number): void {
    const p = stand.pressen[this.index];
    this.gebaut.visible = !!p;
    // Die naechste Etage ist die vernagelte Wand, die zwei danach nur dunkle
    // Umrisse — man sieht, dass es weitergeht, ohne Laerm.
    const abstand = this.index - stand.pressen.length;
    this.gesperrt.visible = !p && abstand >= 0 && abstand < 3;
    this.gesperrt.alpha = abstand === 0 ? 1 : 0.28;
    if (!p) {
      this.letzteStufe = 0;
      this.letzteAnzahl = 0;
      return;
    }
    const e = etage(this.index);

    // Aufstieg: Die Arbeiter jubeln, ueber der Presse spruehen Funken. Beim ersten Bild nicht.
    if (this.letzteStufe > 0 && p.stufe > this.letzteStufe) {
      this.jubelBis = jetzt + 800;
      this.wolke.funken(this.presse.wurzel.x, e.boden - 70);
    }
    this.letzteStufe = p.stufe;

    const { anzahl } = kistenStapel(p, this.index, stand.manufaktur, stand.jubilaeen);
    this.stapel.forEach((s, i) => (s.visible = i < anzahl));
    this.presse.setzeFassung(p.stufe >= 100 ? 3 : p.stufe >= 25 ? 2 : 1);

    const zahl = arbeiter(p.stufe);
    // Meilenstein: Wer neu dazukommt, laeuft von rechts herein.
    if (this.letzteAnzahl > 0 && zahl > this.letzteAnzahl) {
      for (let k = this.letzteAnzahl; k < zahl; k += 1) this.einlauf[k] = 1;
    }
    this.letzteAnzahl = zahl;

    // Ruheplatz rechts vom Meister-Platz, Arbeitsplatz am Bedienpunkt der Presse.
    const kisteX = e.arbeit.x + 20;
    const presseX = this.presse.bedienPunkt().x;
    const tempo = ablaufTempo(p, jetzt);
    let geschlagen = false;
    let arbeitet = false;
    this.arbeiter.forEach((a, k) => {
      a.wurzel.visible = k < zahl;
      if (k >= zahl) return;
      // Die Kolonne laeuft leicht versetzt, aber nie spaeter als der Zyklus:
      // Der erste legt genau dann ab, wenn der Warenwert in der Kiste landet.
      const vorlauf: Presse = { ...p, fortschritt: p.laeuft ? Math.min(0.9999, p.fortschritt + k * 0.02) : 0 };
      const ph = pressenPhase(vorlauf, jetzt, rest);
      const ort = arbeiterOrt(ph.phase, ph.anteil);
      const anKiste = kisteX + k * 9;
      const anPresse = presseX - k * 13;
      let x = anKiste + (anPresse - anKiste) * ort;

      if (this.einlauf[k]! > 0) {
        this.einlauf[k] = Math.max(0, this.einlauf[k]! - dt / 1200);
        x += (BREITE + 30 - x) * this.einlauf[k]!;
        a.spiele('laufen');
        a.schaue(-1);
      } else if (jetzt < this.jubelBis) {
        a.spiele('jubeln');
      } else {
        const ablauf = arbeiterAblauf(ph.phase);
        a.spiele(ablauf, phasenTempo(CLIPS[ablauf], ablauf, pressenPhaseMs(p, ph.phase, jetzt), tempo));
        a.schaue(ph.phase === 'zurueck' ? -1 : 1);
      }
      a.traegt(traegtStapel(ph.phase) ? this.t[stapelBild(this.index)]! : null);
      a.wurzel.position.set(x, e.boden);
      a.aktualisiere(dt);
      if (ph.phase === 'arbeiten') arbeitet = true;

      // Pressenschlag im Takt des vordersten Arbeiters.
      if (k === 0 && ph.phase === 'arbeiten') {
        const vorher = this.letztePhase[k] === 'arbeiten' ? this.letzterAnteil[k]! : 0;
        if (schlagZwischen(vorher, ph.anteil)) geschlagen = true;
      }
      // Der fertige Bogen fliegt aus der Presse zum Arbeiter, sobald er losgeht.
      if (k === 0 && ph.phase === 'zurueck' && this.letztePhase[k] === 'arbeiten') {
        const aus = this.presse.ausgabePunkt();
        this.wolke.karte(aus.x, aus.y, x, e.boden - 30);
      }
      // Zyklus fertig: Der Stapel fliegt in die Kiste — genau jetzt ist er drin.
      if (k === 0 && this.letztePhase[k] === 'ablegen' && ph.phase !== 'ablegen') {
        this.wolke.karte(x, e.boden - 30, e.kiste.x + e.kiste.b / 2, e.boden - 24);
      }
      this.letzterAnteil[k] = ph.anteil;
      this.letztePhase[k] = ph.phase;
    });

    if (geschlagen) {
      this.presse.schlage();
      ton('pressenschlag', 0.4);
      const dampf = this.presse.dampfPunkt();
      if (dampf) this.wolke.dampf(dampf.x, dampf.y);
    }
    this.presse.aktualisiere(dt, arbeitet, tempo);

    // Eingestellt steht der Meister an der Kiste und pfeift, wenn er die Faehigkeit ausloest.
    this.meister.wurzel.visible = p.meister;
    if (p.meister) {
      if (jetzt < p.faehigkeitBis && this.pfeifenSeit === 0) this.pfeifenSeit = jetzt;
      if (jetzt >= p.faehigkeitBis) this.pfeifenSeit = 0;
      this.meister.spiele(this.pfeifenSeit > 0 && jetzt - this.pfeifenSeit < 900 ? 'pfeifen' : 'idle');
      this.meister.traegt(null);
      this.meister.aktualisiere(dt);
    }
  }

  /** Debug: Rig-Anker der Arbeiter und die Punkte der Presse. */
  punkte(): { x: number; y: number }[] {
    // Nur gebaute Etagen — Umriss-Etagen haben nichts, was man pruefen koennte.
    if (!this.gebaut.visible) return [];
    const liste = [this.presse.bedienPunkt(), this.presse.ausgabePunkt()];
    const dampf = this.presse.dampfPunkt();
    if (dampf) liste.push(dampf);
    for (const a of [...this.arbeiter, this.meister]) {
      if (!a.wurzel.visible) continue;
      for (const q of a.punkte()) liste.push({ x: a.wurzel.x + q.x, y: a.wurzel.y + q.y });
    }
    return liste;
  }
}

export class Szene {
  private readonly welt = new Container();
  private readonly etagen: EtageBild[] = [];
  private readonly band: TilingSprite;
  private readonly bandLadung = new Container();
  private readonly antrieb: Sprite;
  private readonly kopf: Sprite;
  private readonly fuss: Sprite;
  private readonly roehre: Graphics;
  private readonly kisten: Sprite;
  private readonly wagen = new Container();
  private readonly wagenKorpus: Sprite;
  private readonly raeder: Sprite[] = [];
  private readonly traeger: Figur;
  private readonly kurbler: Figur;
  private readonly paternosterMeister: Figur;
  private readonly versandMeister: Figur;
  private direktor: Figur | null = null;
  private direktorSchluessel = '';
  private direktorJubel = 0;
  private direktorWinken = 0;
  private stufenSumme = -1;
  private readonly direktorHalter = new Container();
  private readonly wand: TilingSprite;
  private readonly abdunkeln = new Graphics();
  private readonly paket: Texture;
  private letzteWandHoehe = 0;
  private bilder = 0;
  private bilderSeit = performance.now();
  private bildrate = 0;
  private readonly wolke: Teilchenwolke;
  private readonly debug = new Graphics();
  private debugAn = false;
  private bandWeg = 0;
  private kabinenY = 0;
  private letzteEtagen = -1;
  private letzteWagenPhase = 'steht';
  private letzterVerdienst: number | null = null;
  private wagenSquash = 0;
  private letzteZeit = performance.now();
  private readonly segmentOben: number;
  private sichtbarkeit = (): void => {
    if (document.hidden) this.app.ticker.stop();
    else {
      this.letzteZeit = performance.now();
      this.app.ticker.start();
    }
  };

  private constructor(
    private readonly app: Application,
    private readonly t: Record<string, Texture>,
    private readonly quelle: Quelle,
    private readonly ausschnitt: () => Ausschnitt,
    private readonly ereignis: (e: SzenenEreignis) => void,
  ) {
    app.stage.addChild(this.welt);
    this.wolke = new Teilchenwolke(t);
    const h = halle();

    // Halle: der Ausschnitt der Kulisse mit Fenster, Tor und Boden.
    const kulisse = t[R('kulisse-halle-oben.png')]!;
    const halleBild = new Sprite(
      new Texture({ source: kulisse.source, frame: new Rectangle(0, KULISSE.von, KULISSE.breite, KULISSE.bis - KULISSE.von) }),
    );
    halleBild.width = BREITE;
    halleBild.height = HALLE_HOEHE;

    // Keller: Ziegelwand, gekachelt, etwas abgedunkelt fuer die Schilder.
    this.wand = new TilingSprite({ texture: t['/manufaktur/wand-keller.webp']!, width: BREITE, height: 100 });
    this.wand.tileScale.set(150 / 512);
    this.wand.position.set(0, HALLE_HOEHE);
    this.wand.tint = 0xb0a8a0;

    // Paternoster: Kopf mit Antriebsrad auf dem Hallenboden, darunter die Mittelkachel bis zum Fuss.
    const bandX = SCHACHT.x + (SCHACHT.b - BAND.breite) / 2;
    this.segmentOben = h.boden;
    this.roehre = schachtRoehre(SCHACHT.b, 100);
    this.roehre.position.set(SCHACHT.x, this.segmentOben);
    this.band = new TilingSprite({ texture: t[R('laufband-leer.png')]!, width: BAND.breite, height: 100 });
    this.band.tileScale.set(BAND_M);
    // Kachelmitte auf die Bandmitte, sonst stuende das Tablett am linken Rand.
    this.band.tilePosition.x = BAND.breite / 2 - (BAND.px / 2) * BAND_M;
    this.band.position.set(bandX, this.segmentOben);
    this.kopf = new Sprite(t[R('laufband-kopf.png')]);
    this.kopf.anchor.set(0.5, 1);
    this.kopf.scale.set(KOPF_M);
    this.kopf.position.set(bandX + BAND.breite / 2, this.segmentOben);
    this.antrieb = new Sprite(t[R('laufband-antriebsrad.png')]);
    this.antrieb.anchor.set(0.5);
    this.antrieb.scale.set(KOPF_M * 0.6071428571428571);
    this.antrieb.position.set(bandX + BAND.breite / 2, this.segmentOben - (256 - 97) * KOPF_M);
    this.fuss = new Sprite(t[R('laufband-fuss.png')]);
    this.fuss.anchor.set(0.5, 0);
    this.fuss.scale.set(BAND_M);
    for (let i = 0; i < 40; i += 1) {
      const s = new Sprite(t[R('laufband-ladung.png')]);
      s.anchor.set(48 / 96, 60 / 64);
      s.scale.set(BAND_M);
      s.visible = false;
      this.bandLadung.addChild(s);
    }

    // Packtisch mit drei Kartonstapeln (lager.json): klein, mittel, gross nach Menge.
    const tm = h.packtisch.b / TISCH.px;
    const tisch = new Sprite(t[R('lager-tisch.png')]);
    tisch.anchor.set(0, TISCH.unten / TISCH.px);
    tisch.scale.set(tm);
    tisch.position.set(h.packtisch.x, h.boden);
    this.kisten = new Sprite(t[R('lager-kisten-1.png')]);
    this.kisten.anchor.set(128 / 256, 240 / 256);
    this.kisten.scale.set(tm * 0.85);
    this.kisten.position.set(h.packtisch.x + TISCH.abstell[0] * tm, h.boden + (TISCH.abstell[1] - TISCH.unten) * tm);

    // Wagen (versand.json): Front rechts, Hecktuer links zum Packtisch, Raeder getrennt.
    const wm = h.wagen.b / WAGEN.px;
    this.wagenKorpus = new Sprite(t[R('versand-korpus-offen.png')]);
    this.wagen.addChild(this.wagenKorpus);
    for (const [x, y, sx, sy] of [
      [200, 317, 1, 0.96],
      [483, 321, 0.94, 0.9],
    ] as const) {
      const r = new Sprite(t[R('versand-rad.png')]);
      r.anchor.set(0.5);
      r.position.set(x, y);
      r.scale.set(sx, sy);
      this.raeder.push(r);
      this.wagen.addChild(r);
    }
    this.wagen.pivot.set(0, WAGEN.unten);
    this.wagen.scale.set(wm);

    // Figuren der Halle: Packer und Kurbler in Traegerkleidung, die Meister mit Klemmbrett.
    this.paket = t[R('req-paket.png')]!;
    this.traeger = new RigFigur(t, ARBEITER_HOEHE, berufsAusstattung('traeger'), 20);
    this.kurbler = new RigFigur(t, ARBEITER_HOEHE, berufsAusstattung('traeger'));
    this.kurbler.schaue(-1);
    this.kurbler.wurzel.position.set(h.kurbler.x, h.boden);
    this.paternosterMeister = new RigFigur(t, ARBEITER_HOEHE, berufsAusstattung('meister'));
    this.paternosterMeister.wurzel.position.set(h.paternosterMeisterFigur.x + h.paternosterMeisterFigur.b / 2, h.boden);
    this.versandMeister = new RigFigur(t, ARBEITER_HOEHE, berufsAusstattung('meister'));
    this.versandMeister.wurzel.position.set(h.versandMeisterFigur.x + h.versandMeisterFigur.b / 2, h.boden);

    // Der Direktor steht auf diesem Podest vor dem Fenster — ausserhalb der Laufwege.
    const podest = new Graphics()
      .roundRect(h.podest.x, h.podest.y, h.podest.b, h.podest.h, 3)
      .fill(0x7a4a26)
      .rect(h.podest.x, h.podest.y, h.podest.b, 3)
      .fill(0xc9a24a);
    this.direktorHalter.position.set(h.podest.x + h.podest.b / 2, h.podest.y);

    this.welt.addChild(halleBild, this.wand, this.roehre, this.band, this.bandLadung, this.fuss);
    for (let i = 0; i < MAX_PRESSEN; i += 1) {
      const e = new EtageBild(i, t, this.wolke);
      this.etagen.push(e);
      this.welt.addChild(e.wurzel);
    }
    // Ueber den Etagen: So verschwinden auch die Umriss-Etagen im Dunkel.
    this.welt.addChild(this.abdunkeln);
    this.welt.addChild(
      podest,
      this.direktorHalter,
      tisch,
      this.kisten,
      this.paternosterMeister.wurzel,
      this.versandMeister.wurzel,
      this.traeger.wurzel,
      this.wagen,
      this.kopf,
      this.antrieb,
      this.kurbler.wurzel,
      this.wolke.wurzel,
      this.debug,
    );

    app.ticker.maxFPS = 60;
    app.ticker.add(() => this.bild());
    document.addEventListener('visibilitychange', this.sichtbarkeit);
  }

  /** Baut die Szene in `host`. null, wenn das Geraet kein WebGL kann (dann bleibt das DOM). */
  static async erstelle(
    host: HTMLElement,
    quelle: Quelle,
    ausschnitt: () => Ausschnitt,
    ereignis: (e: SzenenEreignis) => void = () => undefined,
  ): Promise<Szene | null> {
    const app = new Application();
    try {
      const { breite, leinwand } = ausschnitt();
      await app.init({
        width: breite,
        height: leinwand,
        backgroundAlpha: 0,
        antialias: true,
        resolution: aufloesung(breite, leinwand),
        autoDensity: true,
        preference: 'webgl',
      });
    } catch (err) {
      console.error('Manufaktur: keine Leinwand (WebGL)', err);
      return null;
    }
    let texturen: Record<string, Texture>;
    try {
      texturen = await ladeTexturen(DATEIEN);
    } catch (err) {
      console.error('Manufaktur: Bilder fuer die Szene nicht geladen', err);
      app.destroy(true);
      return null;
    }
    app.canvas.classList.add('mf-leinwand');
    host.appendChild(app.canvas);
    return new Szene(app, texturen, quelle, ausschnitt, ereignis);
  }

  groesse(breite: number, hoehe: number): void {
    this.app.renderer.resize(breite, hoehe, aufloesung(breite, hoehe));
  }

  /** Debug-Ansicht: Anker und Drehpunkte einblenden, um gelieferte Teile zu pruefen. */
  zeigeDebug(an: boolean): void {
    this.debugAn = an;
    if (!an) this.debug.clear();
  }

  /**
   * Ein Bild sofort zeichnen, ohne auf den Takt zu warten. Fuer Proben in
   * einem verdeckten Fenster: Dort laeuft requestAnimationFrame nicht, und
   * die Buehne bliebe fuer Bildschirmfotos leer.
   */
  zeichneEinmal(): void {
    this.bild();
    this.app.render();
  }

  /** Bilder je Sekunde, gemittelt ueber die letzte Sekunde (Debug-Ansicht). */
  fps(): number {
    return this.bildrate;
  }

  zerstoere(): void {
    document.removeEventListener('visibilitychange', this.sichtbarkeit);
    this.app.destroy(true, { children: true });
  }

  /** Ein Bild: Stand lesen, alles an seinen Platz. */
  private bild(): void {
    const stand = this.quelle.stand();
    if (!stand) return;
    const nun = performance.now();
    const dt = Math.min(MAX_DT, nun - this.letzteZeit);
    this.letzteZeit = nun;
    this.bilder += 1;
    if (nun - this.bilderSeit >= 1000) {
      this.bildrate = (this.bilder * 1000) / (nun - this.bilderSeit);
      this.bilder = 0;
      this.bilderSeit = nun;
    }
    const jetzt = this.quelle.jetzt();
    const rest = Math.max(0, jetzt - stand.zeit);
    const { oben, hoehe, breite, leinwand } = this.ausschnitt();
    const faktor = breite / BREITE;
    // Die Leinwand ist so hoch wie die Welt und rollt mit dem Rollbereich mit
    // — wie Schilder und Knoepfe darueber. Bis zum 23.10.2026 klebte sie oben
    // (`sticky`), und die Szene verschob die Welt selbst um `scrollTop`. Am
    // iPhone kam das Bild beim Schwungrollen ein Bild zu spaet: Hintergrund,
    // Pinguine und Pressen rutschten gegen die Schilder.
    this.welt.scale.set(faktor);
    this.welt.y = 0;

    const anzahl = stand.pressen.length;
    if (anzahl !== this.letzteEtagen) this.bauKeller(anzahl);
    // Kein leerer Raum unter der Welt: Die Wand reicht bis zum unteren Rand
    // des Ausschnitts und laeuft nach unten ins Dunkle aus.
    const wandUnten = Math.max(gesamtHoehe(anzahl), leinwand / faktor);
    if (Math.abs(wandUnten - this.letzteWandHoehe) > 1) {
      this.letzteWandHoehe = wandUnten;
      this.wand.height = wandUnten - HALLE_HOEHE;
      this.zeichneDunkel(etage(Math.min(anzahl + 1, MAX_PRESSEN)).reihe.y - ETAGE_HOEHE * 0.3, wandUnten);
    }

    // Nur bewegen und zeichnen, was im Ausschnitt liegt — mit einem ganzen
    // Ausschnitt Luft nach oben und unten: Das Rollen laeuft ohne die Szene,
    // und eine Etage, die erst im naechsten Bild auftaucht, waere kurz leer.
    const luft = hoehe / faktor;
    const von = oben / faktor - luft;
    const bis = (oben + hoehe) / faktor + luft;
    this.etagen.forEach((e, i) => {
      const y = etage(i).reihe.y;
      const sichtbar = y + ETAGE_HOEHE > von && y < bis;
      e.wurzel.visible = sichtbar;
      if (sichtbar) e.zeige(stand, jetzt, rest, dt);
    });

    this.zeigePaternoster(stand, jetzt, rest, dt);
    this.zeigeVersand(stand, jetzt, rest, dt);
    this.zeigeDirektor(stand, dt);
    this.wolke.aktualisiere(dt);
    if (this.debugAn) this.zeichneDebug();
  }

  /** Von `ab` bis `bis` immer dunkler — die Umriss-Etagen verschwinden im Dunkel. */
  private zeichneDunkel(ab: number, bis: number): void {
    const g = this.abdunkeln;
    g.clear();
    const stufen = 12;
    const spanne = Math.max(1, (bis - ab) * 0.6);
    for (let i = 0; i < stufen; i += 1) {
      const y = ab + (spanne / stufen) * i;
      g.rect(0, y, BREITE, spanne / stufen + 1).fill({ color: 0x07090f, alpha: ((i + 1) / stufen) * 0.92 });
    }
    g.rect(0, ab + spanne, BREITE, Math.max(0, bis - ab - spanne) + 2).fill({ color: 0x07090f, alpha: 0.92 });
  }

  /** Roehre und Mittelkachel reichen bis unter die tiefste Etage, darunter der Fuss. */
  private bauKeller(anzahl: number): void {
    this.letzteEtagen = anzahl;
    this.letzteWandHoehe = 0;
    const schachtUnten = etage(anzahl - 1).boden + 6;
    this.roehre.height = schachtUnten - this.segmentOben;
    this.band.height = schachtUnten - this.segmentOben;
    this.fuss.position.set(this.band.x + BAND.breite / 2, schachtUnten);
  }

  private zeigePaternoster(stand: ManufakturStand, jetzt: number, rest: number, dt: number): void {
    const ort = paternosterOrt(stand, jetzt, rest);
    const y = this.kabinenYFuer(ort.etage, stand.pressen.length);
    const weg = y - this.kabinenY;
    this.kabinenY = y;
    const f = stand.paternoster;
    // Band und Rad laufen genau mit der Fahrt — steht sie, steht alles.
    // Grosse Spruenge (neuer Stand vom Server) zaehlen nicht als Fahrt.
    if (Math.abs(weg) < 200) {
      this.bandWeg += weg;
      this.band.tilePosition.y = this.bandWeg;
      // Hoechstens rund 20° je Bild: Schneller wirkt ein Speichenrad, als
      // drehte es rueckwaerts (Wagenrad-Effekt), sobald der Paternoster flott ist.
      this.antrieb.rotation += Math.max(-0.35, Math.min(0.35, weg / 9));
    }
    // Ladung nur auf den Tabletts, die gerade Ware hinauftragen: auf der
    // Rueckfahrt nach oben, zwischen der Etage, an der die Kabine ist, und dem Kopf.
    const abstand = BAND.tablettAbstandPx * BAND_M;
    const versatz = (((BAND.ladungPx * BAND_M + this.bandWeg) % abstand) + abstand) % abstand;
    const traegt = f.laeuft && f.ladung > 0 && !ort.abwaerts;
    this.bandLadung.children.forEach((c, i) => {
      const ty = this.segmentOben + versatz + i * abstand;
      c.visible = traegt && ty <= y + 4 && ty < this.band.y + this.band.height;
      c.position.set(this.band.x + BAND.breite / 2, ty);
    });

    // Der Kurbler dreht das Rad, solange die Kabine faehrt; ohne Meister und
    // mit Ware in den Kisten schlaeft er.
    const schlaeft = !f.meister && !f.laeuft && stand.pressen.some((p) => p.kiste > 0);
    this.kurbler.spiele(f.laeuft ? 'kurbeln' : schlaeft ? 'schlafen' : 'idle');
    this.kurbler.aktualisiere(dt);
    this.zeigeMeister(this.paternosterMeister, f, jetzt, dt);
  }

  /** Hoehe der Fahrt: 0 = oben in der Halle, k = an Etage k, dazwischen gleichmaessig. */
  private kabinenYFuer(k: number, etagen: number): number {
    const oben = this.segmentOben;
    const an = (e: number): number => (e <= 0 ? oben : haltY(Math.min(e, etagen) - 1));
    const unten = Math.floor(k);
    return an(unten) + (an(unten + 1) - an(unten)) * (k - unten);
  }

  /** Ein Hallen-Meister: steht, wenn eingestellt, und pfeift beim Ausloesen der Faehigkeit. */
  private zeigeMeister(
    figur: Figur,
    s: { meister: boolean; faehigkeitBis: number; abklingenBis: number },
    jetzt: number,
    dt: number,
  ): void {
    figur.wurzel.visible = s.meister;
    if (!s.meister) return;
    const seit = jetzt - (s.faehigkeitBis - FAEHIGKEIT_MS);
    figur.spiele(jetzt < s.faehigkeitBis && seit < 900 ? 'pfeifen' : 'idle');
    figur.traegt(null);
    figur.aktualisiere(dt);
  }

  private zeigeVersand(stand: ManufakturStand, jetzt: number, rest: number, dt: number): void {
    const h = halle();
    const { anzahl } = packtischKartons(stand.packtisch, versandKapazitaet(stand.versand.stufe, stand.manufaktur));
    this.kisten.visible = anzahl > 0;
    const stapel = anzahl >= 6 ? 3 : anzahl >= 3 ? 2 : 1;
    this.kisten.texture = this.t[R(`lager-kisten-${stapel}.png`)]!;

    const wagen = wagenOrt(stand, jetzt, rest);
    const wm = h.wagen.b / WAGEN.px;
    const strecke = BREITE - h.wagen.x + 30;
    const vorher = this.wagen.x;
    this.wagen.x = h.wagen.x + wagen.weg * strecke;
    // Raeder: Drehwinkel aus Strecke durch Radius (in Wagen-Pixeln).
    const gefahren = (this.wagen.x - vorher) / wm;
    if (Math.abs(gefahren) < 400) {
      const dreh = Math.max(-0.35, Math.min(0.35, gefahren / WAGEN.radRadius));
      for (const r of this.raeder) r.rotation += dreh;
    }
    // Tuer offen am Tor, zu unterwegs — als Zustandswechsel mit kurzem Squash.
    const offen = wagen.phase === 'steht' || wagen.phase === 'laden';
    const korpus = this.t[R(offen ? 'versand-korpus-offen.png' : 'versand-korpus-zu.png')]!;
    if (this.wagenKorpus.texture !== korpus) {
      this.wagenKorpus.texture = korpus;
      this.wagenSquash = Math.max(this.wagenSquash, 120);
    }

    // Anfahren: Staubwolke am Auspuff, Hupe.
    if (wagen.phase === 'weg' && this.letzteWagenPhase === 'laden') {
      this.wagenSquash = 160;
      this.wolke.staub(this.wagen.x + WAGEN.auspuff[0] * wm, h.boden + (WAGEN.auspuff[1] - WAGEN.unten) * wm);
      ton('hupe', 0.5);
    }
    this.letzteWagenPhase = wagen.phase;
    this.wagenSquash = Math.max(0, this.wagenSquash - dt);
    const sq = this.wagenSquash / 160;
    // Unterwegs wippt der Wagen leicht.
    const wippen = wagen.phase === 'weg' || wagen.phase === 'zurueck' ? Math.sin(jetzt / 60) * 0.8 : 0;
    this.wagen.scale.set(wm * (1 + 0.04 * sq), wm * (1 - 0.05 * sq));
    this.wagen.y = h.boden - wippen;

    // Verkauf: Muenzen fliegen im DOM vom rechten Bildrand zum Taler-Zaehler, der Direktor winkt.
    if (this.letzterVerdienst !== null && stand.verdient > this.letzterVerdienst) {
      const { oben, breite } = this.ausschnitt();
      const faktor = breite / BREITE;
      this.ereignis({ art: 'verkauf', betrag: stand.verdient - this.letzterVerdienst, x: breite - 30, y: (h.boden - 60) * faktor - oben });
      this.wolke.glanz(BREITE - 24, h.boden - 60);
      this.direktorWinken = 1200;
      ton('muenzen', 0.5);
    }
    this.letzterVerdienst = stand.verdient;

    // Der Packer: traegt das Paket zur Hecktuer, laedt ein, geht zurueck, winkt dem Wagen nach.
    const v = stand.versand;
    const tm = h.packtisch.b / TISCH.px;
    const von = h.packtisch.x + TISCH.packer[0] * tm;
    const bis = h.wagen.x + WAGEN.ladepunkt[0] * wm;
    let x = von;
    if (wagen.phase === 'laden') {
      const a = Math.min(1, wagen.anteil / 0.7);
      x = von + (bis - von) * a;
      // Laden dauert bei vollem Tempo nur noch Sekundenbruchteile — die
      // Ablaeufe muessen in ihren Abschnitt passen (phasenTempo).
      const ladenMs = (VERSAND_ABFAHRT * versandZyklus(v.stufe)) / tempo(v, jetzt);
      const grund = (versandZyklus(1) / versandZyklus(v.stufe)) * tempo(v, jetzt);
      const name = wagen.anteil < 0.7 ? 'laufen_tragen' : 'einladen';
      this.traeger.spiele(name, phasenTempo(CLIPS[name], name, ladenMs * (name === 'einladen' ? 0.3 : 0.7), grund));
      this.traeger.schaue(1);
      this.traeger.traegt(wagen.anteil < 0.85 ? this.paket : null);
    } else if (wagen.phase === 'weg') {
      const a = Math.min(1, wagen.anteil / 0.6);
      x = bis - (bis - von) * a;
      const grund = (versandZyklus(1) / versandZyklus(v.stufe)) * tempo(v, jetzt);
      this.traeger.spiele(a < 1 ? 'laufen' : 'winken', a < 1 ? Math.min(LAUFEN_TEMPO_MAX, grund) : 1);
      this.traeger.schaue(a < 1 ? -1 : 1);
      this.traeger.traegt(null);
    } else {
      this.traeger.spiele(!v.meister && !v.laeuft && stand.packtisch > 0 ? 'schlafen' : 'idle');
      this.traeger.schaue(1);
      this.traeger.traegt(null);
    }
    this.traeger.wurzel.position.set(x, h.boden);
    this.traeger.aktualisiere(dt);
    this.zeigeMeister(this.versandMeister, v, jetzt, dt);
  }

  /** Der Direktor: dein Pinguin mit deinem Outfit; winkt bei Verkaeufen, jubelt bei Upgrades. */
  private zeigeDirektor(stand: ManufakturStand, dt: number): void {
    const getragen = this.quelle.getragen?.();
    const schluessel = JSON.stringify(getragen ?? {});
    if (schluessel !== this.direktorSchluessel) {
      this.direktorSchluessel = schluessel;
      this.direktor?.wurzel.destroy({ children: true });
      const ausstattung: Ausstattung = ausstattungAus(Object.values(getragen ?? {}));
      this.direktor = new RigFigur(this.t, 38, ausstattung);
      this.direktorHalter.addChild(this.direktor.wurzel);
    }
    const summe = [stand.versand, stand.paternoster, ...stand.pressen].reduce((s, x) => s + x.stufe, 0);
    if (this.stufenSumme >= 0 && summe > this.stufenSumme) this.direktorJubel = 800;
    this.stufenSumme = summe;
    this.direktorJubel = Math.max(0, this.direktorJubel - dt);
    this.direktorWinken = Math.max(0, this.direktorWinken - dt);
    const d = this.direktor!;
    d.spiele(this.direktorJubel > 0 ? 'jubeln' : this.direktorWinken > 0 ? 'winken' : 'idle');
    d.traegt(null);
    d.aktualisiere(dt);
  }

  private zeichneDebug(): void {
    const g = this.debug;
    g.clear();
    const kreuz = (x: number, y: number, farbe: number): void => {
      g.moveTo(x - 4, y).lineTo(x + 4, y).moveTo(x, y - 4).lineTo(x, y + 4).stroke({ width: 1.2, color: farbe });
    };
    for (const e of this.etagen) if (e.wurzel.visible) for (const q of e.punkte()) kreuz(q.x, q.y, 0xff3355);
    for (const f of [this.traeger, this.kurbler, this.paternosterMeister, this.versandMeister]) {
      if (!f.wurzel.visible) continue;
      for (const q of f.punkte()) kreuz(f.wurzel.x + q.x, f.wurzel.y + q.y, 0x33ff88);
    }
    kreuz(this.wagen.x, this.wagen.y, 0x33aaff);
    kreuz(this.antrieb.x, this.antrieb.y, 0xffcc00);
    kreuz(this.band.x + BAND.breite / 2, this.kabinenY, 0xffcc00);
  }
}
