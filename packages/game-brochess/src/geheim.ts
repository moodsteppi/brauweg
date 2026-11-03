/**
 * Secret Dame: Zuege, Schach und Buchfuehrung der geheimen Dame.
 *
 * Seit dem 02.11.2026 (Projekt „BroChess neuer Modus SecretDame"). Jede Seite
 * bestimmt vor dem ersten Zug heimlich eine eigene Figur ausser dem König.
 * Diese Figur darf ZUSAETZLICH alle Damenzuege. Ein Zug, den ihre Grundfigur
 * nicht darf, deckt sie auf; bis dahin weiss der Gegner nicht, welche es ist.
 *
 * Steht neben brett.ts statt darin, weil die Stellung (FEN) von der geheimen
 * Dame nichts weiss und nichts wissen darf: Die FEN geht in jede Sicht, auch
 * an den Gegner. Was hier steht, braucht deshalb immer zwei Dinge — die
 * Stellung UND den Stand der beiden geheimen Damen.
 *
 * Die zwei Regeln fuer die Drohung einer noch verdeckten Dame (regeln.ts,
 * `schachDurchVerdeckte`) unterscheiden sich an genau einer Stelle:
 * `zaehltAlsDame`. Alles andere — Zuggenerierung, Aufdecken, Schlagen,
 * Umwandlung — ist fuer A und B dasselbe.
 */

import {
  type Farbe,
  type Stellung,
  type Zug,
  UMWANDLUNGEN,
  angegriffen,
  farbeVon,
  feldName,
  linieVon,
  pseudoZuege,
  reiheVon,
  sanVon,
  wendeAn,
} from './brett.js';
import type { SchachDurchVerdeckte } from './regeln.js';

/**
 * Wo eine geheime Dame steht.
 * - offen: noch nicht gewaehlt (nur vor dem ersten Zug)
 * - verdeckt: gewaehlt, der Gegner weiss nicht welche
 * - aufgedeckt: hat einen Zug gemacht, den die Grundfigur nicht darf
 * - geschlagen: vom Brett
 * - erloschen: der Bauer hat sich umgewandelt; die neue Figur ist keine
 *   geheime Dame mehr
 */
export type GeheimZustand = 'offen' | 'verdeckt' | 'aufgedeckt' | 'geschlagen' | 'erloschen';

export interface GeheimeDame {
  readonly zustand: GeheimZustand;
  /** Feld 0..63, auf dem die Figur steht; null, solange nicht gewaehlt oder nicht mehr da. */
  readonly feld: number | null;
  /** Grundfigur in Kleinbuchstaben ('p', 'n', 'b', 'r', 'q'), null vor der Wahl. */
  readonly grundfigur: string | null;
  /**
   * Weiss der Gegner, welche Figur es war? Wird wahr beim Aufdecken und beim
   * Schlagen der verdeckten Figur — und bleibt es. Eine verdeckt
   * umgewandelte Dame bleibt unbekannt: Der Gegner sieht einen Bauern, der
   * sich umwandelt, und mehr geschah fuer ihn auch nicht.
   */
  readonly bekannt: boolean;
}

/**
 * Was in der Partie mit den geheimen Damen geschah. `halbzug` ist die Nummer
 * des Zuges in `verlauf` (1 = erster Zug von Weiss), an dem es geschah.
 */
export type GeheimEreignis =
  | {
      readonly art: 'aufgedeckt';
      readonly farbe: Farbe;
      /** Feld, auf dem die Figur nach dem aufdeckenden Zug steht. */
      readonly feld: string;
      readonly grundfigur: string;
      readonly halbzug: number;
    }
  | {
      readonly art: 'verdecktGeschlagen';
      /** Farbe der geschlagenen Figur (deren Besitzer). */
      readonly farbe: Farbe;
      readonly feld: string;
      readonly grundfigur: string;
      readonly halbzug: number;
    }
  | {
      readonly art: 'umgewandelt';
      readonly farbe: Farbe;
      readonly feld: string;
      readonly grundfigur: 'p';
      /** War die Dame beim Umwandeln noch verdeckt? Dann sieht das Ereignis nur ihr Besitzer. */
      readonly verdeckt: boolean;
      readonly halbzug: number;
    }
  | {
      /** Regel A: Die Dame hat den König geschlagen. Fuer beide Sitze sichtbar. */
      readonly art: 'koenigGeschlagen';
      /** Farbe des Schlagenden. */
      readonly farbe: Farbe;
      /** Feld des geschlagenen Königs. */
      readonly feld: string;
      readonly halbzug: number;
    };

