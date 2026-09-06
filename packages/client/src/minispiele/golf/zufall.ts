/**
 * Zufall, Winkel und Vektoren für Golf — alles so gerechnet, dass jedes Gerät
 * auf die Stelle genau dieselbe Zahl bekommt.
 *
 * Golf läuft im Gleichschritt: Über die Leitung gehen nur Schläge, die Bahn
 * rechnet jedes Gerät selbst. Weicht ein Gerät in der letzten Stelle ab, läuft
 * die Abweichung über den ersten Wandabprall auseinander und zwei Spieler
 * sehen zwei verschiedene Partien. Deshalb gilt in der Simulation:
 *
 *   - Nur `+ - * /` und `Math.sqrt`. Das sind die einzigen Rechenarten, die
 *     IEEE-754 auf die letzte Stelle vorschreibt; `Math.sin`, `Math.cos`,
 *     `Math.pow`, `Math.hypot` und `Math.exp` dürfen sich zwischen V8 und
 *     JavaScriptCore (Safari — dort läuft die Beta) unterscheiden.
 *   - Winkel gibt es nur an zwei Stellen (Drehkreuz, Bot-Streuung), und dort
 *     ausschließlich über die Tabellen hier unten: Sie werden EINMAL beim Laden
 *     mit `Math.sin`/`Math.cos` gefüllt und dabei auf sechs Nachkommastellen
 *     gerundet. Eine Abweichung in der 16. Stelle kann eine gerundete Zahl
 *     unmöglich in eine andere kippen — nach dem Runden sind alle Geräte
 *     wieder gleich.
 *   - Kein `Math.random`. Zufall kommt aus mulberry32, dessen Zustand im
 *     Partiezustand mitreist und damit von jedem Schnappschuss mitkopiert wird.
 */

/** Ein Richtungsvektor (nicht zwingend normiert). */
export interface Richtung {
  x: number;
  y: number;
}

/* --------------------------------------------------------------------------
 * mulberry32
 * ----------------------------------------------------------------------- */

/**
 * Macht aus einem beliebigen Saatkorn einen Startzustand.
 *
 * Der Zustand ist eine einzelne vorzeichenbehaftete 32-Bit-Zahl — genau
 * deshalb passt er als schlichtes `zufall: number` in den Partiezustand und
 * wird beim Schnappschuss einfach mitkopiert. Ein Generator als Closure
 * (`() => number`) wäre bequemer, ließe sich aber nicht kopieren, und ohne
 * kopierbaren Zufall gibt es kein Rückspulen.
 */
export function mulberry32(saat: number): number {
  return saat | 0;
}

/**
 * Ein Schritt: liefert den Wert in [0,1) UND den neuen Zustand.
 *
 * `Math.imul` ist ganzzahlige 32-Bit-Multiplikation und damit exakt — anders
 * als `a * b` bei großen Zahlen, wo die Gleitkommadarstellung Stellen verliert.
 */
