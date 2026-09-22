import { describe, expect, it } from 'vitest';

import {
  erreichbarVon,
  kraftFuerDistanz,
  kraftFuerStrecke,
  maximaleRollweite,
  sichtFrei,
  wegfeld,
} from './bot';
import { type Karte, type Zone, istInZone } from './karte';
import { KARTEN } from './karten/index';
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

/* --------------------------------------------------------------------------
 * Sand und Eis — der Befund vom 07.09.2026: Bots spielten auf Sand mit der
 * Kraft, die auf Rasen gereicht haette.
 * ----------------------------------------------------------------------- */

/** Die freie Bahn, komplett mit einem Untergrund belegt. */
function freiMit(zone: Zone): Karte {
  return { ...FREI, id: `bot-frei-${zone.art}`, zonen: [zone] };
}

const SAND = freiMit({ art: 'sand', x: 0, y: 0, w: 12, h: 20 });
const EIS = freiMit({ art: 'eis', x: 0, y: 0, w: 12, h: 20 });

describe('Kraft ueber Sand und Eis', () => {
  it('ist auf freiem Rasen dieselbe wie aus der Tabelle', () => {
    for (const d of [1, 3, 6, 12]) {
      expect(kraftFuerStrecke(FREI, 6, 17, 0, -1, d)).toBeCloseTo(kraftFuerDistanz(d), 6);
    }
  });

  it('braucht auf Sand deutlich mehr und auf Eis deutlich weniger Kraft', () => {
    const rasen = kraftFuerStrecke(FREI, 6, 17, 0, -1, 6);
    const sand = kraftFuerStrecke(SAND, 6, 17, 0, -1, 6);
    const eis = kraftFuerStrecke(EIS, 6, 17, 0, -1, 6);
    // Vierfache Reibung gegen 0,12-fache — das sind keine Nuancen.
    expect(sand).toBeGreaterThan(rasen * 1.5);
    expect(eis).toBeLessThan(rasen * 0.7);
  });

  it('rechnet den Untergrund an der Stelle, nicht die Karte als Ganzes', () => {
    // Sand nur am Ende der Bahn: Ein kurzer Schlag davor merkt nichts davon.
    const spaeterSand = freiMit({ art: 'sand', x: 0, y: 0, w: 12, h: 6 });
    expect(kraftFuerStrecke(spaeterSand, 6, 17, 0, -1, 4)).toBeCloseTo(kraftFuerDistanz(4), 4);
    // Ein langer Schlag, der im Sand enden soll, braucht mehr.
    expect(kraftFuerStrecke(spaeterSand, 6, 17, 0, -1, 13)).toBeGreaterThan(kraftFuerDistanz(13));
  });

  it('gibt bei unerreichbarer Weite volle Kraft und bei winziger die Mindestkraft', () => {
    expect(kraftFuerStrecke(SAND, 6, 17, 0, -1, 1000)).toBe(1);
    expect(kraftFuerStrecke(EIS, 6, 17, 0, -1, 0.01)).toBeGreaterThan(0);
    expect(kraftFuerStrecke(EIS, 6, 17, 0, -1, 0.01)).toBeLessThan(0.1);
  });

  it('schlaegt mit Tempo-Vorgabe fester als zum Ausrollen', () => {
    for (const karte of [FREI, SAND, EIS]) {
      const ausrollen = kraftFuerStrecke(karte, 6, 17, 0, -1, 4);
      const durch = kraftFuerStrecke(karte, 6, 17, 0, -1, 4, 5);
      expect(durch).toBeGreaterThan(ausrollen);
    }
  });
});

/* --------------------------------------------------------------------------
 * Portale — k23 hat ein Portalpaar, dessen Portale aufeinander zielen, und
 * eine Sandkammer, die nur durch das Portal zu erreichen ist.
 * ----------------------------------------------------------------------- */