export interface SecretDameStand {
  readonly regel: SchachDurchVerdeckte;
  readonly w: GeheimeDame;
  readonly b: GeheimeDame;
  readonly ereignisse: readonly GeheimEreignis[];
}

/** Ein Zug im Secret-Dame-Modus. `dame`: Nur die geheime Dame darf ihn — er deckt sie auf. */
export interface GeheimZug extends Zug {
  readonly dame: boolean;
}

export const OFFEN: GeheimeDame = { zustand: 'offen', feld: null, grundfigur: null, bekannt: false };

export function neuerStand(regel: SchachDurchVerdeckte): SecretDameStand {
  return { regel, w: OFFEN, b: OFFEN, ereignisse: [] };
}

const gegner = (farbe: Farbe): Farbe => (farbe === 'w' ? 'b' : 'w');

/** Haben beide gewaehlt? Vorher wird nicht gezogen. */
export function wahlFertig(stand: SecretDameStand): boolean {
  return stand.w.zustand !== 'offen' && stand.b.zustand !== 'offen';
}

/** Hat die Figur (noch) Damenkraft? */
export function aktiv(dame: GeheimeDame): boolean {
  return (dame.zustand === 'verdeckt' || dame.zustand === 'aufgedeckt') && dame.feld !== null;
}

/**
 * Zaehlt die Damenkraft dieser Figur fuer Schach und Legalitaet? Aufgedeckt
 * immer; verdeckt nur bei Regel B. Die Gangart der Grundfigur zaehlt
 * ohnehin — die sieht `angegriffen` aus brett.ts auf dem Brett.
 */
export function zaehltAlsDame(dame: GeheimeDame, regel: SchachDurchVerdeckte): boolean {
  if (!aktiv(dame)) return false;
  return dame.zustand === 'aufgedeckt' || regel === 'B';
}

/** Darf diese Farbe die Figur auf `feld` waehlen? Jede eigene ausser dem König. */
export function waehlbar(stellung: Stellung, farbe: Farbe, feld: number): boolean {
  const figur = stellung.brett[feld];
  return figur !== undefined && figur !== '' && farbeVon(figur) === farbe && figur.toLowerCase() !== 'k';
}

export function waehle(stand: SecretDameStand, stellung: Stellung, farbe: Farbe, feld: number): SecretDameStand {
  return {
    ...stand,
    [farbe]: {
      zustand: 'verdeckt',
      feld,
      grundfigur: stellung.brett[feld]!.toLowerCase(),
      bekannt: false,
    } satisfies GeheimeDame,
  };
}

// ---------------------------------------------------------------------------
// Damengangart
// ---------------------------------------------------------------------------

const DAME_RICHTUNGEN: readonly (readonly [number, number])[] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function feldBei(linie: number, reihe: number): number {
  if (linie < 0 || linie > 7 || reihe < 0 || reihe > 7) return -1;
  return reihe * 8 + linie;
}

/** Felder, die eine Dame auf `von` erreicht: leer oder mit gegnerischer Figur (auch dem König). */
function dameZiele(brett: readonly string[], von: number, farbe: Farbe): number[] {
  const ziele: number[] = [];
  for (const [dl, dr] of DAME_RICHTUNGEN) {
    for (let schritt = 1; schritt < 8; schritt += 1) {
      const f = feldBei(linieVon(von) + dl * schritt, reiheVon(von) + dr * schritt);
      if (f < 0) break;
      const figur = brett[f]!;
      if (figur === '') {
        ziele.push(f);
        continue;
      }
      if (farbeVon(figur) !== farbe) ziele.push(f);
      break;
    }
  }
  return ziele;
}

