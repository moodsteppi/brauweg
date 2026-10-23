/**
 * Eine Figur in der Manufaktur: spielt Ablaeufe (clips.ts) ab, blendet
 * dazwischen weich ueber und blinzelt zufaellig alle 2 bis 5 Sekunden.
 *
 * Zwei Bauweisen hinter derselben Schnittstelle (`Figur`):
 * - **Rig** (seit der Lieferung vom 23.10.2026): Einzelteile an Ankern, die
 *   Ablaeufe bewegen Flossen, Fuesse und Lider einzeln (rig.ts).
 * - **Einzelbild** als Rueckfall: der ganze Pinguin als ein Teil, Bewegung nur
 *   aus Drehen, Huepfen und Stauchen.
 * Die Szene ruft nur `spiele`, `traegt`, `schaue` und `aktualisiere` — was
 * darunter steckt, sieht sie nicht.
 */

import { Container, Sprite, type Texture } from 'pixi.js';

import { CLIPS, type ClipName, type Pose, RUHE, UEBERBLENDUNG_MS, mische, poseBei } from './clips';
import { type Ausstattung, FIGUR_HOEHE_PX, KLEIDUNG, type Punkt, RIG, rigDatei } from './rig';

export interface Figur {
  /** Position = Fusspunkt in der Welt. */
  readonly wurzel: Container;
  spiele(name: ClipName, tempo?: number): void;
  aktuell(): ClipName;
  /** Was die Figur in der Vorderflosse haelt (null: nichts). */
  traegt(textur: Texture | null): void;
  /** Blickrichtung: 1 wie gemalt, -1 gespiegelt. */
  schaue(richtung: 1 | -1): void;
  aktualisiere(dt: number): void;
  /** Debug: Dreh- und Ankerpunkte in den Koordinaten der Wurzel. */
  punkte(): { x: number; y: number }[];
}

/** Takt der Ablaeufe, Ueberblendung, Blinzeln — fuer beide Bauweisen gleich. */
class Ablauf {
  private clip: ClipName = 'idle';
  private zeit = 0;
  private tempo = 1;
  private von: Pose = RUHE;
  private blende = 1;
  private blinzelIn = 2000 + Math.random() * 3000;
  private blinzelt = 0;

  spiele(name: ClipName, tempo = 1): void {
    this.tempo = tempo;
    if (name === this.clip) return;
    this.von = this.pose();
    this.blende = 0;
    this.clip = name;
    this.zeit = 0;
  }

  aktuell(): ClipName {
    return this.clip;
  }

  pose(): Pose {
    const clip = CLIPS[this.clip];
    const ziel = poseBei(clip, this.zeit / clip.dauer);
    const p = this.blende >= 1 ? ziel : mische(this.von, ziel, this.blende);
    return this.blinzelt > 0 ? { ...p, lid: 1 } : p;
  }

  weiter(dt: number): void {
    this.zeit += dt * this.tempo;
    if (this.blende < 1) this.blende = Math.min(1, this.blende + dt / UEBERBLENDUNG_MS);
    this.blinzelt = Math.max(0, this.blinzelt - dt);
    this.blinzelIn -= dt;
    if (this.blinzelIn <= 0) {
      this.blinzelIn = 2000 + Math.random() * 3000;
      this.blinzelt = 120;
    }
  }
}

const GRAD = Math.PI / 180;

function setzeAnker(sprite: Sprite, drehpunkt: Punkt): void {
  sprite.anchor.set(drehpunkt[0] / sprite.texture.width, drehpunkt[1] / sprite.texture.height);
}

/** Masse eines Einzelbilds: wie hoch die Figur darin ist (px) und wo die Fuesse stehen (Anteil). */
export interface Bildmasse {
  figur: number;
  fuss: number;
}

/** Drucker und Meister: 384 Pixel, die Fuesse stehen auf Zeile 371. */
export const MANUFAKTUR_PINGUIN: Bildmasse = { figur: 384, fuss: 371 / 384 };
/** Der nackte Basis-Pinguin (hub/pinguin): 480 × 512, Figur von Zeile 50 bis 497. */
export const BASIS_PINGUIN: Bildmasse = { figur: 500, fuss: 497 / 512 };

