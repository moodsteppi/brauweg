/**
 * Das Cut-out-Rig der Pinguine: Einzelteile an Ankerpunkten, Kleidung als
 * Slot-Belegung. Formate laut Auftrag (outputs/rig/json/):
 *
 *   rig-pinguin.json  canvas, boden, anker, teile, reihenfolge,
 *                     griffpunkt_flosse_vorn
 *   kleidung.json     teile (slot, datei, drehpunkt?), berufe
 *
 * Alle Koordinaten sind Pixel in den gelieferten Bildern. Berufskleidung und
 * Kosmetik sind nur Slot-Belegungen — es wird nie ein Bild je Outfit gemalt.
 *
 * Solange `RIG_VORHANDEN` falsch ist, laedt hier niemand etwas: Eine Anfrage
 * auf eine Datei, die es nicht gibt, waere ein 404 je Pinguin (CLAUDE.md:
 * „Kein <img> auf eine Datei, die es noch nicht gibt"). Kommt die Lieferung,
 * legt man die WebP und JSON unter public/manufaktur/rig/ ab und stellt den
 * Schalter um — die Ablaeufe (clips.ts) bleiben dieselben.
 */

import { Container, Sprite, type Texture } from 'pixi.js';

export const RIG_VORHANDEN = false;
export const RIG_ORDNER = '/manufaktur/rig';

export type Punkt = { x: number; y: number } | [number, number];

export type Slot = 'koerper' | 'flosse_vorn' | 'flosse_hinten' | 'fuss_vorn' | 'fuss_hinten' | 'kopf' | 'augen' | 'hand' | 'aura';

export interface RigTeil {
  datei: string;
  drehpunkt: Punkt;
  /** Name eines Ankers im Koerper-Canvas. */
  an: string;
  /** 0 … 1: hintere Teile etwas dunkler, damit sie hinten wirken. */
  abdunkeln?: number;
  sichtbar?: boolean;
}

export interface RigPinguin {
  canvas: Punkt;
  boden: Punkt;
  anker: Record<string, Punkt>;
  teile: Record<string, RigTeil>;
  reihenfolge: string[];
  griffpunkt_flosse_vorn?: Punkt;
}

export interface Kleidung {
  teile: Record<string, { slot: Slot; datei: string; drehpunkt?: Punkt }>;
  berufe: Record<'drucker' | 'traeger' | 'meister', string[]>;
}

export function punkt(p: Punkt): { x: number; y: number } {
  return Array.isArray(p) ? { x: p[0], y: p[1] } : p;
}

/** Welchem Slot ein Rig-Teil gehoert — nach seinem Namen (`flosse_vorn` usw.). */
function slotVon(name: string): Slot | null {
  const slots: Slot[] = ['flosse_vorn', 'flosse_hinten', 'fuss_vorn', 'fuss_hinten', 'kopf', 'augen', 'hand', 'aura', 'koerper'];
  return slots.find((s) => name === s || name.startsWith(`${s}_`)) ?? null;
}

/**
 * Baut einen Pinguin aus dem Rig: je Teil ein Sprite mit seinem Drehpunkt am
 * Anker. Kleidung ersetzt Teile ihres Slots (`koerper` den ganzen Koerper)
 * oder kommt darueber. Der Ursprung ist der Fusspunkt (`boden`).
 */
export function baueRig(
  rig: RigPinguin,
  kleidung: Kleidung | null,
  beruf: keyof Kleidung['berufe'] | null,
  texturen: Record<string, Texture>,
): { wurzel: Container; teile: Map<string, Container>; griff: { x: number; y: number } } {
  const wurzel = new Container();
  const teile = new Map<string, Container>();
  const boden = punkt(rig.boden);
  const belegt = new Map<Slot, { datei: string; drehpunkt?: Punkt }>();
  if (kleidung && beruf) {
    for (const id of kleidung.berufe[beruf] ?? []) {
      const stueck = kleidung.teile[id];
      if (stueck) belegt.set(stueck.slot, stueck);
    }
  }

  for (const name of rig.reihenfolge) {
    const teil = rig.teile[name];
    if (!teil || teil.sichtbar === false) continue;
    const slot = slotVon(name);
    const ersatz = slot ? belegt.get(slot) : undefined;
    const datei = slot === 'koerper' && ersatz ? ersatz.datei : teil.datei;
    const textur = texturen[`${RIG_ORDNER}/${datei}`];
    if (!textur) continue;
    const halter = new Container();
    const bild = new Sprite(textur);
    const dreh = punkt(ersatz?.drehpunkt && slot === 'koerper' ? ersatz.drehpunkt : teil.drehpunkt);
    bild.anchor.set(dreh.x / textur.width, dreh.y / textur.height);
    if (teil.abdunkeln) {
      const g = Math.round(255 * (1 - teil.abdunkeln));
      bild.tint = (g << 16) | (g << 8) | g;
    }
    halter.addChild(bild);
    // Kleidung ueber dem Teil (ausser koerper, der ersetzt wird): an denselben Drehpunkt.
    if (ersatz && slot !== 'koerper') {
      const t2 = texturen[`${RIG_ORDNER}/${ersatz.datei}`];
      if (t2) {
        const ueber = new Sprite(t2);
        const d2 = punkt(ersatz.drehpunkt ?? teil.drehpunkt);
        ueber.anchor.set(d2.x / t2.width, d2.y / t2.height);
        halter.addChild(ueber);
      }
    }
    const anker = punkt(rig.anker[teil.an] ?? rig.boden);
    halter.position.set(anker.x - boden.x, anker.y - boden.y);
    teile.set(name, halter);
    wurzel.addChild(halter);
  }
  const griff = punkt(rig.griffpunkt_flosse_vorn ?? rig.boden);
  return { wurzel, teile, griff: { x: griff.x - boden.x, y: griff.y - boden.y } };
}