/** Greift eine Dame auf `von` das Feld `ziel` an? */
function dameGreiftAn(brett: readonly string[], von: number, ziel: number): boolean {
  if (von === ziel) return false;
  for (const [dl, dr] of DAME_RICHTUNGEN) {
    for (let schritt = 1; schritt < 8; schritt += 1) {
      const f = feldBei(linieVon(von) + dl * schritt, reiheVon(von) + dr * schritt);
      if (f < 0) break;
      if (f === ziel) return true;
      if (brett[f] !== '') break;
    }
  }
  return false;
}

const alsFarbe = (art: string, farbe: Farbe): string =>
  farbe === 'w' ? art.toUpperCase() : art.toLowerCase();

// ---------------------------------------------------------------------------
// Zug ausfuehren
// ---------------------------------------------------------------------------

/**
 * Wendet einen Zug an. Ein Zug der Grundfigur geht durch `wendeAn` aus
 * brett.ts (en passant, Rochade, Doppelschritt — alles wie sonst). Ein
 * reiner Damenzug NICHT: `wendeAn` sieht nur den Figurbuchstaben und hielte
 * einen Bauern, der als Dame schraeg auf das En-passant-Feld zieht, fuer
 * einen En-passant-Schlag, oder einen Damenzug ueber zwei Reihen fuer einen
 * Doppelschritt.
 */
export function wendeAnGeheim(stellung: Stellung, zug: GeheimZug): Stellung {
  if (!zug.dame) return wendeAn(stellung, zug);
  const brett = [...stellung.brett];
  const figur = brett[zug.von]!;
  const farbe = stellung.amZug;
  const geschlagen = brett[zug.nach] !== '';
  brett[zug.nach] = zug.umwandlung ? alsFarbe(zug.umwandlung, farbe) : figur;
  brett[zug.von] = '';
  // Ein Turm, der als Dame von seinem Eckfeld zieht, rochiert danach nicht
  // mehr — und ein geschlagener Turm auch nicht.
  let rochade = stellung.rochade;
  for (const feld of [zug.von, zug.nach]) {
    if (feld === 0) rochade = rochade.replace('Q', '');
    if (feld === 7) rochade = rochade.replace('K', '');
    if (feld === 56) rochade = rochade.replace('q', '');
    if (feld === 63) rochade = rochade.replace('k', '');
  }
  return {
    brett,
    amZug: gegner(farbe),
    rochade,
    epFeld: null,
    halbzugUhr: figur.toLowerCase() === 'p' || geschlagen ? 0 : stellung.halbzugUhr + 1,
    zugNummer: farbe === 'b' ? stellung.zugNummer + 1 : stellung.zugNummer,
  };
}

/** Feld der Figur, die der Zug schlaegt, oder null. En passant steht der Bauer neben dem Ziel. */
function geschlagenesFeld(stellung: Stellung, zug: GeheimZug): number | null {
  if (stellung.brett[zug.nach] !== '') return zug.nach;
  const figur = stellung.brett[zug.von]!;
  if (!zug.dame && figur.toLowerCase() === 'p' && zug.nach === stellung.epFeld) {
    return zug.nach + (stellung.amZug === 'w' ? -8 : 8);
  }
  return null;
}

/** Schlaegt der Zug den gegnerischen König? Geht nur mit der verdeckten Dame unter Regel A. */
export function schlaegtKoenig(stellung: Stellung, zug: Zug): boolean {
  const ziel = stellung.brett[zug.nach]!;
  return ziel !== '' && ziel.toLowerCase() === 'k' && farbeVon(ziel) !== stellung.amZug;
}

// ---------------------------------------------------------------------------
// Schach und legale Zuege
// ---------------------------------------------------------------------------

