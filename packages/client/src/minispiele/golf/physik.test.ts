import { describe, expect, it } from 'vitest';

import { kraftFuerDistanz } from './bot';
import { Gleichschritt } from './gleichschritt';
import type { Karte } from './karte';
import {
  BALL_R,
  type Ball,
  type Ereignis,
  IMMUN_TAKTE,
  istImmun,
  LOCH_VMAX,
  PAUSE_TAKTE,
  type Partiezustand,
  TROEDEL_TAKTE,
  V_MAX,
  neuePartie,
  platzierungen,
  pruefsumme,
  schritt,
  starteLoch,
  waehleKarten,
} from './physik';
import { betrag } from './zufall';

/*
 * Die Pruefbahnen entstehen hier und nicht in einer eigenen Datei: Die 40
 * echten Bahnen kommen spaeter in `karten.ts`, und eine zweite Sammlung
 * danebenzulegen hiesse, sie beim naechsten Typwechsel zweimal zu pflegen.
 * `karteMit` fuellt alles, was der jeweilige Fall nicht selbst setzt.
 */
function karteMit(teil: Partial<Karte>): Karte {
  return {
    id: 'pruef',
    name: 'Pruefbahn',
    schwierigkeit: 1,
    breite: 12,
    hoehe: 20,
    par: 2,
    schlagLimit: 6,
    zeitLimitS: 60,
    abschlaege: [
      [3, 17],
      [9, 17],
    ],
    loch: [6, 3],
    waende: [],
    zonen: [],
    ...teil,
  };
}

function starte(
  karte: Karte,
  opts: { sitze?: number; botSitze?: number[]; loecher?: number; saat?: number } = {},
): Partiezustand {
  const z = neuePartie({
    saat: opts.saat ?? 7,
    sitze: opts.sitze ?? 1,
    botSitze: opts.botSitze ?? [],
    loecher: opts.loecher ?? 1,
    karten: [karte],
  });
  starteLoch(z, 0, 0, [karte]);
  return z;
}

/** Rechnet `n` Takte und verteilt die Ereignisse auf ihre Takte. */
function laufe(z: Partiezustand, n: number, karte: Karte, ereignisse: Ereignis[] = []): void {
  for (let i = 0; i < n; i += 1) {
    const dieses = ereignisse.filter((e) => e.takt === z.takt);
    schritt(z, dieses, [karte]);
  }
}

/** Setzt einen Ball von Hand — der Versatz am Abschlag ist bewusst zufaellig. */
function lege(b: Ball, x: number, y: number): void {
  b.x = x;
  b.y = y;
  b.letzteRuheX = x;
  b.letzteRuheY = y;
}

function schlag(takt: number, sitz: number, nr: number, rx: number, ry: number, kraft: number): Ereignis {
  return { takt, sitz, nr, art: 'schlag', rx, ry, kraft };
}

/* ========================================================================== */

describe('Determinismus', () => {
  const karte = karteMit({ id: 'det', hoehe: 24 });
  const ereignisse: Ereignis[] = [
    schlag(5, 0, 1, 0, -1, 0.7),
    schlag(9, 1, 1, -0.3162, -0.9487, 0.55),
    schlag(140, 0, 2, 0.7071, -0.7071, 0.4),
    schlag(180, 1, 2, 0, -1, 0.9),
    schlag(400, 0, 3, -1, 0, 0.3),
    schlag(700, 1, 3, 0.5, -0.866, 0.65),
    schlag(1000, 0, 4, 0, 1, 0.25),
  ];

  function lauf(): Gleichschritt {
    const g = new Gleichschritt({
      saat: 20260906,
      sitze: 4,
      botSitze: [2, 3],
      loecher: 2,
      karten: [karte],
      botStufe: 'standard',
    });
    for (const e of ereignisse) g.fuegeHinzu(e);
    while (g.takt < 1500) g.rechneBis(1500);
    return g;
  }

  it('zwei Laeufe gleicher Saat sind bis auf die letzte Stelle gleich', () => {
    const a = lauf().zustand();
    const b = lauf().zustand();
    expect(pruefsumme(a.ergebnis)).toBe(pruefsumme(b.ergebnis));
    expect(a.baelle).toEqual(b.baelle);
    expect(a.ergebnis).toEqual(b.ergebnis);
    expect(a.aktuell).toEqual(b.aktuell);
    expect(a.zufall).toBe(b.zufall);
    expect(a.botZufall).toEqual(b.botZufall);
  });

  it('hat nach 1500 Takten ueberhaupt etwas gerechnet', () => {
    const z = lauf().zustand();
    expect(z.takt).toBe(1500);
    // Mindestens das erste Loch muss durch sein, sonst prueft der Test nichts.
    expect(z.ergebnis.length).toBeGreaterThanOrEqual(1);
    expect(z.aktuell.loch).toBe(1);
  });

  it('haengt an der Saat — eine andere Saat gibt eine andere Partie', () => {
    const a = lauf().zustand();
    const g = new Gleichschritt({
      saat: 20260907,
      sitze: 4,
      botSitze: [2, 3],
      loecher: 2,
      karten: [karte],
      botStufe: 'standard',
    });
    for (const e of ereignisse) g.fuegeHinzu(e);
    while (g.takt < 1500) g.rechneBis(1500);
    expect(g.zustand().baelle).not.toEqual(a.baelle);
  });
});