/** Rueckfall ohne Rig: der ganze Pinguin als ein Teil. */
export class EinzelFigur implements Figur {
  readonly wurzel = new Container();
  private readonly koerper = new Container();
  private readonly last: Sprite;
  private readonly ablauf = new Ablauf();
  private richtung = 1;

  constructor(textur: Texture, hoehe: number, lastTextur: Texture, lastGroesse = 22, masse: Bildmasse = MANUFAKTUR_PINGUIN) {
    const bild = new Sprite(textur);
    bild.anchor.set(0.5, masse.fuss);
    bild.scale.set(hoehe / masse.figur);
    this.koerper.addChild(bild);
    this.last = new Sprite(lastTextur);
    this.last.anchor.set(0.5, 1);
    this.last.scale.set(lastGroesse / lastTextur.width);
    this.last.position.set(hoehe * 0.24, -hoehe * 0.3);
    this.last.visible = false;
    this.koerper.addChild(this.last);
    this.wurzel.addChild(this.koerper);
  }

  spiele(name: ClipName, tempo = 1): void {
    this.ablauf.spiele(name, tempo);
  }
  aktuell(): ClipName {
    return this.ablauf.aktuell();
  }
  traegt(textur: Texture | null): void {
    this.last.visible = !!textur;
    if (textur && this.last.texture !== textur) this.last.texture = textur;
  }
  schaue(richtung: 1 | -1): void {
    this.richtung = richtung;
  }
  aktualisiere(dt: number): void {
    this.ablauf.weiter(dt);
    const p = this.ablauf.pose();
    this.koerper.rotation = p.dreh * GRAD;
    this.koerper.y = -p.hoch;
    this.koerper.scale.set(p.breit * this.richtung, p.hochS);
  }
  punkte(): { x: number; y: number }[] {
    return [
      { x: 0, y: 0 },
      { x: this.last.x * this.richtung, y: this.last.y },
    ];
  }
}

/**
 * Der Pinguin aus Einzelteilen. Aufbau (hinten nach vorn): Aura, hinterer
 * Fuss, Rumpf (Hinterflosse, Koerper, Lider, Brille, Kopfschmuck), vorderer
 * Fuss, Vordergruppe (gehaltener Gegenstand, Vorderflosse). Rumpf und
 * Vordergruppe bekommen dieselbe Haltung, damit die Vorderflosse am Koerper
 * bleibt, obwohl sie ueber dem vorderen Fuss liegt.
 */
export class RigFigur implements Figur {
  readonly wurzel = new Container();
  private readonly gestalt = new Container();
  private readonly rumpf = new Container();
  private readonly vorn = new Container();
  private readonly flosseVorn = new Container();
  private readonly flosseHinten = new Container();
  private readonly fussVorn = new Container();
  private readonly fussHinten = new Container();
  private readonly lider: Sprite | null = null;
  private readonly gegenstand = new Sprite();
  private readonly gegenstandHalter = new Container();
  private readonly aura: Sprite[] = [];
  private readonly ablauf = new Ablauf();
  private readonly massstab: number;
  private richtung = 1;
  private auraZeit = Math.random() * 10_000;
  /** Requisite des Berufs (Klemmbrett) — liegt in der Flosse, wenn sonst nichts getragen wird. */
  private readonly eigeneRequisite: Texture | null;
  private readonly lastGroessePx: number;

