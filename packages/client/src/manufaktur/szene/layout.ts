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

export const SCHACHT: { x: number; b: number } = { x: 4, b: 72 };

/** Mindestens 44 pt, damit es keine Fehltipps gibt (Apple HIG). */
export const TIPP_MIN = 44;

export function etageY(index: number): number {
  return HALLE_HOEHE + index * ETAGE_HOEHE;
}

/**
 * Wie viele Reihen unter der Halle: gebaute Etagen, die naechste gesperrte
 * (Bretterwand mit Schild) und bis zu zwei weitere als dunkle Umrisse — man
 * soll sehen, dass es nach unten weitergeht.
 */
export function reihen(anzahlPressen: number, maxPressen = 8): number {
  return anzahlPressen + Math.min(3, maxPressen - anzahlPressen);
}

export function gesamtHoehe(anzahlPressen: number, maxPressen = 8): number {
  return HALLE_HOEHE + reihen(anzahlPressen, maxPressen) * ETAGE_HOEHE + FUSS_HOEHE;
}

/** Kleines Stufen-Schild: nur Zahl und Pfeil, aber gross genug zum Tippen (46 · 375/390 > 44 pt). */
export const SCHILD = 46;

/** Die Teile einer Etage. Boden ist die Oberkante des Bodenbalkens. */
export function etage(index: number): {
  reihe: Rechteck;
  boden: number;
  kiste: Rechteck;
  bestand: { x: number; y: number };
  meister: Rechteck;
  meisterFigur: Rechteck;
  arbeit: Rechteck;
  presse: Rechteck;
  schild: Rechteck;
  nummer: { x: number; y: number };
  sperrSchild: Rechteck;
} {
  const y = etageY(index);
  const boden = y + ETAGE_HOEHE - BALKEN;
  return {
    reihe: { x: 0, y, b: BREITE, h: ETAGE_HOEHE },
    boden,
    kiste: { x: 80, y: boden - 50, b: 58, h: 50 },
    // Ueber den Stapeln, damit die Kiste sichtbar bleibt.
    bestand: { x: 80, y: boden - 84 },
    // Wie im Vorbild: Der Meister steht vorn an der Kiste. Leer ist hier ein
    // Rahmen mit „+" und Preis, eingestellt steht er selbst da (Rahmen weg).
    meister: { x: 139, y: boden - 62, b: 46, h: 58 },
    meisterFigur: { x: 139, y: boden - 62, b: 46, h: 62 },
    arbeit: { x: 186, y: y + 40, b: 150, h: boden - (y + 40) },
    // Weit rechts, unter die Kante des Schilds: Davor braucht die Kolonne Platz
    // zum Anstehen, und das Rad der Gusseisenpresse sitzt tiefer als das Schild.
    presse: { x: 244, y: boden - 104, b: 112, h: 112 },
    schild: { x: 336, y: y + 16, b: SCHILD, h: SCHILD },
    // Mittig auf dem Schacht, in halber Etagenhoehe (der Punkt ist die Mitte, siehe .mf-nummer).
    nummer: { x: SCHACHT.x + SCHACHT.b / 2, y: y + (ETAGE_HOEHE - BALKEN) / 2 },
    sperrSchild: { x: 128, y: y + 34, b: 190, h: 60 },
  };
}

/**
 * Die Versandhalle oben. Im Dachstuhl liegt nichts: Schilder sitzen an ihren
 * Stationen (Paternoster am Kopfstueck, Versand am Wagen), Meister-Plaetze
 * daneben, der Direktor auf einem Podest vor dem Fenster — ausserhalb der
 * Laufwege von Kurbler und Packer.
 */
export function halle(): {
  flaeche: Rechteck;
  boden: number;
  packtisch: Rechteck;
  wagen: Rechteck;
  versandSchild: Rechteck;
  versandMeister: Rechteck;
  versandMeisterFigur: Rechteck;
  kopf: Rechteck;
  rad: { x: number; y: number };
  kurbler: { x: number };
  paternosterSchild: Rechteck;
  paternosterMeister: Rechteck;
  paternosterMeisterFigur: Rechteck;
  podest: Rechteck;
  direktor: Rechteck;
  traegerWeg: { von: number; bis: number };
} {
  const boden = HALLE_HOEHE * HALLE_BODEN;
  const kopf = { x: SCHACHT.x - 2, y: boden - 70, b: SCHACHT.b + 4, h: HALLE_HOEHE - (boden - 70) };
  return {
    flaeche: { x: 0, y: 0, b: BREITE, h: HALLE_HOEHE },
    boden,
    packtisch: { x: 112, y: boden - 92, b: 92, h: 92 },
    wagen: { x: 238, y: boden - 96, b: 150, h: 94 },
    // Auf dem Dach des Wagens, wenn er am Tor steht.
    versandSchild: { x: 296, y: boden - 146, b: SCHILD, h: SCHILD },
    // Neben dem Packtisch.
    versandMeister: { x: 160, y: boden - 158, b: 50, h: 56 },
    versandMeisterFigur: { x: 168, y: boden - 60, b: 34, h: 60 },
    kopf,
    rad: { x: kopf.x + kopf.b / 2, y: kopf.y + 26 },
    kurbler: { x: kopf.x + kopf.b + 14 },
    // Auf dem Kopfstueck, ueber dem Antriebsrad; der Meister-Platz darueber am Schacht.
    paternosterSchild: { x: kopf.x + 5, y: kopf.y - SCHILD - 4, b: SCHILD, h: SCHILD },
    paternosterMeister: { x: kopf.x + 3, y: kopf.y - SCHILD - 66, b: 50, h: 56 },
    paternosterMeisterFigur: { x: kopf.x + kopf.b + 36, y: boden - 60, b: 34, h: 60 },
    podest: { x: 70, y: boden - 100, b: 36, h: 10 },
    direktor: { x: 70, y: boden - 150, b: 36, h: 50 },
    traegerWeg: { von: 214, bis: 250 },
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