/** Greift `von` das Feld an — mit der Damenkraft der geheimen Dame, soweit sie zaehlt? */
function angegriffenGeheim(
  brett: readonly string[],
  feld: number,
  von: Farbe,
  dame: GeheimeDame,
  regel: SchachDurchVerdeckte,
): boolean {
  if (angegriffen(brett, feld, von)) return true;
  return zaehltAlsDame(dame, regel) && dameGreiftAn(brett, dame.feld!, feld);
}

/** Steht der König dieser Farbe im Schach — nach der Regel des Tisches? */
export function imSchachGeheim(
  stellung: Stellung,
  stand: SecretDameStand,
  farbe: Farbe = stellung.amZug,
): boolean {
  const koenig = stellung.brett.indexOf(alsFarbe('k', farbe));
  if (koenig < 0) return false;
  return angegriffenGeheim(stellung.brett, koenig, gegner(farbe), stand[gegner(farbe)], stand.regel);
}

/**
 * Alle Zuege der Seite am Zug: die der Grundfiguren wie sonst, dazu die
 * Damenzuege der eigenen geheimen Dame, die ihre Grundfigur nicht darf.
 *
 * Legal ist ein Zug, wenn der eigene König danach nicht angegriffen ist —
 * gezaehlt nach der Regel des Tisches (`zaehltAlsDame`). Unter Regel A kann
 * der Gegner seinen König darum in der Reichweite der verdeckten Dame
 * stehen lassen; der Zug, der ihn dann schlaegt, ist legal und beendet die
 * Partie.
 */
