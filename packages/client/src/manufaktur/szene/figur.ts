/**
 * Eine Figur in der Manufaktur: spielt Ablaeufe (clips.ts) ab, blendet
 * dazwischen weich ueber und blinzelt zufaellig alle 2 bis 5 Sekunden.
 *
 * Gebaut wird sie aus dem Rig, sobald es geliefert ist (rig.ts); bis dahin
 * ist der ganze Pinguin ein Teil (`pinguin-drucker`, `pinguin-meister`), und
 * die Bewegung entsteht aus Drehen, Huepfen und Stauchen. Die Szene ruft
 * nur `spiele`, `traegt` und `aktualisiere` — was darunter steckt, sieht sie
 * nicht.
 */

import { Container, Sprite, type Texture } from 'pixi.js';

import { CLIPS, type ClipName, type Pose, RUHE, UEBERBLENDUNG_MS, mische, poseBei } from './clips';

/** Masse eines Einzelbilds: wie hoch die Figur darin ist (px) und wo die Fuesse stehen (Anteil). */
export interface Bildmasse {
  figur: number;
  fuss: number;
}

/** Drucker und Meister: 384 Pixel, die Fuesse stehen auf Zeile 371. */
export const MANUFAKTUR_PINGUIN: Bildmasse = { figur: 384, fuss: 371 / 384 };
/** Der nackte Basis-Pinguin (hub/pinguin): 480 × 512, Figur von Zeile 50 bis 497. */
export const BASIS_PINGUIN: Bildmasse = { figur: 500, fuss: 497 / 512 };

export class Figur {
  /** Position = Fusspunkt in der Welt. */
  readonly wurzel = new Container();
  private readonly koerper = new Container();
  private readonly bild: Sprite | null;
  private readonly last: Sprite;
  private clip: ClipName = 'idle';
  private zeit = 0;
  private tempo = 1;
  private von: Pose = RUHE;
  private blende = 1;
  private blinzelIn = 2000 + Math.random() * 3000;
  private richtung = 1;

  constructor(textur: Texture, hoehe: number, lastTextur: Texture, lastGroesse = 22, masse: Bildmasse = MANUFAKTUR_PINGUIN) {
    this.bild = new Sprite(textur);
    this.bild.anchor.set(0.5, masse.fuss);
    this.bild.scale.set(hoehe / masse.figur);
    this.koerper.addChild(this.bild);
    this.last = new Sprite(lastTextur);
    this.last.anchor.set(0.5, 1);
    this.last.scale.set(lastGroesse / lastTextur.width);
    // Griffpunkt der vorderen Flosse im Einzelbild — mit dem Rig kommt er aus der Datei.
    this.last.position.set(hoehe * 0.24, -hoehe * 0.3);
    this.last.visible = false;
    this.koerper.addChild(this.last);
    this.wurzel.addChild(this.koerper);
  }

  /** Einen Ablauf spielen; ist es derselbe, laeuft er weiter (nur das Tempo aendert sich). */
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

  traegt(textur: Texture | null): void {
    this.last.visible = !!textur;
    if (textur && this.last.texture !== textur) this.last.texture = textur;
  }

  /** Blickrichtung: 1 nach rechts, -1 nach links. */
  schaue(richtung: 1 | -1): void {
    this.richtung = richtung;
  }

  private pose(): Pose {
    const clip = CLIPS[this.clip];
    const ziel = poseBei(clip, this.zeit / clip.dauer);
    return this.blende >= 1 ? ziel : mische(this.von, ziel, this.blende);
  }

  /** Ein Bild weiter. `dt` in ms, vom Aufrufer schon begrenzt. */
  aktualisiere(dt: number): void {
    this.zeit += dt * this.tempo;
    if (this.blende < 1) this.blende = Math.min(1, this.blende + dt / UEBERBLENDUNG_MS);
    const p = this.pose();
    this.koerper.rotation = (p.dreh * Math.PI) / 180;
    this.koerper.y = -p.hoch;
    this.koerper.scale.set(p.breit * this.richtung, p.hochS);

    // Blinzeln: Mit dem Rig klappt das Lid zu; das Einzelbild hat keins.
    this.blinzelIn -= dt;
    if (this.blinzelIn <= 0) this.blinzelIn = 2000 + Math.random() * 3000;
  }

  /** Fuer die Debug-Ansicht: wo Drehpunkt und Griff liegen (in Welt-Koordinaten der Figur). */
  punkte(): { name: string; x: number; y: number }[] {
    return [
      { name: 'fuss', x: 0, y: 0 },
      { name: 'griff', x: this.last.x * this.richtung, y: this.last.y },
    ];
  }

  get breite(): number {
    return this.bild?.width ?? 0;
  }
}
