import { DEFAULT_REGELN, type FillerSicht as ModulSicht, filler } from '@brauweg/game-filler';
import { describe, expect, it } from 'vitest';

import type { FillerSicht } from '../minispiele/filler/sicht';
import {
  type Beweglich,
  type Leer,
  type PasstAuf,
  type Spielmodul,
  fehlendeFelder,
  felderEinerPartie,
} from './vertrag';

/*
 * Vertrag zwischen der Client-Sicht von Filler und dem Modul.
 *
 * Zwei Felder tragen hier die ganze Bedienung: `farbe` sagt, welche Farbe
 * jedem Sitz gehört (und damit, welche Knöpfe gesperrt sind), und
 * `barrierenMoeglich` sagt, wohin eine Mauer darf — die Einsperr-Regel rechnet
 * das Modul, der Bildschirm baut sie ausdrücklich nicht nach. Verschwindet
 * eines der beiden, wird der Bildschirm nicht rot, sondern still: keine
 * Mauern, keine Meldung.
 */

// ---------------------------------------------------------------------------
// Beim Übersetzen: Diese Zeilen brechen `npm run build`, nicht erst den Test.
// ---------------------------------------------------------------------------

type EchteSicht = Beweglich<ModulSicht>;

/** Die echte Modulsicht muss auf die Client-Beschreibung passen. */
type _sichtPasst = PasstAuf<FillerSicht, EchteSicht>;

/**
 * Und kein Feld darf nur noch im Client stehen. Nötig neben der Zuweisung
 * oben, weil ein optionales Client-Feld sonst lautlos durchginge — und
 * `barrierenMoeglich` ist genau so eines.
 */
type _keinFeldNurImClient = Leer<Exclude<keyof FillerSicht, keyof EchteSicht>>;

// ---------------------------------------------------------------------------
// Beim Prüfen: Liefert eine echte Partie die Felder auch wirklich?
// ---------------------------------------------------------------------------

/**
 * Die Felder als Liste. Sie kann nicht veralten: `_listeVollstaendig` bricht
 * den Bau, sobald `FillerSicht` ein Feld bekommt, das hier fehlt, und
 * `_listeOhneKarteileichen`, sobald hier eines steht, das es nicht mehr gibt.
 */
const FELDER = [
  'ich',
  'variante',
  'spalten',
  'zeilen',
  'farbzahl',
  'feld',
  'grau',
  'besitzer',
  'farbe',
  'punkte',
  'dran',
  'zug',
  'fertig',
  'sieger',
  'leftSeats',
  'zuschauer',
  'barrieren',
  'barrierenUebrig',
  'barrierenMoeglich',
  'sterne',
  'mauerSperre',
] as const;
type _listeVollstaendig = Leer<Exclude<keyof FillerSicht, (typeof FELDER)[number]>>;
type _listeOhneKarteileichen = Leer<Exclude<(typeof FELDER)[number], keyof FillerSicht>>;

describe('Vertrag Filler', () => {
  /*
   * In der Spielart `build`, nicht in der Vorgabe `nebel`: `barrierenMoeglich`
   * gibt es nur dort, wo es Mauern gibt. Eine Partie im Nebel ließe das Feld
   * ungeprüft — und ein Feld, das niemand prüft, ist der Grund für diese
   * Dateien.
   */
  const gesehen = felderEinerPartie(filler as unknown as Spielmodul, {
    sitze: 2,
    runden: 1,
    config: { ...DEFAULT_REGELN, variante: 'build' },
  });

  it('liefert jedes Feld, das der Bildschirm liest', () => {
    expect(fehlendeFelder(FELDER, gesehen.oben)).toEqual([]);
  });

  it('führt die Barrieren-Felder, an denen der Bildschirm keine Regel nachbaut', () => {
    // `barrierenMoeglich` kommt fertig gerechnet vom Modul. Fehlt es, zeigt
    // der Bildschirm kein einziges Ziel an und die Spielart `build` ist tot.
    expect(gesehen.oben.has('barrierenMoeglich')).toBe(true);
    expect(gesehen.oben.has('barrierenUebrig')).toBe(true);
  });
});
