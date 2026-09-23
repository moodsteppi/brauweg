import { describe, expect, it } from 'vitest';

import { kraftFuerStrecke, zielImWind } from './bot';
import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import { KARTEN } from './karten';
import { botLoestKarte } from './karten-pruefen';
import {
  type Lochmodifikatoren,
  OHNE_MODIFIKATOR,
  type Rouletteart,
  festerModifikator,
  rouletteFuerLoch,
} from './modifikator';
import {
  BALL_R,
  type Ereignis,
  KLASSISCHE_WERTE,
  type Partiezustand,
  RESTITUTION_WAND,
  neuePartie,
  physikwerte,
  pruefsumme,
  schritt,
  starteLoch,
  zeitlimitS,
} from './physik';
import { betrag } from './zufall';

/*
 * Die Physik je Roulette-Modifikator (Fun-Modus, seit dem 23.09.2026) — nach
 * dem Muster von physik.test.ts: eine leere Prüfbahn, ein Schlag, messen.
 */

function karteMit(teil: Partial<Karte>): Karte {
  return {
    id: 'fun-pruef',
    name: 'Prüfbahn',
    schwierigkeit: 1,
    breite: 12,
    hoehe: 60,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 60,
    abschlaege: [[6, 56]],
    loch: [11, 2],
    waende: [],
    zonen: [],
    ...teil,
  };
}

const FREI = karteMit({});

function starte(karte: Karte, mod: Lochmodifikatoren, sitze = 1): Partiezustand {
  const z = neuePartie({ saat: 7, sitze, botSitze: [], loecher: 1, karten: [karte] });
  starteLoch(z, 0, 0, [karte]);
  z.aktuell.mod = mod;
  return z;
}

function schlag(takt: number, sitz: number, rx: number, ry: number, kraft: number): Ereignis {
  return { takt, sitz, nr: takt, art: 'schlag', rx, ry, kraft };
}

/** Rechnet, bis alle Bälle liegen (höchstens `max` Takte); liefert die Takte. */
function bisRuhe(z: Partiezustand, karte: Karte, ereignisse: Ereignis[], max = 4000): number {
  const start = z.takt;
  for (let i = 0; i < max; i += 1) {
    schritt(z, ereignisse.filter((e) => e.takt === z.takt), [karte]);
    if (i > 2 && z.baelle.every((b) => b.ruht && b.flugTakte === 0)) break;
  }
  return z.takt - start;
}

/** Wie weit rollt ein gerader Schlag nach oben mit dieser Kraft? */
function rollweite(mod: Lochmodifikatoren, kraft: number): { weg: number; takte: number } {
  const z = starte(FREI, mod);
  const takte = bisRuhe(z, FREI, [schlag(0, 0, 0, -1, kraft)]);
  return { weg: 56 - z.baelle[0].y, takte };
}

describe('Physikwerte', () => {
  it('ohne Modifikator ist es der klassische Satz selbst', () => {
    expect(physikwerte(OHNE_MODIFIKATOR, FREI)).toBe(KLASSISCHE_WERTE);
  });

  it('ein Bahnwind macht aus dem klassischen Satz einen eigenen', () => {
    const p = physikwerte(OHNE_MODIFIKATOR, karteMit({ wind: { rx: 1, ry: 0, staerke: 0.5 } }));
    expect(p).not.toBe(KLASSISCHE_WERTE);
    expect(p.windStaerke).toBe(0.5);
  });
});

