import { describe, expect, it } from 'vitest';

import { Gleichschritt, HAEPPCHEN, SCHNAPP_RING, sortiere } from './gleichschritt';
import type { Karte } from './karte';
import { type Ereignis, pruefsumme } from './physik';

/*
 * Eine Bahn mit Wand und Zonen: Rueckspulen prueft man nicht auf freiem Rasen.
 * Jede Abweichung um eine Fliesskommastelle muss sich ueber einen Wandabprall
 * oder einen Ballstoss auftuermen, sonst faellt sie in keinem Vergleich auf.
 */
const KARTE: Karte = {
  id: 'gs-pruef',
  name: 'Rueckspulbahn',
  schwierigkeit: 3,
  breite: 14,
  hoehe: 26,
  par: 3,
  schlagLimit: 8,
  zeitLimitS: 90,
  abschlaege: [
    [4, 23],
    [7, 23],
    [10, 23],
  ],
  loch: [7, 4],
  waende: [
    { x: 0, y: 14, w: 8, h: 0.8 },
    { x: 10, y: 8, w: 4, h: 0.8 },
  ],
  zonen: [
    { art: 'sand', x: 2, y: 17, w: 4, h: 3 },
    { art: 'eis', x: 8, y: 10, w: 5, h: 3 },
    { art: 'bumper', x: 4, y: 9, r: 0.6 },
  ],
};

const OPTIONEN = {
  saat: 4242,
  sitze: 4,
  botSitze: [2, 3],
  loecher: 2,
  karten: [KARTE],
  botStufe: 'experte' as const,
};

const EREIGNISSE: Ereignis[] = [
  { takt: 8, sitz: 0, nr: 1, art: 'schlag', rx: 0, ry: -1, kraft: 0.75 },
  { takt: 22, sitz: 1, nr: 1, art: 'schlag', rx: -0.4472, ry: -0.8944, kraft: 0.62 },
  { takt: 95, sitz: 0, nr: 2, art: 'schlag', rx: 0.7071, ry: -0.7071, kraft: 0.45 },
  { takt: 160, sitz: 1, nr: 2, art: 'schlag', rx: 0, ry: -1, kraft: 0.9 },
  { takt: 240, sitz: 0, nr: 3, art: 'schlag', rx: -1, ry: 0, kraft: 0.35 },
  { takt: 410, sitz: 1, nr: 3, art: 'schlag', rx: 0.3162, ry: -0.9487, kraft: 0.55 },
  { takt: 620, sitz: 0, nr: 4, art: 'schlag', rx: 0, ry: -1, kraft: 0.5 },
  { takt: 900, sitz: 1, nr: 4, art: 'schlag', rx: 0.6, ry: -0.8, kraft: 0.4 },
  { takt: 1150, sitz: 0, nr: 5, art: 'schlag', rx: 0, ry: 1, kraft: 0.3 },
];

const BIS = 1600;

function vollstaendig(bis = BIS): Gleichschritt {
  const g = new Gleichschritt(OPTIONEN);
  for (const e of sortiere(EREIGNISSE)) g.fuegeHinzu(e);
  while (g.takt < bis) g.rechneBis(bis);
  return g;
}

function vergleiche(a: Gleichschritt, b: Gleichschritt): void {
  const za = a.zustand();
  const zb = b.zustand();
  expect(za.takt).toBe(zb.takt);
  expect(pruefsumme(za.ergebnis)).toBe(pruefsumme(zb.ergebnis));
  expect(za.ergebnis).toEqual(zb.ergebnis);
  // Nicht nur die Pruefsumme: Sie sieht nur die Schlagzahlen, eine Abweichung
  // von einem Millimeter in der Ballage bliebe darin unsichtbar.
  expect(za.baelle).toEqual(zb.baelle);
  expect(za.aktuell).toEqual(zb.aktuell);
  expect(za.zufall).toBe(zb.zufall);
  expect(za.botZufall).toEqual(zb.botZufall);
  expect(za.botWartet).toEqual(zb.botWartet);
}

