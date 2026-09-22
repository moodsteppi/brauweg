/**
 * Das Modell der Bahnwerkstatt: eine Bahn anlegen, bestücken, verändern.
 *
 * Seit dem 22.09.2026. Robin hat an dem Tag entschieden, dass „viel mehr
 * Maps" aus einem Editor fürs Team kommen sollen statt aus handgeschriebenen
 * Objekten — bis dahin waren es 40 Bahnen in 1.517 Zeilen TypeScript, und
 * jede neue hieß: Koordinaten im Kopf rechnen, Test laufen lassen, raten,
 * welche Wand gemeint ist.
 *
 * Hier stehen nur reine Funktionen ohne DOM, damit sie prüfbar sind
 * (`modell.test.ts`) und der Bildschirm (`Werkstatt.tsx`) nur noch Zeiger in
 * Weltkoordinaten umrechnet. Zwei Regeln gelten überall:
 *
 *   1. **Jede Änderung liefert eine NEUE Bahn** (und neue Listen darin). Das
 *      ist keine Stilfrage: Physik, Wegfeld und Zeichner halten je
 *      Kartenobjekt einen Zwischenspeicher (`segmenteVon`, `wegfeld`,
 *      `setzeKarte`). Wer eine Bahn an Ort und Stelle verändert, bekommt die
 *      Wände von vorher geprüft und gezeichnet.
 *   2. **Nichts hier rechnet Physik nach.** Treffer, Griffe und Raster sind
 *      Bedienung; ob eine Bahn taugt, sagen allein `pruefeKarte` und
 *      `botLoestKarte` aus `karten-pruefen.ts`.
 */

import type {
  Karte,
  Kreisflaeche,
  Rechteckflaeche,
  Rechteckwand,
  Schraegwand,
  Wand,
  Zone,
} from '../../minispiele/golf/karte';
import { istInZone, istKreis, istRechteck } from '../../minispiele/golf/karte';

/* --------------------------------------------------------------------------
 * Typen
 * ----------------------------------------------------------------------- */

export type Zonenart = Zone['art'];

/** Alle neun Zonenarten, in der Reihenfolge von `karte.ts`. */
export const ZONENARTEN: readonly Zonenart[] = [
  'beschleuniger',
  'sand',
  'eis',
  'wasser',
  'portal',
  'bumper',
  'strudel',
  'sprungfeld',
  'drehkreuz',
];

/**
 * Freie Angaben zur Bahn, die heute noch NICHT am Typ `Karte` stehen.
 *
 * `feature/golf-bahnen-als-daten` (parallel, am 22.09.2026 noch nicht auf
 * staging) ergänzt genau diese vier Felder optional an `Karte`. Die Werkstatt
 * führt sie schon mit, damit eine Bahn, die heute gebaut wird, sie nicht
 * nachgetragen bekommen muss. Sobald der Zweig gemerged ist, ist dieser Typ
 * eine Teilmenge von `Karte` und die Schnittmenge unten ist schlicht `Karte`.
 */
export interface Bahnangaben {
  beschreibung?: string;
  thema?: string;
  autor?: string;
  tags?: string[];
}

export type Werkstattbahn = Karte & Bahnangaben;

/** Was angewählt sein kann. Indizes zeigen in die Listen der Bahn. */
export type Auswahl =
  | { art: 'wand'; index: number }
  | { art: 'zone'; index: number }
  | { art: 'abschlag'; index: number }
  | { art: 'loch' };

/** Womit gebaut wird. `auswahl` wählt an und verschiebt. */
export type Werkzeug =
  | 'auswahl'
  | 'wand-rechteck'
  | 'wand-schraeg'
  | 'abschlag'
  | 'loch'
  | Zonenart;

/**
 * Ein Anfasser an der Auswahl.
 *
 * `ecke` zieht die rechte untere Ecke eines Rechtecks, `a`/`b` die Enden
 * einer schrägen Wand, `radius` den Rand eines Kreises, `ziel` den Zielpunkt
 * eines Portals oder Strudels, `laenge` das Ende eines Drehkreuzbalkens.
 */
