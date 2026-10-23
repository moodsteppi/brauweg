/**
 * Die Presse aus Einzelteilen (Lieferung 23.10.2026, Paket 3,
 * rig-daten/maschinen.json): Korpus, Querhebel, bei der Gusseisenpresse das
 * Schwungrad, bei der Dampfpresse der Manometerzeiger.
 *
 * Montage laut LIESMICH: Teildrehpunkt auf `position` im Korpus-Canvas; der
 * Hebel „schwingt" ueber eine waagrechte Stauchung um seinen Drehpunkt
 * (Drehung um die Hochachse), das Rad dreht sich in einem eigenen Halter,
 * den der Eltern-Halter auf die Ellipse staucht und neigt, der Zeiger
 * zittert. Gezeichnet wird in Canvas-Pixeln, der Ursprung liegt auf der
 * Bodenlinie (Zeile 450) in der Mitte.
 */

import { Container, Sprite, type Texture } from 'pixi.js';

import maschinenDaten from './rig-daten/maschinen.json';
import { type Punkt, rigDatei } from './rig';

interface Teil {
  datei: string;
  drehpunkt: Punkt;
  position: Punkt;
  bewegung: 'schwingen_x' | 'drehen' | 'zittern';
  ellipse?: { skala_x: number; skala_y: number; neigung_grad: number };
}

interface Maschine {
  korpus: string;
  teile: Record<string, Teil>;
  punkte: { ausgabe: Punkt; bedienposition: Punkt; dampf_austritt: Punkt | null };
  reihenfolge: string[];
}

const MASCHINEN = maschinenDaten as unknown as Record<'presse-1' | 'presse-2' | 'presse-3', Maschine>;
const URSPRUNG: Punkt = [256, 450];
const SCHLAG_MS = 120;

export function maschinenDateien(): string[] {
  const dateien: string[] = [];
  // Nur die drei Pressen — das JSON traegt daneben ein Feld `version`.
  for (const m of [MASCHINEN['presse-1'], MASCHINEN['presse-2'], MASCHINEN['presse-3']]) {
    dateien.push(rigDatei(m.korpus));
    for (const t of Object.values(m.teile)) dateien.push(rigDatei(t.datei));
  }
  return dateien;
}

export class PresseBild {
  /** Ursprung: Mitte der Bodenlinie, in Welt-Einheiten. */
  readonly wurzel = new Container();
  private readonly koerper = new Container();
  private fassung = 0;
  private griff: Sprite | null = null;
  private rad: Sprite | null = null;
  private zeiger: Sprite | null = null;
  private schlag = 0;
  private zeit = 0;
  private daten: Maschine = MASCHINEN['presse-1'];

  constructor(
    private readonly t: Record<string, Texture>,
    private readonly massstab: number,
  ) {
    this.koerper.scale.set(massstab);
    this.wurzel.addChild(this.koerper);
  }

  /** Holzpresse, Gusseisen, Dampf — nur neu aufbauen, wenn sich die Fassung aendert. */
  setzeFassung(fassung: 1 | 2 | 3): void {
    if (fassung === this.fassung) return;
    this.fassung = fassung;
    this.daten = MASCHINEN[`presse-${fassung}`];
    const innen = new Container();
    innen.position.set(-URSPRUNG[0], -URSPRUNG[1]);
    this.griff = this.rad = this.zeiger = null;
    for (const name of this.daten.reihenfolge) {
      if (name === 'korpus') {
        innen.addChild(new Sprite(this.t[rigDatei(this.daten.korpus)]));
        continue;
      }
      const teil = this.daten.teile[name];
      if (!teil) continue;
      const s = new Sprite(this.t[rigDatei(teil.datei)]);
      s.anchor.set(teil.drehpunkt[0] / s.texture.width, teil.drehpunkt[1] / s.texture.height);
      if (teil.bewegung === 'drehen' && teil.ellipse) {
        // Rad: im eigenen Halter drehen, der Halter staucht auf die Ellipse und neigt.
        const halter = new Container();
        halter.position.set(teil.position[0], teil.position[1]);
        halter.scale.set(teil.ellipse.skala_x, teil.ellipse.skala_y);
        halter.rotation = (teil.ellipse.neigung_grad * Math.PI) / 180;
        halter.addChild(s);
        innen.addChild(halter);
        this.rad = s;
        continue;
      }
      s.position.set(teil.position[0], teil.position[1]);
      innen.addChild(s);
      if (teil.bewegung === 'schwingen_x') this.griff = s;
      if (teil.bewegung === 'zittern') this.zeiger = s;
    }
    this.koerper.removeChildren().forEach((c) => c.destroy());
    this.koerper.addChild(innen);
  }

  /** Ein Pressenschlag: der Korpus federt, der Hebel schwingt. */
  schlage(): void {
    this.schlag = SCHLAG_MS;
  }

  aktualisiere(dt: number, arbeitet: boolean, tempo: number): void {
    this.zeit += dt;
    this.schlag = Math.max(0, this.schlag - dt);
    const f = this.schlag / SCHLAG_MS;
    // Squash beim Schlag: 0,94 hoch / 1,04 breit, 120 ms.
    this.koerper.scale.set(this.massstab * (1 + 0.04 * f), this.massstab * (1 - 0.06 * f));
    if (this.griff) this.griff.scale.x = 1 - 0.45 * Math.sin(f * Math.PI);
    if (this.rad && arbeitet) this.rad.rotation += (dt / 1000) * 3 * tempo;
    if (this.zeiger) {
      this.zeiger.rotation = arbeitet ? Math.sin(this.zeit / 35) * 0.12 + (Math.random() - 0.5) * 0.05 : 0;
    }
  }

  private welt(p: Punkt): { x: number; y: number } {
    return {
      x: this.wurzel.x + (p[0] - URSPRUNG[0]) * this.massstab,
      y: this.wurzel.y + (p[1] - URSPRUNG[1]) * this.massstab,
    };
  }

  /** Wo der Dampf austritt (nur die Dampfpresse) — in Welt-Koordinaten. */
  dampfPunkt(): { x: number; y: number } | null {
    return this.daten.punkte.dampf_austritt ? this.welt(this.daten.punkte.dampf_austritt) : null;
  }

  /** Wo der fertige Bogen die Presse verlaesst. */
  ausgabePunkt(): { x: number; y: number } {
    return this.welt(this.daten.punkte.ausgabe);
  }

  /** Wo der Pinguin beim Bedienen steht (Fuss-Stellpunkt). */
  bedienPunkt(): { x: number; y: number } {
    return this.welt(this.daten.punkte.bedienposition);
  }
}
