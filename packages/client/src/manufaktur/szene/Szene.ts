/**
 * Die Spielwelt der Kartenmanufaktur als Pixi-Szene (PixiJS v8).
 *
 * Nur Bild: Die Szene liest in jedem Bild den Stand aus der Steuerung und
 * stellt ihn dar. Getippt wird auf DOM-Knoepfe, die genau darueber liegen
 * (Ueberlagerung.tsx, beide aus layout.ts) — das haelt Schrift scharf,
 * VoiceOver bedienbar und die Tippflaechen bei mindestens 44 pt.
 *
 * Die Leinwand ist so gross wie der sichtbare Ausschnitt und klebt oben im
 * Rollbereich (`position: sticky`); gerollt wird, indem die Welt verschoben
 * wird. Was nicht im Ausschnitt liegt, wird nicht gezeichnet, und im
 * Hintergrund steht der Takt still — beim Zurueckkommen rechnet die Steuerung
 * ueber die Uhr nach, nicht die Szene.
 */

import { Application, Container, Graphics, Rectangle, Sprite, Texture, TilingSprite } from 'pixi.js';

import { type ManufakturStand, MAX_PRESSEN, arbeiter, versandKapazitaet } from '@brauweg/manufaktur-kern';

import { BILD, presseBild, stapelBild } from '../bilder';
import {
  arbeiterOrt,
  kistenStapel,
  packtischKartons,
  paternosterOrt,
  pressenPhase,
  traegtStapel,
  wagenOrt,
} from './abbild';
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
];

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
      bild.src = url;
      await bild.decode();
      return [url, Texture.from(bild)] as const;
    }),
  );
  return Object.fromEntries(paare);
}

/** Pinguinbilder: 384 Pixel, die Fuesse stehen auf Zeile 371. */
const PINGUIN = { groesse: 384, fuss: 371 / 384, hoehe: 54 };
/** Laufband-Kachel: 256 × 512, im Schacht 40 breit. */
const BAND = { breite: 40, kachel: 80 };

/** Ein Arbeiter. Phase 2: Stehen, Gehen, Schlafen — die Bewegung kommt in Phase 3. */
class Arbeiter {
  readonly koerper = new Container();
  private readonly bild: Sprite;
  private readonly stapel: Sprite;

  constructor(textur: Texture, stapelTextur: Texture) {
    this.bild = new Sprite(textur);
    this.bild.anchor.set(0.5, PINGUIN.fuss);
    this.bild.scale.set(PINGUIN.hoehe / PINGUIN.groesse);
    this.stapel = new Sprite(stapelTextur);
    this.stapel.anchor.set(0.5, 1);
    this.stapel.scale.set(22 / 256);
    this.stapel.position.set(12, -18);
    this.koerper.addChild(this.bild, this.stapel);
  }

  zeige(x: number, y: number, schlaeft: boolean, traegt: boolean, nachLinks: boolean): void {
    this.koerper.position.set(x, y);
    this.bild.rotation = schlaeft ? -0.18 : 0;
    this.bild.scale.x = Math.abs(this.bild.scale.x) * (nachLinks ? -1 : 1);
    this.stapel.visible = traegt;
  }

  stapelBild(textur: Texture): void {
    this.stapel.texture = textur;
  }
}

/** Eine Etage: Balken, Kiste mit Stapeln, Presse, Arbeiter — oder die Bretterwand. */
class EtageBild {
  readonly wurzel = new Container();
  private readonly gebaut = new Container();
  private readonly gesperrt = new Container();
  private readonly stapel: Sprite[] = [];
  private readonly presse: Sprite;
  private readonly arbeiter: Arbeiter[] = [];

  constructor(
    private readonly index: number,
    private readonly t: Record<string, Texture>,
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
      s.scale.set(30 / 256);
      // Zwei Reihen in der Kiste, die oberen ragen heraus — so sieht man, wie voll sie ist.
      s.position.set(e.kiste.x + 16 + (i % 2) * 26, e.boden - 14 - Math.floor(i / 2) * 12);
      this.stapel.push(s);
      this.gebaut.addChild(s);
    }

    this.presse = new Sprite(t[presseBild(1)]);
    this.presse.anchor.set(0.5, 450 / 512);
    this.presse.scale.set(e.presse.b / 512);
    this.presse.position.set(e.presse.x + e.presse.b / 2, e.boden);
    this.gebaut.addChild(this.presse);