  constructor(
    private readonly t: Record<string, Texture>,
    hoehe: number,
    ausstattung: Ausstattung,
    lastGroesse = 22,
  ) {
    this.massstab = hoehe / FIGUR_HOEHE_PX;
    this.lastGroessePx = lastGroesse / this.massstab;
    const [bx, by] = RIG.boden;
    // Alles in Canvas-Pixeln, der Boden liegt im Ursprung der Gestalt.
    this.gestalt.position.set(0, 0);
    this.gestalt.scale.set(this.massstab);
    this.wurzel.addChild(this.gestalt);

    const textur = (datei: string): Texture | undefined => this.t[rigDatei(datei)];
    const teil = (name: string) => RIG.teile[name]!;
    const anker = (name: string | null): Punkt => (name ? RIG.anker[name]! : RIG.boden);
    const rel = (p: Punkt): [number, number] => [p[0] - bx, p[1] - by];
    const kleid = (slot: keyof Ausstattung) => {
      const id = ausstattung[slot];
      return id ? KLEIDUNG.teile[id] : undefined;
    };

    // Aura: ein paar kleine Partikel um die Figur (die Szene bewegt sie hier selbst).
    const aura = kleid('aura');
    if (aura) {
      const at = textur(aura.datei);
      for (let i = 0; i < 4 && at; i += 1) {
        const s = new Sprite(at);
        s.anchor.set(0.5);
        this.aura.push(s);
        this.gestalt.addChild(s);
      }
    }

    // Fuesse: der Schuh ersetzt den Fuss, der hintere bleibt 15 % dunkler.
    const schuh = kleid('fuss');
    const baueFuss = (halter: Container, name: 'fuss_hinten' | 'fuss_vorn'): void => {
      const tl = teil(name);
      const s = new Sprite(textur(schuh?.datei ?? tl.datei));
      setzeAnker(s, schuh?.drehpunkt ?? tl.drehpunkt);
      if (tl.abdunkeln) {
        const g = Math.round(255 * (1 - tl.abdunkeln));
        s.tint = (g << 16) | (g << 8) | g;
      }
      halter.addChild(s);
      halter.position.set(...rel(anker(tl.an)));
    };
    baueFuss(this.fussHinten, 'fuss_hinten');
    this.gestalt.addChild(this.fussHinten);

    // Rumpf: Hinterflosse (ggf. Aermel), Koerper (ggf. Ersatzkoerper), Lider, Brille, Kopfschmuck.
    const fh = teil('flosse_hinten');
    const aermelHinten = kleid('flosse_hinten');
    const fhs = new Sprite(textur(aermelHinten?.datei ?? fh.datei));
    setzeAnker(fhs, aermelHinten?.drehpunkt ?? fh.drehpunkt);
    this.flosseHinten.addChild(fhs);
    this.flosseHinten.position.set(...rel(anker(fh.an)));
    this.rumpf.addChild(this.flosseHinten);

    const kt = teil('koerper');
    const ersatz = kleid('koerper');
    const ks = new Sprite(textur(ersatz?.datei ?? kt.datei));
    setzeAnker(ks, kt.drehpunkt);
    this.rumpf.addChild(ks);

    const lt = teil('lider');
    const lidTextur = textur(lt.datei);
    if (lidTextur) {
      const ls = new Sprite(lidTextur);
      setzeAnker(ls, lt.drehpunkt);
      ls.position.set(...rel(anker(lt.an)));
      if (lt.skala) ls.scale.set(lt.skala[0], lt.skala[1]);
      ls.visible = false;
      this.rumpf.addChild(ls);
      this.lider = ls;
    }

    const montiere = (k: ReturnType<typeof kleid>, ankerName: string): void => {
      if (!k) return;
      const s = new Sprite(textur(k.datei));
      setzeAnker(s, k.drehpunkt ?? [s.texture.width / 2, s.texture.height / 2]);
      if (k.skala) s.scale.set(k.skala[0], k.skala[1]);
      if (k.neigung_grad) s.rotation = k.neigung_grad * GRAD;
      const [ax, ay] = rel(anker(ankerName));
      s.position.set(ax + (k.versatz?.[0] ?? 0), ay + (k.versatz?.[1] ?? 0));
      this.rumpf.addChild(s);
    };
    // Die Brille liegt unter dem Hut, damit ein breiter Hutrand darueber faellt (wie im Hub).
    montiere(kleid('augen'), 'augen_mitte');
    montiere(kleid('kopf'), 'kopf_oben');
    this.gestalt.addChild(this.rumpf);

    baueFuss(this.fussVorn, 'fuss_vorn');
    this.gestalt.addChild(this.fussVorn);

    // Vordergruppe: Gegenstand am Griffpunkt, darueber die Vorderflosse.
    const fv = teil('flosse_vorn');
    const aermelVorn = kleid('flosse_vorn');
    const fvs = new Sprite(textur(aermelVorn?.datei ?? fv.datei));
    setzeAnker(fvs, aermelVorn?.drehpunkt ?? fv.drehpunkt);
    const [gx, gy] = RIG.griffpunkt_flosse_vorn;
    this.gegenstandHalter.position.set(gx - fv.drehpunkt[0], gy - fv.drehpunkt[1]);
    this.gegenstandHalter.addChild(this.gegenstand);
    this.gegenstand.visible = false;
    this.flosseVorn.addChild(this.gegenstandHalter, fvs);
    this.flosseVorn.position.set(...rel(anker(fv.an)));
    this.vorn.addChild(this.flosseVorn);
    this.gestalt.addChild(this.vorn);

    const hand = kleid('hand');
    this.eigeneRequisite = hand ? (textur(hand.datei) ?? null) : null;
    this.handDrehpunkt = hand?.drehpunkt ?? null;
    this.handSkala = hand?.skala ?? null;
    this.traegt(null);
  }

