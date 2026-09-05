import { describe, expect, it } from 'vitest';

import {
  type Sitzstand,
  eigenerPlatz,
  gegnerDieseRunde,
  leistenplaetze,
  nochDabei,
  platzTabelle,
} from './platzierung';

/*
 * Die Rechnungen hinter Mitspielerleiste und Endbild.
 *
 * Der wichtigste Teil ist `platzTabelle`: Sie ist die Abschrift von
 * `platzierungen` aus packages/game-tafelrunde/src/partie.ts (siehe der Kopf
 * von platzierung.ts). Die Faelle hier sind deshalb bewusst genau die
 * Unterscheidungen, an denen die beiden Fassungen auseinanderlaufen wuerden:
 * ueberstandene Runden vor Leben, Leben als zweites Kriterium, und ein
 * geteilter Platz nur bei Gleichstand in BEIDEM.
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

describe('platzTabelle', () => {
  it('setzt die Lebenden vor die Ausgeschiedenen', () => {
    const tabelle = platzTabelle(
      [
        sitz({ sitz: 0, ausRunde: 3, leben: 0 }),
        sitz({ sitz: 1, leben: 20 }),
        sitz({ sitz: 2, ausRunde: 7, leben: 0 }),
      ],
      9,
    );
    expect(tabelle.map((p) => p.sitz)).toEqual([1, 2, 0]);
    expect(tabelle.map((p) => p.platz)).toEqual([1, 2, 3]);
  });

  it('zaehlt die laufende Runde fuer alle mit, die noch stehen', () => {
    const tabelle = platzTabelle([sitz({ sitz: 0 }), sitz({ sitz: 1, ausRunde: 12 })], 12);
    expect(tabelle.find((p) => p.sitz === 0)?.runden).toBe(12);
    expect(tabelle.find((p) => p.sitz === 1)?.runden).toBe(12);
  });

  it('entscheidet bei gleichen Runden ueber das Leben', () => {
    const tabelle = platzTabelle([sitz({ sitz: 0, leben: 12 }), sitz({ sitz: 1, leben: 44 })], 6);
    expect(tabelle.map((p) => p.sitz)).toEqual([1, 0]);
    expect(tabelle.map((p) => p.platz)).toEqual([1, 2]);
  });

  it('teilt einen Platz nur bei Gleichstand in Runden UND Leben', () => {
    const tabelle = platzTabelle(
      [sitz({ sitz: 0, leben: 30 }), sitz({ sitz: 1, leben: 30 }), sitz({ sitz: 2, leben: 10 })],
      5,
    );
    /* Zwei erste Plaetze, und der Dritte ist dann der DRITTE — nicht der
       zweite. Genau so zaehlt das Modul (platzierungen in partie.ts). */
    expect(tabelle.map((p) => p.platz)).toEqual([1, 1, 3]);
  });

  it('liefert eine feste Reihenfolge bei voelligem Gleichstand', () => {
    /* Ohne den Sitz als letztes Kriterium haengt die Reihung von der
       Eingabereihenfolge ab — und die Anzeige spraenge bei jedem Rundruf. */
    const a = platzTabelle([sitz({ sitz: 3 }), sitz({ sitz: 1 })], 4);
    const b = platzTabelle([sitz({ sitz: 1 }), sitz({ sitz: 3 })], 4);
    expect(a.map((p) => p.sitz)).toEqual([1, 3]);
    expect(b.map((p) => p.sitz)).toEqual([1, 3]);
  });
});

describe('eigenerPlatz', () => {
  it('findet den eigenen Sitz in der Tabelle', () => {
    const tabelle = platzTabelle([sitz({ sitz: 0, leben: 10 }), sitz({ sitz: 1, leben: 90 })], 8);
    expect(eigenerPlatz(tabelle, 0)?.platz).toBe(2);
    expect(eigenerPlatz(tabelle, null)).toBeNull();
    expect(eigenerPlatz(tabelle, 5)).toBeNull();
  });
});
