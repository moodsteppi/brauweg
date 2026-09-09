import { describe, expect, it } from 'vitest';

import type { Karte } from './karte';
import { botLoestKarte, pruefeKarte, pruefeKarteMitBot, pruefeKarten } from './karten-pruefen';

function karteMit(teil: Partial<Karte>): Karte {
  return {
    id: 'gut',
    name: 'Gute Bahn',
    schwierigkeit: 2,
    breite: 14,
    hoehe: 22,
    par: 3,
    schlagLimit: 6,
    zeitLimitS: 60,
    abschlaege: [
      [4, 19],
      [10, 19],
    ],
    loch: [7, 4],
    waende: [],
    zonen: [],
    ...teil,
  };
}

describe('pruefeKarte', () => {
  it('laesst eine saubere Bahn durch', () => {
    expect(pruefeKarte(karteMit({}))).toEqual([]);
  });

  it('meldet ein Loch, das in einer Wand steckt', () => {
    const karte = karteMit({ id: 'loch-in-wand', waende: [{ x: 6, y: 3, w: 2, h: 2 }] });
    const fehler = pruefeKarte(karte);
    expect(fehler.some((f) => f.startsWith('Loch liegt in oder zu nah an einer Wand'))).toBe(true);
  });

  it('meldet einen Abschlag ausserhalb des Feldes', () => {
    const karte = karteMit({
      id: 'abschlag-draussen',
      abschlaege: [
        [-2, 19],
        [10, 19],
      ],
    });
    const fehler = pruefeKarte(karte);
    expect(fehler).toContain('Abschlag 0 liegt ausserhalb des Feldes');
  });

  it('meldet ein unerreichbares Loch', () => {
    // Riegel ueber die ganze Breite: das Loch liegt hinter einer geschlossenen
    // Wand. Geometrisch ist alles in Ordnung — nur hinkommen kann niemand.
    const karte = karteMit({ id: 'eingemauert', waende: [{ x: 0, y: 8, w: 14, h: 0.6 }] });
    const fehler = pruefeKarte(karte);
    expect(fehler).toContain('Vom Abschlag 0 ist das Loch nicht erreichbar');
    expect(fehler).toContain('Vom Abschlag 1 ist das Loch nicht erreichbar');
  });

  it('meldet Abschlaege zu nah an der Wand und zu nah beieinander', () => {
    const zuNah = karteMit({
      id: 'gedraengt',
      abschlaege: [
        [0.3, 19],
        [0.6, 19],
      ],
    });
    const fehler = pruefeKarte(zuNah);
    expect(fehler.some((f) => f.startsWith('Abschlag 0 liegt zu nah an einer Wand'))).toBe(true);
    expect(fehler.some((f) => f.startsWith('Abschlaege 0 und 1 liegen'))).toBe(true);
  });

  it('meldet einen Abschlag oder ein Loch in einer Zone', () => {
    const karte = karteMit({
      id: 'in-zone',
      zonen: [
        { art: 'sand', x: 3, y: 18, w: 3, h: 3 },
        { art: 'wasser', x: 6, y: 3, w: 2, h: 2 },
      ],
    });
    const fehler = pruefeKarte(karte);
    expect(fehler).toContain('Abschlag 0 liegt in einer Zone (sand)');
    expect(fehler).toContain('Loch liegt in einer Zone (wasser)');
  });

  it('meldet Masse und Par ausserhalb der Vorgaben', () => {
    const karte = karteMit({ id: 'masse', breite: 8, hoehe: 90, par: 5, schlagLimit: 6, zeitLimitS: 200 });
    const fehler = pruefeKarte(karte);
    expect(fehler).toContain('Breite 8 liegt nicht in 12..40');
    expect(fehler).toContain('Hoehe 90 liegt nicht in 16..64');
    expect(fehler).toContain('Par 5 liegt nicht in 1..4');
    expect(fehler).toContain('Zeitlimit 200 s liegt nicht in 45..120');
  });

  it('meldet Wand und Zone ausserhalb des Feldes und ein Portal ins Nichts', () => {
    const karte = karteMit({
      id: 'draussen',
      waende: [{ x: 12, y: 5, w: 5, h: 1 }],
      zonen: [{ art: 'portal', x: 5, y: 10, r: 0.6, ziel: { x: 99, y: 5 }, paar: 0 }],
    });
    const fehler = pruefeKarte(karte);
    expect(fehler).toContain('Wand 0 liegt nicht im Feld');
    expect(fehler).toContain('Zone 0 (portal) zielt aus dem Feld heraus');
  });

  it('erkennt doppelte Kennungen nur mit der ganzen Sammlung', () => {
    const a = karteMit({ id: 'zwilling' });
    const b = karteMit({ id: 'zwilling', name: 'Andere Bahn' });
    expect(pruefeKarte(a)).toEqual([]);
    expect(pruefeKarte(a, [a, b])).toContain('Kennung zwilling kommt 2-mal vor');
  });

  it('sammelt ueber eine ganze Liste nur die Karten mit Befund', () => {
    const gut = karteMit({ id: 'gut-1' });
    const schlecht = karteMit({ id: 'schlecht-1', par: 9 });
    const liste = pruefeKarten([gut, schlecht]);
    expect(liste).toHaveLength(1);
    expect(liste[0].id).toBe('schlecht-1');
  });
});

describe('botLoestKarte', () => {
  it('spielt die Bahn wirklich durch', () => {
    const r = botLoestKarte(karteMit({ id: 'probe' }), 'genie');
    expect(r.geloest).toBe(true);
    expect(r.schlaege).toBeGreaterThan(0);
    expect(r.takte).toBeGreaterThan(0);
  });

  it('gibt auf, wenn das Loch nicht zu erreichen ist', () => {
    const karte = karteMit({ id: 'aussichtslos', waende: [{ x: 0, y: 8, w: 14, h: 0.6 }] });
    const r = botLoestKarte(karte, 'genie');
    expect(r.geloest).toBe(false);
  });

  it('haengt der vollstaendigen Pruefung den Probelauf an', () => {
    expect(pruefeKarteMitBot(karteMit({ id: 'voll' }))).toEqual([]);
    const kaputt = karteMit({ id: 'voll-kaputt', waende: [{ x: 0, y: 8, w: 14, h: 0.6 }] });
    expect(pruefeKarteMitBot(kaputt).length).toBeGreaterThan(0);
  });
});