  private readonly handDrehpunkt: Punkt | null;
  private readonly handSkala: Punkt | null;

  spiele(name: ClipName, tempo = 1): void {
    this.ablauf.spiele(name, tempo);
  }
  aktuell(): ClipName {
    return this.ablauf.aktuell();
  }

  /**
   * Was die Figur in der Vorderflosse haelt. Getragene Ware (Stapel, Paket)
   * geht vor die eigene Requisite; ohne Last haelt der Meister sein
   * Klemmbrett, der Direktor seinen Kosmetik-Gegenstand.
   */
  traegt(textur: Texture | null): void {
    const s = this.gegenstand;
    const anzeige = textur ?? this.eigeneRequisite;
    s.visible = !!anzeige;
    if (!anzeige) return;
    if (s.texture !== anzeige) s.texture = anzeige;
    if (textur) {
      // Ware: unten mittig greifen, Groesse aus der Szene (Welt-Einheiten).
      s.anchor.set(0.5, 0.85);
      s.scale.set(this.lastGroessePx / anzeige.width);
    } else if (this.handDrehpunkt) {
      setzeAnker(s, this.handDrehpunkt);
      s.scale.set(this.handSkala?.[0] ?? 1, this.handSkala?.[1] ?? 1);
    }
  }

  schaue(richtung: 1 | -1): void {
    this.richtung = richtung;
  }

  aktualisiere(dt: number): void {
    this.ablauf.weiter(dt);
    const p = this.ablauf.pose();
    // Haltung von Rumpf und Vordergruppe: um den Boden gedreht, gehoben, gestaucht.
    for (const c of [this.rumpf, this.vorn]) {
      c.rotation = p.dreh * GRAD;
      c.y = -p.hoch / this.massstab;
      c.scale.set(p.breit, p.hochS);
    }
    this.gestalt.scale.set(this.massstab * this.richtung, this.massstab);
    this.flosseVorn.rotation = p.fv * GRAD;
    this.flosseHinten.rotation = p.fh * GRAD;
    this.fussVorn.rotation = p.fuv * GRAD;
    this.fussHinten.rotation = p.fuh * GRAD;
    // Der Gegenstand bleibt aufrecht, die Flosse dreht um ihn herum.
    this.gegenstandHalter.rotation = -p.fv * GRAD - p.dreh * GRAD;
    if (this.lider) this.lider.visible = p.lid > 0.5;

    if (this.aura.length > 0) {
      this.auraZeit += dt;
      this.aura.forEach((s, i) => {
        const w = this.auraZeit / 1400 + (i * Math.PI) / 2;
        s.position.set(Math.cos(w) * 230, -230 + Math.sin(w * 1.3) * 150 - i * 20);
        s.alpha = 0.55 + 0.45 * Math.sin(w * 2);
      });
    }
  }

  punkte(): { x: number; y: number }[] {
    const m = this.massstab * this.richtung;
    const [bx, by] = RIG.boden;
    return [
      { x: 0, y: 0 },
      ...Object.values(RIG.anker).map(([x, y]) => ({ x: (x - bx) * m, y: (y - by) * this.massstab })),
    ];
  }
}