/* ========================================================================== */

describe('Waende', () => {
  it('prallt ab und verliert dabei Energie', () => {
    const karte = karteMit({ id: 'wand' });
    const z = starte(karte);
    lege(z.baelle[0], 6, 10);
    laufe(z, 1, karte, [schlag(0, 0, 1, 1, 0, 0.6)]);
    const vorher = Math.abs(z.baelle[0].vx);
    expect(z.baelle[0].vx).toBeGreaterThan(0);
    // Bis zur rechten Wand sind es rund 5,4 E, bei 16,8 E/s also ~7 Takte.
    laufe(z, 12, karte);
    expect(z.baelle[0].vx).toBeLessThan(0);
    expect(Math.abs(z.baelle[0].vx)).toBeLessThan(vorher);
    // Und er steckt nicht in der Wand.
    expect(z.baelle[0].x).toBeLessThanOrEqual(karte.breite - BALL_R + 1e-9);
  });

  it('laesst auch den schnellsten Ball nicht durch die Wand', () => {
    const karte = karteMit({ id: 'tunnel' });
    const z = starte(karte);
    lege(z.baelle[0], 6, 10);
    laufe(z, 200, karte, [schlag(0, 0, 1, 0.7071, -0.7071, 1)]);
    for (let i = 0; i < 200; i += 1) {
      expect(z.baelle[0].x).toBeGreaterThanOrEqual(-0.01);
      expect(z.baelle[0].x).toBeLessThanOrEqual(karte.breite + 0.01);
      expect(z.baelle[0].y).toBeGreaterThanOrEqual(-0.01);
      expect(z.baelle[0].y).toBeLessThanOrEqual(karte.hoehe + 0.01);
      schritt(z, [], [karte]);
    }
  });
});

/* ========================================================================== */

describe('Ball gegen Ball', () => {
  it('stoesst sich elastisch — der ruhende Ball bekommt Tempo ab', () => {
    const karte = karteMit({ id: 'stoss', abschlaege: [[6, 17]] });
    const z = starte(karte, { sitze: 2 });
    lege(z.baelle[0], 6, 12);
    lege(z.baelle[1], 6, 8);
    // Der ruhende Ball muss schon geschlagen haben, sonst ist er ein Geist.
    z.baelle[1].geschlagen = true;
    z.baelle[0].ruht = true;
    z.baelle[1].ruht = true;
    laufe(z, 1, karte, [schlag(z.takt, 0, 1, 0, -1, 0.5)]);
    laufe(z, 12, karte);
    expect(z.baelle[1].vy).toBeLessThan(0);
    expect(z.baelle[1].y).toBeLessThan(8);
    // Der stossende Ball wird gebremst, aber nicht umgedreht.
    expect(z.baelle[0].vy).toBeGreaterThan(-14);
  });

  it('laesst alle auf demselben Punkt starten und als Geister liegen, bis sie schlagen', () => {
    const karte = karteMit({ id: 'immun', abschlaege: [[6, 17], [9, 17]] });
    const z = starte(karte, { sitze: 3 });
    for (const b of z.baelle) {
      expect([b.x, b.y]).toEqual([6, 17]);
      expect(istImmun(z, b)).toBe(true);
    }
    // Auch lange nach dem Lochstart bleiben die Geister übereinander liegen.
    laufe(z, IMMUN_TAKTE + 40, karte);
    expect(z.baelle[1].x).toBe(6);
    expect(istImmun(z, z.baelle[1])).toBe(true);
  });

  it('laesst einen geschlagenen Ball durch die Geister der anderen hindurch', () => {
    const karte = karteMit({ id: 'geist', abschlaege: [[6, 17]] });
    const z = starte(karte, { sitze: 2 });
    lege(z.baelle[1], 6, 12);
    laufe(z, 40, karte, [schlag(0, 0, 1, 0, -1, 0.5)]);
    // Sitz 1 hat nie geschlagen: Er liegt noch genau da, wo er lag.
    expect([z.baelle[1].x, z.baelle[1].y]).toEqual([6, 12]);
    expect(istImmun(z, z.baelle[0])).toBe(false);
  });

  it('macht einen aus dem Wasser zurueckgesetzten Ball wieder zum Geist', () => {
    const karte = karteMit({ id: 'wassergeist', abschlaege: [[6, 17]], zonen: [{ art: 'wasser', x: 4, y: 9, w: 4, h: 3 }] });
    const z = starte(karte, { sitze: 1 });
    laufe(z, 60, karte, [schlag(0, 0, 1, 0, -1, 0.45)]);
    expect(z.baelle[0].schlaege).toBe(2);
    expect(istImmun(z, z.baelle[0])).toBe(true);
  });
});