describe('Portale im Wegfeld', () => {
  const k23 = KARTEN.find((k) => k.id === 'k23-portal-in-die-sandkammer');
  if (k23 === undefined) throw new Error('k23 fehlt im Katalog');
  const ausgang = k23.zonen.find((z) => z.art === 'portal' && z.y === 10);
  if (ausgang === undefined) throw new Error('k23: Ausgangsportal fehlt');

  it('erreicht die Sandkammer durch das Portalpaar von jedem Abschlag', () => {
    // Beide Portale zielen in die Mitte des anderen. Wartet jedes darauf, dass
    // das andere zuerst eine Entfernung bekommt, bekommt keines eine.
    for (const [x, y] of k23.abschlaege) expect(erreichbarVon(k23, x, y)).toBe(true);
  });

  it('laeuft aus der Kammer nie als Boden durch das Ausgangsportal', () => {
    // Jede freie Bodenzelle neben dem Ausgangsportal liegt naeher am Loch als
    // das Portal selbst — der Abstieg fuehrt also nie hinein. Sonst spielt der
    // Bot seinen Ball aus der Kammer wieder hinaus.
    const feld = wegfeld(k23);
    let geprueft = 0;
    for (let i = 0; i < feld.entfernung.length; i += 1) {
      if (feld.portalZu[i] < 0) continue;
      const x = (i % feld.spalten) * 0.5 + 0.25;
      const y = Math.floor(i / feld.spalten) * 0.5 + 0.25;
      if (!istInZone(ausgang, x, y)) continue;
      expect(feld.entfernung[i]).toBeGreaterThan(0);
      for (const n of [i + 1, i - 1, i + feld.spalten, i - feld.spalten]) {
        if (feld.frei[n] !== 1 || feld.portalZu[n] >= 0) continue;
        expect(feld.entfernung[n]).toBeLessThan(feld.entfernung[i]);
        geprueft += 1;
      }
    }
    expect(geprueft).toBeGreaterThan(0);
  });

  it('spielt als Genie durch das Portal und locht in der Kammer ein', () => {
    for (const saat of [1, 2, 3, 4, 5, 99, 20260921]) {
      const r = botLoestKarte(k23, 'genie', saat);
      expect(r.geloest).toBe(true);
      expect(r.schlaege).toBeLessThanOrEqual(k23.par + 2);
    }
  });
});

/* --------------------------------------------------------------------------
 * Die fünf Zonenarten, die der Bot bis zum 22.09.2026 für Rasen hielt —
 * Beschleuniger, Bumper, Strudel, Sprungfeld, Drehkreuz. Er rechnet sie
 * nicht nach, er probt sie (`PROBE_ARTEN` in bot.ts). Jede Prüfung hier hält
 * eine Bahn fest, auf der die Probe gemessen etwas gebracht hat, und die
 * Grenze liegt unter dem, was der Bot VOR der Änderung schaffte.
 * ----------------------------------------------------------------------- */

function karteMit(id: string): Karte {
  const karte = KARTEN.find((k) => k.id.startsWith(id));
  if (karte === undefined) throw new Error(`${id} fehlt im Katalog`);
  return karte;
}

/** Mittel der Schläge über zwanzig Saaten, ungelöste zählen wie in der Partie. */
function mittelSchlaege(karte: Karte, stufe: 'genie' | 'experte' | 'standard'): number {
  let summe = 0;
  for (let saat = 1; saat <= 20; saat += 1) {
    const r = botLoestKarte(karte, stufe, saat * 7919);
    summe += r.geloest ? r.schlaege : karte.schlagLimit + 1;
  }
  return summe / 20;
}

describe('Beschleuniger', () => {
  it('spielt k12 durch beide Schübe in zwei Schlägen (vorher 2,90)', () => {
    // Der Genie probt die Kraft, statt sie für Rasen zu halten: Er findet den
    // Schlag, den beide Beschleuniger zusammen bis vors Loch tragen.
    expect(mittelSchlaege(karteMit('k12-'), 'genie')).toBeLessThanOrEqual(2);
  });

  it('bleibt auf k04 beim Ass — der Schlag über die Rückwand bleibt der geplante', () => {
    // Der Befund, mit dem es anfing: Eine „genauere" Rechnung ohne Wände
    // spielte hier 2,75 statt 1,00. Die Probe kennt die Rückwand und behält
    // den Plan, weil keine Abweichung besser ist.
    expect(mittelSchlaege(karteMit('k04-'), 'genie')).toBe(1);
  });

  it('nimmt auf k22 die Linie mit freiem Blick aufs Loch (Experte, vorher 2,55)', () => {
    expect(mittelSchlaege(karteMit('k22-'), 'experte')).toBeLessThanOrEqual(2.1);
  });
});