export type Griffart = 'ecke' | 'a' | 'b' | 'radius' | 'ziel' | 'laenge';

export interface Griff {
  art: Griffart;
  x: number;
  y: number;
}

/* --------------------------------------------------------------------------
 * Zahlen
 * ----------------------------------------------------------------------- */

/**
 * Auf das Raster legen. `raster <= 0` heißt „frei" — dann wird trotzdem auf
 * Hundertstel gerundet: Eine Zeigerbewegung liefert 17 Stellen, und
 * `x: 7.283746192837465` im Quelltext liest niemand gegen.
 */
export function rasten(wert: number, raster: number): number {
  const schritt = raster > 0 ? raster : 0.01;
  return rund(Math.round(wert / schritt) * schritt);
}

/** Tausendstel genügen jeder Angabe hier; weg mit dem Fließkommarauschen. */
export function rund(wert: number): number {
  const r = Math.round(wert * 1000) / 1000;
  // -0 schreibt sich als „0", ist für `Object.is` (und `toEqual`) aber eine
  // andere Zahl — das Hin und Her über den Quelltext wäre sonst nicht
  // verlustfrei. Einmal hier gerade gezogen.
  return r === 0 ? 0 : r;
}

function klemmeZahl(wert: number, min: number, max: number): number {
  if (max < min) return (min + max) / 2;
  return wert < min ? min : wert > max ? max : wert;
}

/** Grenzen für Breite und Höhe in der Werkstatt — enger lässt die Prüfung zu. */
export const MASS_MIN = 4;
export const MASS_MAX = 80;

/* --------------------------------------------------------------------------
 * Eine neue Bahn
 * ----------------------------------------------------------------------- */

/** Aus einem Namen eine Kennung im Stil des Katalogs (`k41-die-neue`). */
export function kennungAus(name: string, nummer: number): string {
  const stamm = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const nr = String(Math.max(0, Math.floor(nummer))).padStart(2, '0');
  return `k${nr}-${stamm === '' ? 'neue-bahn' : stamm}`;
}

/** Die nächste freie Bahnnummer hinter dem Katalog (`k40-…` → 41). */
export function naechsteNummer(karten: readonly Karte[]): number {
  let hoechste = 0;
  for (const k of karten) {
    const treffer = /^k(\d+)-/.exec(k.id);
    if (treffer !== null) hoechste = Math.max(hoechste, Number(treffer[1]));
  }
  return hoechste + 1;
}

/**
 * Eine leere, aber schon GÜLTIGE Bahn: Abschläge unten, Loch oben, Maße und
 * Grenzen mitten in den Bereichen, die `pruefeKarte` verlangt. Wer anfängt,
 * soll mit Grün anfangen und sehen, welcher Handgriff es rot macht.
 */
export function neueBahn(opts: {
  breite?: number;
  hoehe?: number;
  name?: string;
  nummer?: number;
} = {}): Werkstattbahn {
  const breite = klemmeZahl(opts.breite ?? 16, MASS_MIN, MASS_MAX);
  const hoehe = klemmeZahl(opts.hoehe ?? 24, MASS_MIN, MASS_MAX);
  const name = opts.name ?? 'Neue Bahn';
  const mitte = rund(breite / 2);
  return {
    id: kennungAus(name, opts.nummer ?? 41),
    name,
    schwierigkeit: 1,
    breite,
    hoehe,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 60,
    abschlaege: [
      [rund(mitte - 1.5), rund(hoehe - 3)],
      [rund(mitte + 1.5), rund(hoehe - 3)],
    ],
    loch: [mitte, 3],
    waende: [],
    zonen: [],
    dekor: 'wiese',
  };
}

/* --------------------------------------------------------------------------
 * Objekte setzen
 * ----------------------------------------------------------------------- */