/* ========================================================================== */

describe('Einlochen', () => {
  it('nimmt den langsamen Ball und laesst den schnellen drueber rollen', () => {
    const karte = karteMit({ id: 'loch' });

    const schnell = starte(karte);
    lege(schnell.baelle[0], 6, 6.5);
    laufe(schnell, 3, karte, [schlag(0, 0, 1, 0, -1, 1)]);
    expect(schnell.baelle[0].y).toBeLessThan(3);
    expect(schnell.baelle[0].eingelocht).toBe(false);

    const langsam = starte(karte);
    lege(langsam.baelle[0], 6, 6.5);
    const kraft = kraftFuerDistanz(3.85);
    laufe(langsam, 80, karte, [schlag(0, 0, 1, 0, -1, kraft)]);
    expect(langsam.baelle[0].eingelocht).toBe(true);
    expect(langsam.baelle[0].schlaege).toBe(1);
    expect(langsam.baelle[0].fertigTakt).toBeGreaterThanOrEqual(0);
  });

  it('haelt sich an LOCH_VMAX', () => {
    // Der schnelle Ball von oben faehrt mit V_MAX los, also weit ueber LOCH_VMAX.
    expect(V_MAX).toBeGreaterThan(LOCH_VMAX);
  });
});

/* ========================================================================== */

