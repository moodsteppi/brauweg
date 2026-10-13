/**
 * Der Computergegner von BroChess — und zugleich der Ersatzzug der Plattform.
 *
 * Bis zum 13.10.2026 stand hier nur ein Ersatzzug ("der erste legale Zug"):
 * genug, damit ein Tisch weiterlaeuft, wenn jemand geht, aber kein Gegner.
 * Seit die App BroChess zum Alleinspielen gegen einen Bot anbietet (Emile,
 * 13.10.2026), rechnet er: Alpha-Beta-Suche ueber Material und
 * Stellungstabellen, Schlagabtausch bis zur Ruhe ausgerechnet.
 *
 * **Deterministisch.** Ein Spielmodul hat keinen Zufall ausser der Saat, und
 * `botAction` bekommt keine. Gleiche Sicht und gleiche Stufe ergeben darum
 * denselben Zug; bei Gleichstand gewinnt der zuerst erzeugte Zug.
 *
 * **Begrenzt ueber Knoten, nicht ueber die Uhr.** Der Bot rechnet im
 * Serverprozess und haelt dort alle anderen Tische an, solange er denkt. Eine
 * Zeitgrenze waere nicht deterministisch (schneller Rechner, anderer Zug);
 * eine Knotengrenze ist es und deckelt die Rechenzeit trotzdem. Reicht sie
 * nicht fuer die volle Tiefe, gilt das Ergebnis der letzten fertigen Tiefe.
 *
 * Die Stufen der Plattform (`BotLevel`):
 * - anfaenger: eine Halbzug-Tiefe, nur Material — nimmt, was haengt, und
 *   uebersieht jede Drohung.
 * - standard: zwei Halbzuege mit Stellungsgefuehl.
 * - experte: drei Halbzuege.
 * - genie: vier Halbzuege.
 */

import type { BotLevel } from '@brauweg/game-api';

import {
  type Stellung,
  type Zug,
  ausFen,
  feldName,
  imSchach,
  legaleZuege,
  pseudoZuege,
  wendeAn,
} from './brett.js';
import type { BroChessAktion } from './partie.js';
import type { BroChessSicht } from './sicht.js';

/** Figurenwerte in Hundertstel-Bauern. */
const WERT: Readonly<Record<string, number>> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/*
 * Stellungstabellen aus Sicht von Weiss, a1 zuerst (wie `brett`). Schwarz
 * liest dieselbe Tabelle gespiegelt. Werte nach dem verbreiteten
 * "Simplified Evaluation Function"-Schema: Mitte besetzen, Springer nicht an
 * den Rand, König hinter den Bauern.
 */
const TABELLE: Readonly<Record<string, readonly number[]>> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, -20, -20, 10, 10, 5,
    5, -5, -10, 0, 0, -10, -5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, 5, 10, 25, 25, 10, 5, 5,
    10, 10, 20, 30, 30, 20, 10, 10,
    50, 50, 50, 50, 50, 50, 50, 50,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 5, 5, 0, 0, 0,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    5, 10, 10, 10, 10, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -10, 5, 5, 5, 5, 5, 0, -10,
    0, 0, 5, 5, 5, 5, 0, -5,
    -5, 0, 5, 5, 5, 5, 0, -5,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  k: [
    20, 30, 10, 0, 0, 10, 30, 20,
    20, 20, 0, 0, 0, 0, 20, 20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
  ],
};

/** Matt schlaegt jede Materialrechnung; je naeher, desto besser. */
const MATT = 100_000;

interface Stufe {
  readonly tiefe: number;
  /** Stellungstabellen mitrechnen? Der Anfaenger zaehlt nur Material. */
  readonly stellung: boolean;
  /** Schlagabtausch am Ende der Suche ausrechnen? */
  readonly ruhe: boolean;
  /** Obergrenze fuer besuchte Stellungen je Zug — deckelt die Rechenzeit. */
  readonly knoten: number;
}

const STUFEN: Readonly<Record<BotLevel, Stufe>> = {
  anfaenger: { tiefe: 1, stellung: false, ruhe: false, knoten: 2_000 },
  standard: { tiefe: 2, stellung: true, ruhe: true, knoten: 8_000 },
  experte: { tiefe: 3, stellung: true, ruhe: true, knoten: 20_000 },
  genie: { tiefe: 4, stellung: true, ruhe: true, knoten: 40_000 },
};

/** Bewertung aus Sicht der Seite am Zug. */
function bewerte(stellung: Stellung, mitStellung: boolean): number {
  let summe = 0;
  const { brett } = stellung;
  for (let feld = 0; feld < 64; feld += 1) {
    const figur = brett[feld]!;
    if (figur === '') continue;
    const art = figur.toLowerCase();
    const weiss = figur !== art;
    let wert = WERT[art]!;
    if (mitStellung) wert += TABELLE[art]![weiss ? feld : feld ^ 56]!;
    summe += weiss ? wert : -wert;
  }
  return stellung.amZug === 'w' ? summe : -summe;
}

/** Schlaege zuerst, wertvolles Opfer mit billigem Taeter vorn (MVV-LVA). */
function ordne(stellung: Stellung, zuege: Zug[]): Zug[] {
  const gewicht = (zug: Zug): number => {
    const opfer = stellung.brett[zug.nach]!;
    const taeter = stellung.brett[zug.von]!.toLowerCase();
    let g = 0;
    if (opfer !== '') g += 10 * WERT[opfer.toLowerCase()]! - WERT[taeter]!;
    if (zug.umwandlung) g += WERT[zug.umwandlung]!;
    return g;
  };
  // Stabil sortiert: Bei gleichem Gewicht bleibt die Erzeugungsreihenfolge,
  // und damit bleibt der Bot deterministisch.
  return zuege
    .map((zug, i) => ({ zug, g: gewicht(zug), i }))
    .sort((a, b) => b.g - a.g || a.i - b.i)
    .map((e) => e.zug);
}