/**
 * Eine neue Zone der Art `art` um den Punkt `(x, y)`.
 *
 * Die Vorgaben sind den Katalogbahnen abgeschaut (typische Größe und Stärke
 * je Art), damit ein frisch gesetztes Objekt schon so wirkt wie im Spiel. Die
 * Lage wird ins Feld geklemmt: Ein Klick nahe am Rand soll eine Zone am Rand
 * ergeben, nicht einen Befund „liegt nicht im Feld".
 *
 * Portale kommen als PAAR — ein einzelnes Portal ohne Gegenstück hat kein
 * sinnvolles Ziel, und so bauen alle zwölf Katalogportale. Das zweite liegt
 * versetzt daneben; beide zielen in die Mitte des anderen, wie im Katalog.
 */
export function neueZonen(bahn: Karte, art: Zonenart, x: number, y: number): Zone[] {
  const B = bahn.breite;
  const H = bahn.hoehe;
  const rechteck = (w: number, h: number): Rechteckflaeche => ({
    x: rund(klemmeZahl(x - w / 2, 0, B - w)),
    y: rund(klemmeZahl(y - h / 2, 0, H - h)),
    w,
    h,
  });
  const kreis = (r: number): Kreisflaeche => ({
    x: rund(klemmeZahl(x, r, B - r)),
    y: rund(klemmeZahl(y, r, H - r)),
    r,
  });
  switch (art) {
    case 'beschleuniger':
      return [{ art, ...rechteck(3, 2), rx: 0, ry: -1, staerke: 30 }];
    case 'sand':
      return [{ art, ...rechteck(3, 3) }];
    case 'eis':
      return [{ art, ...rechteck(4, 4) }];
    case 'wasser':
      return [{ art, ...kreis(1.5) }];
    case 'bumper':
      return [{ art, ...kreis(0.75) }];
    case 'strudel':
      return [{ art, ...kreis(1.5), staerke: 12 }];
    case 'sprungfeld':
      return [{ art, ...rechteck(4, 2), rx: 0, ry: -1, weite: 8 }];
    case 'drehkreuz': {
      const k = kreis(2);
      return [{ art, x: k.x, y: k.y, laenge: 4, gradJeTakt: 2, phase: 0 }];
    }
    case 'portal': {
      const a = kreis(1);
      // Das Gegenstück sechs Einheiten weiter oben, sonst unten — Hauptsache
      // im Feld und nicht auf dem ersten.
      const obenFrei = a.y - 6 >= 1;
      const b = { x: a.x, y: rund(klemmeZahl(obenFrei ? a.y - 6 : a.y + 6, 1, H - 1)) };
      const paar = naechstesPortalpaar(bahn);
      return [
        { art, x: a.x, y: a.y, r: 1, ziel: { x: b.x, y: b.y }, paar },
        { art, x: b.x, y: b.y, r: 1, ziel: { x: a.x, y: a.y }, paar },
      ];
    }
  }
}

function naechstesPortalpaar(bahn: Karte): number {
  let hoechstes = -1;
  for (const z of bahn.zonen) if (z.art === 'portal' && z.paar > hoechstes) hoechstes = z.paar;
  return hoechstes + 1;
}

/** Eine neue Wand um den Punkt — Rechteck liegend, Schräge von links unten nach rechts oben. */
export function neueWand(bahn: Karte, art: 'rechteck' | 'schraeg', x: number, y: number): Wand {
  if (art === 'rechteck') {
    const w = 4;
    const h = 0.6;
    return {
      x: rund(klemmeZahl(x - w / 2, 0, bahn.breite - w)),
      y: rund(klemmeZahl(y - h / 2, 0, bahn.hoehe - h)),
      w,
      h,
    };
  }
  const halb = 1.5;
  return {
    ax: rund(klemmeZahl(x - halb, 0, bahn.breite)),
    ay: rund(klemmeZahl(y + halb, 0, bahn.hoehe)),
    bx: rund(klemmeZahl(x + halb, 0, bahn.breite)),
    by: rund(klemmeZahl(y - halb, 0, bahn.hoehe)),
    dicke: 0.6,
  };
}

