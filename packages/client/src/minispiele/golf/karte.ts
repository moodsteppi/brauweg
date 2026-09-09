/**
 * Die Bahn: Typen, Rand und die Umrechnung in Wandsegmente.
 *
 * Alle Maße sind Einheiten (E) der Spielwelt, y zeigt nach UNTEN (wie auf dem
 * Bildschirm). Das Spielfeld einer Karte ist das Rechteck 0..breite mal
 * 0..hoehe; alles, was eine Karte beschreibt, liegt darin. Der Rand ist keine
 * Angabe der Karte, sondern entsteht hier (siehe `randWaende`).
 *
 * Warum Segmente statt Rechtecken in der Physik: Eine Kollision Kreis gegen
 * Strecke ist ein Fall, eine Kollision Kreis gegen Rechteck sind vier (Kanten)
 * plus vier (Ecken), und die Ecken sind genau die Stelle, an der ein Ball bei
 * ungeschickter Behandlung durch die Wand rutscht. Ein Rechteck wird deshalb
 * einmal je Karte in vier Strecken zerlegt und danach nie wieder angefasst.
 */

import { normiere } from './zufall';

/* --------------------------------------------------------------------------
 * Wände
 * ----------------------------------------------------------------------- */

/** Achsenparallele Wand. `x`/`y` ist die linke obere Ecke. */
export interface Rechteckwand {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Schräge Wand: Strecke von (ax,ay) nach (bx,by) mit Dicke. */
export interface Schraegwand {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dicke: number;
}

export type Wand = Rechteckwand | Schraegwand;

/** Unterscheidet die beiden Wandarten — TypeScript kann das sonst nicht. */
export function istRechteck(wand: Wand): wand is Rechteckwand {
  return (wand as Rechteckwand).w !== undefined;
}

/* --------------------------------------------------------------------------
 * Zonen
 * ----------------------------------------------------------------------- */

/** Rechteckige Fläche, `x`/`y` ist die linke obere Ecke. */
export interface Rechteckflaeche {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Kreisfläche, `x`/`y` ist der Mittelpunkt. */
export interface Kreisflaeche {
  x: number;
  y: number;
  r: number;
}

/** Sand, Eis und Wasser dürfen beides sein — eckige Tümpel sehen falsch aus. */
export type Flaeche = Rechteckflaeche | Kreisflaeche;

/** Unterscheidet die beiden Flächenarten. */
export function istKreis(f: Flaeche): f is Kreisflaeche {
  return (f as Kreisflaeche).r !== undefined;
}

/** Schiebt den Ball in Richtung `(rx, ry)`, solange er darin liegt. */
export type ZoneBeschleuniger = Rechteckflaeche & {
  art: 'beschleuniger';
  rx: number;
  ry: number;
  /** Beschleunigung in E/s², typisch 30. */
  staerke: number;
};

/** Reibung mal 4. */
export type ZoneSand = Flaeche & { art: 'sand' };
/** Reibung mal 0,12 — der Ball läuft fast ewig. */
export type ZoneEis = Flaeche & { art: 'eis' };
/** Strafschlag und zurück auf die Stelle vor dem letzten Schlag. */
export type ZoneWasser = Flaeche & { art: 'wasser' };

/** Wirft den Ball zum Partner-Portal, Richtung und Tempo bleiben. */
export interface ZonePortal {
  art: 'portal';
  x: number;
  y: number;
  r: number;
  /** Mittelpunkt des Partner-Portals. */
  ziel: { x: number; y: number };
  /** Nummer des Portalpaars — nur für die Farbe der beiden Ringe. */
  paar: number;
}

/** Runder Prallkörper wie im Flipper. */
export interface ZoneBumper {
  art: 'bumper';
  x: number;
  y: number;
  r: number;
}

/** Zieht den Ball zur Mitte; ohne `ziel` ist er eine Falle, mit `ziel` ein Auswurf. */
export interface ZoneStrudel {
  art: 'strudel';
  x: number;
  y: number;
  r: number;
  /** Beschleunigung zur Mitte am Rand des Strudels, in E/s². */
  staerke: number;
  ziel?: { x: number; y: number };
}

/** Wirft den Ball über Wände hinweg. */
export type ZoneSprungfeld = Rechteckflaeche & {
  art: 'sprungfeld';
  rx: number;
  ry: number;
  /** Nur Deko/Doku — die Flugdauer steht als `FLUG_TAKTE` in der Physik. */
  weite: number;
};

/** Drehendes Segment um einen festen Mittelpunkt. */
export interface ZoneDrehkreuz {
  art: 'drehkreuz';
  x: number;
  y: number;
  /** Gesamtlänge des Balkens; der Mittelpunkt liegt in der Mitte. */
  laenge: number;
  /** GANZE Grad je Takt — die Winkeltabellen kennen nur ganze Grad. */
  gradJeTakt: number;
  /** Startwinkel in ganzen Grad. */
  phase: number;
}

export type Zone =
  | ZoneBeschleuniger
  | ZoneSand
  | ZoneEis
  | ZoneWasser
  | ZonePortal
  | ZoneBumper
  | ZoneStrudel
  | ZoneSprungfeld
  | ZoneDrehkreuz;

/* --------------------------------------------------------------------------
 * Karte
 * ----------------------------------------------------------------------- */

export interface Karte {
  /** Eindeutig, z. B. `k01-anfang`. Der Segment-Zwischenspeicher hängt daran. */
  id: string;
  name: string;
  schwierigkeit: 1 | 2 | 3 | 4 | 5;
  breite: number;
  hoehe: number;
  par: number;
  schlagLimit: number;
  zeitLimitS: number;
  /** Mindestens zwei Startplätze; Sitz i startet auf `i % laenge`. */
  abschlaege: [number, number][];
  loch: [number, number];
  waende: Wand[];
  zonen: Zone[];
  dekor?: 'wiese' | 'wueste' | 'eis' | 'nacht';
}

/* --------------------------------------------------------------------------
 * Segmente
 * ----------------------------------------------------------------------- */

/**
 * Eine Wandstrecke, fertig für die Kollision.
 *
 * `dx`/`dy`/`laengeQ` und die Hülle (`minX`…) stehen mit drin, weil sie in
 * jedem Unterschritt gebraucht werden: 20 Takte je Sekunde mal 5 Unterschritte
 * mal 8 Bälle mal 4 Auflösungsdurchgänge — was hier einmal je Karte gerechnet
 * wird, wird sonst 3200-mal je Sekunde gerechnet.
 */
export interface Segment {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  dx: number;
  dy: number;
  /** Quadrat der Länge; 0 bei entarteten Strecken (dann zählt nur Punkt A). */
  laengeQ: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Baut ein `Segment` samt Vorberechnungen. */
export function segment(ax: number, ay: number, bx: number, by: number): Segment {
  const dx = bx - ax;
  const dy = by - ay;
  return {
    ax,
    ay,
    bx,
    by,
    dx,
    dy,
    laengeQ: dx * dx + dy * dy,
    minX: ax < bx ? ax : bx,
    maxX: ax > bx ? ax : bx,
    minY: ay < by ? ay : by,
    maxY: ay > by ? ay : by,
  };
}

/** Dicke des Rahmens. Der Rahmen liegt AUSSERHALB des Spielfelds. */
export const RAND_DICKE = 0.8;

/**
 * Die vier Rahmenwände einer Karte.
 *
 * Sie liegen außerhalb von 0..breite mal 0..hoehe, ihre Innenkanten sind also
 * genau x=0, x=breite, y=0 und y=hoehe. Damit bleibt das Spielfeld vollständig
 * bespielbar und der Zeichner kann den Rahmen als sichtbare Holzleiste malen,
 * ohne dass sie Fläche wegnimmt. Die Ecken überlappen bewusst (oben und unten
 * sind breiter), sonst bliebe an jeder Ecke ein Loch von 0,8 mal 0,8 E.
 */
export function randWaende(karte: Karte): Rechteckwand[] {
  const b = karte.breite;
  const h = karte.hoehe;
  const d = RAND_DICKE;
  return [
    { x: -d, y: -d, w: b + 2 * d, h: d },
    { x: -d, y: h, w: b + 2 * d, h: d },
    { x: -d, y: 0, w: d, h },
    { x: b, y: 0, w: d, h },
  ];
}

/** Zerlegt ein Rechteck in seine vier Kanten. */
function rechteckSegmente(x: number, y: number, w: number, h: number, ziel: Segment[]): void {
  ziel.push(segment(x, y, x + w, y));
  ziel.push(segment(x + w, y, x + w, y + h));
  ziel.push(segment(x + w, y + h, x, y + h));
  ziel.push(segment(x, y + h, x, y));
}

/**
 * Zerlegt eine schräge Wand in die vier Kanten ihres gedrehten Rechtecks.
 *
 * Eine Strecke mit Dicke null wäre einfacher, hätte aber keine Seiten: Ein
 * Ball, der von schräg oben kommt, würde an der Mittellinie abprallen und dabei
 * sichtbar in der gezeichneten Wand stecken.
 */
function schraegSegmente(wand: Schraegwand, ziel: Segment[]): void {
  const richtung = normiere(wand.bx - wand.ax, wand.by - wand.ay);
  const halb = wand.dicke / 2;
  // Senkrechte zur Wandrichtung.
  const nx = -richtung.y * halb;
  const ny = richtung.x * halb;
  const p1x = wand.ax + nx;
  const p1y = wand.ay + ny;
  const p2x = wand.bx + nx;
  const p2y = wand.by + ny;
  const p3x = wand.bx - nx;
  const p3y = wand.by - ny;
  const p4x = wand.ax - nx;
  const p4y = wand.ay - ny;
  ziel.push(segment(p1x, p1y, p2x, p2y));
  ziel.push(segment(p2x, p2y, p3x, p3y));
  ziel.push(segment(p3x, p3y, p4x, p4y));
  ziel.push(segment(p4x, p4y, p1x, p1y));
}

/*
 * Zwischenspeicher für die Segmente je Karte.
 *
 * Das ist Modul-Zustand, aber KEIN Spielzustand: Der Inhalt ist eine reine
 * Funktion der Karte und ändert sich nie. Ein Schnappschuss muss ihn deshalb
 * nicht mitnehmen, und ein Rückspulen kann ihn nicht falsch machen. Geschlüsselt
 * wird auf das Kartenobjekt selbst und nicht auf `id`, damit zwei Karten mit
 * versehentlich gleicher Kennung (in Tests schnell passiert) sich nicht
 * gegenseitig die Wände unterschieben.
 */
const segmentSpeicher = new Map<Karte, Segment[]>();

/**
 * Alle Wandsegmente einer Karte, Rahmen eingeschlossen — einmal je Karte
 * gerechnet.
 *
 * Drehkreuze sind NICHT dabei: Ihre Lage hängt am Takt, sie werden in der
 * Physik je Takt neu aufgebaut.
 */
export function segmenteVon(karte: Karte): Segment[] {
  const fertig = segmentSpeicher.get(karte);
  if (fertig !== undefined) return fertig;
  const segmente: Segment[] = [];
  for (const wand of randWaende(karte)) {
    rechteckSegmente(wand.x, wand.y, wand.w, wand.h, segmente);
  }
  for (const wand of karte.waende) {
    if (istRechteck(wand)) rechteckSegmente(wand.x, wand.y, wand.w, wand.h, segmente);
    else schraegSegmente(wand, segmente);
  }
  segmentSpeicher.set(karte, segmente);
  return segmente;
}

/* --------------------------------------------------------------------------
 * Zonen nach Wirkung sortiert
 * ----------------------------------------------------------------------- */

/**
 * Die Zonen einer Karte, nach dem sortiert, wer sie wann braucht.
 *
 * Ohne das läuft die Physik die volle Zonenliste DREIMAL je Ball und
 * Unterschritt ab (Untergrund, Ortswirkung, Bumper) — bei acht Bällen, fünf
 * Unterschritten und elf Zonen sind das 1320 Durchläufe je Takt, von denen
 * die allermeisten nur ein `art !==` prüfen. Sortiert sind es 440.
 */
export interface Zonengruppen {
  /** Sand und Eis in Kartenreihenfolge — bei Überlappung gewinnt der letzte. */
  untergrund: (ZoneSand | ZoneEis)[];
  beschleuniger: ZoneBeschleuniger[];
  strudel: ZoneStrudel[];
  wasser: ZoneWasser[];
  portale: ZonePortal[];
  sprungfelder: ZoneSprungfeld[];
  bumper: ZoneBumper[];
  drehkreuze: ZoneDrehkreuz[];
}

const gruppenSpeicher = new Map<Karte, Zonengruppen>();

/** Die sortierten Zonen einer Karte — einmal je Karte gerechnet. */
export function zonengruppen(karte: Karte): Zonengruppen {
  const fertig = gruppenSpeicher.get(karte);
  if (fertig !== undefined) return fertig;
  const g: Zonengruppen = {
    untergrund: [],
    beschleuniger: [],
    strudel: [],
    wasser: [],
    portale: [],
    sprungfelder: [],
    bumper: [],
    drehkreuze: [],
  };
  for (const zone of karte.zonen) {
    if (zone.art === 'sand' || zone.art === 'eis') g.untergrund.push(zone);
    else if (zone.art === 'beschleuniger') g.beschleuniger.push(zone);
    else if (zone.art === 'strudel') g.strudel.push(zone);
    else if (zone.art === 'wasser') g.wasser.push(zone);
    else if (zone.art === 'portal') g.portale.push(zone);
    else if (zone.art === 'sprungfeld') g.sprungfelder.push(zone);
    else if (zone.art === 'bumper') g.bumper.push(zone);
    else g.drehkreuze.push(zone);
  }
  gruppenSpeicher.set(karte, g);
  return g;
}

/** Leert die Zwischenspeicher — nur für Messungen und Tests. */
export function vergissSegmente(): void {
  segmentSpeicher.clear();
  gruppenSpeicher.clear();
}

/* --------------------------------------------------------------------------
 * Flächenabfragen
 * ----------------------------------------------------------------------- */

/**
 * Liegt der Punkt in der Zone?
 *
 * Für das Drehkreuz immer `false`: Es ist eine Wand, keine Fläche — wer es als
 * Zone abfragt, meint etwas anderes, als er bekommt.
 */
export function istInZone(zone: Zone, x: number, y: number): boolean {
  if (zone.art === 'drehkreuz') return false;
  if (zone.art === 'portal' || zone.art === 'bumper' || zone.art === 'strudel') {
    const dx = x - zone.x;
    const dy = y - zone.y;
    return dx * dx + dy * dy <= zone.r * zone.r;
  }
  if (istKreis(zone)) {
    const dx = x - zone.x;
    const dy = y - zone.y;
    return dx * dx + dy * dy <= zone.r * zone.r;
  }
  return x >= zone.x && x <= zone.x + zone.w && y >= zone.y && y <= zone.y + zone.h;
}

/**
 * Quadrat des Abstands eines Punktes zu einer Strecke.
 *
 * Quadriert, weil der Aufrufer fast immer nur vergleicht — und eine Wurzel, die
 * niemand liest, kostet in der inneren Schleife spürbar.
 */
export function abstandQuadrat(seg: Segment, px: number, py: number): number {
  let t = 0;
  if (seg.laengeQ > 0) {
    t = ((px - seg.ax) * seg.dx + (py - seg.ay) * seg.dy) / seg.laengeQ;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const nx = px - (seg.ax + seg.dx * t);
  const ny = py - (seg.ay + seg.dy * t);
  return nx * nx + ny * ny;
}

/** Kleinster Abstand eines Punktes zu irgendeiner Wand der Karte. */
export function abstandZuWaenden(karte: Karte, x: number, y: number): number {
  let besteQ = Infinity;
  for (const seg of segmenteVon(karte)) {
    const q = abstandQuadrat(seg, x, y);
    if (q < besteQ) besteQ = q;
  }
  return Math.sqrt(besteQ);
}

/**
 * Quadrat des kleinsten Abstands zwischen zwei Strecken.
 *
 * Gebraucht für die Sichtlinie der Bots: Der Ball ist ein Kreis, sein Weg also
 * eine Kapsel. „Ist der Weg frei" heißt genau: Ist jede Wand weiter als der
 * Ballradius von der Wegstrecke entfernt.
 *
 * Beide Strecken kommen fertig herein und werden nicht hier gebaut: Ein Bot
 * prüft je Entscheidung bis zu 50 Wegpunkte gegen alle Wände, und ein
 * `segment()` je Paar wären ein paar Tausend Objekte je Entscheidung.
 */
export function streckenAbstandQuadrat(a: Segment, b: Segment): number {
  // Schneiden sich die Strecken, ist der Abstand null.
  const d1 = a.dx * (b.ay - a.ay) - a.dy * (b.ax - a.ax);
  const d2 = a.dx * (b.by - a.ay) - a.dy * (b.bx - a.ax);
  const d3 = b.dx * (a.ay - b.ay) - b.dy * (a.ax - b.ax);
  const d4 = b.dx * (a.by - b.ay) - b.dy * (a.bx - b.ax);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  // Sonst liegt das Minimum an einem der vier Endpunkte.
  let beste = abstandQuadrat(a, b.ax, b.ay);
  let q = abstandQuadrat(a, b.bx, b.by);
  if (q < beste) beste = q;
  q = abstandQuadrat(b, a.ax, a.ay);
  if (q < beste) beste = q;
  q = abstandQuadrat(b, a.bx, a.by);
  if (q < beste) beste = q;
  return beste;
}

/** Bequeme Fassung von `streckenAbstandQuadrat` für Aufrufer ohne heißen Pfad. */
export function segmentAbstandQuadrat(
  seg: Segment,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  return streckenAbstandQuadrat(seg, segment(ax, ay, bx, by));
}
