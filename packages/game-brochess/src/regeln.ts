/**
 * Regelsatz von BroChess.
 *
 * Klassisches Schach hat keine Hausregeln, die ein Tisch waehlen koennte —
 * aber eine Zeitkontrolle. Bis zum 22.10.2026 stand hier, die Schachuhr
 * gehoere ausdruecklich nicht dazu, sie sei Plattformzeit. Das stimmt nur
 * halb: MESSEN ist Plattformzeit (das Modul hat keine Uhr, game-api), aber
 * WELCHE Bedenkzeit gilt, wann der Zuschlag kommt und was ein Zeitablauf
 * bedeutet, sind Schachregeln (FIDE 6). Deshalb steht die Zeitkontrolle hier,
 * und die Plattform fragt das Modul ueber `schachuhr` (game-api), statt sie
 * selbst zu deuten.
 *
 * Ohne `bedenkzeitMs` spielt der Tisch wie vorher ohne Schachuhr, nur mit
 * der Zugzeit der Plattform — so laufen alte Tische und Tests unveraendert.
 *
 * Einsatz, Topf, Preise gehoeren nie hierher (game-api, Grundsatz 4).
 */

import type { ConfigProblem } from '@brauweg/game-api';

export interface BroChessRegeln {
  /** Bedenkzeit je Spieler fuer die ganze Partie. Fehlt sie, gibt es keine Schachuhr. */
  readonly bedenkzeitMs?: number;
  /** Zuschlag je Zug (Fischer-Modus), gutgeschrieben nach dem eigenen Zug. */
  readonly zuschlagMs?: number;
  /**
   * Spielart, seit dem 02.11.2026. Fehlt das Feld, ist es 'normal' — so
   * spielen alte Tische und Tests unveraendert weiter. 'secretDame': Jede
   * Seite bestimmt vor dem ersten Zug heimlich eine eigene Figur (nicht den
   * König), die zusaetzlich wie eine Dame ziehen darf (geheim.ts).
   * 'dreiSchach' (seit dem 14.11.2026): Wer dem Gegner zum dritten Mal
   * Schach gibt, gewinnt (dreischach.ts).
   * 'chess960' (seit dem 16.11.2026): Grundreihe aus 960 Anordnungen, Rochade
   * nach Chess960-Regeln (chess960.ts, brett.ts).
   * 'huegel' (seit dem 17.11.2026): Wer seinen König legal auf d4, e4, d5
   * oder e5 zieht, gewinnt (huegel.ts).
   * 'nebel' (seit dem 17.11.2026): Nebelschach — jeder sieht nur seine eigenen
   * Felder und deren Zugziele, kein Schach, gewonnen hat, wer den König schlaegt
   * (nebel.ts).
   */
  readonly modus?: Modus | 'zufall';
  /**
   * Nur bei 'secretDame': Zaehlt die Drohung einer noch VERDECKTEN Dame als
   * Schach? 'A' (Vorgabe): nein — der Gegner weiss ja nichts von ihr; laesst
   * er seinen König in ihrer Reichweite stehen, darf sie ihn schlagen, und
   * die Partie ist aus. 'B': ja, sie zaehlt wie eine offene Dame (fuer
   * Schach, Matt und die erlaubten Zuege des Gegners) — dafuer verraten
   * dessen erlaubte Zuege, wo sie stehen koennte.
   */
  readonly schachDurchVerdeckte?: SchachDurchVerdeckte;
}

export type Modus = 'normal' | 'secretDame' | 'dreiSchach' | 'chess960' | 'huegel' | 'nebel';
export type SchachDurchVerdeckte = 'A' | 'B';

export const MODI: readonly Modus[] = ['normal', 'secretDame', 'dreiSchach', 'chess960', 'huegel', 'nebel'];
export const SCHACH_DURCH_VERDECKTE: readonly SchachDurchVerdeckte[] = ['A', 'B'];

/**
 * Die Spezialmodi, aus denen 'zufall' zieht — alles ausser dem klassischen
 * Schach. Seit dem 28.11.2026 fuer die Spielart „Spezial" (spielarten.ts):
 * Robin wollte eine Karte, hinter der jedes Mal ein anderer Modus steckt.
 */
export const ZUFALLS_MODI: readonly Modus[] = ['secretDame', 'dreiSchach', 'chess960', 'huegel', 'nebel'];

/**
 * Spielart des Regelsatzes; ein fehlendes Feld heisst 'normal'.
 *
 * 'zufall' kommt hier nie an: `zufallAufgeloest` ersetzt es beim Partiebau
 * durch einen echten Modus, und gelesen wird nur noch der Regelsatz der
 * Partie. Steht es doch einmal da (ein Aufruf am Partiebau vorbei), ist es
 * klassisches Schach — lieber das als ein Modus, den niemand gezogen hat.
 */
export function modusVon(regeln: BroChessRegeln): Modus {
  const modus = regeln.modus ?? 'normal';
  return modus === 'zufall' ? 'normal' : modus;
}