/** Setzt mit dem Werkzeug an der Stelle — und sagt, was danach angewählt ist. */
export function setze(
  bahn: Werkstattbahn,
  werkzeug: Exclude<Werkzeug, 'auswahl'>,
  x: number,
  y: number,
): { bahn: Werkstattbahn; auswahl: Auswahl } {
  if (werkzeug === 'wand-rechteck' || werkzeug === 'wand-schraeg') {
    const wand = neueWand(bahn, werkzeug === 'wand-rechteck' ? 'rechteck' : 'schraeg', x, y);
    return {
      bahn: { ...bahn, waende: [...bahn.waende, wand] },
      auswahl: { art: 'wand', index: bahn.waende.length },
    };
  }
  if (werkzeug === 'abschlag') {
    const punkt: [number, number] = [
      rund(klemmeZahl(x, 0, bahn.breite)),
      rund(klemmeZahl(y, 0, bahn.hoehe)),
    ];
    return {
      bahn: { ...bahn, abschlaege: [...bahn.abschlaege, punkt] },
      auswahl: { art: 'abschlag', index: bahn.abschlaege.length },
    };
  }
  if (werkzeug === 'loch') {
    return {
      bahn: { ...bahn, loch: [rund(klemmeZahl(x, 0, bahn.breite)), rund(klemmeZahl(y, 0, bahn.hoehe))] },
      auswahl: { art: 'loch' },
    };
  }
  const zonen = neueZonen(bahn, werkzeug, x, y);
  return {
    bahn: { ...bahn, zonen: [...bahn.zonen, ...zonen] },
    auswahl: { art: 'zone', index: bahn.zonen.length },
  };
}

/* --------------------------------------------------------------------------
 * Bezugspunkt, Verschieben, Löschen
 * ----------------------------------------------------------------------- */

/**
 * Der Punkt, an dem ein Objekt „hängt" — den verschiebt man, und der rastet.
 *
 * Für Rechtecke die linke obere Ecke (so steht es im Quelltext), für Kreise
 * und Drehkreuze die Mitte, für schräge Wände der Anfang A.
 */
export function bezugspunkt(bahn: Karte, auswahl: Auswahl): { x: number; y: number } | null {
  if (auswahl.art === 'loch') return { x: bahn.loch[0], y: bahn.loch[1] };
  if (auswahl.art === 'abschlag') {
    const p = bahn.abschlaege[auswahl.index];
    return p === undefined ? null : { x: p[0], y: p[1] };
  }
  if (auswahl.art === 'wand') {
    const w = bahn.waende[auswahl.index];
    if (w === undefined) return null;
    return istRechteck(w) ? { x: w.x, y: w.y } : { x: w.ax, y: w.ay };
  }
  const z = bahn.zonen[auswahl.index];
  return z === undefined ? null : { x: z.x, y: z.y };
}

/**
 * Setzt den Bezugspunkt auf `(x, y)` — alle anderen Punkte des Objekts
 * wandern mit (das Ende einer Schräge, das Ziel eines Strudels).
 *
 * Beim Portal wandert zusätzlich das ZIEL DES PARTNERS mit, sofern es auf
 * die alte Mitte zeigte: Ein Paar, bei dem man nach jedem Verschieben das
 * Gegenstück von Hand nachzieht, ist ein Paar, das irgendwann ins Leere zielt.
 */