describe('Gleichschritt', () => {
  it('kommt mit verspaeteten Ereignissen zum selben Ergebnis wie mit puenktlichen', () => {
    const g = new Gleichschritt(OPTIONEN);
    // Absichtlich die unguenstigste Reihenfolge: rueckwaerts nach Takt. Jedes
    // Ereignis trifft ein, wenn sein Takt laengst gerechnet ist.
    const offen = [...EREIGNISSE].sort((a, b) => b.takt - a.takt);
    let uhr = 0;
    while (uhr < BIS) {
      uhr += 25;
      g.rechneBis(uhr);
      for (let i = offen.length - 1; i >= 0; i -= 1) {
        if (offen[i].takt <= g.takt) {
          g.fuegeHinzu(offen[i]);
          offen.splice(i, 1);
        }
      }
      g.rechneBis(uhr);
    }
    while (g.takt < BIS) g.rechneBis(BIS);

    expect(g.rueckspulungen).toBeGreaterThan(0);
    expect(offen).toHaveLength(0);
    vergleiche(g, vollstaendig());
  });

  it('kommt auch mit gemischter Reihenfolge innerhalb eines Takts klar', () => {
    // Zwei Sitze im selben Takt, absichtlich verkehrt herum eingereicht.
    const gleichzeitig: Ereignis[] = [
      { takt: 30, sitz: 1, nr: 9, art: 'schlag', rx: 0, ry: -1, kraft: 0.5 },
      { takt: 30, sitz: 0, nr: 9, art: 'schlag', rx: 0, ry: -1, kraft: 0.5 },
    ];
    const a = new Gleichschritt(OPTIONEN);
    a.fuegeHinzu(gleichzeitig[0]);
    a.fuegeHinzu(gleichzeitig[1]);
    while (a.takt < 300) a.rechneBis(300);

    const b = new Gleichschritt(OPTIONEN);
    b.fuegeHinzu(gleichzeitig[1]);
    b.fuegeHinzu(gleichzeitig[0]);
    while (b.takt < 300) b.rechneBis(300);
    vergleiche(a, b);
  });

  it('spult auch weiter zurueck, als der Ring reicht', () => {
    const spaet: Ereignis = { takt: 3, sitz: 0, nr: 77, art: 'schlag', rx: 1, ry: 0, kraft: 0.6 };
    const g = new Gleichschritt(OPTIONEN);
    for (const e of sortiere(EREIGNISSE)) g.fuegeHinzu(e);
    // Erst weit ueber die Ringlaenge hinaus rechnen …
    const weit = SCHNAPP_RING * 3;
    while (g.takt < weit) g.rechneBis(weit);
    // … dann ein Ereignis aus Takt 3 nachreichen. Der Ring kennt Takt 3 nicht
    // mehr, gerettet wird der Sprung vom dauerhaften Lochstart-Schnappschuss.
    g.fuegeHinzu(spaet);
    while (g.takt < BIS) g.rechneBis(BIS);

    const referenz = new Gleichschritt(OPTIONEN);
    for (const e of sortiere([...EREIGNISSE, spaet])) referenz.fuegeHinzu(e);
    while (referenz.takt < BIS) referenz.rechneBis(BIS);
    vergleiche(g, referenz);
  });

  it('verwirft Doppelte (gleicher Sitz, gleiche Laufnummer)', () => {
    const g = new Gleichschritt(OPTIONEN);
    const e = EREIGNISSE[0];
    g.fuegeHinzu(e);
    g.fuegeHinzu({ ...e });
    // Auch mit anderem Takt und anderer Kraft: die Laufnummer entscheidet.
    g.fuegeHinzu({ takt: 40, sitz: e.sitz, nr: e.nr, art: 'schlag', rx: 0, ry: -1, kraft: 0.1 });
    expect(g.alleEreignisse()).toHaveLength(1);
    while (g.takt < 200) g.rechneBis(200);
    expect(g.zustand().baelle[0].schlaege).toBe(1);
    expect(g.rueckspulungen).toBe(0);
  });

  it('nimmt Ereignisse aus der Zukunft ohne Ruecksprung an', () => {
    const g = new Gleichschritt(OPTIONEN);
    while (g.takt < 100) g.rechneBis(100);
    g.fuegeHinzu({ takt: 150, sitz: 0, nr: 1, art: 'schlag', rx: 0, ry: -1, kraft: 0.5 });
    expect(g.rueckspulungen).toBe(0);
    while (g.takt < 200) g.rechneBis(200);
    expect(g.zustand().baelle[0].schlaege).toBe(1);
  });

  it('rechnet in Haeppchen und laesst den Rest liegen', () => {
    const g = new Gleichschritt(OPTIONEN);
    g.rechneBis(HAEPPCHEN * 2);
    expect(g.takt).toBe(HAEPPCHEN);
    g.rechneBis(HAEPPCHEN * 2);
    expect(g.takt).toBe(HAEPPCHEN * 2);
  });

  it('liefert den Vortakt fuer die Interpolation', () => {
    const g = new Gleichschritt(OPTIONEN);
    while (g.takt < 120) g.rechneBis(120);
    expect(g.vorher().takt).toBe(119);
    expect(g.zustand().takt).toBe(120);
    // Und der Vortakt ist wirklich ein anderer Zustand, kein zweiter Zeiger.
    expect(g.vorher()).not.toBe(g.zustand());
  });

  it('haelt den Takt beim Rueckspulen nicht an', () => {
    const g = new Gleichschritt(OPTIONEN);
    while (g.takt < 300) g.rechneBis(300);
    g.fuegeHinzu({ takt: 120, sitz: 0, nr: 1, art: 'schlag', rx: 0, ry: -1, kraft: 0.5 });
    expect(g.takt).toBeLessThan(300);
    g.rechneBis(300);
    expect(g.takt).toBe(300);
    expect(g.rueckspulungen).toBe(1);
  });
});
