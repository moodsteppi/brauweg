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
 * Kabine traegt nur Karten, wenn sie faehrt, der Wagen faehrt erst beladen,
 * und das Tempo der Ablaeufe kommt aus der Zykluszeit der Station.
 *
 * Die Leinwand ist so gross wie der sichtbare Ausschnitt und klebt oben im
 * Rollbereich (`position: sticky`); gerollt wird, indem die Welt verschoben
 * wird. Was nicht im Ausschnitt liegt, wird nicht gezeichnet, und im
 * Hintergrund steht der Takt still — beim Zurueckkommen rechnet die Steuerung
 * ueber die Uhr nach, nicht die Szene.
 */

import { Application, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';

import { FAEHIGKEIT_MS, type ManufakturStand, type Presse, MAX_PRESSEN, arbeiter, versandKapazitaet } from '@brauweg/manufaktur-kern';

import { BILD, presseBild, stapelBild } from '../bilder';
import { ton } from '../toene';
import {
  ablaufTempo,
  arbeiterAblauf,
  arbeiterOrt,
  kistenStapel,
  packtischKartons,
  paternosterOrt,
  pressenPhase,
  schlagZwischen,
  traegtStapel,
  wagenOrt,
} from './abbild';
import { BASIS_PINGUIN, Figur } from './figur';
import {
  BALKEN,
  BREITE,
  ETAGE_HOEHE,
  FUSS_HOEHE,
  HALLE_HOEHE,
  KULISSE,
  SCHACHT,
  etage,
  gesamtHoehe,
  haltY,
  halle,
} from './layout';
import { FARBE, balken, bretterwand, fussstueck, karton, kiste, kopfstueck, rad, schachtRoehre, schloss } from './zeichnen';

export interface Quelle {
  stand: () => ManufakturStand | null;
  jetzt: () => number;
}

/** Wie gerollt ist (Bildschirmpunkte) und wie hoch der Ausschnitt ist. */
export interface Ausschnitt {
  oben: number;
  hoehe: number;
  breite: number;
}

/** Was die Szene dem DOM meldet — Muenzflug und Zahlen-Popup laufen dort. */
export type SzenenEreignis = { art: 'verkauf'; betrag: number; x: number; y: number };

/**
 * Packer und Kurbler: der nackte Basis-Pinguin. Das Druckerbild haelt einen
 * gemalten Druckbogen in der Flosse — als Packer trug er dann Bogen UND Paket.
 */
const BASIS = '/hub/pinguin/pinguin-basis.webp';

const DATEIEN = [
  '/manufaktur/kulisse-halle.webp',
  '/manufaktur/wand-keller.webp',
  '/manufaktur/laufband.webp',
  BILD.lager,
  BILD.versand,
  BILD.drucker,
  BILD.meister,
  presseBild(1),
  presseBild(25),
  presseBild(100),
  ...Array.from({ length: MAX_PRESSEN }, (_, i) => stapelBild(i)),
  BASIS,
];

/** Laufband-Kachel: 256 × 512, im Schacht 40 breit. */
const BAND = { breite: 40, kachel: 80 };
const ARBEITER_HOEHE = 54;
/** Laenger als ein Bild darf ein Schritt nicht sein — sonst springen Ablaeufe nach einer Pause. */
const MAX_DT = 100;

/**
 * Bilder als <img> laden und daraus Texturen machen — nicht ueber Pixis
 * `Assets`. In der App liefert ein eigenes URL-Schema die Dateien (apps/ios,
 * PaketSchema), und `Assets.load` kam dort nie zurueck, auch ohne Worker:
 * Die Buehne blieb schwarz, ohne Fehler. Ein <img> laedt dort wie ueberall.
 */
async function ladeTexturen(dateien: readonly string[]): Promise<Record<string, Texture>> {
  const paare = await Promise.all(
    dateien.map(async (url) => {
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

/** Kurzlebige Teilchen: Dampf, Staub, ein fliegender Bogen. */
interface Teilchen {
  g: Container;
  vx: number;
  vy: number;
  leben: number;
  dauer: number;
  wachsen: number;
}

class Teilchenwolke {
  readonly wurzel = new Container();
  private readonly liste: Teilchen[] = [];

  dampf(x: number, y: number): void {
    for (let i = 0; i < 3; i += 1) {
      const g = new Graphics().circle(0, 0, 4 + Math.random() * 3).fill({ color: 0xffffff, alpha: 0.55 });
      g.position.set(x + (Math.random() - 0.5) * 6, y);
      this.dazu({ g, vx: (Math.random() - 0.5) * 8, vy: -22 - Math.random() * 10, leben: 0, dauer: 900, wachsen: 1.6 });
    }
  }

  staub(x: number, y: number): void {
    for (let i = 0; i < 6; i += 1) {
      const g = new Graphics().circle(0, 0, 3 + Math.random() * 4).fill({ color: 0xc8b090, alpha: 0.6 });
      g.position.set(x, y - Math.random() * 6);
      this.dazu({ g, vx: -30 - Math.random() * 40, vy: -6 - Math.random() * 10, leben: 0, dauer: 600, wachsen: 1.8 });
    }
  }

  bogen(x: number, y: number, zielX: number, zielY: number): void {
    const g = new Graphics().roundRect(-5, -7, 10, 14, 2).fill(0xfaf6ec).stroke({ width: 1, color: 0xc9a24a });
    g.position.set(x, y);
    const dauer = 260;
    this.dazu({ g, vx: ((zielX - x) / dauer) * 1000, vy: ((zielY - y) / dauer) * 1000 - 40, leben: 0, dauer, wachsen: 0.9 });
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
      const f = t.leben / t.dauer;
      t.g.alpha = 1 - f;
      t.g.scale.set(1 + (t.wachsen - 1) * f);
      if (t.leben >= t.dauer) {
        t.g.destroy();
        this.liste.splice(i, 1);
      }
    }
  }
}

/** Eine Etage: Balken, Kiste mit Stapeln, Presse, Arbeiter, Meister — oder die Bretterwand. */
class EtageBild {
  readonly wurzel = new Container();
  private readonly gebaut = new Container();
  private readonly gesperrt = new Container();
  private readonly schloss: Graphics;
  private readonly stapel: Sprite[] = [];
  private readonly presse: Sprite;
  private readonly arbeiter: Figur[] = [];
  private readonly meister: Figur;
  /** Merkzettel vom letzten Bild — daraus entstehen Schlaege, Jubel und Einlauf. */
  private letzteStufe = 0;
  private letzteAnzahl = 0;
  private letzterAnteil: number[] = [];
  private letztePhase: string[] = [];
  private einlauf: number[] = [];
  private jubelBis = 0;
  private schlag = 0;
  private pfeifenSeit = 0;

  constructor(
    private readonly index: number,
    private readonly t: Record<string, Texture>,
    private readonly wolke: Teilchenwolke,
  ) {
    const e = etage(index);
    const b = balken(BREITE, BALKEN);
    b.position.set(0, e.boden);
    this.wurzel.addChild(this.gebaut, this.gesperrt, b);

    const k = kiste(e.kiste.b, 34);
    k.position.set(e.kiste.x, e.boden);
    this.gebaut.addChild(k);
    for (let i = 0; i < 6; i += 1) {
      const s = new Sprite(t[stapelBild(index)]);
      s.anchor.set(0.5, 1);
      // Klein (rund 60 % der ersten Fassung), damit die Kiste sichtbar bleibt:
      // zwei Reihen zu drei, die obere ragt heraus — so sieht man, wie voll sie ist.
      s.scale.set(18 / 256);
      s.position.set(e.kiste.x + 12 + (i % 3) * 17, e.boden - 12 - Math.floor(i / 3) * 10);
      this.stapel.push(s);
      this.gebaut.addChild(s);
    }

    this.presse = new Sprite(t[presseBild(1)]);
    this.presse.anchor.set(0.5, 450 / 512);
    this.presse.scale.set(e.presse.b / 512);
    this.presse.position.set(e.presse.x + e.presse.b / 2, e.boden);
    this.gebaut.addChild(this.presse);

    // Wie im Vorbild steht der Meister vorn an der Kiste, in Arbeitergroesse.
    this.meister = new Figur(t[BILD.meister]!, ARBEITER_HOEHE, t[stapelBild(index)]!);
    this.meister.wurzel.position.set(e.meisterFigur.x + e.meisterFigur.b / 2, e.boden);

    for (let i = 0; i < 5; i += 1) {
      const a = new Figur(t[BILD.drucker]!, ARBEITER_HOEHE, t[stapelBild(index)]!);
      this.arbeiter.push(a);
      this.letzterAnteil.push(0);
      this.letztePhase.push('');
      this.einlauf.push(0);
      this.gebaut.addChild(a.wurzel);
    }
    // Vor den Arbeitern: Sonst verschwindet er hinter der Kolonne, und nur sein ⚡ bleibt sichtbar.
    this.gebaut.addChild(this.meister.wurzel);

    const wand = bretterwand(BREITE - SCHACHT.x - SCHACHT.b - 10, ETAGE_HOEHE - BALKEN - 8);
    wand.position.set(SCHACHT.x + SCHACHT.b + 6, e.reihe.y + 4);
    this.schloss = schloss(26);
    this.schloss.position.set(e.sperrSchild.x - 22, e.reihe.y + 74);
    this.gesperrt.addChild(wand, this.schloss);
  }

  zeige(stand: ManufakturStand, jetzt: number, rest: number, dt: number): void {
    const p = stand.pressen[this.index];
    this.gebaut.visible = !!p;
    // Die naechste Etage ist eine Bretterwand mit Schloss, die zwei danach
    // nur dunkle Umrisse — man sieht, dass es weitergeht, ohne Laerm.
    const abstand = this.index - stand.pressen.length;
    this.gesperrt.visible = !p && abstand >= 0 && abstand < 3;
    this.gesperrt.alpha = abstand === 0 ? 1 : 0.28;
    this.schloss.visible = abstand === 0;
    if (!p) {
      this.letzteStufe = 0;
      this.letzteAnzahl = 0;
      return;
    }
    const e = etage(this.index);

    // Aufstieg: Die Arbeiter jubeln. Beim ersten Bild nicht — das ist kein Aufstieg.
    if (this.letzteStufe > 0 && p.stufe > this.letzteStufe) this.jubelBis = jetzt + 800;
    this.letzteStufe = p.stufe;

    const { anzahl } = kistenStapel(p, this.index, stand.manufaktur);
    this.stapel.forEach((s, i) => (s.visible = i < anzahl));
    this.presse.texture = this.t[presseBild(p.stufe)]!;

    const zahl = arbeiter(p.stufe);
    // Meilenstein: Wer neu dazukommt, laeuft von rechts herein.
    if (this.letzteAnzahl > 0 && zahl > this.letzteAnzahl) {
      for (let k = this.letzteAnzahl; k < zahl; k += 1) this.einlauf[k] = 1;
    }
    this.letzteAnzahl = zahl;

    // Zwischen Meister und Presse: Hier gehen die Arbeiter hin und her; den
    // Stapel werfen sie am Ende in die Kiste (siehe unten).
    // Ruheplatz rechts vom Meister-Platz, damit der leere Rahmen ihn nicht verdeckt.
    const kisteX = e.arbeit.x + 20;
    const presseX = e.presse.x + 8;
    const tempo = ablaufTempo(p, jetzt);
    let geschlagen = false;
    this.arbeiter.forEach((a, k) => {
      a.wurzel.visible = k < zahl;
      if (k >= zahl) return;
      // Die Kolonne laeuft leicht versetzt, aber nie spaeter als der Zyklus:
      // Der erste legt genau dann ab, wenn der Warenwert in der Kiste landet.
      const vorlauf: Presse = { ...p, fortschritt: p.laeuft ? Math.min(0.9999, p.fortschritt + k * 0.02) : 0 };
      const ph = pressenPhase(vorlauf, jetzt, rest);
      const ort = arbeiterOrt(ph.phase, ph.anteil);
      // Fuenf Arbeiter brauchen Abstand: an der Kiste und an der Presse je
      // eine kleine Reihe, sonst stehen sie als ein Klumpen da.
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
        a.spiele(arbeiterAblauf(ph.phase), tempo);
        a.schaue(ph.phase === 'zurueck' ? -1 : 1);
      }
      a.traegt(traegtStapel(ph.phase) ? this.t[stapelBild(this.index)]! : null);
      a.wurzel.position.set(x, e.boden);
      a.aktualisiere(dt);

      // Pressenschlag im Takt des vordersten Arbeiters.
      if (k === 0 && ph.phase === 'arbeiten') {
        const vorher = this.letztePhase[k] === 'arbeiten' ? this.letzterAnteil[k]! : 0;
        if (schlagZwischen(vorher, ph.anteil)) geschlagen = true;
      }
      // Der fertige Bogen fliegt zum Arbeiter, sobald er losgeht.
      if (k === 0 && ph.phase === 'zurueck' && this.letztePhase[k] === 'arbeiten') {
        this.wolke.bogen(this.presse.x, e.boden - 38, x, e.boden - 30);
      }
      // Zyklus fertig: Der Stapel fliegt in die Kiste — genau jetzt ist er drin.
      if (k === 0 && this.letztePhase[k] === 'ablegen' && ph.phase !== 'ablegen') {
        this.wolke.bogen(x, e.boden - 30, e.kiste.x + e.kiste.b / 2, e.boden - 24);
      }
      this.letzterAnteil[k] = ph.anteil;
      this.letztePhase[k] = ph.phase;
    });

    if (geschlagen) {
      this.schlag = 120;
      ton('pressenschlag', 0.4);
      if (p.stufe >= 100) this.wolke.dampf(this.presse.x - 30, e.boden - 96);
    }
    // Squash beim Schlag: 0,94 hoch / 1,04 breit, 120 ms.
    this.schlag = Math.max(0, this.schlag - dt);
    const f = this.schlag / 120;
    const basis = e.presse.b / 512;
    this.presse.scale.set(basis * (1 + 0.04 * f), basis * (1 - 0.06 * f));

    // Eingestellt steht der Meister an der Kiste und pfeift, wenn er die Faehigkeit ausloest.
    this.meister.wurzel.visible = p.meister;
    if (p.meister) {
      if (jetzt < p.faehigkeitBis && this.pfeifenSeit === 0) this.pfeifenSeit = jetzt;
      if (jetzt >= p.faehigkeitBis) this.pfeifenSeit = 0;
      this.meister.spiele(this.pfeifenSeit > 0 && jetzt - this.pfeifenSeit < 900 ? 'pfeifen' : 'idle');
      this.meister.aktualisiere(dt);
    }
  }

  /** Debug: Fusspunkte, Griffe und den Drehpunkt der Presse. */
  punkte(): { x: number; y: number }[] {
    // Nur gebaute Etagen — Umriss-Etagen haben nichts, was man pruefen koennte.
    if (!this.gebaut.visible) return [];
    const liste = [{ x: this.presse.x, y: this.presse.y }];
    for (const a of this.arbeiter) {
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
  private readonly kabine = new Container();
  private readonly kabinenLadung: Sprite;
  private readonly antrieb: Container;
  private readonly fuss: Graphics;
  private readonly roehre: Graphics;
  private readonly kartons: Graphics[] = [];
  private readonly wagen: Sprite;
  private readonly traeger: Figur;
  private readonly kurbler: Figur;
  private readonly paternosterMeister: Figur;
  private readonly versandMeister: Figur;
  private readonly wand: TilingSprite;
  private readonly abdunkeln = new Graphics();
  private readonly paket: Texture;
  private letzteWandHoehe = 0;
  private bilder = 0;
  private bilderSeit = performance.now();
  private bildrate = 0;
  private readonly wolke = new Teilchenwolke();
  private readonly debug = new Graphics();
  private debugAn = false;
  private bandWeg = 0;
  private letzteEtagen = -1;
  private letzteWagenPhase = 'steht';
  private letzterVerdienst: number | null = null;
  private wagenSquash = 0;
  private letzteZeit = performance.now();
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

    // Halle: der Ausschnitt der Kulisse mit Fenster, Tor und Boden.
    const kulisse = t['/manufaktur/kulisse-halle.webp']!;
    const ausschnittTextur = new Texture({
      source: kulisse.source,
      frame: new Rectangle(0, KULISSE.von, KULISSE.breite, KULISSE.bis - KULISSE.von),
    });
    const halleBild = new Sprite(ausschnittTextur);
    halleBild.width = BREITE;
    halleBild.height = HALLE_HOEHE;

    // Keller: Ziegelwand, gekachelt, etwas abgedunkelt fuer die Schilder.
    this.wand = new TilingSprite({ texture: t['/manufaktur/wand-keller.webp']!, width: BREITE, height: 100 });
    this.wand.tileScale.set(150 / 512);
    this.wand.position.set(0, HALLE_HOEHE);
    this.wand.tint = 0xb0a8a0;

    this.roehre = schachtRoehre(SCHACHT.b, 100);
    this.roehre.position.set(SCHACHT.x, HALLE_HOEHE - 20);

    this.band = new TilingSprite({ texture: t['/manufaktur/laufband.webp']!, width: BAND.breite, height: 100 });
    this.band.tileScale.set(BAND.breite / 256, BAND.kachel / 512);
    this.band.position.set(SCHACHT.x + (SCHACHT.b - BAND.breite) / 2, HALLE_HOEHE - 20);

    // Kabine: ein Tablett, das an den Etagen haelt. Ladung nur, wenn wirklich etwas faehrt.
    const tablett = new Graphics().roundRect(-22, -5, 44, 10, 3).fill(FARBE.holzHell).stroke({ width: 2, color: FARBE.holzDunkel });
    this.kabinenLadung = new Sprite(t[stapelBild(0)]);
    this.kabinenLadung.anchor.set(0.5, 1);
    this.kabinenLadung.scale.set(28 / 256);
    this.kabinenLadung.position.set(0, -4);
    this.kabine.addChild(tablett, this.kabinenLadung);
    this.kabine.position.set(SCHACHT.x + SCHACHT.b / 2, 0);

    const h = halle();
    const kopf = kopfstueck(h.kopf.b, h.kopf.h);
    kopf.position.set(h.kopf.x, h.kopf.y);
    this.antrieb = rad(16);
    this.antrieb.position.set(h.rad.x, h.rad.y);

    this.fuss = fussstueck(SCHACHT.b, FUSS_HOEHE - 12);

    const tisch = new Sprite(t[BILD.lager]);
    tisch.width = h.packtisch.b;
    tisch.height = h.packtisch.b;
    tisch.position.set(h.packtisch.x, h.boden - h.packtisch.b * (500 / 512));
    const platte = h.boden - h.packtisch.b * 0.46;
    for (let i = 0; i < 8; i += 1) {
      const k = karton(14, 11);
      // Ein kleiner Stapel auf der Tischplatte, von links nach rechts und dann hoch.
      k.position.set(h.packtisch.x + 24 + (i % 4) * 15, platte - Math.floor(i / 4) * 11);
      this.kartons.push(k);
    }
    // Der Direktor (DOM) steht auf diesem Podest vor dem Fenster — ausserhalb der Laufwege.
    const podest = new Graphics()
      .roundRect(h.podest.x, h.podest.y, h.podest.b, h.podest.h, 3)
      .fill(FARBE.holz)
      .rect(h.podest.x, h.podest.y, h.podest.b, 3)
      .fill(FARBE.messing);

    this.wagen = new Sprite(t[BILD.versand]);
    this.wagen.anchor.set(0, 371 / 384);
    this.wagen.scale.set(h.wagen.b / 640);
    // Der Packer traegt Pakete, keine Druckboegen.
    const paket = app.renderer.generateTexture(karton(18, 14));
    this.paket = paket;
    this.traeger = new Figur(t[BASIS]!, ARBEITER_HOEHE, paket, 16, BASIS_PINGUIN);
    this.kurbler = new Figur(t[BASIS]!, ARBEITER_HOEHE, paket, 16, BASIS_PINGUIN);
    this.kurbler.schaue(-1);
    this.kurbler.wurzel.position.set(h.kurbler.x, h.boden);
    this.paternosterMeister = new Figur(t[BILD.meister]!, ARBEITER_HOEHE, paket);
    this.paternosterMeister.wurzel.position.set(h.paternosterMeisterFigur.x + h.paternosterMeisterFigur.b / 2, h.boden);
    this.versandMeister = new Figur(t[BILD.meister]!, ARBEITER_HOEHE, paket);
    this.versandMeister.wurzel.position.set(h.versandMeisterFigur.x + h.versandMeisterFigur.b / 2, h.boden);

    this.welt.addChild(halleBild, this.wand, this.roehre, this.band, this.fuss);
    for (let i = 0; i < MAX_PRESSEN; i += 1) {
      const e = new EtageBild(i, t, this.wolke);
      this.etagen.push(e);
      this.welt.addChild(e.wurzel);
    }
    // Ueber den Etagen: So verschwinden auch die Umriss-Etagen im Dunkel.
    this.welt.addChild(this.abdunkeln);
    this.welt.addChild(
      podest,
      tisch,
      ...this.kartons,
      this.paternosterMeister.wurzel,
      this.versandMeister.wurzel,
      this.traeger.wurzel,
      this.wagen,
      kopf,
      this.antrieb,
      this.kurbler.wurzel,
      this.kabine,
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
      const { breite, hoehe } = ausschnitt();
      await app.init({
        width: breite,
        height: hoehe,
        backgroundAlpha: 0,
        antialias: true,
        // Drei-fache Aufloesung kostet am iPhone viel Speicher und sieht man nicht.
        resolution: Math.min(window.devicePixelRatio || 1, 2),
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
    this.app.renderer.resize(breite, hoehe);
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
    const { oben, hoehe, breite } = this.ausschnitt();
    const faktor = breite / BREITE;
    this.welt.scale.set(faktor);
    this.welt.y = -oben;

    const anzahl = stand.pressen.length;
    if (anzahl !== this.letzteEtagen) this.bauKeller(anzahl);
    // Kein leerer Raum unter der Welt: Die Wand reicht bis zum unteren Rand
    // des Ausschnitts und laeuft nach unten ins Dunkle aus.
    const wandUnten = Math.max(gesamtHoehe(anzahl), (oben + hoehe) / faktor);
    if (Math.abs(wandUnten - this.letzteWandHoehe) > 1) {
      this.letzteWandHoehe = wandUnten;
      this.wand.height = wandUnten - HALLE_HOEHE;
      this.zeichneDunkel(etage(Math.min(anzahl + 1, MAX_PRESSEN)).reihe.y - ETAGE_HOEHE * 0.3, wandUnten);
    }

    // Nur zeichnen, was im Ausschnitt liegt (mit einer Etage Luft).
    const von = oben / faktor - ETAGE_HOEHE;
    const bis = (oben + hoehe) / faktor + ETAGE_HOEHE;
    this.etagen.forEach((e, i) => {
      const y = etage(i).reihe.y;
      const sichtbar = y + ETAGE_HOEHE > von && y < bis;
      e.wurzel.visible = sichtbar;
      if (sichtbar) e.zeige(stand, jetzt, rest, dt);
    });

    this.dtZuletzt = dt;
    this.zeigePaternoster(stand, jetzt, rest);
    this.zeigeVersand(stand, jetzt, rest, dt);
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

  /** Wand, Roehre und Fussstueck reichen bis unter die tiefste Etage. */
  private bauKeller(anzahl: number): void {
    this.letzteEtagen = anzahl;
    this.letzteWandHoehe = 0;
    const schachtUnten = etage(anzahl - 1).boden + BALKEN;
    this.roehre.height = schachtUnten - (HALLE_HOEHE - 20);
    this.band.height = schachtUnten - (HALLE_HOEHE - 20);
    this.fuss.position.set(SCHACHT.x, schachtUnten);
  }

  private zeigePaternoster(stand: ManufakturStand, jetzt: number, rest: number): void {
    const ort = paternosterOrt(stand, jetzt, rest);
    const y = this.kabinenY(ort.etage, stand.pressen.length);
    const weg = y - this.kabine.y;
    this.kabine.y = y;
    const f = stand.paternoster;
    this.kabinenLadung.visible = f.laeuft && f.ladung > 0;
    // Band und Rad laufen genau mit der Kabine — steht sie, steht alles.
    // Grosse Spruenge (neuer Stand vom Server) zaehlen nicht als Fahrt.
    if (Math.abs(weg) < 200) {
      this.bandWeg += weg;
      this.band.tilePosition.y = this.bandWeg;
      this.antrieb.rotation += weg / 16;
    }
    // Der Kurbler dreht das Rad, solange die Kabine faehrt; ohne Meister und
    // mit Ware in den Kisten schlaeft er.
    const schlaeft = !f.meister && !f.laeuft && stand.pressen.some((p) => p.kiste > 0);
    this.kurbler.spiele(f.laeuft ? 'kurbeln' : schlaeft ? 'schlafen' : 'idle');
    this.kurbler.aktualisiere(this.dtZuletzt);
    this.zeigeMeister(this.paternosterMeister, f, jetzt);
  }

  private dtZuletzt = 16;

  /** Ein Hallen-Meister: steht, wenn eingestellt, und pfeift beim Ausloesen der Faehigkeit. */
  private zeigeMeister(figur: Figur, s: { meister: boolean; faehigkeitBis: number; abklingenBis: number }, jetzt: number): void {
    figur.wurzel.visible = s.meister;
    if (!s.meister) return;
    const seit = jetzt - (s.faehigkeitBis - FAEHIGKEIT_MS);
    figur.spiele(jetzt < s.faehigkeitBis && seit < 900 ? 'pfeifen' : 'idle');
    figur.aktualisiere(this.dtZuletzt);
  }

  /** Hoehe der Kabine: 0 = oben in der Halle, k = an Etage k, dazwischen gleichmaessig. */
  private kabinenY(k: number, etagen: number): number {
    const oben = halle().boden - 10;
    const an = (e: number): number => (e <= 0 ? oben : haltY(Math.min(e, etagen) - 1));
    const unten = Math.floor(k);
    return an(unten) + (an(unten + 1) - an(unten)) * (k - unten);
  }

  private zeigeVersand(stand: ManufakturStand, jetzt: number, rest: number, dt: number): void {
    const h = halle();
    const { anzahl } = packtischKartons(stand.packtisch, versandKapazitaet(stand.versand.stufe, stand.manufaktur));
    this.kartons.forEach((k, i) => (k.visible = i < anzahl));

    const wagen = wagenOrt(stand, jetzt, rest);
    const strecke = BREITE - h.wagen.x + 30;
    this.wagen.x = h.wagen.x + wagen.weg * strecke;

    // Anfahren: kurz stauchen, Staubwolke, Hupe.
    if (wagen.phase === 'weg' && this.letzteWagenPhase === 'laden') {
      this.wagenSquash = 160;
      this.wolke.staub(h.wagen.x + 10, h.boden - 4);
      ton('hupe', 0.5);
    }
    this.letzteWagenPhase = wagen.phase;
    this.wagenSquash = Math.max(0, this.wagenSquash - dt);
    const sq = this.wagenSquash / 160;
    const basis = h.wagen.b / 640;
    // Unterwegs wippt der Wagen leicht — die Raeder sind ins Bild gemalt und drehen sich nicht.
    const wippen = wagen.phase === 'weg' || wagen.phase === 'zurueck' ? Math.sin(jetzt / 60) * 0.8 : 0;
    this.wagen.scale.set(basis * (1 + 0.04 * sq), basis * (1 - 0.05 * sq));
    this.wagen.y = h.boden - wippen;

    // Verkauf: Muenzen fliegen im DOM vom rechten Bildrand zum Taler-Zaehler.
    if (this.letzterVerdienst !== null && stand.verdient > this.letzterVerdienst) {
      const { oben, breite } = this.ausschnitt();
      const faktor = breite / BREITE;
      this.ereignis({ art: 'verkauf', betrag: stand.verdient - this.letzterVerdienst, x: breite - 30, y: (h.boden - 60) * faktor - oben });
      ton('muenzen', 0.5);
    }
    this.letzterVerdienst = stand.verdient;

    // Der Traeger: traegt zum Wagen, laedt ein, geht zurueck, winkt dem Wagen nach.
    const v = stand.versand;
    const { von, bis } = h.traegerWeg;
    let x = von;
    if (wagen.phase === 'laden') {
      const a = Math.min(1, wagen.anteil / 0.7);
      x = von + (bis - von) * a;
      this.traeger.spiele(wagen.anteil < 0.7 ? 'laufen_tragen' : 'einladen');
      this.traeger.schaue(1);
      this.traeger.traegt(wagen.anteil < 0.85 ? this.paket : null);
    } else if (wagen.phase === 'weg') {
      const a = Math.min(1, wagen.anteil / 0.6);
      x = bis - (bis - von) * a;
      this.traeger.spiele(a < 1 ? 'laufen' : 'winken');
      this.traeger.schaue(a < 1 ? -1 : 1);
      this.traeger.traegt(null);
    } else {
      this.traeger.spiele(!v.meister && !v.laeuft && stand.packtisch > 0 ? 'schlafen' : 'idle');
      this.traeger.schaue(1);
      this.traeger.traegt(null);
    }
    this.traeger.wurzel.position.set(x, h.boden);
    this.traeger.aktualisiere(dt);
    this.zeigeMeister(this.versandMeister, v, jetzt);
  }

  private zeichneDebug(): void {
    const g = this.debug;
    g.clear();
    const kreuz = (x: number, y: number, farbe: number): void => {
      g.moveTo(x - 5, y).lineTo(x + 5, y).moveTo(x, y - 5).lineTo(x, y + 5).stroke({ width: 1.5, color: farbe });
    };
    for (const e of this.etagen) if (e.wurzel.visible) for (const q of e.punkte()) kreuz(q.x, q.y, 0xff3355);
    kreuz(this.traeger.wurzel.x, this.traeger.wurzel.y, 0x33ff88);
    kreuz(this.wagen.x, this.wagen.y, 0x33aaff);
    kreuz(this.antrieb.x, this.antrieb.y, 0xffcc00);
    kreuz(this.kabine.x, this.kabine.y, 0xffcc00);
  }
}