export function legaleZuegeGeheim(stellung: Stellung, stand: SecretDameStand): GeheimZug[] {
  const farbe = stellung.amZug;
  const { brett } = stellung;
  const eigene = stand[farbe];
  const basis = pseudoZuege(stellung);
  const zuege: GeheimZug[] = basis.map((z) => ({ ...z, dame: false }));

  if (aktiv(eigene) && brett[eigene.feld!] !== '' && farbeVon(brett[eigene.feld!]!) === farbe) {
    const von = eigene.feld!;
    const bauer = brett[von]!.toLowerCase() === 'p';
    const letzteReihe = farbe === 'w' ? 7 : 0;
    for (const nach of dameZiele(brett, von, farbe)) {
      if (basis.some((z) => z.von === von && z.nach === nach)) continue;
      // Auch als Dame wandelt sich ein Bauer auf der letzten Reihe um.
      if (bauer && reiheVon(nach) === letzteReihe) {
        for (const umwandlung of UMWANDLUNGEN) zuege.push({ von, nach, umwandlung, dame: true });
      } else {
        zuege.push({ von, nach, dame: true });
      }
    }
  }

  const fremd = stand[gegner(farbe)];
  return zuege.filter((zug) => {
    if (schlaegtKoenig(stellung, zug)) return true;
    const danach = wendeAnGeheim(stellung, zug);
    const fremdDanach: GeheimeDame =
      fremd.feld !== null && geschlagenesFeld(stellung, zug) === fremd.feld
        ? { ...fremd, zustand: 'geschlagen', feld: null }
        : fremd;
    const koenig = danach.brett.indexOf(alsFarbe('k', farbe));
    if (koenig >= 0 && angegriffenGeheim(danach.brett, koenig, gegner(farbe), fremdDanach, stand.regel)) {
      return false;
    }
    // Rochade: brett.ts prueft die Felder nur gegen die sichtbaren Figuren.
    const figur = brett[zug.von]!;
    if (!zug.dame && figur.toLowerCase() === 'k' && Math.abs(zug.nach - zug.von) === 2) {
      const mitte = (zug.von + zug.nach) / 2;
      if (
        zaehltAlsDame(fremd, stand.regel) &&
        [zug.von, mitte, zug.nach].some((f) => dameGreiftAn(brett, fremd.feld!, f))
      ) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Fuehrt die Buchfuehrung der geheimen Damen nach einem Zug nach: wohin sie
 * gezogen ist, ob sie aufgedeckt, geschlagen oder umgewandelt wurde.
 */
export function standNachZug(
  stand: SecretDameStand,
  stellung: Stellung,
  zug: GeheimZug,
  halbzug: number,
): SecretDameStand {
  const farbe = stellung.amZug;
  let eigene = stand[farbe];
  let fremd = stand[gegner(farbe)];
  const ereignisse = [...stand.ereignisse];
  const figur = stellung.brett[zug.von]!;

  // Rochade: Der Turm zieht mit, und er kann die geheime Dame sein.
  if (!zug.dame && figur.toLowerCase() === 'k' && Math.abs(zug.nach - zug.von) === 2) {
    const kurz = zug.nach > zug.von;
    const turmVon = kurz ? zug.von + 3 : zug.von - 4;
    if (eigene.feld === turmVon) eigene = { ...eigene, feld: kurz ? zug.von + 1 : zug.von - 1 };
  }

  if (aktiv(eigene) && eigene.feld === zug.von) {
    if (zug.dame && eigene.zustand === 'verdeckt') {
      eigene = { ...eigene, zustand: 'aufgedeckt', bekannt: true };
      ereignisse.push({
        art: 'aufgedeckt',
        farbe,
        feld: feldName(zug.nach),
        grundfigur: eigene.grundfigur!,
        halbzug,
      });
    }
    if (zug.umwandlung) {
      ereignisse.push({
        art: 'umgewandelt',
        farbe,
        feld: feldName(zug.nach),
        grundfigur: 'p',
        verdeckt: eigene.zustand === 'verdeckt',
        halbzug,
      });
      eigene = { ...eigene, zustand: 'erloschen', feld: null };
    } else {
      eigene = { ...eigene, feld: zug.nach };
    }
  }

  const geschlagen = geschlagenesFeld(stellung, zug);
  if (geschlagen !== null && aktiv(fremd) && fremd.feld === geschlagen) {
    if (fremd.zustand === 'verdeckt') {
      ereignisse.push({
        art: 'verdecktGeschlagen',
        farbe: gegner(farbe),
        feld: feldName(geschlagen),
        grundfigur: fremd.grundfigur!,
        halbzug,
      });
    }
    fremd = { ...fremd, zustand: 'geschlagen', feld: null, bekannt: true };
  }

  return { ...stand, [farbe]: eigene, [gegner(farbe)]: fremd, ereignisse } as SecretDameStand;
}

// ---------------------------------------------------------------------------
// Notation
// ---------------------------------------------------------------------------

const BUCHSTABE: Readonly<Record<string, string>> = { p: '', n: 'N', b: 'B', r: 'R', q: 'Q', k: 'K' };

/**
 * Kurzschrift eines Zuges im Secret-Dame-Modus, OHNE Schachzeichen — das
 * haengt die Partie an, weil nur sie weiss, ob nach der Regel des Tisches
 * Schach ist. Die Schachzeichen von `sanVon` taugen hier nicht: Unter
 * Regel A zaehlt die verdeckte Dame nicht, und ein „+" verriete sie.
 *
 * Ein Damenzug steht in Langschrift („Nb1-d3", „e3xe6=Q"): Die Kurzschrift
 * „Nd3" laese sich als Springerzug, und der ist genau das, was er nicht war.
 */
export function notationGeheim(stellung: Stellung, zug: GeheimZug): string {
  if (!zug.dame) return sanVon(stellung, zug).replace(/[+#]$/, '');
  const figur = stellung.brett[zug.von]!.toLowerCase();
  const schlag = stellung.brett[zug.nach] !== '';
  const umwandlung = zug.umwandlung ? `=${zug.umwandlung.toUpperCase()}` : '';
  return `${BUCHSTABE[figur]}${feldName(zug.von)}${schlag ? 'x' : '-'}${feldName(zug.nach)}${umwandlung}`;
}