describe('Regen und Schwerelos', () => {
  it('Regen trägt weiter als Rasen, Schwerelos noch weiter', () => {
    const rasen = rollweite(OHNE_MODIFIKATOR, 0.4).weg;
    const regen = rollweite(festerModifikator('regen'), 0.4).weg;
    const schwerelos = rollweite(festerModifikator('schwerelos'), 0.4).weg;
    expect(regen).toBeGreaterThan(rasen * 1.4);
    expect(schwerelos).toBeGreaterThan(regen * 1.4);
  });

  it('der Bot rechnet das mit: weniger Kraft für dieselbe Strecke', () => {
    const d = 8;
    const rasen = kraftFuerStrecke(FREI, 6, 56, 0, -1, d);
    const regen = kraftFuerStrecke(FREI, 6, 56, 0, -1, d, 0, physikwerte(festerModifikator('regen'), FREI));
    expect(regen).toBeLessThan(rasen);
    // Und die Kraft trifft: Der Ball liegt am Ende eine Handbreit um die Strecke.
    const weg = rollweite(festerModifikator('regen'), regen).weg;
    expect(Math.abs(weg - d)).toBeLessThan(0.3);
  });

  it('schwerelos wirft ein Sprungfeld nur, wer in Sprungrichtung rollt — kein Pendeln', () => {
    const karte = karteMit({
      zonen: [{ art: 'sprungfeld', x: 3, y: 40, w: 6, h: 3, rx: 0, ry: -1, weite: 10 }],
    });
    const z = starte(karte, festerModifikator('schwerelos'));
    // Von oben kommend, also GEGEN die Sprungrichtung: rollt durch.
    z.baelle[0].x = 6;
    z.baelle[0].y = 30;
    z.baelle[0].letzteRuheX = 6;
    z.baelle[0].letzteRuheY = 30;
    const sprungTakte: number[] = [];
    for (let i = 0; i < 300; i += 1) {
      schritt(z, i === 0 ? [schlag(z.takt, 0, 0, 1, 0.3)] : [], [karte]);
      if (z.baelle[0].flugTakte > 0) sprungTakte.push(z.takt);
    }
    expect(sprungTakte).toEqual([]);
  });

  it('schwerelos fliegt ein Sprung anderthalbmal so lang', () => {
    expect(physikwerte(festerModifikator('schwerelos'), FREI).flugTakte).toBe(
      KLASSISCHE_WERTE.flugTakte * 1.5,
    );
  });
});

describe('Zeitlupe', () => {
  it('derselbe Schlag rollt gleich weit, braucht aber doppelt so lang', () => {
    const normal = rollweite(OHNE_MODIFIKATOR, 0.5);
    const lupe = rollweite(festerModifikator('zeitlupe'), 0.5);
    expect(Math.abs(lupe.weg - normal.weg)).toBeLessThan(normal.weg * 0.02);
    expect(lupe.takte).toBeGreaterThan(normal.takte * 1.9);
    expect(lupe.takte).toBeLessThan(normal.takte * 2.1);
  });

  it('das Zeitlimit wächst mit', () => {
    const z = starte(FREI, festerModifikator('zeitlupe'));
    expect(zeitlimitS(z, FREI)).toBe(FREI.zeitLimitS * 2);
    const k = starte(FREI, OHNE_MODIFIKATOR);
    expect(zeitlimitS(k, FREI)).toBe(FREI.zeitLimitS);
  });
});

describe('Riesen- und Miniball', () => {
  /** Ein Ball, der in die obere Wand ragt, wird auf genau seinen Radius hinausgeschoben. */
  function anDerWand(mod: Lochmodifikatoren): number {
    const z = starte(FREI, mod);
    z.baelle[0].y = 0.1;
    schritt(z, [], [FREI]);
    return z.baelle[0].y;
  }

  it('hält seinen eigenen Radius Abstand zur Wand', () => {
    expect(anDerWand(OHNE_MODIFIKATOR)).toBeCloseTo(BALL_R, 9);
    expect(anDerWand(festerModifikator('riesenball'))).toBeCloseTo(BALL_R * 1.5, 9);
    expect(anDerWand(festerModifikator('miniball'))).toBeCloseTo(BALL_R * 0.625, 9);
  });

  it('der Miniball tunnelt nicht: voller Schlag gegen eine dünne Wand', () => {
    const karte = karteMit({ waende: [{ x: 0, y: 30, w: 12, h: 0.3 }] });
    const z = starte(karte, festerModifikator('miniball'));
    for (let i = 0; i < 300; i += 1) schritt(z, i === 0 ? [schlag(0, 0, 0, -1, 1)] : [], [karte]);
    expect(z.baelle[0].y).toBeGreaterThan(30.3);
  });

  it('zwei Riesenbälle stoßen sich auf doppeltem Riesenradius', () => {
    const z = starte(FREI, festerModifikator('riesenball'), 2);
    for (const b of z.baelle) b.geschlagen = true;
    z.baelle[0].x = 6;
    z.baelle[0].y = 30;
    z.baelle[1].x = 6.5;
    z.baelle[1].y = 30;
    schritt(z, [], [FREI]);
    const abstand = betrag(z.baelle[1].x - z.baelle[0].x, z.baelle[1].y - z.baelle[0].y);
    expect(abstand).toBeGreaterThanOrEqual(2 * BALL_R * 1.5 - 1e-9);
  });
});

