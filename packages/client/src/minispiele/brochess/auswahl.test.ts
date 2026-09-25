import { describe, expect, it } from 'vitest';

import { anzeigeReihenfolge, beweglicheFelder, feldName, zielfelder, zuegeNach } from './auswahl';
import type { BroChessZug } from './sicht';

const ZUEGE: BroChessZug[] = [
  { type: 'zug', von: 'e2', nach: 'e3' },
  { type: 'zug', von: 'e2', nach: 'e4' },
  { type: 'zug', von: 'g1', nach: 'f3' },
  { type: 'zug', von: 'b7', nach: 'b8', umwandlung: 'q' },
  { type: 'zug', von: 'b7', nach: 'b8', umwandlung: 'n' },
];

describe('BroChess: Auswahl auf dem Brett', () => {
  it('benennt die Felder a1 bis h8', () => {
    expect(feldName(0)).toBe('a1');
    expect(feldName(7)).toBe('h1');
    expect(feldName(63)).toBe('h8');
  });

  it('zeigt Weiss a8 links oben und Schwarz h1 links oben', () => {
    expect(feldName(anzeigeReihenfolge('w')[0] ?? -1)).toBe('a8');
    expect(feldName(anzeigeReihenfolge(null)[0] ?? -1)).toBe('a8');
    expect(feldName(anzeigeReihenfolge('b')[0] ?? -1)).toBe('h1');
    expect(anzeigeReihenfolge('b')).toHaveLength(64);
  });

  it('hebt nur hervor, was in den Zuegen des Servers steht', () => {
    expect([...beweglicheFelder(ZUEGE)].sort()).toEqual(['b7', 'e2', 'g1']);
    expect([...zielfelder(ZUEGE, 'e2')].sort()).toEqual(['e3', 'e4']);
    expect(zielfelder(ZUEGE, 'a2').size).toBe(0);
    expect(zielfelder(ZUEGE, null).size).toBe(0);
  });

  it('liefert bei einer Umwandlung alle angebotenen Figuren', () => {
    expect(zuegeNach(ZUEGE, 'b7', 'b8').map((z) => z.umwandlung)).toEqual(['q', 'n']);
    expect(zuegeNach(ZUEGE, 'g1', 'f3')).toHaveLength(1);
  });
});