/**
 * 'zufall' durch einen Modus aus `ZUFALLS_MODI` ersetzen — aus der Saat,
 * denn ein Modul kennt keinen anderen Zufall (game-api, Grundsatz 1).
 *
 * Die Saat wird vorher verruehrt: Ihr letztes Bit entscheidet schon, wer Weiss
 * spielt (`erstellePartie`), und ein roher Rest modulo fuenf hinge daran.
 */
export function zufallAufgeloest(regeln: BroChessRegeln, seed: number): BroChessRegeln {
  if (regeln.modus !== 'zufall') return regeln;
  const verruehrt = Math.imul(Math.trunc(seed) | 0, 0x9e3779b1) >>> 0;
  const modus = ZUFALLS_MODI[(verruehrt >>> 7) % ZUFALLS_MODI.length]!;
  return { ...regeln, modus };
}

/** Regel fuer die Drohung der verdeckten Dame; ein fehlendes Feld heisst 'A'. */
export function schachRegelVon(regeln: BroChessRegeln): SchachDurchVerdeckte {
  return regeln.schachDurchVerdeckte ?? 'A';
}

export const DEFAULT_REGELN: BroChessRegeln = {};

/** Kuerzeste Bedenkzeit: 20 Sekunden wie „20 sec + 1" in der Auswahl. */
export const BEDENKZEIT_MIN_MS = 20_000;
/** Laengste: drei Stunden. Mehr ist kein Schnellschach, sondern ein vergessener Tisch. */
export const BEDENKZEIT_MAX_MS = 3 * 60 * 60_000;
export const ZUSCHLAG_MAX_MS = 60_000;

/** Schach ist ein Duell. */
export const SEAT_COUNTS: readonly number[] = [2];

/** Eine Partie ist eine Runde; es gibt keinen Geber, der reihum wechseln muesste. */
export function rotationSize(): number {
  return 1;
}

export function suggestedRounds(): readonly number[] {
  return [1];
}

function ganzzahlImBereich(wert: unknown, min: number, max: number): boolean {
  return typeof wert === 'number' && Number.isInteger(wert) && wert >= min && wert <= max;
}

export function pruefeRegeln(config: unknown, seats: number, rounds: number): ConfigProblem[] {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    return [{ path: 'config', messageKey: 'ruleset.notAnObject', severity: 'error' }];
  }
  const probleme: ConfigProblem[] = [];
  if (!SEAT_COUNTS.includes(seats)) {
    probleme.push({ path: 'seats', messageKey: 'ruleset.tableSizeUnsupported', severity: 'error' });
  }
  /*
   * Genau eine Partie je Tisch. Mehrere hintereinander waeren ein Match, und
   * dafuer fehlt alles, was ein Match ausmacht (Farbwechsel, Zwischenstand) —
   * lieber abweisen als eine zweite Partie still verschlucken.
   */
  if (rounds !== 1) {
    probleme.push({ path: 'rounds', messageKey: 'ruleset.roundsOutOfRange', severity: 'error' });
  }
  const regeln = config as {
    bedenkzeitMs?: unknown;
    zuschlagMs?: unknown;
    modus?: unknown;
    schachDurchVerdeckte?: unknown;
  };
  if (regeln.modus !== undefined && regeln.modus !== 'zufall' && !MODI.includes(regeln.modus as Modus)) {
    probleme.push({ path: 'modus', messageKey: 'ruleset.modus', severity: 'error' });
  }
  if (
    regeln.schachDurchVerdeckte !== undefined &&
    !SCHACH_DURCH_VERDECKTE.includes(regeln.schachDurchVerdeckte as SchachDurchVerdeckte)
  ) {
    probleme.push({
      path: 'schachDurchVerdeckte',
      messageKey: 'ruleset.schachDurchVerdeckte',
      severity: 'error',
    });
  }
  if (
    regeln.bedenkzeitMs !== undefined &&
    !ganzzahlImBereich(regeln.bedenkzeitMs, BEDENKZEIT_MIN_MS, BEDENKZEIT_MAX_MS)
  ) {
    probleme.push({ path: 'bedenkzeitMs', messageKey: 'ruleset.bedenkzeit', severity: 'error' });
  }
  if (regeln.zuschlagMs !== undefined) {
    // Ein Zuschlag ohne Bedenkzeit waere eine Uhr ohne Zifferblatt.
    if (regeln.bedenkzeitMs === undefined || !ganzzahlImBereich(regeln.zuschlagMs, 0, ZUSCHLAG_MAX_MS)) {
      probleme.push({ path: 'zuschlagMs', messageKey: 'ruleset.zuschlag', severity: 'error' });
    }
  }
  return probleme;
}

/** Die Uhr dieses Regelsatzes, oder null fuer einen Tisch ohne Schachuhr. */
export function zeitkontrolle(
  regeln: BroChessRegeln,
): { readonly bedenkzeitMs: number; readonly zuschlagMs: number } | null {
  if (regeln.bedenkzeitMs === undefined) return null;
  return { bedenkzeitMs: regeln.bedenkzeitMs, zuschlagMs: regeln.zuschlagMs ?? 0 };
}