export function verschiebeNach(
  bahn: Werkstattbahn,
  auswahl: Auswahl,
  x: number,
  y: number,
): Werkstattbahn {
  const alt = bezugspunkt(bahn, auswahl);
  if (alt === null) return bahn;
  const dx = x - alt.x;
  const dy = y - alt.y;
  if (dx === 0 && dy === 0) return bahn;

  if (auswahl.art === 'loch') return { ...bahn, loch: [rund(x), rund(y)] };
  if (auswahl.art === 'abschlag') {
    const abschlaege = bahn.abschlaege.map((p, i): [number, number] =>
      i === auswahl.index ? [rund(x), rund(y)] : p,
    );
    return { ...bahn, abschlaege };
  }
  if (auswahl.art === 'wand') {
    const waende = bahn.waende.map((w, i): Wand => {
      if (i !== auswahl.index) return w;
      if (istRechteck(w)) return { ...w, x: rund(x), y: rund(y) };
      return { ...w, ax: rund(w.ax + dx), ay: rund(w.ay + dy), bx: rund(w.bx + dx), by: rund(w.by + dy) };
    });
    return { ...bahn, waende };
  }
  const zone = bahn.zonen[auswahl.index];
  const zonen = bahn.zonen.map((z, i): Zone => {
    if (i === auswahl.index) {
      const neu = { ...z, x: rund(x), y: rund(y) } as Zone;
      if (neu.art === 'strudel' && neu.ziel !== undefined) {
        neu.ziel = { x: rund(neu.ziel.x + dx), y: rund(neu.ziel.y + dy) };
      }
      return neu;
    }
    if (
      zone.art === 'portal' &&
      z.art === 'portal' &&
      z.paar === zone.paar &&
      z.ziel.x === alt.x &&
      z.ziel.y === alt.y
    ) {
      return { ...z, ziel: { x: rund(x), y: rund(y) } };
    }
    return z;
  });
  return { ...bahn, zonen };
}

/** Entfernt das Objekt. Loch und die letzten zwei Abschläge bleiben — ohne sie gibt es keine Bahn. */
export function loesche(bahn: Werkstattbahn, auswahl: Auswahl): Werkstattbahn {
  if (auswahl.art === 'loch') return bahn;
  if (auswahl.art === 'abschlag') {
    if (bahn.abschlaege.length <= 2) return bahn;
    return { ...bahn, abschlaege: bahn.abschlaege.filter((_, i) => i !== auswahl.index) };
  }
  if (auswahl.art === 'wand') {
    return { ...bahn, waende: bahn.waende.filter((_, i) => i !== auswahl.index) };
  }
  return { ...bahn, zonen: bahn.zonen.filter((_, i) => i !== auswahl.index) };
}

/** Darf das weg? Für den Knopf — `loesche` selbst weigert sich still. */
export function loeschbar(bahn: Karte, auswahl: Auswahl): boolean {
  if (auswahl.art === 'loch') return false;
  if (auswahl.art === 'abschlag') return bahn.abschlaege.length > 2;
  return true;
}

/** Ersetzt die Zone an `index` durch `zone` (für das Seitenpanel). */
export function ersetzeZone(bahn: Werkstattbahn, index: number, zone: Zone): Werkstattbahn {
  return { ...bahn, zonen: bahn.zonen.map((z, i) => (i === index ? zone : z)) };
}

/** Ersetzt die Wand an `index` durch `wand` (für das Seitenpanel). */
export function ersetzeWand(bahn: Werkstattbahn, index: number, wand: Wand): Werkstattbahn {
  return { ...bahn, waende: bahn.waende.map((w, i) => (i === index ? wand : w)) };
}

/**
 * Sand, Eis und Wasser zwischen Rechteck und Kreis umschalten — Fläche und
 * Mitte bleiben ungefähr, damit die Zone nicht quer über die Bahn springt.
 */
export function wechsleForm(zone: Zone): Zone {
  if (zone.art !== 'sand' && zone.art !== 'eis' && zone.art !== 'wasser') return zone;
  if (istKreis(zone)) {
    const seite = rund(zone.r * 2);
    return { art: zone.art, x: rund(zone.x - zone.r), y: rund(zone.y - zone.r), w: seite, h: seite } as Zone;
  }
  const r = rund(Math.min(zone.w, zone.h) / 2);
  return { art: zone.art, x: rund(zone.x + zone.w / 2), y: rund(zone.y + zone.h / 2), r } as Zone;
}