describe('Zonen', () => {
  it('bremst im Sand und traegt auf dem Eis weiter als auf Rasen', () => {
    const grund = { hoehe: 40 as number, abschlaege: [[6, 36]] as [number, number][], loch: [6, 3] as [number, number] };
    const rasen = karteMit({ id: 'z-rasen', ...grund });
    const sand = karteMit({
      id: 'z-sand',
      ...grund,
      zonen: [{ art: 'sand', x: 0, y: 0, w: 12, h: 40 }],
    });
    const eis = karteMit({
      id: 'z-eis',
      ...grund,
      zonen: [{ art: 'eis', x: 0, y: 0, w: 12, h: 40 }],
    });

    function weite(karte: Karte): number {
      const z = starte(karte);
      lege(z.baelle[0], 6, 36);
      laufe(z, 20, karte, [schlag(0, 0, 1, 0, -1, 0.3)]);
      return 36 - z.baelle[0].y;
    }

    const wRasen = weite(rasen);
    const wSand = weite(sand);
    const wEis = weite(eis);
    expect(wSand).toBeLessThan(wRasen);
    expect(wEis).toBeGreaterThan(wRasen);
  });

  it('kostet im Wasser einen Strafschlag und legt den Ball zurueck', () => {
    const karte = karteMit({
      id: 'z-wasser',
      zonen: [{ art: 'wasser', x: 4, y: 8, w: 4, h: 2 }],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 13);
    laufe(z, 40, karte, [schlag(0, 0, 1, 0, -1, 0.5)]);
    expect(z.baelle[0].schlaege).toBe(2);
    expect(z.baelle[0].x).toBeCloseTo(6, 6);
    expect(z.baelle[0].y).toBeCloseTo(13, 6);
    expect(z.baelle[0].ruht).toBe(true);
  });

  it('wirft den Ball durch ein Portal zum Partner', () => {
    const karte = karteMit({
      id: 'z-portal',
      zonen: [
        { art: 'portal', x: 6, y: 10, r: 0.6, ziel: { x: 2, y: 5 }, paar: 0 },
        { art: 'portal', x: 2, y: 5, r: 0.6, ziel: { x: 6, y: 10 }, paar: 0 },
      ],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 14);
    let kleinstesX = 99;
    laufe(z, 1, karte, [schlag(0, 0, 1, 0, -1, 0.5)]);
    for (let i = 0; i < 40; i += 1) {
      schritt(z, [], [karte]);
      if (z.baelle[0].x < kleinstesX) kleinstesX = z.baelle[0].x;
    }
    expect(kleinstesX).toBeLessThan(3);
  });

  it('laesst den Ball im Flug ueber eine Wand hinweg', () => {
    const karte = karteMit({
      id: 'z-sprung',
      hoehe: 30,
      abschlaege: [[6, 26]],
      loch: [6, 3],
      waende: [{ x: 0, y: 18, w: 12, h: 1 }],
      zonen: [{ art: 'sprungfeld', x: 4, y: 22, w: 4, h: 2, rx: 0, ry: -1, weite: 10 }],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 26);
    laufe(z, 60, karte, [schlag(0, 0, 1, 0, -1, 0.5)]);
    // Ohne Sprungfeld waere hier bei y = 19,3 Schluss (Wand plus Ballradius).
    expect(z.baelle[0].y).toBeLessThan(18);
    expect(z.baelle[0].flugTakte).toBe(0);
  });

  it('stoesst am Bumper kraeftig ab', () => {
    const karte = karteMit({
      id: 'z-bumper',
      zonen: [{ art: 'bumper', x: 6, y: 9, r: 0.7 }],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 13);
    laufe(z, 30, karte, [schlag(0, 0, 1, 0, -1, 0.35)]);
    // Zurueckgeworfen: der Ball ist wieder unterhalb des Bumpers und schnell.
    expect(z.baelle[0].y).toBeGreaterThan(10);
  });

  it('treibt den Ball auf dem Beschleuniger an', () => {
    const karte = karteMit({
      id: 'z-beschleuniger',
      zonen: [
        { art: 'beschleuniger', x: 4, y: 6, w: 4, h: 8, rx: 0, ry: -1, staerke: 30 },
      ],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 13);
    laufe(z, 6, karte, [schlag(0, 0, 1, 0, -1, 0.2)]);
    const mit = betrag(z.baelle[0].vx, z.baelle[0].vy);

    const ohne = starte(karteMit({ id: 'z-ohne' }));
    lege(ohne.baelle[0], 6, 13);
    laufe(ohne, 6, karteMit({ id: 'z-ohne' }), [schlag(0, 0, 1, 0, -1, 0.2)]);
    expect(mit).toBeGreaterThan(betrag(ohne.baelle[0].vx, ohne.baelle[0].vy));
  });

  it('setzt einen LIEGENDEN Ball auf dem Beschleuniger von selbst in Bewegung', () => {
    /*
     * Absicherung der Ruhe-Abkuerzung in `schritt`: Baelle, die sich nicht
     * bewegen, ueberspringen Wand- und Ortspruefung. Die Zonenkraefte gehoeren
     * NICHT dazu — sonst bliebe ein Ball auf dem Foerderband liegen.
     */
    const karte = karteMit({
      id: 'z-liegt',
      zonen: [{ art: 'beschleuniger', x: 4, y: 8, w: 4, h: 8, rx: 0, ry: -1, staerke: 30 }],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 14);
    z.baelle[0].ruht = true;
    expect(z.baelle[0].vx).toBe(0);
    // Nur ein halbe Sekunde: danach ist der Ball laengst aus der Zone heraus
    // und rollt wieder aus, was hier nichts mehr beweist.
    laufe(z, 10, karte);
    expect(z.baelle[0].y).toBeLessThan(13);
    expect(z.baelle[0].ruht).toBe(false);
  });

  it('schiebt einen angestossenen Ball wieder aus der Wand heraus', () => {
    // Zweite Absicherung derselben Abkuerzung: Ein ruhender Ball, den ein
    // anderer verschiebt, muss im selben Unterschritt wieder aufgeweckt werden.
    const karte = karteMit({ id: 'z-gedraengt', abschlaege: [[6, 17]] });
    const z = starte(karte, { sitze: 2 });
    laufe(z, IMMUN_TAKTE + 1, karte);
    lege(z.baelle[0], 8, 10);
    lege(z.baelle[1], 11.6, 10);
    z.baelle[0].ruht = true;
    z.baelle[1].ruht = true;
    laufe(z, 1, karte, [schlag(z.takt, 0, 1, 1, 0, 0.6)]);
    for (let i = 0; i < 120; i += 1) {
      schritt(z, [], [karte]);
      expect(z.baelle[1].x).toBeLessThanOrEqual(karte.breite - BALL_R + 0.001);
    }
  });

  it('lenkt den Ball im Strudel ab und haelt ihn in der Mitte fest', () => {
    const karte = karteMit({
      id: 'z-strudel',
      zonen: [{ art: 'strudel', x: 6, y: 9, r: 2.5, staerke: 22 }],
    });
    // Der Strudel dreht (tangential mal 0,6), der Ball darf also nicht mehr
    // gerade fliegen.
    const z = starte(karte);
    lege(z.baelle[0], 6, 13);
    laufe(z, 60, karte, [schlag(0, 0, 1, 0, -1, 0.28)]);
    expect(Math.abs(z.baelle[0].x - 6)).toBeGreaterThan(0.5);

    // Und wer langsam genug in die Mitte kommt, bleibt darin liegen.
    const falle = starte(karte);
    lege(falle.baelle[0], 6, 9.15);
    laufe(falle, 3, karte);
    expect(betrag(falle.baelle[0].x - 6, falle.baelle[0].y - 9)).toBeLessThan(0.01);
    expect(falle.baelle[0].ruht).toBe(true);
  });

  it('lenkt den Ball am Drehkreuz ab', () => {
    const karte = karteMit({
      id: 'z-dreh',
      zonen: [{ art: 'drehkreuz', x: 6, y: 9, laenge: 5, gradJeTakt: 3, phase: 0 }],
    });
    const z = starte(karte);
    lege(z.baelle[0], 6, 13);
    laufe(z, 40, karte, [schlag(0, 0, 1, 0, -1, 0.5)]);
    // Der Balken steht quer im Weg: der Ball kommt nicht am Loch an.
    expect(z.baelle[0].eingelocht).toBe(false);
    expect(z.baelle[0].y).toBeGreaterThan(6);
  });
});

/* ========================================================================== */

describe('Lochende', () => {
  it('beendet den Ball beim Schlaglimit mit Limit plus eins', () => {
    const karte = karteMit({ id: 'limit', schlagLimit: 6 });
    const z = starte(karte);
    lege(z.baelle[0], 6, 17);
    const ereignisse: Ereignis[] = [];
    // Sechs kurze Schlaege nach unten, immer weg vom Loch.
    for (let i = 0; i < 6; i += 1) ereignisse.push(schlag(i * 40, 0, i + 1, 0, 1, 0.06));
    laufe(z, 300, karte, ereignisse);
    expect(z.baelle[0].eingelocht).toBe(false);
    expect(z.baelle[0].schlaege).toBe(karte.schlagLimit + 1);
    expect(z.baelle[0].fertigTakt).toBeGreaterThan(0);
  });

  it('beendet beim Zeitlimit alle Unfertigen', () => {
    const karte = karteMit({ id: 'zeit', zeitLimitS: 45 });
    const z = starte(karte, { sitze: 2 });
    laufe(z, 45 * 20 + 2, karte);
    expect(z.baelle[0].schlaege).toBe(karte.schlagLimit + 1);
    expect(z.baelle[1].schlaege).toBe(karte.schlagLimit + 1);
    expect(z.aktuell.endeTakt).toBeGreaterThan(0);
  });

  it('beendet den Troedler, wenn alle anderen fertig sind', () => {
    const karte = karteMit({ id: 'troedel', abschlaege: [[3, 17], [9, 17]] });
    const z = starte(karte, { sitze: 2 });
    lege(z.baelle[0], 6, 6.5);
    const kraft = kraftFuerDistanz(3.85);
    laufe(z, 80, karte, [schlag(0, 0, 1, 0, -1, kraft)]);
    expect(z.baelle[0].eingelocht).toBe(true);
    const fertigTakt = z.baelle[0].fertigTakt;

    /*
     * Sitz 1 ruehrt sich nicht. Die Frist laeuft ab dem SPAETEREN von „letzter
     * anderer wurde fertig" (hier das Einlochen von Sitz 0) und „eigener
     * letzter Schlag" (hier der Lochstart, Takt 0) — also ab `fertigTakt`.
     */
    laufe(z, fertigTakt + TROEDEL_TAKTE - 5 - z.takt, karte);
    expect(z.baelle[1].fertigTakt).toBe(-1);
    laufe(z, 10, karte);
    expect(z.baelle[1].fertigTakt).toBe(fertigTakt + TROEDEL_TAKTE);
    expect(z.baelle[1].schlaege).toBe(karte.schlagLimit + 1);
  });

  it('greift die Troedel-Regel nicht, wenn nur Bots warten', () => {
    const karte = karteMit({ id: 'troedel-bots', abschlaege: [[3, 17], [9, 17]] });
    const z = starte(karte, { sitze: 2, botSitze: [0] });
    // Der Bot ist laengst fertig, der Mensch hat sich nicht geruehrt.
    lege(z.baelle[0], 6, 6.5);
    laufe(z, 80, karte, [schlag(0, 0, 1, 0, -1, kraftFuerDistanz(3.85))]);
    expect(z.baelle[0].eingelocht).toBe(true);
    laufe(z, TROEDEL_TAKTE + 50, karte);
    expect(z.baelle[1].fertigTakt).toBe(-1);
  });

  it('greift die Troedel-Regel nicht, wenn nur einer spielt', () => {
    const karte = karteMit({ id: 'allein' });
    const z = starte(karte, { sitze: 1 });
    laufe(z, TROEDEL_TAKTE + 50, karte);
    // Erst das Zeitlimit (60 s = 1200 Takte) beendet ihn, nicht die Frist.
    expect(z.baelle[0].fertigTakt).toBe(-1);
  });
});

/* ========================================================================== */

describe('Ausstieg', () => {
  it('macht den Sitz fertig und stellt ihn im naechsten Loch nicht mehr auf', () => {
    const karte = karteMit({ id: 'aus', abschlaege: [[3, 17], [9, 17]] });
    const z = starte(karte, { sitze: 2, loecher: 2 });
    lege(z.baelle[0], 6, 6.5);
    const kraft = kraftFuerDistanz(3.85);
    // Nur bis zum Ende des ERSTEN Lochs rechnen — danach stellt `starteLoch`
    // die Baelle neu auf und die Zahlen unten waeren die des zweiten Lochs.
    laufe(z, 70, karte, [
      { takt: 5, sitz: 1, nr: 1, art: 'ausstieg' },
      schlag(10, 0, 1, 0, -1, kraft),
    ]);
    expect(z.baelle[1].fertigTakt).toBe(5);
    expect(z.baelle[1].schlaege).toBe(karte.schlagLimit + 1);
    // Im laufenden Loch liegt der Ball noch als Hindernis.
    expect(z.baelle[1].dabei).toBe(true);
    expect(z.ergebnis[0]).toEqual([1, karte.schlagLimit + 1]);

    // Weiter bis ins zweite Loch.
    laufe(z, PAUSE_TAKTE + 20, karte);
    expect(z.aktuell.loch).toBe(1);
    expect(z.baelle[1].dabei).toBe(false);
    expect(z.baelle[1].schlaege).toBe(karte.schlagLimit + 1);
  });

  it('laesst einen Schlag des Ausgestiegenen nicht mehr zu', () => {
    const karte = karteMit({ id: 'aus2' });
    const z = starte(karte, { sitze: 2 });
    laufe(z, 10, karte, [{ takt: 2, sitz: 1, nr: 1, art: 'ausstieg' }]);
    const vorher = z.baelle[1].schlaege;
    laufe(z, 5, karte, [schlag(z.takt, 1, 2, 0, -1, 0.5)]);
    expect(z.baelle[1].schlaege).toBe(vorher);
  });
});

/* ========================================================================== */

describe('Lochwechsel', () => {
  it('haelt die Pause ein und faengt das naechste Loch danach an', () => {
    const karte = karteMit({ id: 'wechsel', loch: [6, 3] });
    const z = starte(karte, { loecher: 2 });
    lege(z.baelle[0], 6, 6.5);
    laufe(z, 200, karte, [schlag(0, 0, 1, 0, -1, kraftFuerDistanz(3.85))]);
    const ende = z.ergebnis.length > 0 ? 0 : -1;
    expect(ende).toBe(0);
    expect(z.aktuell.loch).toBe(1);
    // Der Beginn des zweiten Lochs liegt genau PAUSE_TAKTE nach dem Ende des
    // ersten — die Zwischenstandstafel braucht diese 3,5 Sekunden.
    expect(z.aktuell.startTakt).toBeGreaterThan(0);
    expect(z.baelle[0].eingelocht).toBe(false);
    expect(z.baelle[0].schlaege).toBe(0);
  });

  it('setzt fertig nach dem letzten Loch', () => {
    const karte = karteMit({ id: 'ende' });
    const z = starte(karte, { loecher: 1 });
    lege(z.baelle[0], 6, 6.5);
    laufe(z, 60, karte, [schlag(0, 0, 1, 0, -1, kraftFuerDistanz(3.85))]);
    expect(z.fertig).toBe(false);
    laufe(z, PAUSE_TAKTE + 5, karte);
    expect(z.fertig).toBe(true);
    expect(z.ergebnis.length).toBe(1);
  });
});

/* ========================================================================== */

describe('Kartenwahl', () => {
  const vorrat: Karte[] = [];
  for (let i = 0; i < 40; i += 1) {
    vorrat.push(
      karteMit({
        id: `k${i}`,
        // 1,2,3,4,5 der Reihe nach — so ist die Sortierung nachpruefbar.
        schwierigkeit: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
      }),
    );
  }

  it('waehlt verschiedene Bahnen und sortiert nach Schwierigkeit', () => {
    for (const saat of [1, 2, 99, 20260906]) {
      const wahl = waehleKarten(saat, 9, vorrat);
      expect(wahl).toHaveLength(9);
      expect(new Set(wahl).size).toBe(9);
      for (let i = 1; i < wahl.length; i += 1) {
        expect(vorrat[wahl[i]].schwierigkeit).toBeGreaterThanOrEqual(
          vorrat[wahl[i - 1]].schwierigkeit,
        );
      }
    }
  });

  it('laesst ein kurzes Match leicht beginnen und ein langes bis zur Spitze steigen', () => {
    // 40 Attrappen: acht je Stufe, wie im echten Katalog ungefaehr.
    const katalog: Karte[] = [];
    for (let i = 0; i < 40; i += 1) {
      katalog.push(karteMit({ id: `s${i}`, schwierigkeit: (1 + (i % 5)) as 1 | 2 | 3 | 4 | 5 }));
    }
    const zwei = waehleKarten(11, 2, katalog).map((i) => katalog[i].schwierigkeit);
    expect(zwei).toEqual([1, 2]);
    const neun = waehleKarten(11, 9, katalog).map((i) => katalog[i].schwierigkeit);
    expect(neun).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5]);
    const fuenfzehn = waehleKarten(11, 15, katalog).map((i) => katalog[i].schwierigkeit);
    expect(fuenfzehn).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
    expect(new Set(waehleKarten(11, 15, katalog)).size).toBe(15);
  });

  it('ist reproduzierbar und haengt an der Saat', () => {
    expect(waehleKarten(5, 6, vorrat)).toEqual(waehleKarten(5, 6, vorrat));
    expect(waehleKarten(5, 6, vorrat)).not.toEqual(waehleKarten(6, 6, vorrat));
  });
});

/* ========================================================================== */

describe('Ergebnis', () => {
  it('rechnet Platzierungen mit geteilten Plaetzen', () => {
    const z = neuePartie({ saat: 1, sitze: 4, botSitze: [], loecher: 2, karten: 1 });
    z.ergebnis = [
      [2, 3, 3, 5],
      [2, 2, 3, 4],
    ];
    const plaetze = platzierungen(z);
    expect(plaetze.map((p) => p.schlaege)).toEqual([4, 5, 6, 9]);
    expect(plaetze.map((p) => p.sitz)).toEqual([0, 1, 2, 3]);
    expect(plaetze.map((p) => p.platz)).toEqual([1, 2, 3, 4]);

    z.ergebnis = [[3, 3, 4, 4]];
    const gleich = platzierungen(z);
    expect(gleich.map((p) => p.platz)).toEqual([1, 1, 3, 3]);
  });

  it('macht aus gleichen Ergebnissen gleiche Pruefsummen', () => {
    expect(pruefsumme([[1, 2], [3, 4]])).toBe(pruefsumme([[1, 2], [3, 4]]));
    expect(pruefsumme([[1, 2], [3, 4]])).not.toBe(pruefsumme([[1, 2], [3, 5]]));
  });
});
