import { describe, expect, it } from 'vitest';

import { KARTEN } from './karten';
import { lochName, parJeLoch, parName, zuPar, zuParSumme } from './par';
import { platzierungen, type Partiezustand } from './physik';

/*
 * Par in der Anzeige (seit 22.09.2026).
 *
 * Geprüft wird dreierlei: dass jede Differenz den richtigen Namen trägt, dass
 * „zu Par" in Golf-Schreibweise steht — und dass die Rangfolge NICHTS davon
 * mitbekommt. Das Letzte ist die eigentliche Zusage an Robin: Par wird
 * angezeigt, gewertet wird weiter die Schlagsumme.
 */

/** Das echte Minuszeichen (U+2212) — ausgeschrieben, damit es niemand für einen Bindestrich hält. */
const M = String.fromCharCode(0x2212);

describe('parName', () => {
  it('benennt −4 bis +3 mit ihren Golfnamen', () => {
    expect(parName(-4)).toBe('Condor');
    expect(parName(-3)).toBe('Albatros');
    expect(parName(-2)).toBe('Eagle');
    expect(parName(-1)).toBe('Birdie');
    expect(parName(0)).toBe('Par');
    expect(parName(1)).toBe('Bogey');
    expect(parName(2)).toBe('Doppel-Bogey');
    expect(parName(3)).toBe('Triple-Bogey');
  });

  it('schreibt ab +4 und unter −4 die Zahl', () => {
    expect(parName(4)).toBe('+4');
    expect(parName(7)).toBe('+7');
    expect(parName(-5)).toBe(`${M}5`);
  });

  it('der Condor ist kein Hirngespinst: es gibt Bahnen, auf denen −4 geht', () => {
    // Fällt diese Probe, gibt es keine Bahn mit Par ≥ 5 mehr — dann ist der
    // Condor tote Anzeige und die Begründung in par.ts veraltet.
    expect(KARTEN.some((k) => k.par >= 5)).toBe(true);
  });
});

describe('lochName', () => {
  it('nennt einen einzelnen Schlag Hole-in-one, egal auf welchem Par', () => {
    expect(lochName(1, 2, true)).toBe('Hole-in-one');
    expect(lochName(1, 3, true)).toBe('Hole-in-one');
    expect(lochName(1, 5, true)).toBe('Hole-in-one');
  });

  it('nimmt sonst die Differenz zu Par', () => {
    expect(lochName(2, 3, true)).toBe('Birdie');
    expect(lochName(3, 3, true)).toBe('Par');
    expect(lochName(5, 3, true)).toBe('Doppel-Bogey');
    expect(lochName(7, 3, true)).toBe('+4');
  });

  it('nennt eine Strafzahl nicht Bogey', () => {
    // Schlaglimit+1 ist angeschrieben, nicht gespielt.
    expect(lochName(8, 4, false)).toBe('nicht eingelocht');
  });
});

describe('zuPar', () => {
  it('schreibt Golf: −2, E, +3', () => {
    expect(zuPar(-2)).toBe(`${M}2`);
    expect(zuPar(0)).toBe('E');
    expect(zuPar(3)).toBe('+3');
  });

  it('nimmt das echte Minuszeichen, nicht den Bindestrich', () => {
    expect(zuPar(-1)).not.toContain('-');
  });
});

describe('parJeLoch und zuParSumme', () => {
  const karten = [{ par: 2 }, { par: 3 }, { par: 5 }];

  it('liest das Par in SPIELreihenfolge, nicht in Katalogreihenfolge', () => {
    expect(parJeLoch([2, 0], karten)).toEqual([5, 2]);
  });

  it('macht aus einer fehlenden Karte Par 0 statt eines Absturzes', () => {
    expect(parJeLoch([9], karten)).toEqual([0]);
  });

  it('summiert Schläge minus Par über die gespielten Löcher', () => {
    const par = parJeLoch([0, 1, 2], karten); // Par 2, 3, 5 = 10
    const ergebnis = [
      [1, 3],
      [3, 3],
      [4, 6],
    ];
    expect(zuParSumme(ergebnis, par, 0)).toBe(-2); // 8 Schläge
    expect(zuParSumme(ergebnis, par, 1)).toBe(2); // 12 Schläge
  });
});

describe('die Rangfolge bleibt die Schlagsumme', () => {
  /** Nur was `platzierungen` liest — der Rest des Zustands spielt keine Rolle. */
  function zustandMit(ergebnis: number[][]): Partiezustand {
    return { sitze: ergebnis[0]?.length ?? 0, ergebnis } as unknown as Partiezustand;
  }

  it('gleiche Summe, ganz verschiedener Par-Verlauf: geteilter Platz, gleiches zu Par', () => {
    const par = [2, 3, 5];
    // Sitz 0: Hole-in-one, Doppel-Bogey, Par   = 1 + 5 + 5 = 11
    // Sitz 1: Par, Par, Bogey                 = 2 + 3 + 6 = 11
    // Sitz 2: dreimal Par, einen Schlag besser = 2 + 3 + 5 = 10
    const ergebnis = [
      [1, 2, 2],
      [5, 3, 3],
      [5, 6, 5],
    ];
    const platz = platzierungen(zustandMit(ergebnis));
    expect(platz.map((z) => [z.sitz, z.platz])).toEqual([
      [2, 1],
      [0, 2],
      [1, 2],
    ]);
    expect(zuParSumme(ergebnis, par, 0)).toBe(zuParSumme(ergebnis, par, 1));
  });

  it('zu Par ist Summe minus Parsumme — für jeden Sitz dieselbe Konstante', () => {
    const par = [4, 2];
    const ergebnis = [
      [2, 6, 10],
      [3, 1, 7],
    ];
    const platz = platzierungen(zustandMit(ergebnis));
    for (const zeile of platz) {
      expect(zeile.schlaege - zuParSumme(ergebnis, par, zeile.sitz)).toBe(6);
    }
  });
});