/* --------------------------------------------------------------------------
 * Griffe
 * ----------------------------------------------------------------------- */

/** Die Anfasser der Auswahl, in Weltkoordinaten. */
export function griffe(bahn: Karte, auswahl: Auswahl | null): Griff[] {
  if (auswahl === null) return [];
  if (auswahl.art === 'wand') {
    const w = bahn.waende[auswahl.index];
    if (w === undefined) return [];
    if (istRechteck(w)) return [{ art: 'ecke', x: w.x + w.w, y: w.y + w.h }];
    return [
      { art: 'a', x: w.ax, y: w.ay },
      { art: 'b', x: w.bx, y: w.by },
    ];
  }
  if (auswahl.art !== 'zone') return [];
  const z = bahn.zonen[auswahl.index];
  if (z === undefined) return [];
  const liste: Griff[] = [];
  if (z.art === 'drehkreuz') {
    liste.push({ art: 'laenge', x: z.x + z.laenge / 2, y: z.y });
    return liste;
  }
  if (z.art === 'portal' || z.art === 'bumper' || z.art === 'strudel' || istKreis(z)) {
    const r = (z as Kreisflaeche).r;
    liste.push({ art: 'radius', x: z.x + r, y: z.y });
  } else {
    const f = z as Rechteckflaeche;
    liste.push({ art: 'ecke', x: f.x + f.w, y: f.y + f.h });
  }
  if (z.art === 'portal') liste.push({ art: 'ziel', x: z.ziel.x, y: z.ziel.y });
  if (z.art === 'strudel' && z.ziel !== undefined) liste.push({ art: 'ziel', x: z.ziel.x, y: z.ziel.y });
  return liste;
}

/** Kleinste Ausdehnung beim Ziehen — eine Wand der Dicke 0 zeichnet nichts und prallt an nichts. */
const MIN_AUSDEHNUNG = 0.2;

/** Einen Griff nach `(x, y)` ziehen. */
export function zieheGriff(
  bahn: Werkstattbahn,
  auswahl: Auswahl,
  griff: Griffart,
  x: number,
  y: number,
  /** Radius und Länge rasten mit, sonst wäre nach dem Ziehen nur die Mitte glatt. */
  raster = 0,
): Werkstattbahn {
  if (auswahl.art === 'wand') {
    const w = bahn.waende[auswahl.index];
    if (w === undefined) return bahn;
    let neu: Wand = w;
    if (istRechteck(w) && griff === 'ecke') {
      neu = { ...w, w: rund(Math.max(MIN_AUSDEHNUNG, x - w.x)), h: rund(Math.max(MIN_AUSDEHNUNG, y - w.y)) };
    } else if (!istRechteck(w) && griff === 'a') {
      neu = { ...w, ax: rund(x), ay: rund(y) };
    } else if (!istRechteck(w) && griff === 'b') {
      neu = { ...w, bx: rund(x), by: rund(y) };
    }
    return neu === w ? bahn : ersetzeWand(bahn, auswahl.index, neu);
  }
  if (auswahl.art !== 'zone') return bahn;
  const z = bahn.zonen[auswahl.index];
  if (z === undefined) return bahn;
  let neu: Zone = z;
  if (griff === 'ziel' && (z.art === 'portal' || z.art === 'strudel')) {
    neu = { ...z, ziel: { x: rund(x), y: rund(y) } };
  } else if (griff === 'laenge' && z.art === 'drehkreuz') {
    const d = Math.sqrt((x - z.x) * (x - z.x) + (y - z.y) * (y - z.y));
    neu = { ...z, laenge: Math.max(MIN_AUSDEHNUNG, rasten(d * 2, raster)) };
  } else if (griff === 'radius' && 'r' in z) {
    const d = Math.sqrt((x - z.x) * (x - z.x) + (y - z.y) * (y - z.y));
    neu = { ...z, r: Math.max(MIN_AUSDEHNUNG, rasten(d, raster)) } as Zone;
  } else if (griff === 'ecke' && z.art !== 'drehkreuz' && !('r' in z)) {
    const f = z as Zone & Rechteckflaeche;
    neu = { ...f, w: rund(Math.max(MIN_AUSDEHNUNG, x - f.x)), h: rund(Math.max(MIN_AUSDEHNUNG, y - f.y)) } as Zone;
  }
  return neu === z ? bahn : ersetzeZone(bahn, auswahl.index, neu);
}

