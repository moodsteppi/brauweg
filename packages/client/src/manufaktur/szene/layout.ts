/**
 * Wo in der Manufaktur was steht — in Welt-Einheiten bei 390 Breite, der
 * Bildschirm skaliert alles mit `breite / BREITE`.
 *
 * Eine Quelle fuer beides: Die Pixi-Szene zeichnet an diese Stellen, und die
 * DOM-Knoepfe (Schilder, Meister-Plaetze, Tippflaechen) liegen genau darueber.
 * Stuende das zweimal da, laege der Knopf irgendwann neben der Maschine.
 *
 * Von oben nach unten: Versandhalle, dann je Etage eine Reihe, die naechste
 * gesperrte Etage als Bretterwand, unten das Fussstueck des Schachts. Links
 * laeuft der Schacht durch alles hindurch.
 */

export const BREITE = 390;

export interface Rechteck {
  x: number;
  y: number;
  b: number;
  h: number;
}

/** Ausschnitt der Kulisse: Zeile 430 bis 1030 von 1536 — Fenster, Tor, Boden. */
export const KULISSE = { von: 430, bis: 1030, breite: 1024 } as const;
export const HALLE_HOEHE = Math.round((BREITE * (KULISSE.bis - KULISSE.von)) / KULISSE.breite);
/** Hallenboden (Vorderkante) als Anteil der Hallenhoehe. */
export const HALLE_BODEN = 0.93;

export const ETAGE_HOEHE = 136;
export const BALKEN = 12;
export const FUSS_HOEHE = 48;

export const SCHACHT: { x: number; b: number } = { x: 6, b: 52 };

/** Mindestens 44 pt, damit es keine Fehltipps gibt (Apple HIG). */
export const TIPP_MIN = 44;

export function etageY(index: number): number {
  return HALLE_HOEHE + index * ETAGE_HOEHE;
}

/** Wie viele Reihen unter der Halle: gebaute Etagen plus die gesperrte, solange es eine gibt. */
export function reihen(anzahlPressen: number, maxPressen = 8): number {
  return anzahlPressen + (anzahlPressen < maxPressen ? 1 : 0);
}

export function gesamtHoehe(anzahlPressen: number, maxPressen = 8): number {
  return HALLE_HOEHE + reihen(anzahlPressen, maxPressen) * ETAGE_HOEHE + FUSS_HOEHE;
}

/** Die Teile einer Etage. Boden ist die Oberkante des Bodenbalkens. */
export function etage(index: number): {
  reihe: Rechteck;
  boden: number;
  kiste: Rechteck;
  meister: Rechteck;
  arbeit: Rechteck;
  presse: Rechteck;
  schild: Rechteck;
  nummer: { x: number; y: number };
} {
  const y = etageY(index);
  const boden = y + ETAGE_HOEHE - BALKEN;
  return {
    reihe: { x: 0, y, b: BREITE, h: ETAGE_HOEHE },
    boden,
    kiste: { x: 62, y: boden - 50, b: 58, h: 50 },
    meister: { x: 126, y: y + 10, b: 52, h: 60 },
    arbeit: { x: 126, y: y + 74, b: 194, h: boden - (y + 74) },
    presse: { x: 196, y: boden - 104, b: 112, h: 112 },
    schild: { x: 324, y: y + 34, b: 60, h: 60 },
    nummer: { x: SCHACHT.x + SCHACHT.b / 2, y: y + 22 },
  };
}

/** Die Versandhalle oben. */
export function halle(): {
  flaeche: Rechteck;
  boden: number;
  packtisch: Rechteck;
  wagen: Rechteck;
  versandSchild: Rechteck;
  versandMeister: Rechteck;
  kopf: Rechteck;
  paternosterSchild: Rechteck;
  paternosterMeister: Rechteck;
  direktor: Rechteck;
  traegerWeg: { von: number; bis: number };
} {
  const boden = HALLE_HOEHE * HALLE_BODEN;
  return {
    flaeche: { x: 0, y: 0, b: BREITE, h: HALLE_HOEHE },
    boden,
    packtisch: { x: 54, y: boden - 96, b: 112, h: 104 },
    wagen: { x: 196, y: boden - 112, b: 190, h: 114 },
    versandSchild: { x: 324, y: 10, b: 60, h: 60 },
    versandMeister: { x: 264, y: 10, b: 52, h: 60 },
    // Kopfstueck des Paternosters mit Antriebsrad, ueber dem Schacht.
    kopf: { x: SCHACHT.x - 2, y: boden - 70, b: SCHACHT.b + 4, h: HALLE_HOEHE - (boden - 70) },
    paternosterSchild: { x: SCHACHT.x, y: 10, b: 60, h: 60 },
    paternosterMeister: { x: SCHACHT.x + 68, y: 10, b: 52, h: 60 },
    direktor: { x: 168, y: boden - 52, b: 36, h: 52 },
    traegerWeg: { von: 132, bis: 206 },
  };
}

/** Der Schacht von der Halle bis unter die tiefste gebaute Etage. */
export function schacht(anzahlPressen: number, maxPressen = 8): Rechteck {
  const y = HALLE_HOEHE - 20;
  return { x: SCHACHT.x, y, b: SCHACHT.b, h: gesamtHoehe(anzahlPressen, maxPressen) - y - 8 };
}

/** Wo der Paternoster an Etage `index` haelt (Mitte des Tabletts). */
export function haltY(index: number): number {
  return etage(index).boden - 30;
}

/** Skaliert ein Rechteck von Welt-Einheiten auf Bildschirmpunkte. */
export function skaliere(r: Rechteck, faktor: number): Rechteck {
  return { x: r.x * faktor, y: r.y * faktor, b: r.b * faktor, h: r.h * faktor };
}