describe('Gummiwände', () => {
  function abprall(mod: Lochmodifikatoren, rx: number, ry: number): { vorher: number; nachher: number; winkel: number } {
    const karte = karteMit({ breite: 40, hoehe: 20, abschlaege: [[6, 10]], loch: [1.5, 18.5] });
    const z = starte(karte, mod);
    let vorher = 0;
    for (let i = 0; i < 200; i += 1) {
      schritt(z, i === 0 ? [schlag(0, 0, rx, ry, 0.6)] : [], [karte]);
      const b = z.baelle[0];
      if (b.vy < 0) vorher = betrag(b.vx, b.vy);
      else if (vorher > 0) return { vorher, nachher: betrag(b.vx, b.vy), winkel: b.vy / Math.max(1e-9, Math.abs(b.vx)) };
    }
    throw new Error('kein Abprall');
  }

  it('senkrecht: kein Fahrtverlust statt 18 %', () => {
    const klassisch = abprall(OHNE_MODIFIKATOR, 0, -1);
    const gummi = abprall(festerModifikator('gummiwaende'), 0, -1);
    expect(klassisch.nachher / klassisch.vorher).toBeLessThan(RESTITUTION_WAND + 0.05);
    // Gemessen je Takt, also mit ein paar Unterschritten Reibung dazwischen.
    expect(gummi.nachher / gummi.vorher).toBeGreaterThan(klassisch.nachher / klassisch.vorher + 0.1);
    expect(gummi.nachher).toBeLessThanOrEqual(gummi.vorher + 1e-9);
  });

  it('schräg: steiler ab als klassisch, aber nie schneller als davor', () => {
    const klassisch = abprall(OHNE_MODIFIKATOR, 0.6, -0.8);
    const gummi = abprall(festerModifikator('gummiwaende'), 0.6, -0.8);
    expect(gummi.winkel).toBeGreaterThan(klassisch.winkel);
    expect(gummi.nachher).toBeLessThanOrEqual(gummi.vorher + 1e-9);
  });

  it('ein Ball zwischen zwei nahen Gummiwänden kommt zur Ruhe', () => {
    const karte = karteMit({ breite: 3, hoehe: 12, abschlaege: [[1.5, 6]], loch: [1.5, 10.5] });
    const z = starte(karte, festerModifikator('gummiwaende'));
    const takte = bisRuhe(z, karte, [schlag(0, 0, 1, 0, 1)], 3000);
    expect(takte).toBeLessThan(3000);
    expect(z.baelle[0].ruht).toBe(true);
  });
});

