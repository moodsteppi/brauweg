/**
 * Das Cut-out-Rig der Pinguine (Lieferung 23.10.2026, outputs/rig/, Pakete 1,
 * 2 und 7): Einzelteile an Ankerpunkten, Kleidung und Kosmetik als
 * Slot-Belegung. Es wird nie ein Bild je Outfit gemalt — ein Drucker ist der
 * Basis-Pinguin mit Lederschuerze und Schiebermuetze, der Direktor derselbe
 * Pinguin mit dem, was der Spieler im Hub traegt.
 *
 * Die Daten stehen als JSON neben dem Code (rig-daten/) und kommen mit dem
 * Bau — nichts wird zur Laufzeit nachgeladen, also gibt es keine 404. Alle
 * Koordinaten sind Pixel in den gelieferten Bildern; die Bilder selbst liegen
 * als WebP unter public/manufaktur/rig/ (Dateinamen wie im JSON, .png → .webp).
 *
 * Montage laut LIESMICH der Pakete:
 * - Ersatzkoerper am unveraenderten Ursprung; `begleiter` nennt die Flossen,
 *   die zu einem Oberteil gehoeren (Aermel).
 * - Kopf: Drehpunkt auf `kopf_oben`, erst skalieren, dann neigen.
 * - Augen: Drehpunkt auf `augen_mitte` plus `versatz`.
 * - Hand: Drehpunkt des Gegenstands auf den mit der Vorderflosse
 *   mitbewegten `griffpunkt_flosse_vorn`; der Gegenstand bleibt aufrecht,
 *   die Vorderflosse liegt darueber.
 * - Fuss: derselbe Schuh fuer beide Fuesse, der hintere 15 % dunkler.
 * - Aura: ein kleines Partikel, das die Szene um die Figur verteilt.
 */

import kleidungDaten from './rig-daten/kleidung.json';
import rigDaten from './rig-daten/rig-pinguin.json';

/** Ein- und ausschaltbar: Ohne Rig faellt die Szene auf die Einzelbilder zurueck. */
export const RIG_VORHANDEN = true;
export const RIG_ORDNER = '/manufaktur/rig';

export type Punkt = [number, number];
export type Slot = 'koerper' | 'kopf' | 'augen' | 'hand' | 'fuss' | 'aura' | 'flosse_vorn' | 'flosse_hinten';

export interface RigTeil {
  datei: string;
  drehpunkt: Punkt;
  an: string | null;
  abdunkeln?: number;
  sichtbar?: boolean;
  skala?: Punkt;
}

export interface RigPinguin {
  canvas: Punkt;
  boden: Punkt;
  anker: Record<string, Punkt>;
  teile: Record<string, RigTeil>;
  reihenfolge: string[];
  griffpunkt_flosse_vorn: Punkt;
}

export interface Kleidungsteil {
  slot: Slot;
  datei: string;
  drehpunkt?: Punkt;
  skala?: Punkt;
  neigung_grad?: number;
  versatz?: Punkt;
  begleiter?: string[];
}

export const RIG = rigDaten as unknown as RigPinguin;
export const KLEIDUNG = kleidungDaten as unknown as {
  teile: Record<string, Kleidungsteil>;
  berufe: Record<'drucker' | 'traeger' | 'meister', string[]>;
};

/** Hoehe der Figur im Rig-Canvas: vom Scheitel (kopf_oben) bis zum Boden. */
export const FIGUR_HOEHE_PX = RIG.boden[1] - RIG.anker.kopf_oben![1];

export function rigDatei(datei: string): string {
  return `${RIG_ORDNER}/${datei.replace(/\.png$/, '.webp')}`;
}

/** Eine Ausstattung: je Slot die Kennung eines Kleidungsteils (kleidung.json). */
export type Ausstattung = Partial<Record<Slot, string>>;

/** Ordnet Kennungen ihren Slots zu; ein Oberteil bringt seine Aermel mit. */
export function ausstattungAus(kennungen: readonly (string | undefined)[]): Ausstattung {
  const aus: Ausstattung = {};
  for (const id of kennungen) {
    if (!id) continue;
    const teil = KLEIDUNG.teile[id];
    if (!teil) continue;
    aus[teil.slot] = id;
    for (const b of teil.begleiter ?? []) {
      const begleiter = KLEIDUNG.teile[b];
      if (begleiter) aus[begleiter.slot] = b;
    }
  }
  return aus;
}

export type Beruf = 'drucker' | 'traeger' | 'meister';

/** Berufskleidung laut kleidung.json (ohne die Requisite — die traegt die Szene). */
export function berufsAusstattung(beruf: Beruf): Ausstattung {
  return ausstattungAus(KLEIDUNG.berufe[beruf]);
}

/** Alle Bilddateien, die Rig, Berufe und Kosmetik brauchen koennen. */
export function rigDateien(): string[] {
  const dateien = new Set<string>();
  for (const t of Object.values(RIG.teile)) dateien.add(rigDatei(t.datei));
  for (const t of Object.values(KLEIDUNG.teile)) dateien.add(rigDatei(t.datei));
  return [...dateien];
}