    for (let i = 0; i < 5; i += 1) {
      const a = new Arbeiter(t[BILD.drucker]!, t[stapelBild(index)]!);
      this.arbeiter.push(a);
      this.gebaut.addChild(a.koerper);
    }

    const wand = bretterwand(BREITE - SCHACHT.x - SCHACHT.b - 10, ETAGE_HOEHE - BALKEN - 8);
    wand.position.set(SCHACHT.x + SCHACHT.b + 6, e.reihe.y + 4);
    const sch = schloss(26);
    sch.position.set(BREITE / 2 + 20, e.reihe.y + 52);
    this.gesperrt.addChild(wand, sch);
  }

  zeige(stand: ManufakturStand, jetzt: number, rest: number): void {
    const p = stand.pressen[this.index];
    this.gebaut.visible = !!p;
    this.gesperrt.visible = !p && this.index === stand.pressen.length;
    if (!p) return;
    const e = etage(this.index);

    const { anzahl } = kistenStapel(p, this.index, stand.manufaktur);
    this.stapel.forEach((s, i) => (s.visible = i < anzahl));
    this.presse.texture = this.t[presseBild(p.stufe)]!;

    const zahl = arbeiter(p.stufe);
    const kisteX = e.kiste.x + e.kiste.b + 12;
    const presseX = e.presse.x + 6;
    this.arbeiter.forEach((a, k) => {
      a.koerper.visible = k < zahl;
      if (k >= zahl) return;
      // Die Kolonne laeuft leicht versetzt, aber nie spaeter als der Zyklus:
      // Der erste legt genau dann ab, wenn der Warenwert in der Kiste landet.
      const vorlauf = { ...p, fortschritt: p.laeuft ? Math.min(0.9999, p.fortschritt + k * 0.02) : 0 };
      const ph = pressenPhase(vorlauf, jetzt, rest);
      const ort = arbeiterOrt(ph.phase, ph.anteil);
      const x = kisteX + k * 9 + (presseX - kisteX - k * 23) * ort;
      a.zeige(x, e.boden, ph.phase === 'schlafen', traegtStapel(ph.phase), ph.phase === 'zurueck');
    });
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
  private readonly traeger: Arbeiter;
  private readonly wand: TilingSprite;
  private bandWeg = 0;
  private letzteEtagen = -1;
  private sichtbarkeit = (): void => {
    if (document.hidden) this.app.ticker.stop();
    else this.app.ticker.start();
  };

  private constructor(
    private readonly app: Application,
    private readonly t: Record<string, Texture>,
    private readonly quelle: Quelle,
    private readonly ausschnitt: () => Ausschnitt,
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
    const tablett = new Graphics().roundRect(-20, -4, 40, 8, 2).fill(FARBE.holzHell);
    this.kabinenLadung = new Sprite(t[stapelBild(0)]);
    this.kabinenLadung.anchor.set(0.5, 1);
    this.kabinenLadung.scale.set(26 / 256);
    this.kabinenLadung.position.set(0, -3);
    this.kabine.addChild(tablett, this.kabinenLadung);
    this.kabine.position.set(SCHACHT.x + SCHACHT.b / 2, 0);

    const h = halle();
    const kopf = kopfstueck(h.kopf.b, h.kopf.h);
    kopf.position.set(h.kopf.x, h.kopf.y);
    this.antrieb = rad(16);
    this.antrieb.position.set(h.kopf.x + h.kopf.b / 2, h.kopf.y + 26);

    this.fuss = fussstueck(SCHACHT.b, FUSS_HOEHE - 12);

    const tisch = new Sprite(t[BILD.lager]);
    tisch.width = h.packtisch.b;
    tisch.height = h.packtisch.b;
    tisch.position.set(h.packtisch.x, h.boden - h.packtisch.b * (500 / 512));
    for (let i = 0; i < 8; i += 1) {
      const k = karton(16, 12);
      // Ein kleiner Stapel auf der Tischplatte, von links nach rechts und dann hoch.
      k.position.set(h.packtisch.x + 30 + (i % 4) * 17, h.boden - 52 - Math.floor(i / 4) * 12);
      this.kartons.push(k);
    }

    this.wagen = new Sprite(t[BILD.versand]);
    this.wagen.anchor.set(0, 371 / 384);
    this.wagen.scale.set(h.wagen.b / 640);
    this.traeger = new Arbeiter(t[BILD.drucker]!, t[stapelBild(0)]!);

    this.welt.addChild(halleBild, this.wand, this.roehre, this.band, this.fuss);
    for (let i = 0; i < MAX_PRESSEN; i += 1) {
      const e = new EtageBild(i, t);
      this.etagen.push(e);
      this.welt.addChild(e.wurzel);
    }
    this.welt.addChild(tisch, ...this.kartons, this.traeger.koerper, this.wagen, kopf, this.antrieb, this.kabine);

    app.ticker.maxFPS = 60;
    app.ticker.add(() => this.bild());
    document.addEventListener('visibilitychange', this.sichtbarkeit);
  }

  /** Baut die Szene in `host`. null, wenn das Geraet kein WebGL kann (dann bleibt das DOM). */
  static async erstelle(host: HTMLElement, quelle: Quelle, ausschnitt: () => Ausschnitt): Promise<Szene | null> {
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
    const szene = new Szene(app, texturen, quelle, ausschnitt);
    return szene;
  }

  groesse(breite: number, hoehe: number): void {
    this.app.renderer.resize(breite, hoehe);
  }

  zerstoere(): void {
    document.removeEventListener('visibilitychange', this.sichtbarkeit);
    this.app.destroy(true, { children: true });
  }

  /** Ein Bild: Stand lesen, alles an seinen Platz. */
  private bild(): void {
    const stand = this.quelle.stand();
    if (!stand) return;
    const jetzt = this.quelle.jetzt();
    const rest = Math.max(0, jetzt - stand.zeit);
    const { oben, hoehe, breite } = this.ausschnitt();
    const faktor = breite / BREITE;
    this.welt.scale.set(faktor);
    this.welt.y = -oben;

    const anzahl = stand.pressen.length;
    if (anzahl !== this.letzteEtagen) this.bauKeller(anzahl);

    // Nur zeichnen, was im Ausschnitt liegt (mit einer Etage Luft).
    const von = oben / faktor - ETAGE_HOEHE;
    const bis = (oben + hoehe) / faktor + ETAGE_HOEHE;
    this.etagen.forEach((e, i) => {
      const y = etage(i).reihe.y;
      const sichtbar = y + ETAGE_HOEHE > von && y < bis;
      e.wurzel.visible = sichtbar;
      if (sichtbar) e.zeige(stand, jetzt, rest);
    });

    this.zeigePaternoster(stand, jetzt, rest);
    this.zeigeVersand(stand, jetzt, rest);
  }

  /** Wand, Roehre und Fussstueck reichen bis unter die tiefste Etage. */
  private bauKeller(anzahl: number): void {
    this.letzteEtagen = anzahl;
    const unten = gesamtHoehe(anzahl);
    this.wand.height = unten - HALLE_HOEHE;
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
  }

  /** Hoehe der Kabine: 0 = oben in der Halle, k = an Etage k, dazwischen gleichmaessig. */
  private kabinenY(k: number, etagen: number): number {
    const oben = halle().boden - 10;
    const an = (e: number): number => (e <= 0 ? oben : haltY(Math.min(e, etagen) - 1));
    const unten = Math.floor(k);
    return an(unten) + (an(unten + 1) - an(unten)) * (k - unten);
  }

  private zeigeVersand(stand: ManufakturStand, jetzt: number, rest: number): void {
    const h = halle();
    const { anzahl } = packtischKartons(stand.packtisch, versandKapazitaet(stand.versand.stufe, stand.manufaktur));
    this.kartons.forEach((k, i) => (k.visible = i < anzahl));

    const wagen = wagenOrt(stand, jetzt, rest);
    this.wagen.x = h.wagen.x + wagen.weg * (BREITE - h.wagen.x + 30);
    this.wagen.y = h.boden;

    const v = stand.versand;
    const laedt = wagen.phase === 'laden';
    const x = laedt ? h.traegerWeg.von + (h.traegerWeg.bis - h.traegerWeg.von) * wagen.anteil : h.traegerWeg.von;
    const schlaeft = !v.meister && !v.laeuft;
    this.traeger.zeige(x, h.boden, schlaeft, laedt, false);
  }
}