export function naechste(zustand: number): { wert: number; zustand: number } {
  const a = (zustand + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { wert: ((t ^ (t >>> 14)) >>> 0) / 4294967296, zustand: a };
}

/**
 * Eine ganze Zahl in [von, bis], beide einschließlich.
 *
 * Über `Math.floor` auf dem Bruch — `Math.floor` ist exakt, weil es nichts
 * rechnet, sondern nur abschneidet.
 */
export function ganzzahl(
  zustand: number,
  von: number,
  bis: number,
): { wert: number; zustand: number } {
  const z = naechste(zustand);
  const spanne = bis - von + 1;
  let wert = von + Math.floor(z.wert * spanne);
  // Sicherheitsnetz: bei 0,999… und großer Spanne kann die Multiplikation
  // aufrunden und genau auf `bis + 1` fallen.
  if (wert > bis) wert = bis;
  return { wert, zustand: z.zustand };
}

/** Eine Zahl in [von, bis) als Gleitkomma. */
export function bruch(
  zustand: number,
  von: number,
  bis: number,
): { wert: number; zustand: number } {
  const z = naechste(zustand);
  return { wert: von + z.wert * (bis - von), zustand: z.zustand };
}

/**
 * Ein eigener Zufallsstrom je Sitz, abgeleitet aus dem Saatkorn.
 *
 * Warum je Sitz ein eigener Strom und nicht der gemeinsame: Der Bot von Sitz 3
 * soll immer denselben Schlag machen, egal ob Sitz 1 kurz vorher gezogen hat.
 * Mit einem gemeinsamen Strom hinge sein Wurf an der ANZAHL der Ziehungen
 * davor — und die ändert sich beim Rückspulen sehr wohl, weil ein
 * zurückgenommener Schlag anders zieht als ein zugelassener.
 */
export function stromFuerSitz(saat: number, sitz: number): number {
  return mulberry32(saat ^ Math.imul(sitz + 1, 0x9e3779b9));
}

/* --------------------------------------------------------------------------
 * FNV-1a
 * ----------------------------------------------------------------------- */

/**
 * FNV-1a über einen Text, als achtstelliger Hexwert.
 *
 * Dient als Prüfsumme der Schlagzahlen: Alle Geräte melden am Matchende ihre
 * Zahlen mit dieser Summe, und das Modul erkennt daran, ob zwei Geräte
 * dieselbe Partie gesehen haben.
 */
export function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* --------------------------------------------------------------------------
 * Quantisierte Winkel
 * ----------------------------------------------------------------------- */

function tabelle(schritte: number, gradJeSchritt: number, sinus: boolean): number[] {
  const werte: number[] = new Array<number>(schritte);
  for (let i = 0; i < schritte; i += 1) {
    // 0.017453292519943295 = pi/180 als Literal. Math.PI wäre auch exakt, aber
    // ein Literal macht sichtbar, dass hier nichts gerechnet wird, was ein
    // Gerät anders sehen könnte — gerundet wird ohnehin gleich danach.
    const bogen = i * gradJeSchritt * 0.017453292519943295;
    const roh = sinus ? Math.sin(bogen) : Math.cos(bogen);
    // Sechs Nachkommastellen: fein genug, dass man den Sprung nicht sieht (bei
    // 20 E Bahnlänge sind das 0,00002 E), grob genug, dass keine
    // Engine-Abweichung sie je erreicht.
    werte[i] = Math.round(roh * 1e6) / 1e6;
  }
  return werte;
}

/** Sinus für ganze Grad, quantisiert auf sechs Nachkommastellen. */
export const SIN: readonly number[] = tabelle(360, 1, true);
/** Kosinus für ganze Grad, quantisiert auf sechs Nachkommastellen. */
export const COS: readonly number[] = tabelle(360, 1, false);

/*
 * Zweite Tabelle für Hundertstelgrad.
 *
 * Warum es sie gibt: Die feinste Bot-Stufe streut um plusminus 0,8 Grad — auf
 * ganze Grad gerundet wäre das „minus eins, null oder plus eins", also
 * entweder gar keine Streuung oder eine um ein Viertel zu große. Eine Drehung
 * um a + b ist dieselbe wie erst um a und dann um b, also setzt
 * `dreheHundertstel` die feine Drehung aus zwei Tabellenwerten zusammen und
 * bleibt trotzdem quantisiert.
 */
const SIN_FEIN: readonly number[] = tabelle(100, 0.01, true);
const COS_FEIN: readonly number[] = tabelle(100, 0.01, false);

/**
 * Dreht `(rx, ry)` um `grad` GANZE Grad (bei y nach unten im Uhrzeigersinn).
 *
 * Negative und übergroße Werte werden auf 0..359 gefaltet, damit der Aufrufer
 * nicht selbst rechnen muss.
 */
export function drehe(rx: number, ry: number, grad: number): Richtung {
  let g = grad % 360;
  if (g < 0) g += 360;
  const s = SIN[g];
  const c = COS[g];
  return { x: rx * c - ry * s, y: rx * s + ry * c };
}

/**
 * Dreht `(rx, ry)` um `hundertstel / 100` Grad.
 *
 * Gebraucht für die Streuung der Bots, siehe Kommentar bei `SIN_FEIN`.
 */
export function dreheHundertstel(rx: number, ry: number, hundertstel: number): Richtung {
  let h = hundertstel % 36000;
  if (h < 0) h += 36000;
  const grob = Math.floor(h / 100);
  const fein = h - grob * 100;
  const grobDreh = drehe(rx, ry, grob);
  if (fein === 0) return grobDreh;
  const s = SIN_FEIN[fein];
  const c = COS_FEIN[fein];
  return { x: grobDreh.x * c - grobDreh.y * s, y: grobDreh.x * s + grobDreh.y * c };
}

/* --------------------------------------------------------------------------
 * Vektoren
 * ----------------------------------------------------------------------- */

/** Länge eines Vektors — die einzige Wurzel, die die Simulation zieht. */
export function betrag(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/**
 * Einheitsvektor.
 *
 * Bei Länge 0 kommt `(1, 0)` zurück statt `(0, 0)`: Ein Nullvektor als
 * Richtung erzeugt später ein 0/0 und damit NaN, und NaN frisst sich durch den
 * ganzen Zustand, bis nichts mehr zu retten ist.
 */
export function normiere(x: number, y: number): Richtung {
  const l = betrag(x, y);
  if (l === 0) return { x: 1, y: 0 };
  return { x: x / l, y: y / l };
}

/**
 * Rundet eine Richtung auf vier Nachkommastellen — so geht sie über die
 * Leitung, und so muss sie auf jedem Gerät ankommen.
 */
export function rundeRichtung(rx: number, ry: number): Richtung {
  return { x: Math.round(rx * 1e4) / 1e4, y: Math.round(ry * 1e4) / 1e4 };
}