const istSchlag = (stellung: Stellung, zug: Zug): boolean =>
  stellung.brett[zug.nach] !== '' ||
  (stellung.brett[zug.von]!.toLowerCase() === 'p' && zug.nach === stellung.epFeld) ||
  zug.umwandlung !== undefined;

class Suche {
  besucht = 0;
  constructor(private readonly stufe: Stufe) {}

  get erschoepft(): boolean {
    return this.besucht >= this.stufe.knoten;
  }

  /** Nur Schlaege, bis die Stellung ruhig ist — sonst endet die Suche mitten im Abtausch. */
  private ruhe(stellung: Stellung, alpha: number, beta: number): number {
    this.besucht += 1;
    const stehen = bewerte(stellung, this.stufe.stellung);
    if (stehen >= beta) return stehen;
    if (stehen > alpha) alpha = stehen;
    if (this.erschoepft) return stehen;
    const schlaege = pseudoZuege(stellung).filter((z) => istSchlag(stellung, z));
    for (const zug of ordne(stellung, schlaege)) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, stellung.amZug)) continue;
      const wert = -this.ruhe(danach, -beta, -alpha);
      if (wert >= beta) return wert;
      if (wert > alpha) alpha = wert;
    }
    return alpha;
  }

  wert(stellung: Stellung, tiefe: number, alpha: number, beta: number, abstand: number): number {
    if (stellung.halbzugUhr >= 100) return 0;
    if (tiefe === 0) {
      // Matt muss am Blatt erkannt werden, sonst saehe der Bot ein Matt in
      // einem Zug nur als Materialgewinn. Alle Zuege aufzuzaehlen kostet aber,
      // also nur im Schach. Ein Patt am Blatt uebersieht er — das ist selten
      // und kostet hoechstens ein Remis.
      if (imSchach(stellung) && legaleZuege(stellung).length === 0) return -MATT + abstand;
      if (this.stufe.ruhe) return this.ruhe(stellung, alpha, beta);
      this.besucht += 1;
      return bewerte(stellung, this.stufe.stellung);
    }
    this.besucht += 1;
    let bester = -Infinity;
    let legal = 0;
    // Legal wird ein Zug erst hier: Wer den eigenen König im Schach laesst,
    // faellt heraus. Das spart den zweiten Aufbau jeder Stellung, den
    // `legaleZuege` sonst vorab machte.
    for (const zug of ordne(stellung, pseudoZuege(stellung))) {
      const danach = wendeAn(stellung, zug);
      if (imSchach(danach, stellung.amZug)) continue;
      legal += 1;
      const wert = -this.wert(danach, tiefe - 1, -beta, -alpha, abstand + 1);
      if (wert > bester) bester = wert;
      if (wert > alpha) alpha = wert;
      if (alpha >= beta || this.erschoepft) break;
    }
    if (legal === 0) return imSchach(stellung) ? -MATT + abstand : 0;
    return bester;
  }
}

/** Der beste Zug nach Stufe. Wirft nur, wenn es keinen legalen Zug gibt. */
export function besterZug(stellung: Stellung, level: BotLevel): Zug {
  const zuege = legaleZuege(stellung);
  if (zuege.length === 0) throw new Error('Kein legaler Zug');
  const stufe = STUFEN[level];
  const suche = new Suche(stufe);
  let gewaehlt = ordne(stellung, zuege)[0]!;

  // Iterativ vertiefen: Jede fertige Tiefe ist ein gueltiges Ergebnis, und
  // die beste Antwort der vorigen Tiefe wird zuerst gerechnet — sie schneidet
  // in der naechsten am meisten ab.
  for (let tiefe = 1; tiefe <= stufe.tiefe; tiefe += 1) {
    const reihe = [gewaehlt, ...ordne(stellung, zuege).filter((z) => z !== gewaehlt && !gleich(z, gewaehlt))];
    let bester: Zug | null = null;
    let besterWert = -Infinity;
    let alpha = -Infinity;
    let fertig = true;
    for (const zug of reihe) {
      const wert = -suche.wert(wendeAn(stellung, zug), tiefe - 1, -Infinity, -alpha, 1);
      // Ging das Budget mitten in diesem Zug aus, ist sein Wert halb gerechnet
      // und zaehlt nicht. Die Zuege davor sind fertig: Der Beste unter ihnen
      // ist auf dieser Tiefe besser als der Sieger der vorigen, denn der steht
      // vorn und wurde zuerst zu Ende gerechnet.
      if (suche.erschoepft) {
        fertig = false;
        break;
      }
      if (wert > besterWert) {
        besterWert = wert;
        bester = zug;
      }
      if (wert > alpha) alpha = wert;
    }
    if (bester) gewaehlt = bester;
    if (!fertig || besterWert >= MATT - 100) break;
  }
  return gewaehlt;
}

function gleich(a: Zug, b: Zug): boolean {
  return a.von === b.von && a.nach === b.nach && a.umwandlung === b.umwandlung;
}

/** Fuer die Plattform: Zug als Aktion, aus der Sicht des Sitzes am Zug. */
export function botZug(sicht: BroChessSicht, level: BotLevel = 'standard'): BroChessAktion {
  const zug = besterZug(ausFen(sicht.fen), level);
  return {
    type: 'zug',
    von: feldName(zug.von),
    nach: feldName(zug.nach),
    ...(zug.umwandlung ? { umwandlung: zug.umwandlung } : {}),
  };
}