/* --------------------------------------------------------------------------
 * Treffer
 * ----------------------------------------------------------------------- */

function abstandZuStrecke(ax: number, ay: number, bx: number, by: number, px: number, py: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lq = dx * dx + dy * dy;
  let t = lq > 0 ? ((px - ax) * dx + (py - ay) * dy) / lq : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const nx = px - (ax + dx * t);
  const ny = py - (ay + dy * t);
  return Math.sqrt(nx * nx + ny * ny);
}

/** Trifft der Punkt die Wand? `toleranz` in Einheiten, damit dünne Wände greifbar bleiben. */
export function trifftWand(wand: Wand, x: number, y: number, toleranz: number): boolean {
  if (istRechteck(wand)) {
    return (
      x >= wand.x - toleranz &&
      x <= wand.x + wand.w + toleranz &&
      y >= wand.y - toleranz &&
      y <= wand.y + wand.h + toleranz
    );
  }
  return abstandZuStrecke(wand.ax, wand.ay, wand.bx, wand.by, x, y) <= wand.dicke / 2 + toleranz;
}

/** Trifft der Punkt die Zone? Das Drehkreuz zählt mit seinem ganzen Kreis. */
export function trifftZone(zone: Zone, x: number, y: number): boolean {
  if (zone.art === 'drehkreuz') {
    const dx = x - zone.x;
    const dy = y - zone.y;
    const r = zone.laenge / 2;
    return dx * dx + dy * dy <= r * r;
  }
  return istInZone(zone, x, y);
}

/**
 * Was liegt unter dem Zeiger? Kleine Ziele zuerst (Loch, Abschläge), dann
 * Zonen und Wände von oben nach unten — also zuletzt gesetzt zuerst, wie man
 * sie sieht.
 */
export function trifft(bahn: Karte, x: number, y: number, toleranz: number): Auswahl | null {
  const punkt = Math.max(0.6, toleranz * 2);
  const [lx, ly] = bahn.loch;
  if ((x - lx) * (x - lx) + (y - ly) * (y - ly) <= punkt * punkt) return { art: 'loch' };
  for (let i = bahn.abschlaege.length - 1; i >= 0; i -= 1) {
    const [ax, ay] = bahn.abschlaege[i];
    if ((x - ax) * (x - ax) + (y - ay) * (y - ay) <= punkt * punkt) return { art: 'abschlag', index: i };
  }
  for (let i = bahn.zonen.length - 1; i >= 0; i -= 1) {
    if (trifftZone(bahn.zonen[i], x, y)) return { art: 'zone', index: i };
  }
  for (let i = bahn.waende.length - 1; i >= 0; i -= 1) {
    if (trifftWand(bahn.waende[i], x, y, toleranz)) return { art: 'wand', index: i };
  }
  return null;
}

/** Trifft der Punkt einen Griff der Auswahl? */
export function trifftGriff(
  bahn: Karte,
  auswahl: Auswahl | null,
  x: number,
  y: number,
  radius: number,
): Griffart | null {
  for (const g of griffe(bahn, auswahl)) {
    if ((x - g.x) * (x - g.x) + (y - g.y) * (y - g.y) <= radius * radius) return g.art;
  }
  return null;
}

