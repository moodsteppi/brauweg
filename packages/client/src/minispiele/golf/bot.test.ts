import { describe, expect, it } from 'vitest';

import { erreichbarVon, kraftFuerDistanz, maximaleRollweite, sichtFrei, wegfeld } from './bot';
import type { Karte } from './karte';
import { botLoestKarte } from './karten-pruefen';
import { V_MAX } from './physik';

/** Die einfachste denkbare Bahn: 12 mal 20, nichts im Weg. */
const FREI: Karte = {
  id: 'bot-frei',
  name: 'Freie Bahn',
  schwierigkeit: 1,
  breite: 12,
  hoehe: 20,
  par: 2,
  schlagLimit: 6,
  zeitLimitS: 60,
  abschlaege: [
    [4, 17],
    [8, 17],
  ],
  loch: [6, 3],
  waende: [],
  zonen: [],
};

/**
 * Ein Riegel quer durch die Bahn: Das Loch liegt nur ums Eck.
 *
 * Die Wand laesst rechts eine Luecke von 14 minus 10 gleich 4 E — breit genug
 * fuer einen Ball, aber es gibt keine gerade Linie vom Abschlag zum Loch.
 */
const RIEGEL: Karte = {
  id: 'bot-riegel',
  name: 'Um die Ecke',
  schwierigkeit: 3,
  breite: 14,
  hoehe: 22,
  par: 4,
  schlagLimit: 8,
  zeitLimitS: 90,
  abschlaege: [
    [3, 19],
    [6, 19],
  ],
  loch: [3, 3],
  waende: [{ x: 0, y: 11, w: 10, h: 1 }],
  zonen: [],
};

describe('Kraft aus Distanz', () => {
  it('steigt streng mit der Entfernung', () => {
    let vorher = 0;
    for (let d = 0.5; d < maximaleRollweite(); d += 0.5) {
      const k = kraftFuerDistanz(d);
      expect(k).toBeGreaterThanOrEqual(vorher);
      expect(k).toBeLessThanOrEqual(1);
      vorher = k;
    }
    expect(kraftFuerDistanz(1000)).toBe(1);
  });

  it('reicht auf einer 20-E-Bahn von einem Ende zum anderen', () => {
    expect(maximaleRollweite()).toBeGreaterThan(20);
    // Und bleibt unter dem, was V_MAX in einer Sekunde schafft — sonst waere
    // die Reibung falsch herum eingebaut.
    expect(maximaleRollweite()).toBeLessThan(V_MAX);
  });
});

describe('Sichtlinie', () => {
  it('sieht ueber freien Rasen und nicht durch Waende', () => {
    expect(sichtFrei(FREI, 6, 17, 6, 3)).toBe(true);
    expect(sichtFrei(RIEGEL, 3, 19, 3, 3)).toBe(false);
    // Rechts an der Wand vorbei geht es.
    expect(sichtFrei(RIEGEL, 12, 19, 12, 3)).toBe(true);
  });
});

describe('Wegfindung', () => {
  it('erreicht das Loch von jedem Abschlag', () => {
    for (const karte of [FREI, RIEGEL]) {
      for (const [x, y] of karte.abschlaege) {
        expect(erreichbarVon(karte, x, y)).toBe(true);
      }
    }
  });

  it('legt um den Riegel herum einen laengeren Weg als die Luftlinie', () => {
    const feld = wegfeld(RIEGEL);
    const spalten = feld.spalten;
    const zelle = (x: number, y: number): number =>
      Math.floor(y / 0.5) * spalten + Math.floor(x / 0.5);
    const vomAbschlag = feld.entfernung[zelle(3, 19)];
    // Luftlinie waeren 16 E, also 32 Rasterschritte. Der Umweg ist laenger.
    expect(vomAbschlag).toBeGreaterThan(32);
  });
});

describe('Bot spielt', () => {
  it('locht auf freier Bahn als Genie in hoechstens drei Schlaegen ein', () => {
    // Mehrere Saatkoerner: ein einzelnes koennte zufaellig guenstig liegen.
    for (const saat of [1, 2, 3, 4, 5, 99, 20260906]) {
      const r = botLoestKarte(FREI, 'genie', saat);
      expect(r.geloest).toBe(true);
      expect(r.schlaege).toBeLessThanOrEqual(3);
    }
  });

  it('spielt um die Ecke und bleibt unter dem Schlaglimit', () => {
    for (const saat of [1, 2, 3, 4, 5, 99, 20260906]) {
      const r = botLoestKarte(RIEGEL, 'genie', saat);
      expect(r.geloest).toBe(true);
      expect(r.schlaege).toBeLessThanOrEqual(RIEGEL.schlagLimit);
    }
  });

  it('locht auch auf den schwaecheren Stufen ein', () => {
    for (const stufe of ['anfaenger', 'standard', 'experte'] as const) {
      const r = botLoestKarte(FREI, stufe, 7);
      expect(r.geloest).toBe(true);
      expect(r.schlaege).toBeLessThanOrEqual(FREI.schlagLimit);
    }
  });

  it('ist reproduzierbar — gleiche Saat, gleiches Ergebnis', () => {
    const a = botLoestKarte(RIEGEL, 'standard', 555);
    const b = botLoestKarte(RIEGEL, 'standard', 555);
    expect(a).toEqual(b);
    const c = botLoestKarte(RIEGEL, 'standard', 556);
    expect(c.takte).not.toBe(a.takte);
  });

  it('spielt schlechter, je schwaecher die Stufe — im Mittel ueber viele Saaten', () => {
    function mittel(stufe: 'anfaenger' | 'genie'): number {
      let summe = 0;
      for (let saat = 1; saat <= 20; saat += 1) summe += botLoestKarte(FREI, stufe, saat).schlaege;
      return summe / 20;
    }
    expect(mittel('anfaenger')).toBeGreaterThan(mittel('genie'));
  });
});
