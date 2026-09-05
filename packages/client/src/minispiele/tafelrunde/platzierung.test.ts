import { describe, expect, it } from 'vitest';

import {
  type Sitzstand,
  eigenerPlatz,
  gegnerDieseRunde,
  leistenplaetze,
  nochDabei,
} from './platzierung';

/*
 * Die Ableitungen hinter Mitspielerleiste und Endbild.
 *
 * Hier stand bis zum 6.9.2026 der Pruefstand fuer `platzTabelle` — die
 * Abschrift der Platzierungsformel aus dem Modul. Die Formel liegt jetzt nur
 * noch dort, die Sicht liefert sie als `platzierung` mit, und die Faelle sind
 * nach packages/game-tafelrunde/test/sicht.test.ts gewandert. Was bleibt,
 * ist Nachschlagen und Ablesen.
 */

function sitz(teil: Partial<Sitzstand> & { sitz: number }): Sitzstand {
  return { leben: 100, level: 1, ausRunde: null, bereit: false, ...teil };
}

describe('leistenplaetze', () => {
  it('nimmt den eigenen Sitz mit auf und sortiert nach Sitznummer', () => {
    const plaetze = leistenplaetze(
      sitz({ sitz: 2 }),
      [sitz({ sitz: 0 }), sitz({ sitz: 3 }), sitz({ sitz: 1 })],
      null,
    );
    expect(plaetze.map((p) => p.sitz)).toEqual([0, 1, 2, 3]);
    expect(plaetze.filter((p) => p.ich).map((p) => p.sitz)).toEqual([2]);
  });

  it('markiert den Gegner der Runde — und nie sich selbst', () => {
    const plaetze = leistenplaetze(sitz({ sitz: 0 }), [sitz({ sitz: 1 })], 1);
    expect(plaetze.find((p) => p.sitz === 1)?.gegnerJetzt).toBe(true);
    expect(plaetze.find((p) => p.sitz === 0)?.gegnerJetzt).toBe(false);
  });

  it('kommt ohne eigenen Sitz aus — der Zuschauer hat keinen', () => {
    const plaetze = leistenplaetze(null, [sitz({ sitz: 0 }), sitz({ sitz: 1 })], null);
    expect(plaetze).toHaveLength(2);
    expect(plaetze.every((p) => !p.ich)).toBe(true);
  });
});

describe('nochDabei', () => {
  it('zaehlt nur, wer keine Runde des Ausscheidens traegt', () => {
    /* Nicht `leben > 0`: Zwischen Kampf und Rundenwechsel steht ein Sitz mit
       null Leben noch im Spiel (siehe eigenesLebt in sicht.ts). */
    const plaetze = leistenplaetze(
      sitz({ sitz: 0, leben: 0 }),
      [sitz({ sitz: 1, ausRunde: 4 }), sitz({ sitz: 2 })],
      null,
    );
    expect(nochDabei(plaetze)).toBe(2);
  });
});

describe('gegnerDieseRunde', () => {
  it('findet den Gegner, egal auf welcher Arenaseite ich stehe', () => {
    const kaempfe = [
      { a: 0, b: 1, geist: false },
      { a: 2, b: 3, geist: false },
    ];
    expect(gegnerDieseRunde(kaempfe, 0)).toBe(1);
    expect(gegnerDieseRunde(kaempfe, 3)).toBe(2);
  });

  it('nennt beim Geisterkampf den Sitz, dessen Abbild antritt', () => {
    expect(gegnerDieseRunde([{ a: 0, b: 1, geist: true }], 0)).toBe(1);
  });

  it('ist fuer den Besitzer des Abbilds kein Kampf', () => {
    /* Sitz 1 stellt nur sein Brett als Geist; er selbst kaempft anderswo.
       Ohne diese Unterscheidung stuende bei ihm ein Gegner, gegen den er gar
       nicht antritt. */
    const kaempfe = [
      { a: 0, b: 1, geist: true },
      { a: 1, b: 2, geist: false },
    ];
    expect(gegnerDieseRunde(kaempfe, 1)).toBe(2);
  });

  it('ist null ohne Kaempfe — in der Vorbereitung gibt es die Paarung nicht', () => {
    expect(gegnerDieseRunde(undefined, 0)).toBeNull();
    expect(gegnerDieseRunde([], 0)).toBeNull();
    expect(gegnerDieseRunde([{ a: 0, b: 1, geist: false }], null)).toBeNull();
  });
});

describe('eigenerPlatz', () => {
  it('findet den eigenen Sitz in der Rangliste der Sicht', () => {
    /* Die Rangliste kommt fertig aus dem Modul (sicht.ts, `platzierung`);
       hier wird nur noch darin gesucht. */
    const tabelle = [
      { sitz: 1, platz: 1, runden: 8 },
      { sitz: 0, platz: 2, runden: 8 },
    ];
    expect(eigenerPlatz(tabelle, 0)?.platz).toBe(2);
    expect(eigenerPlatz(tabelle, 1)?.runden).toBe(8);
    /* Zuschauer haben keinen Sitz, und ein fremder Tisch keinen Sitz 5. */
    expect(eigenerPlatz(tabelle, null)).toBeNull();
    expect(eigenerPlatz(tabelle, 5)).toBeNull();
  });
});
