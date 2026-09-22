import { golf, pruefsummeDerTafel, waehleLochwerte } from '@brauweg/game-golf';
import { describe, expect, it } from 'vitest';

import { pruefsumme } from '../minispiele/golf/physik';

/*
 * Vertrag Bestleistung je Bahn (seit 22.09.2026): Das Modul rechnet die
 * Pruefsumme der mitgeschickten Tafel NACH (packages/game-golf/src/
 * bestleistung.ts), mit einer Abschrift der Client-Rechnung. Liefe die
 * Abschrift auseinander, fiele jede ehrliche Tafel durch — und es gaebe
 * lautlos keine einzige Bestleistung mehr, ohne dass irgendetwas rot wird.
 * Hier stehen beide Rechnungen nebeneinander.
 */

const TAFELN: number[][][] = [
  [],
  [[1]],
  [
    [2, 3],
    [4, 1],
    [3, 5],
  ],
  [
    [10, 7, 1, 12, 13, 2, 9, 11],
    [3, 3, 3, 3, 3, 3, 3, 3],
  ],
];

describe('Vertrag Golf-Bestleistung', () => {
  it('Modul und Client rechnen dieselbe Pruefsumme', () => {
    for (const tafel of TAFELN) expect(pruefsummeDerTafel(tafel)).toBe(pruefsumme(tafel));
  });

  it('eine Meldung, wie meldeErgebnis sie baut, liefert dem Modul seine Tafel', () => {
    // Dieselbe Form wie screens/Golf.tsx: Summen je Sitz, Pruefsumme des
    // Clients, die Tafel als Kopie `[loch][sitz]`.
    const tafel = TAFELN[2]!;
    const meldung = {
      art: 'ergebnis' as const,
      schlaege: [9, 9],
      pruef: pruefsumme(tafel),
      jeLoch: tafel.map((reihe) => [...reihe]),
      eingelocht: tafel.map((reihe) => reihe.map(() => true)),
    };
    let p = golf.createParty({ config: golf.defaultConfig(), seats: 2, rounds: 3, seed: 7 });
    p = golf.act(p, 0, meldung);
    p = golf.act(p, 1, meldung);
    expect(waehleLochwerte(p)?.schlaege).toEqual(tafel);
  });
});
