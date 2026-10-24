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
const GELIEFERT = kleidungDaten as unknown as {
  teile: Record<string, Kleidungsteil>;
  berufe: Record<'drucker' | 'traeger' | 'meister', string[]>;
};

/**
 * Rang-Kleidung und Baustelle (zweite Lieferung, outputs/rig2/,
 * docs/ASSETS-KARTENMANUFAKTUR-RIG2.md). Drehpunkte wie bei den
 * vergleichbaren Teilen aus Paket 7; die Dateien liegen unter rig2/ —
 * bis zur Lieferung als Platzhalter (werkzeug/manufaktur-platzhalter.mjs).
 */
const RIG2_TEILE: Record<string, Kleidungsteil> = {
  'rang-jung': { slot: 'kopf', datei: 'rig2/muetze-jungmeister.png', drehpunkt: [128, 199] },
  'rang-meister': { slot: 'koerper', datei: 'rig2/koerper-weste-meister.png', begleiter: ['rang-meister-vorn', 'rang-meister-hinten'] },
  'rang-meister-vorn': { slot: 'flosse_vorn', datei: 'rig2/flosse-vorn-weste-meister.png', drehpunkt: [140, 70] },
  'rang-meister-hinten': { slot: 'flosse_hinten', datei: 'rig2/flosse-hinten-weste-meister.png', drehpunkt: [97, 68] },
  'rang-ober': { slot: 'kopf', datei: 'rig2/hut-obermeister.png', drehpunkt: [128, 196] },
  bauhelm: { slot: 'kopf', datei: 'rig2/muetze-bauhelm.png', drehpunkt: [128, 198] },
  schaufel: { slot: 'hand', datei: 'rig2/req-schaufel.png', drehpunkt: [60, 190] },
  hammer: { slot: 'hand', datei: 'rig2/req-hammer.png', drehpunkt: [60, 190] },
};

export const KLEIDUNG = { teile: { ...GELIEFERT.teile, ...RIG2_TEILE }, berufe: GELIEFERT.berufe };

/** Hoehe der Figur im Rig-Canvas: vom Scheitel (kopf_oben) bis zum Boden. */
export const FIGUR_HOEHE_PX = RIG.boden[1] - RIG.anker.kopf_oben![1];

/** Geliefert heisst .png, ausgeliefert .webp. Ein Pfad mit Ordner (`rig2/…`) gilt ab /manufaktur. */
export function rigDatei(datei: string): string {
  const webp = datei.replace(/\.png$/, '.webp');
  return webp.includes('/') ? `/manufaktur/${webp}` : `${RIG_ORDNER}/${webp}`;
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

export type Beruf = 'drucker' | 'traeger' | 'meister' | 'bauarbeiter';

/** Berufskleidung laut kleidung.json (ohne die Requisite — die traegt die Szene). */
export function berufsAusstattung(beruf: Beruf): Ausstattung {
  if (beruf === 'bauarbeiter') return ausstattungAus(['latzhose', 'bauhelm', 'hammer']);
  return ausstattungAus(KLEIDUNG.berufe[beruf]);
}

/**
 * Ein Meister nach Rang: Jungmeister mit Muetze, Meister mit Weste (statt
 * Schuerze), Obermeister mit Zylinder — sonst wie der Berufs-Meister.
 */
export function meisterAusstattung(rang: 'jung' | 'meister' | 'ober' | null): Ausstattung {
  const grund = KLEIDUNG.berufe.meister;
  if (rang === 'jung') return ausstattungAus([...grund, 'rang-jung']);
  if (rang === 'meister') return ausstattungAus([...grund, 'rang-meister']);
  if (rang === 'ober') return ausstattungAus([...grund, 'rang-ober']);
  return ausstattungAus(grund);
}

/** Alle Bilddateien, die Rig, Berufe und Kosmetik brauchen koennen. */
export function rigDateien(): string[] {
  const dateien = new Set<string>();
  for (const t of Object.values(RIG.teile)) dateien.add(rigDatei(t.datei));
  for (const t of Object.values(KLEIDUNG.teile)) dateien.add(rigDatei(t.datei));
  return [...dateien];
}