describe('Wind', () => {
  const OSTWIND: Lochmodifikatoren = { roulette: 'wind', wind: { rx: 1, ry: 0, staerke: 0.85 } };

  it('treibt einen rollenden Ball ab — und lässt einen liegenden liegen', () => {
    const z = starte(FREI, OSTWIND);
    // 50 Takte ohne Schlag: Der Ball am Abschlag rührt sich nicht.
    for (let i = 0; i < 50; i += 1) schritt(z, [], [FREI]);
    expect(z.baelle[0].x).toBe(6);
    bisRuhe(z, FREI, [schlag(z.takt, 0, 0, -1, 0.7)]);
    expect(z.baelle[0].x).toBeGreaterThan(6.8);
    expect(z.baelle[0].ruht).toBe(true);
  });

  it('nie stärker als die Rollreibung: auch schwerelos kommt der Ball im Wind zur Ruhe', () => {
    const karte = karteMit({ wind: { rx: 0, ry: -1, staerke: 5 } });
    const z = starte(karte, festerModifikator('schwerelos'));
    const takte = bisRuhe(z, karte, [schlag(0, 0, 0, -1, 0.2)], 3000);
    expect(takte).toBeLessThan(3000);
  });

  it('der Bot hält vor: sein Schlag landet trotz Seitenwind am Ziel', () => {
    const p = physikwerte(OSTWIND, FREI);
    const d = 12;
    const s = zielImWind(FREI, p, 6, 56, 0, -1, d);
    expect(s.rx).toBeLessThan(0); // gegen den Wind nach links gehalten
    const z = starte(FREI, OSTWIND);
    bisRuhe(z, FREI, [schlag(0, 0, s.rx, s.ry, s.kraft)]);
    expect(Math.abs(z.baelle[0].x - 6)).toBeLessThan(0.3);
    expect(Math.abs(56 - z.baelle[0].y - d)).toBeLessThan(0.4);
  });
});

describe('Fun-Partie', () => {
  const BAHNEN = ['k01', 'k04', 'k12', 'k26'].map((id) => KARTEN.find((k) => k.id.startsWith(id))!);

  function spiele(modus: 'klassisch' | 'fun', saat: number): { pruef: string; takte: number } {
    const gs = new Gleichschritt({
      saat,
      sitze: 4,
      botSitze: [0, 1, 2, 3],
      loecher: BAHNEN.length,
      karten: BAHNEN,
      botStufe: 'experte',
      modus,
    });
    let takt = 0;
    while (!gs.zustand().fertig && takt < 20_000) {
      takt += 400;
      gs.rechneBis(takt);
    }
    return { pruef: pruefsumme(gs.zustand().ergebnis), takte: gs.zustand().takt };
  }

  it('dieselbe Saat spielt zweimal dieselbe Fun-Partie', () => {
    expect(spiele('fun', 31337)).toEqual(spiele('fun', 31337));
  });

  it('und eine andere als die klassische', () => {
    expect(spiele('fun', 31337)).not.toEqual(spiele('klassisch', 31337));
  });

  it('jedes Loch trägt den Modifikator aus Saat und Lochindex', () => {
    const gs = new Gleichschritt({ saat: 5, sitze: 1, botSitze: [0], loecher: 3, karten: BAHNEN, modus: 'fun' });
    const gesehen: (Rouletteart | null)[] = [];
    let takt = 0;
    while (!gs.zustand().fertig && takt < 20_000) {
      takt += 50;
      gs.rechneBis(takt);
      const z = gs.zustand();
      if (gesehen[z.aktuell.loch] === undefined) gesehen[z.aktuell.loch] = z.aktuell.mod.roulette;
    }
    expect(gesehen).toEqual([0, 1, 2].map((l) => rouletteFuerLoch(5, l)));
  });
});


describe('Bots im Fun-Modus', () => {
  const k01 = KARTEN.find((k) => k.id.startsWith('k01'))!;
  for (const art of ['wind', 'regen', 'riesenball', 'miniball', 'gummiwaende', 'zeitlupe', 'schwerelos'] as const) {
    it(`der Genie locht k01 auch mit ${art} ein`, () => {
      const r = botLoestKarte(k01, 'genie', 0x9017f, festerModifikator(art, 3, 0));
      expect(r.geloest).toBe(true);
      expect(r.schlaege).toBeLessThanOrEqual(k01.schlagLimit);
    });
  }
});