/* --------------------------------------------------------------------------
 * Befunde auf die Bahn legen
 * ----------------------------------------------------------------------- */

export interface Befund {
  text: string;
  /** Die Objekte, die der Befund nennt; leer heißt: die ganze Bahn. */
  ziele: Auswahl[];
}

/**
 * Ordnet die Meldungen von `pruefeKarte` den Objekten zu, die sie nennen.
 *
 * `pruefeKarte` liefert Text und keine Struktur, und das bleibt so: Die
 * Meldungen sind für Menschen, und die Prüfung gehört nicht der Werkstatt.
 * Die Zuordnung liest deshalb die Anfänge der Sätze, die dort stehen
 * („Wand 3 …", „Zone 2 (portal) …", „Abschlag 1 …", „Abschlaege 0 und 1 …",
 * „Loch …"). Ändert sich eine Formulierung, landet der Befund als Befund der
 * ganzen Bahn in der Liste — sichtbar bleibt er in jedem Fall.
 */
export function ordneBefunde(meldungen: readonly string[]): Befund[] {
  return meldungen.map((text): Befund => {
    let m = /^Wand (\d+) /.exec(text);
    if (m !== null) return { text, ziele: [{ art: 'wand', index: Number(m[1]) }] };
    m = /^Zone (\d+) /.exec(text);
    if (m !== null) return { text, ziele: [{ art: 'zone', index: Number(m[1]) }] };
    m = /^Abschlaege (\d+) und (\d+) /.exec(text);
    if (m !== null) {
      return {
        text,
        ziele: [
          { art: 'abschlag', index: Number(m[1]) },
          { art: 'abschlag', index: Number(m[2]) },
        ],
      };
    }
    m = /^(?:Vom )?Abschlag (\d+) /.exec(text);
    if (m !== null) return { text, ziele: [{ art: 'abschlag', index: Number(m[1]) }] };
    if (/^Loch /.test(text)) return { text, ziele: [{ art: 'loch' }] };
    return { text, ziele: [] };
  });
}

/** Gleiche Auswahl? */
export function gleicheAuswahl(a: Auswahl | null, b: Auswahl | null): boolean {
  if (a === null || b === null) return a === b;
  if (a.art !== b.art) return false;
  if (a.art === 'loch') return true;
  return a.index === (b as { index: number }).index;
}

/** Kurzname für Liste und Kopfzeile des Panels. */
export function auswahlName(bahn: Karte, auswahl: Auswahl): string {
  if (auswahl.art === 'loch') return 'Loch';
  if (auswahl.art === 'abschlag') return `Abschlag ${auswahl.index}`;
  if (auswahl.art === 'wand') {
    const w = bahn.waende[auswahl.index];
    return `Wand ${auswahl.index} (${w !== undefined && istRechteck(w) ? 'Rechteck' : 'schräg'})`;
  }
  const z = bahn.zonen[auswahl.index];
  return `Zone ${auswahl.index} (${z?.art ?? '?'})`;
}

/** Richtungen für Beschleuniger und Sprungfeld: acht Knöpfe statt Winkelrechnung. */
export const RICHTUNGEN: readonly { zeichen: string; rx: number; ry: number }[] = [
  { zeichen: '↑', rx: 0, ry: -1 },
  { zeichen: '↗', rx: 0.7071, ry: -0.7071 },
  { zeichen: '→', rx: 1, ry: 0 },
  { zeichen: '↘', rx: 0.7071, ry: 0.7071 },
  { zeichen: '↓', rx: 0, ry: 1 },
  { zeichen: '↙', rx: -0.7071, ry: 0.7071 },
  { zeichen: '←', rx: -1, ry: 0 },
  { zeichen: '↖', rx: -0.7071, ry: -0.7071 },
];

/** Für die Typprüfung im Panel. */
export type { Rechteckwand, Schraegwand };
